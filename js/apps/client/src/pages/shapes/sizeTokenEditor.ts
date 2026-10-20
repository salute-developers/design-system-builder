import type { DesignSystem, Theme } from '../../controllers';
import {
    applyToTheme,
    createHttpSizeTokenRepository,
    createSizeTokenAutosave,
    deletedTogether,
    legacyDraftOperations,
    legacySizeEntries,
    removeFromTheme,
    tokenValue,
    withValue,
    SizeTokenOperationError,
    type CreateSizeTokenRequest,
    type SizeToken,
    type SizeTokenAutosave,
    type SizeTokenContext,
    type SizeTokenRepository,
    type SizeTokens,
    type SizeTokenValue,
} from '../../modules/sizeTokens';
import { draftEntriesOfTypes, removeDraftEntries } from '../../utils/designSystemDraft';

/** Сессия раздела темы: живёт дольше экрана, чтобы пережить перезагрузку темы и смену раздела. */
export interface SizeTokenSession {
    context: SizeTokenContext;
    autosave: SizeTokenAutosave;
    /** Последний ответ чтения с применёнными ответами операций — сохранённые значения. */
    data: SizeTokens | null;
    loading: boolean;
    loadError: string | null;
    /** Несохранённые значения токенов по `tokenId`: их видит пользователь, пока очередь не отправит их. */
    edits: Map<string, SizeTokenValue>;
    /** Конфликт ревизии, после которого раздел перечитан; сбрасывается «Повторить». */
    conflict: SizeTokenOperationError | null;
    theme: Theme | null;
    designSystem: DesignSystem | null;
    /** Модель темы изменилась: другие разделы перечитывают значения. */
    onModelChange: () => void;
    /** Перезагрузка темы целиком: после отброшенного черновика. */
    reloadTheme: () => void;
    listeners: Set<() => void>;
}

const sessions = new Map<string, SizeTokenSession>();
const sessionKey = ({ projectId, designSystemId, tenantId }: SizeTokenContext) =>
    `${projectId}:${designSystemId}:${tenantId}`;

let repository: SizeTokenRepository = createHttpSizeTokenRepository();

/** Подмена порта операций в тестах. */
export const setSizeTokenRepository = (value: SizeTokenRepository) => {
    repository = value;
    sessions.forEach((session) => session.autosave.dispose());
    sessions.clear();
};

const notify = (session: SizeTokenSession) => session.listeners.forEach((listener) => listener());

const replaceToken = (session: SizeTokenSession, token: SizeToken) => {
    if (!session.data) return;
    session.data = {
        ...session.data,
        tokens: session.data.tokens.map((item) => (item.tokenId === token.tokenId ? token : item)),
    };
};

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Перечитывает раздел; ревизия темы только растёт — ответ чтения, начатого до операции, её не откатывает. */
export const loadSizeTokens = async (session: SizeTokenSession) => {
    session.loading = true;
    notify(session);
    try {
        const data = await repository.load(session.context);
        session.data = data;
        session.loadError = null;
        const parameters = session.designSystem?.getParameters();
        if (parameters) parameters.editRevision = Math.max(parameters.editRevision ?? 0, data.editRevision);
    } catch (error) {
        session.loadError = errorText(error);
    } finally {
        session.loading = false;
        notify(session);
    }
};

/** Сессия темы; создаётся при первом открытии раздела и переиспользуется до смены темы. */
export const sizeTokenSession = (context: SizeTokenContext): SizeTokenSession => {
    const key = sessionKey(context);
    const existing = sessions.get(key);
    if (existing) return existing;
    const session: SizeTokenSession = {
        context,
        data: null,
        loading: false,
        loadError: null,
        edits: new Map(),
        conflict: null,
        theme: null,
        designSystem: null,
        onModelChange: () => undefined,
        reloadTheme: () => undefined,
        listeners: new Set(),
        autosave: undefined as unknown as SizeTokenAutosave,
    };
    session.autosave = createSizeTokenAutosave({
        repository: { updateValue: (...args) => repository.updateValue(...args) },
        context,
        revision: {
            get: () => session.designSystem?.getParameters()?.editRevision ?? session.data?.editRevision ?? 0,
            set: (value) => {
                const parameters = session.designSystem?.getParameters();
                if (parameters) parameters.editRevision = value;
                if (session.data) session.data = { ...session.data, editRevision: value };
            },
        },
        onChange: () => notify(session),
        onSaved: (key, result, latest) => {
            replaceToken(session, result.token);
            if (latest) session.edits.delete(key);
            if (session.theme) applyToTheme(session.theme, result.token, result.values);
            session.onModelChange();
        },
        onConflict: (error) => {
            // Тема изменена в другом месте: раздел перечитывается, несохранённые значения остаются в сессии,
            // повторная отправка — только по «Повторить».
            session.conflict = error;
            notify(session);
            void loadSizeTokens(session);
        },
    });
    sessions.set(key, session);
    return session;
};

