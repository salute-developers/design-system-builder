import { useEffect, useMemo, useReducer, useRef } from 'react';

import type { DesignSystem, Theme } from '../../controllers';
import { authService } from '../../api/authService';
import { recordDraftSave, reloadWhenDraftAutosaveIsIdle, setDraftAutosaveActivity } from '../../api/draftAutosaveActivity';
import { tokenValueKey } from '../../api/editorHttp';
import { observeTokenValueRevisions } from '../../api/subjectRevisions';
import {
    applyStyleChange,
    applyUpdatedStyle,
    createHttpTypographyStyleRepository,
    createTypographyAutosave,
    styleKey,
    styleValueAddresses,
    styleValueRevisions,
    validateChange,
    type TypographyAutosave,
    type TypographyContext,
    type TypographyField,
    type TypographyOverridePlatform,
    type TypographyScreen,
    type TypographyStyle,
    type TypographyStyleChange,
    type TypographyStyleRepository,
    type TypographyStyles,
    type UpdatedTypographyStyle,
} from '../../modules/typographyTokens';

/** Источник очереди типографии в общем состоянии автосохранения редактора. */
const ACTIVITY_SOURCE = 'typography';

/** Ключ правки в очереди: стиль на экране. */
export const queueKey = (screen: TypographyScreen, key: string, platform?: TypographyOverridePlatform) =>
    platform ? `${screen}|${key}|${platform}` : `${screen}|${key}`;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Сессия типографии темы: живёт дольше экрана, чтобы очередь сохранения пережила перемонтирование (перезагрузку
 * темы, уход в другой раздел и возврат).
 */
interface TypographySession {
    context: TypographyContext;
    autosave: TypographyAutosave;
    saved: TypographyStyles | null;
    loadError: string | null;
    /** Номер последнего запущенного чтения: ответ устаревшего чтения не заменяет более нового. */
    loads: number;
    /** Ошибки значений у полей: `<экран>|<стиль>|<поле>` → текст. */
    fieldErrors: Record<string, string>;
    /** Тема и перерисовка открытого экрана. */
    live: { theme: Theme | null; rerender: () => void };
    listeners: Set<() => void>;
}

let repository: TypographyStyleRepository = createHttpTypographyStyleRepository();
const sessions = new Map<string, TypographySession>();

const clearSessions = () => {
    sessions.forEach((session) => {
        session.autosave.dispose();
        if (!session.context.versionId) setDraftAutosaveActivity(session.context, ACTIVITY_SOURCE, null);
    });
    sessions.clear();
};
authService.onSessionReset(clearSessions);

/** Подмена порта стилей в тестах. */
export const setTypographyStyleRepository = (value: TypographyStyleRepository) => {
    repository = value;
    clearSessions();
};

const notify = (session: TypographySession) => session.listeners.forEach((listener) => listener());

/** Технические редакции прочитанных значений становятся базовыми редакциями следующих правок. */
const observeRevisions = (session: TypographySession, styles: TypographyStyles) => {
    const tokenValueRevisionsByKey: Record<string, number> = {};
    const tokenValueEntityIdsByKey: Record<string, string> = {};
    styleValueRevisions(styles).forEach(({ tokenId, platform, valueId, revision }) => {
        const key = tokenValueKey(tokenId, platform, null);
        tokenValueRevisionsByKey[key] = revision;
        tokenValueEntityIdsByKey[key] = valueId;
    });
    observeTokenValueRevisions(session.context, { tokenValueRevisionsByKey, tokenValueEntityIdsByKey });
};

/** Перечитывает стили после отправки очереди: ответ чтения не опережает отправленные правки. */
const load = async (session: TypographySession) => {
    await session.autosave.flush();
    const current = ++session.loads;
    try {
        const styles = await repository.load(session.context);
        if (current !== session.loads) return;
        observeRevisions(session, styles);
        session.saved = styles;
        session.loadError = null;
    } catch (error) {
        if (current !== session.loads) return;
        session.loadError = errorText(error);
    }
    notify(session);
};

/** Записанные значения токенов стиля переносятся в модель темы, чтобы другие разделы видели новую типографию. */
const applyToTheme = (theme: Theme | null, result: UpdatedTypographyStyle) => {
    for (const token of result.tokens) {
        const target = theme?.getToken(token.name, 'typography');
        if (!target) continue;
        for (const { platform, value } of token.values) {
            const fields = Array.isArray(value) ? value[0] : value;
            if (fields && typeof fields === 'object') target.setValue(platform as never, fields as never);
        }
    }
};

const applySaved = (session: TypographySession, result: UpdatedTypographyStyle, change: TypographyStyleChange) => {
    if (session.saved) session.saved = applyUpdatedStyle(session.saved, result.style, change);
    applyToTheme(session.live.theme, result);
    session.live.rerender();
};

