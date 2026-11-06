import { useEffect, useMemo, useReducer } from 'react';

import type { DesignSystem, Theme } from '../../controllers';
import { subscribeEditorDataInvalidation } from '../../api/draftInvalidationStream';
import { authService } from '../../api/authService';
import { reloadWhenDraftAutosaveIsIdle, setDraftAutosaveActivity } from '../../api/draftAutosaveActivity';
import { tokenValueKey } from '../../api/editorHttp';
import { observeTokenValueRevisions } from '../../api/subjectRevisions';
import {
    applyStyleChange,
    applyUpdatedStyle,
    createHttpTypographyStyleRepository,
    createTypographyAutosave,
    definedEntries,
    styleKey,
    groupNameRequest,
    styleSizeRequest,
    styleValueAddresses,
    styleValueRevisions,
    TypographyOperationError,
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
    invalidation: number;
    loadedInvalidation: number;
    loadedAt?: number;
    failedInvalidation?: number;
    loading?: Promise<void>;
    readController?: AbortController;
    unsubscribe: () => void;
    /** Ошибки значений у полей: `<экран>|<стиль>|<поле>` → текст. */
    fieldErrors: Record<string, string>;
    /** Описания, сохранённые с экрана, по имени токена: показываются до перечитывания модели темы. */
    descriptions: Record<string, string>;
    /** Тема и перерисовка открытого экрана. */
    live: { theme: Theme | null; rerender: () => void };
    listeners: Set<() => void>;
}

let repository: TypographyStyleRepository = createHttpTypographyStyleRepository();
const sessions = new Map<string, TypographySession>();