/** Редактор раздела: правки ставятся в очередь автосохранения, ответы операций обновляют модель темы. */
export const createSizeTokenEditor = (session: SizeTokenSession) => {
    const saved = (tokenId: string) => session.data?.tokens.find((token) => token.tokenId === tokenId) ?? null;

    const schedule = (tokenId: string) =>
        session.autosave.schedule(tokenId, () => {
            const value = session.edits.get(tokenId);
            return value ? { tokenId, value } : null;
        });

    const draftName = () => session.designSystem?.getName() || '';

    return {
        /** Токены с несохранёнными значениями — то, что видно в инспекторе. */
        tokens(): SizeToken[] {
            return (session.data?.tokens ?? []).map((token) => withValue(token, session.edits.get(token.tokenId)));
        },

        /**
         * Токены для дерева и борда: значение, отклонённое проверкой сервера, не показывается — там остаётся
         * последнее сохранённое.
         */
        shownTokens(): SizeToken[] {
            return (session.data?.tokens ?? []).map((token) => {
                const status = session.autosave.status(token.tokenId);
                return status.state === 'error' && status.error?.kind === 'invalid'
                    ? token
                    : withValue(token, session.edits.get(token.tokenId));
            });
        },

        /** Текущее значение токена с несохранёнными правками. */
        value(tokenId: string): SizeTokenValue | null {
            const token = saved(tokenId);
            return session.edits.get(tokenId) ?? (token ? tokenValue(token) : null);
        },

        /** Новое значение токена из текущего: правка ставится в очередь автосохранения. */
        update(tokenId: string, change: (value: SizeTokenValue) => SizeTokenValue) {
            const current = this.value(tokenId);
            if (!current) return;
            session.edits.set(tokenId, change(current));
            schedule(tokenId);
            notify(session);
        },

        /** Создаёт радиус, отступ или размер тени после отправки очереди и добавляет их в раздел и модель темы. */
        async create(request: CreateSizeTokenRequest): Promise<SizeToken[]> {
            const created = await session.autosave.run((editRevision) =>
                repository
                    .create(session.context, request, editRevision)
                    .then((result) => ({ editRevision: result.editRevision, value: result.created })),
            );
            if (session.data) session.data = { ...session.data, tokens: [...session.data.tokens, ...created] };
            if (session.theme) created.forEach((token) => applyToTheme(session.theme!, token));
            session.onModelChange();
            notify(session);
            return created;
        },

        /** Удаляет токен (у тени — размер целиком) после отправки очереди. */
        async remove(token: SizeToken) {
            const together = deletedTogether(session.data?.tokens ?? [], token);
            const ids = await session.autosave.run((editRevision) =>
                repository
                    .delete(session.context, token.tokenId, editRevision)
                    .then((result) => ({ editRevision: result.editRevision, value: result.deletedTokenIds })),
            );
            const deleted = new Set(ids?.length ? ids : together.map((item) => item.tokenId));
            const removed = (session.data?.tokens ?? []).filter((item) => deleted.has(item.tokenId));
            removed.forEach((item) => {
                session.autosave.forget(item.tokenId);
                session.edits.delete(item.tokenId);
            });
            if (session.data)
                session.data = {
                    ...session.data,
                    tokens: session.data.tokens.filter((item) => !deleted.has(item.tokenId)),
                };
            if (session.theme) removeFromTheme(session.theme, removed);
            session.onModelChange();
            notify(session);
        },

        /** Записи радиусов, отступов и теней прежнего черновика темы. */
        legacyDraft() {
            return legacySizeEntries(draftEntriesOfTypes(draftName(), '0.1.0', ['shape', 'spacing', 'shadow']));
        },

        /** Сохраняет записи прежнего черновика операциями над токенами и удаляет из черновика только их. */
        async saveLegacyDraft() {
            const entries = this.legacyDraft();
            const theme = session.theme;
            const operations = legacyDraftOperations(entries, session.data?.tokens ?? [], (name, type, platform) =>
                theme?.getToken(name, type as 'shape')?.getValue(platform as never),
            );
            operations.updates.forEach(({ tokenId, value }) => {
                session.edits.set(tokenId, value);
                schedule(tokenId);
            });
            for (const request of operations.creates) await this.create(request);
            await session.autosave.flush();
            // Отправка очереди ошибок не бросает: о несохранённых правках говорит её состояние. Черновик
            // очищается только после успешной отправки, иначе его можно сохранить снова.
            const result = session.autosave.overall();
            if (result.state === 'error') throw result.error ?? new Error('Часть правок не сохранена');
            removeDraftEntries(
                draftName(),
                '0.1.0',
                entries.map((entry) => entry.name),
            );
            notify(session);
        },

        /** Отбрасывает записи прежнего черновика и перечитывает тему без них. */
        discardLegacyDraft() {
            removeDraftEntries(
                draftName(),
                '0.1.0',
                this.legacyDraft().map((entry) => entry.name),
            );
            session.reloadTheme();
        },

        /** «Повторить»: снимает отметку конфликта и отправляет несохранённые токены. */
        retry(tokenId?: string) {
            session.conflict = null;
            session.autosave.retry(tokenId);
            notify(session);
        },

        reload: () => loadSizeTokens(session),
    };
};

export type SizeTokenEditor = ReturnType<typeof createSizeTokenEditor>;
