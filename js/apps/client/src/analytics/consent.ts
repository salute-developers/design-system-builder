import { API_GATEWAY_URL } from '../api/constants';
import { authService } from '../api/authService';

type Decision = 'granted' | 'denied' | 'withdrawn';
type Policy = { version: string; sha256: string; text: string };
type Receipt = {
    revision: number;
    decision: Decision;
    policy_version: string;
    policy_sha256: string;
    received_at: string;
};
type Response = {
    policy: Policy;
    current: { revision: number; analytics_allowed: boolean; receipt: Receipt | null };
    receipt?: Receipt;
};
type Saved = {
    key: string;
    decision?: Decision;
    revision: number;
    receipt?: Receipt;
    pending?: {
        request_id: string;
        decision: Decision;
        expected_revision: number;
        policy_version?: string;
        policy_sha256?: string;
    };
};
type State = { allowed: boolean; choice?: Decision; policy?: Policy; busy: boolean; error: boolean; saving?: Decision };

type ConsentLock = <T>(operation: () => T) => Promise<T>;

/** Записи между вкладками сериализуются; сеть всегда выполняется вне блокировки. */
export const createAnalyticsConsent = (
    storage: Storage,
    storageKey: string | (() => string | undefined),
    request: typeof fetch,
    synchronize: ConsentLock = async (operation) => operation(),
) => {
    let state: State = { allowed: false, busy: false, error: false };
    let startup: Promise<void> | undefined;
    let generation = 0;
    const resolveStorageKey = () => (typeof storageKey === 'string' ? storageKey : storageKey());
    let activeStorageKey = typeof storageKey === 'string' ? storageKey : undefined;
    const isCurrent = (ticket: number) => ticket === generation && activeStorageKey === resolveStorageKey();
    const requireStorageKey = () => {
        if (!activeStorageKey) throw new Error('Missing consent account scope');
        return activeStorageKey;
    };
    const listeners = new Set<() => void>();
    const publish = (patch: Partial<State>) => {
        state = { ...state, ...patch };
        listeners.forEach((listener) => listener());
    };
    const read = (key = requireStorageKey()): Saved | undefined => {
        const value = JSON.parse(storage.getItem(key) || 'null');
        if (!value) return undefined;
        const valid = [
            /^[a-f0-9]{64}$/.test(value.key),
            Number.isSafeInteger(value.revision),
            value.revision >= 0,
            !value.decision || ['granted', 'denied', 'withdrawn'].includes(value.decision),
        ].every(Boolean);
        return valid ? value : undefined;
    };
    const create = (): Saved => ({
        key: Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join(
            '',
        ),
        revision: 0,
    });
    const same = (left: Saved | undefined, right: Saved | undefined) => JSON.stringify(left) === JSON.stringify(right);
    const write = (saved: Saved, key = requireStorageKey()) => {
        storage.setItem(key, JSON.stringify(saved));
        return saved;
    };
    const load = () => {
        const key = requireStorageKey();
        return synchronize(() => read(key) || write(create(), key));
    };
    const commit = <T>(expected: Saved, ticket: number, operation: () => T) =>
        synchronize(() => {
            if (!isCurrent(ticket) || !same(read(), expected)) return undefined;
            return operation();
        });
    const api = (saved: Saved, body?: object) => {
        const path = `${API_GATEWAY_URL}/api/privacy/analytics/consent`;
        const { url, ...operation } = body
            ? {
                  url: path,
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...body, client_group: 'web' }),
              }
            : { url: `${path}?client_group=web`, method: 'GET', headers: {} };
        return request(url, {
            ...operation,
            credentials: 'omit',
            redirect: 'error',
            cache: 'no-store',
            headers: { 'X-Consent-Key': saved.key, ...operation.headers },
            signal: AbortSignal.timeout(5000),
        });
    };
    const decode = async (response: globalThis.Response): Promise<Response> => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
    };
    const fetchState = async (saved: Saved) => decode(await api(saved));
    // Общий жизненный цикл действий UI: старый ответ не меняет новый выбор.
    const perform = async (ticket: number, operation: () => Promise<void>, finishBusy = true) => {
        try {
            await operation();
        } catch {
            if (isCurrent(ticket)) publish({ error: true, allowed: false });
        } finally {
            if (finishBusy && isCurrent(ticket)) publish({ busy: false, saving: undefined });
        }
    };
    const apply = (saved: Saved, response: Response, ticket: number, record: boolean) =>
        commit(saved, ticket, () => {
            if (record && !response.receipt) throw new Error('Missing receipt');
            const updated: Saved = { ...saved, revision: response.current.revision };
            if (record) {
                updated.receipt = response.receipt;
                delete updated.pending;
            }
            write(updated);
            const allowed = saved.decision === 'granted' && response.current.analytics_allowed;
            publish({
                policy: response.policy,
                allowed,
                choice: allowed ? 'granted' : record ? saved.decision : undefined,
            });
            return updated;
        });
    const sync = async (saved: Saved, ticket: number) => {
        const pending = saved.pending;
        if (!pending || !isCurrent(ticket)) return;
        let response = await api(saved, pending);
        if (response.status === 409) {
            if (!isCurrent(ticket)) return;
            const current = await fetchState(saved);
            if (!isCurrent(ticket)) return;
            const updated: Saved = { ...saved, revision: current.current.revision };
            if (pending.decision === 'granted') {
                delete updated.pending;
                delete updated.decision;
                await commit(saved, ticket, () => {
                    write(updated);
                    publish({ policy: current.policy, choice: undefined });
                });
                throw new Error('Read the current notice before a new grant');
            }
            updated.pending = {
                request_id: crypto.randomUUID(),
                decision: pending.decision,
                expected_revision: current.current.revision,
            };
            const changed = await commit(saved, ticket, () => write(updated));
            if (!changed) return;
            saved = changed;
            response = await api(saved, saved.pending);
        }
        return apply(saved, await decode(response), ticket, true);
    };
    const review = async (ticket: number) => {
        const saved = await load();
        if (!isCurrent(ticket)) return;
        const response = await fetchState(saved);
        await commit(saved, ticket, () => {
            write({ ...saved, revision: response.current.revision });
            publish({ policy: response.policy });
        });
    };
    const start = () => {
        if (startup) return startup;
        const ticket = generation;
        startup = perform(
            ticket,
            async () => {
                activeStorageKey = resolveStorageKey();
                const saved = await load();
                if (!isCurrent(ticket)) return;
                publish({ choice: saved.decision });
                if (saved.pending) {
                    await sync(saved, ticket);
                    return;
                }
                if (['denied', 'withdrawn'].includes(saved.decision ?? '')) return;
                await apply(saved, await fetchState(saved), ticket, false);
            },
            false,
        );
        return startup;
    };
    return {
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        getSnapshot: () => state,
        start,
        async choose(decision: Decision) {
            const ticket = ++generation;
            const displayed = state.policy;
            publish({ allowed: false, choice: decision, busy: true, error: false, saving: decision });
            await perform(ticket, async () => {
                if (decision === 'granted' && !displayed) {
                    await review(ticket);
                    publish({ choice: undefined });
                    return;
                }
                let expected = read();
                if (decision === 'granted' && expected?.pending && expected.pending.decision !== 'granted') {
                    const resolved = await sync(expected, ticket);
                    if (!resolved || !isCurrent(ticket)) return;
                    expected = resolved;
                    if (displayed!.version !== state.policy?.version || displayed!.sha256 !== state.policy?.sha256) {
                        publish({ choice: undefined });
                        return;
                    }
                }
                const saved = await synchronize(() => {
                    if (!isCurrent(ticket)) return undefined;
                    const latest = read();
                    if (decision === 'granted' && !same(latest, expected)) return undefined;
                    const current = latest || create();
                    // Неопределённый POST сначала повторяется с исходным request_id.
                    if (decision === 'granted' && current.pending?.decision === 'granted') return current;
                    return write({
                        ...current,
                        decision,
                        pending: {
                            request_id: crypto.randomUUID(),
                            decision,
                            expected_revision: current.revision,
                            ...(decision === 'granted'
                                ? { policy_version: displayed!.version, policy_sha256: displayed!.sha256 }
                                : {}),
                        },
                    });
                });
                if (saved) await sync(saved, ticket);
            });
        },
        async review() {
            const ticket = generation;
            await start();
            if (!isCurrent(ticket) || state.policy || state.saving) return;
            publish({ busy: true, error: false });
            await perform(ticket, () => review(ticket));
        },
        stop() {
            ++generation;
            startup = undefined;
            activeStorageKey = undefined;
            publish({
                allowed: false,
                choice: undefined,
                policy: undefined,
                busy: false,
                error: false,
                saving: undefined,
            });
        },
        changed() {
            ++generation;
            try {
                publish({ allowed: false, choice: read()?.decision, busy: false, saving: undefined });
            } catch {
                publish({ allowed: false, error: true });
            }
        },
    };
};

export const analyticsConsentEnabled =
    import.meta.env.VITE_METRICA_ENABLED === 'true' &&
    Boolean(navigator.locks) &&
    Number.isSafeInteger(Number(import.meta.env.VITE_METRICA_COUNTER_ID)) &&
    Number(import.meta.env.VITE_METRICA_COUNTER_ID) > 0;
const consentStorageKey = `dsbuilder.analytics-consent:${import.meta.env.MODE}:${API_GATEWAY_URL}:${import.meta.env.VITE_METRICA_COUNTER_ID}`;
/** Выбор изолирован для аккаунта, браузера и окружения; прежняя общая запись не используется. */
export const getConsentStorageKey = () => {
    const accountId = authService.getCurrentUser()?.id;
    return accountId ? `${consentStorageKey}:user:${encodeURIComponent(accountId)}` : undefined;
};
export const analyticsConsent = createAnalyticsConsent(
    {
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
    } as Storage,
    getConsentStorageKey,
    (...args) => fetch(...args),
    (operation) => navigator.locks.request(getConsentStorageKey() || consentStorageKey, operation),
);
