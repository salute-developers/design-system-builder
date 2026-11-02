import { subscribeEditorDataInvalidation } from '../../api/draftInvalidationStream';
import { authService } from '../../api/authService';
import { setDraftAutosaveActivity } from '../../api/draftAutosaveActivity';
import type { SizeTokenCommand, SizeTokenContext, SizeTokenRepository } from './application/sizeTokenRepository';
import {
    createSizeTokenSession,
    loadSizeTokens,
    notifySession,
    SIZE_TOKENS_ACTIVITY_SOURCE,
    type SizeTokenSession,
} from './application/session';
import { createHttpSizeTokenRepository } from './data/httpSizeTokenRepository';
import { createLocalPendingSizeTokenCommands } from './data/localPendingSizeTokenCommands';

let repository: SizeTokenRepository = createHttpSizeTokenRepository();
const sessions = new Map<string, SizeTokenSession>();
const subscriptions = new Map<string, () => void>();

const sessionKey = ({ projectId, designSystemId, tenantId, versionId }: SizeTokenContext) =>
    `${projectId}:${designSystemId}:${tenantId}:${versionId ?? ''}`;

const clearSessions = () => {
    sessions.forEach((session) => {
        session.readController?.abort();
        session.autosave.dispose();
        if (!session.context.versionId) setDraftAutosaveActivity(session.context, SIZE_TOKENS_ACTIVITY_SOURCE, null);
    });
    subscriptions.forEach((unsubscribe) => unsubscribe());
    subscriptions.clear();
    sessions.clear();
};
authService.onSessionReset(clearSessions);

/** Подмена порта операций в тестах. */
export const setSizeTokenRepository = (value: SizeTokenRepository) => {
    repository = value;
    clearSessions();
};

/** Сессия раздела темы; создаётся при первом обращении и переиспользуется до смены темы или версии. */
export const sizeTokenSession = (context: SizeTokenContext): SizeTokenSession => {
    const key = sessionKey(context);
    for (const [id, cached] of sessions) {
        if (
            id !== key &&
            !cached.listeners.size &&
            !cached.loading &&
            cached.loadedAt !== undefined &&
            Date.now() - cached.loadedAt >= 300_000 &&
            !cached.autosave.hasUnsaved()
        ) {
            subscriptions.get(id)?.();
            subscriptions.delete(id);
            cached.autosave.dispose();
            sessions.delete(id);
        }
    }
    const existing = sessions.get(key);
    if (existing) return existing;
    const session = createSizeTokenSession(
        context,
        {
            load: (...args) => repository.load(...args),
            command: (...args) => repository.command(...args),
            send: (...args) => repository.send(...args),
        },
        createLocalPendingSizeTokenCommands(context),
    );
    subscriptions.set(
        key,
        subscribeEditorDataInvalidation(context, (scopes, types) => {
            if (types && !types.some((type) => ['shape', 'spacing', 'shadow', 'color', 'gradient'].includes(type)))
                return;
            if (!scopes.size) return;
            session.invalidation++;
            notifySession(session);
        }),
    );
    sessions.set(key, session);
    return session;
};

/** Перечитывает раздел темы после отправки его очереди. */
export const reloadSizeTokens = (session: SizeTokenSession) => loadSizeTokens(session, repository);

const REPLAY_ORDER: Record<SizeTokenCommand['operation'], number> = { create: 0, update: 1, delete: 2 };

/**
 * Повторяет неподтверждённые команды `size-tokens`, сохранённые в `localStorage` темы до перезагрузки, той же
 * командой: тем же телом с `platforms`, базовыми редакциями и ключом повторяемости. Вызывается при открытии темы,
 * поэтому повтор не ждёт, пока пользователь откроет раздел. В общую запись значений токена (`ds_draft`) команды не
 * переводятся: в ней нет признака своего значения платформы.
 */
export const restorePendingSizeTokenCommands = (context: SizeTokenContext) => {
    if (context.versionId) return;
    const pending = createLocalPendingSizeTokenCommands(context).list();
    if (!pending.length) return;
    const session = sizeTokenSession(context);
    pending
        .sort((left, right) => REPLAY_ORDER[left.command.operation] - REPLAY_ORDER[right.command.operation])
        .forEach(({ key, command }) => session.autosave.replay(key, command));
};