const clearSessions = () => {
    sessions.forEach((session) => {
        session.unsubscribe();
        session.readController?.abort();
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
const load = (session: TypographySession): Promise<void> => {
    if (session.loading) return session.loading;
    const controller = new AbortController();
    session.readController = controller;
    const run = async () => {
        await session.autosave.flush();
        if (controller.signal.aborted) return;
        // Описания перечитываются с темой: после сброса или правки в другом месте кэш экрана устарел.
        session.descriptions = {};
        const current = ++session.loads;
        const invalidation = session.invalidation;
        try {
            const styles = await repository.load(session.context, controller.signal);
            if (current !== session.loads || controller.signal.aborted) return;
            observeRevisions(session, styles);
            session.saved = styles;
            session.loadError = null;
            session.failedInvalidation = undefined;
            session.loadedInvalidation = invalidation;
            session.loadedAt = Date.now();
        } catch (error) {
            if (current !== session.loads || controller.signal.aborted) return;
            session.loadError = errorText(error);
            session.failedInvalidation = invalidation;
        }
    };
    session.loading = run().finally(() => {
        session.loading = undefined;
        notify(session);
    });
    return session.loading;
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
    session.loads++;
    session.loadedAt = Date.now();
    if (session.saved) session.saved = applyUpdatedStyle(session.saved, result.style, change);
    applyToTheme(session.live.theme, result);
    session.live.rerender();
};

const sessionKey = ({ projectId, designSystemId, tenantId, versionId }: TypographyContext) =>
    `${projectId}:${designSystemId}:${tenantId}:${versionId ?? ''}`;

const typographySession = (context: TypographyContext): TypographySession => {
    const id = sessionKey(context);
    for (const [key, cached] of sessions) {
        if (
            key !== id &&
            !cached.listeners.size &&
            !cached.loading &&
            cached.loadedAt !== undefined &&
            Date.now() - cached.loadedAt >= 300_000 &&
            cached.autosave.overall().state === 'saved'
        ) {
            cached.unsubscribe();
            cached.autosave.dispose();
            sessions.delete(key);
        }
    }
    const existing = sessions.get(id);
    if (existing) return existing;
    const session: TypographySession = {
        context,
        autosave: undefined as unknown as TypographyAutosave,
        saved: null,
        loadError: null,
        loads: 0,
        invalidation: 0,
        loadedInvalidation: -1,
        unsubscribe: () => {},
        fieldErrors: {},
        descriptions: {},
        live: { theme: null, rerender: () => undefined },
        listeners: new Set(),
    };
    session.unsubscribe = subscribeEditorDataInvalidation(context, (scopes, types) => {
        if (types && !types.some((type) => ['typography', 'fontFamily'].includes(type))) return;
        if (
            !scopes.has('theme-tokens') &&
            !scopes.has('theme-metadata') &&
            !scopes.has('component-configurations') &&
            !scopes.has('all') &&
            !scopes.has('design-system')
        )
            return;
        session.invalidation++;
        notify(session);
    });
    session.autosave = createTypographyAutosave({
        repository: { update: (...args) => repository.update(...args) },
        context,
        onChange: () => {
            // Общий индикатор, публикация и перечитывание по сигналу ждут подтверждения очереди типографии.
            if (!context.versionId)
                setDraftAutosaveActivity(context, ACTIVITY_SOURCE, session.autosave.overall().state);
            notify(session);
        },
        onSaved: (_, result, change) => {
            applySaved(session, result, change);
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
        session.failedInvalidation = undefined;
        if (session.loadedAt !== undefined && Date.now() - session.loadedAt >= 30_000) session.invalidation++;
        return () => {
            session.listeners.delete(refresh);
            queueMicrotask(() => {
                if (!session.listeners.size) session.readController?.abort();
            });
        };
    }, [session]);

    useEffect(() => {
        if (
            session.loadedInvalidation === session.invalidation ||
            session.failedInvalidation === session.invalidation ||
            session.loading
        )
            return;
        return reloadWhenDraftAutosaveIsIdle(session.context, () => {
            void load(session);
        });
    }, [session, session.invalidation, session.loadedInvalidation, Boolean(session.loading)]);

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

    /** Имя токена начертания стиля: `<экран>.<группа>.<размер>.<начертание>`. */
    const tokenName = (style: TypographyStyle, variant: string) => `${style.screen}.${styleKey(style)}.${variant}`;

    /** Описание стиля — описание токена его первого начертания на экране стиля. */
    const description = (style: TypographyStyle) => {
        const [variant] = definedEntries(style.variants).map(([id]) => id);
        if (!variant) return '';
        const name = tokenName(style, variant);
        return session.descriptions[name] ?? theme.getToken(name, 'typography')?.getDescription?.() ?? '';
    };

    /** Токены стиля на всех экранах: у стиля одно описание и один сброс. */
    const styleTokens = (style: TypographyStyle) =>
        (session.saved?.screens ?? []).flatMap((item) =>
            item.styles
                .filter((candidate) => styleKey(candidate) === styleKey(style))
                .flatMap((candidate) =>
                    definedEntries(candidate.variants).map(([variant, view]) => ({
                        tokenId: view.tokenId,
                        name: tokenName(candidate, variant),
                    })),
                ),
        );

    /** Описание стиля пишется во все токены стиля на всех экранах: у стиля одно описание. */
    const describe = async (style: TypographyStyle, text: string) => {
        if (readOnly || session.context.versionId) return;
        const tokens = styleTokens(style);
        await Promise.all(tokens.map(({ tokenId }) => repository.describe(session.context, tokenId, text)));
        tokens.forEach(({ name }) => {
            session.descriptions = { ...session.descriptions, [name]: text };
            session.live.theme?.getToken(name, 'typography')?.setDescription?.(text || undefined);
        });
        session.live.rerender();
        notify(session);
    };

    /** Все стили темы на всех экранах: проверка занятого имени при создании и переименовании. */
    const allStyles = () => (session.saved?.screens ?? []).flatMap((item) => item.styles);

    /**
     * Создание, переименование и удаление: сначала отправляется очередь правок, затем операция; после неё раздел
     * перечитывается. Ошибка ввода или отказ сервера бросаются с текстом для поля.
     */
    const structural = async (operation: () => Promise<string[]>) => {
        if (readOnly || session.context.versionId) return [];
        await session.autosave.flush();
        const tokenIds = await operation();
        await load(session);
        return tokenIds;
    };
    const sizeOf = (group: string, input: string, except?: string) => {
        const result = styleSizeRequest(group, input, allStyles(), except);
        if ('error' in result) throw new TypographyOperationError('invalid', result.error);
        return result.size;
    };
    const groupNameOf = (input: string, except?: string) => {
        const result = groupNameRequest(input, [...new Set(allStyles().map((style) => style.group))], except);
        if ('error' in result) throw new TypographyOperationError('invalid', result.error);
        return result.name;
    };
    const firstToken = (style: TypographyStyle) => definedEntries(style.variants)[0]?.[1].tokenId ?? '';

    return {
        styles,
        description,
        describe,
        /** Создаёт стиль группы [group] с именем из ввода [input]; новая группа появляется с ним. Результат — ключ стиля. */
        create: async (group: string, input: string) => {
            const size = sizeOf(group, input);
            await structural(() => repository.create(session.context, group, size));
            return styleKey({ group, size });
        },
        /** Меняет имя стиля в группе на введённое; результат — новый ключ стиля. */
        rename: async (style: TypographyStyle, input: string) => {
            const size = sizeOf(style.group, input, styleKey(style));
            if (size === style.size) return styleKey(style);
            await structural(() => repository.rename(session.context, firstToken(style), size));
            return styleKey({ group: style.group, size });
        },
        /** Удаляет стиль на всех экранах. */
        remove: (style: TypographyStyle) => structural(() => repository.remove(session.context, firstToken(style))),
        /** Имя новой группы из ввода; ошибка ввода бросается с текстом для поля. Группа появится с первым стилем. */
        groupName: (input: string) => groupNameOf(input),
        /** Переименовывает свою группу [group] в имя из ввода; результат — новое имя группы. */
        renameGroup: async (group: string, input: string) => {
            const name = groupNameOf(input, group);
            if (name === group) return group;
            await structural(() => repository.renameGroup(session.context, group, name));
            return name;
        },
        /** Удаляет свою группу со всеми её стилями на всех экранах. */
        removeGroup: (group: string) => structural(() => repository.removeGroup(session.context, group)),
        styleTokenIds: (style: TypographyStyle) => new Set(styleTokens(style).map(({ tokenId }) => tokenId)),
        loadError: session.loadError,
        status: session.autosave.overall(),
        edit,
        retry: () => session.autosave.retry(),
        fieldError,
        reload: () => load(session),
    };
};