const sessionKey = ({ projectId, designSystemId, tenantId, versionId }: TypographyContext) =>
    `${projectId}:${designSystemId}:${tenantId}:${versionId ?? ''}`;

const typographySession = (context: TypographyContext): TypographySession => {
    const id = sessionKey(context);
    const existing = sessions.get(id);
    if (existing) return existing;
    const session: TypographySession = {
        context,
        autosave: undefined as unknown as TypographyAutosave,
        saved: null,
        loadError: null,
        loads: 0,
        fieldErrors: {},
        live: { theme: null, rerender: () => undefined },
        listeners: new Set(),
    };
    session.autosave = createTypographyAutosave({
        repository: { load: (...args) => repository.load(...args), update: (...args) => repository.update(...args) },
        context,
        onChange: () => {
            // Общий индикатор, публикация и перечитывание по сигналу ждут подтверждения очереди типографии.
            if (!context.versionId)
                setDraftAutosaveActivity(context, ACTIVITY_SOURCE, session.autosave.overall().state);
            notify(session);
        },
        onSaved: (_, result, change) => {
            applySaved(session, result, change);
            recordDraftSave(context);
        },
        onRejected: (key, error) => {
            session.fieldErrors = { ...session.fieldErrors, [`${key}|${error.field ?? 'size'}`]: error.message };
        },
    });
    sessions.set(id, session);
    return session;
};

interface EditorInput {
    context: TypographyContext;
    designSystem: DesignSystem;
    theme: Theme;
    rerender: () => void;
    /** Раздел только для чтения: опубликованная версия, роль без права правки или архивный проект. */
    readOnly: boolean;
}

/** Раздел «Типографика»: стили темы, правки с автосохранением и перечитывание после изменений в другом месте. */
export const useTypographyEditor = ({ context, theme, rerender, readOnly }: EditorInput) => {
    const session = useMemo(
        () => typographySession(context),
        [context.projectId, context.designSystemId, context.tenantId, context.versionId],
    );
    session.live = { theme, rerender };
    const [version, refresh] = useReducer((value: number) => value + 1, 0);

    useEffect(() => {
        session.listeners.add(refresh);
        void load(session);
        return () => {
            session.listeners.delete(refresh);
        };
    }, [session]);

    // Новая модель темы — сигнал об изменении черновика в другом месте: стили перечитываются после локальных очередей.
    const loadedTheme = useRef(theme);
    useEffect(() => {
        if (loadedTheme.current === theme) return;
        loadedTheme.current = theme;
        return reloadWhenDraftAutosaveIsIdle(session.context, () => void load(session));
    }, [session, theme]);

    // Уход со страницы: очередь отправляется сразу, а несохранённые правки предупреждают браузер.
    useEffect(() => {
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (!session.autosave.hasUnsaved()) return;
            void session.autosave.flush();
            event.preventDefault();
        };
        window.addEventListener('beforeunload', beforeUnload);
        return () => {
            window.removeEventListener('beforeunload', beforeUnload);
            void session.autosave.flush();
        };
    }, [session]);

    /** Стили для показа: сохранённые значения и правки, которые ещё не сохранены. */
    const styles = useMemo(() => {
        if (!session.saved) return null;
        return session.autosave.entries().reduce((current, { key, change }) => {
            const [screen, style] = key.split('|') as [TypographyScreen, string];
            return applyStyleChange(current, style, screen, change);
        }, session.saved);
        // Сессия меняется на месте, `version` отмечает её изменения.
    }, [session, version, session.saved]);

    const fieldError = (style: TypographyStyle, field: TypographyField, platform?: TypographyOverridePlatform) =>
        session.fieldErrors[`${queueKey(style.screen, styleKey(style), platform)}|${field}`] ?? null;

    /** Правка стиля: недопустимое значение показывается у поля и не отправляется. */
    const edit = (style: TypographyStyle, change: TypographyStyleChange) => {
        if (readOnly || session.context.versionId) return;
        const key = queueKey(style.screen, styleKey(style), change.platform);
        const fields = Object.keys(change)
            .filter((field) => field !== 'platform')
            .flatMap((field) =>
                field === 'weights'
                    ? Object.keys(change.weights ?? {}).map((variant) => `weights.${variant}`)
                    : [field],
            );
        const violation = validateChange(change);
        const next = { ...session.fieldErrors };
        fields.forEach((field) => delete next[`${key}|${field}`]);
        if (violation) next[`${key}|${violation.field}`] = violation.message;
        session.fieldErrors = next;
        const tokenId = Object.values(style.variants).find(Boolean)?.tokenId;
        if (!violation && tokenId) {
            session.autosave.schedule(key, tokenId, change, styleValueAddresses(session.saved, styleKey(style)));
        } else notify(session);
    };

    return {
        styles,
        loadError: session.loadError,
        status: session.autosave.overall(),
        edit,
        retry: () => session.autosave.retry(),
        fieldError,
        reload: () => load(session),
    };
};
