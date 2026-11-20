import type { AnalyticsView } from './routes';

import { getBaseName } from '../utils/baseName';

type Ym = ((counter: number, method: string, ...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
declare global {
    interface Window {
        ym?: Ym;
    }
}

type Config = Readonly<{ enabled: boolean; counterId: number; baseUrl: string }>;
type PendingView = Readonly<{ url: string; title: string; referer: string }>;

/** Ограниченная очередь содержит только нормализованные данные. Ошибки SDK не выходят в UI. */
export const createWebAnalytics = (config: Config) => {
    let state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
    let pending: PendingView[] = [];
    let consent = true;
    let scriptElement: HTMLScriptElement | undefined;
    let previousUrl = new URL(config.baseUrl, window.location.origin).href;
    const enabled = config.enabled && Number.isSafeInteger(config.counterId) && config.counterId > 0;
    const safeBase = new URL(config.baseUrl, window.location.origin).href.replace(/\/$/, '');

    const invoke = (method: 'hit' | 'destruct', ...args: unknown[]) => {
        try {
            window.ym?.(config.counterId, method, ...args);
        } catch {
            /* Блокировщик или SDK не влияют на навигацию. */
        }
    };
    const send = (view: PendingView) =>
        invoke('hit', view.url, {
            title: view.title,
            referer: view.referer,
            params: { client_type: 'web' },
        });
    const fail = () => {
        state = 'failed';
        pending = [];
    };
    const load = () => {
        state = 'loading';
        const script = document.createElement('script');
        scriptElement = script;
        script.async = true;
        script.referrerPolicy = 'no-referrer';
        script.src = 'https://mc.yandex.ru/metrika/tag.js';
        script.dataset.dsbuilderAnalytics = 'true';
        // Стандартный загрузочный stub; hit хранится в нашей ограниченной очереди.
        window.ym =
            window.ym ||
            Object.assign(
                (...args: unknown[]) => {
                    const queue = (window.ym!.a ??= []);
                    if (queue.length >= 33) queue.shift();
                    queue.push(args);
                },
                { l: Date.now() },
            );
        script.onload = () => {
            if (!consent || scriptElement !== script) return;
            try {
                if (!window.ym) return fail();
                window.ym(config.counterId, 'init', {
                    defer: true,
                    clickmap: false,
                    webvisor: false,
                    trackLinks: false,
                    trackHash: false,
                    accurateTrackBounce: false,
                    sendTitle: false,
                    ecommerce: false,
                    disableYtm: true,
                    params: { client_type: 'web' },
                    url: pending[0]?.url || `${safeBase}/projects`,
                    referrer: `${safeBase}/`,
                });
                state = 'ready';
                pending.splice(0).forEach(send);
            } catch {
                fail();
            }
        };
        script.onerror = () => {
            if (scriptElement === script) fail();
        };
        try {
            document.head.appendChild(script);
        } catch {
            fail();
        }
    };
    return {
        setConsent(allowed: boolean) {
            consent = allowed;
            if (!allowed) {
                pending = [];
                scriptElement?.remove();
                scriptElement = undefined;
                if (state === 'ready') invoke('destruct');
                state = 'idle';
                previousUrl = new URL(config.baseUrl, window.location.origin).href;
            }
        },
        view(screen: AnalyticsView) {
            if (!consent || !enabled || state === 'failed') return;
            const view = { url: `${safeBase}${screen.path}`, title: screen.title, referer: previousUrl };
            previousUrl = view.url;
            if (state === 'ready') send(view);
            else {
                pending = [...pending, view].slice(-32);
                if (state === 'idle') load();
            }
        },
    };
};

export const webAnalytics = createWebAnalytics({
    enabled: import.meta.env.VITE_METRICA_ENABLED === 'true',
    counterId: Number(import.meta.env.VITE_METRICA_COUNTER_ID),
    baseUrl: getBaseName(),
});

webAnalytics.setConsent(false);
