import { useEffect, useMemo, useReducer, useState } from 'react';

import type { DesignSystem, Theme } from '../../controllers';
import {
    TypographyOperationError,
    applyStyleChange,
    applyUpdatedStyle,
    createHttpTypographyStyleRepository,
    createTypographyAutosave,
    legacyStyleCount,
    legacyTypographyChanges,
    styleKey,
    validateChange,
    type TypographyAutosave,
    type TypographyContext,
    type TypographyField,
    type TypographyScreen,
    type TypographyStyle,
    type TypographyStyleChange,
    type TypographyStyleRepository,
    type TypographyStyles,
    type UpdatedTypographyStyle,
} from '../../modules/typographyTokens';
import { draftValuesOfTypes, removeDraftEntries } from '../../utils/designSystemDraft';

const DRAFT_VERSION = '0.1.0';

/** Ключ правки в очереди: стиль на экране. */
export const queueKey = (screen: TypographyScreen, key: string) => `${screen}|${key}`;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Сессия типографии темы: живёт дольше экрана, чтобы очередь сохранения пережила перемонтирование (перезагрузку
 * темы, уход в другой раздел и возврат) и операции темы шли одной цепочкой ревизий.
 */
interface TypographySession {
    context: TypographyContext;
    autosave: TypographyAutosave;
    saved: TypographyStyles | null;
    loadError: string | null;
    conflict: TypographyOperationError | null;
    /** Ошибки значений у полей: `<экран>|<стиль>|<поле>` → текст. */
    fieldErrors: Record<string, string>;
    /** Тема, дизайн-система и перерисовка открытого экрана. */
    live: { theme: Theme | null; designSystem: DesignSystem | null; rerender: () => void };
    listeners: Set<() => void>;
}

let repository: TypographyStyleRepository = createHttpTypographyStyleRepository();
const sessions = new Map<string, TypographySession>();

/** Подмена порта стилей в тестах. */
export const setTypographyStyleRepository = (value: TypographyStyleRepository) => {
    repository = value;
    sessions.clear();
};

const notify = (session: TypographySession) => session.listeners.forEach((listener) => listener());

const revisionOf = (session: TypographySession) => ({
    get: () => session.live.designSystem?.getParameters()?.editRevision ?? 0,
    set: (value: number) => {
        const parameters = session.live.designSystem?.getParameters();
        if (parameters) parameters.editRevision = value;
    },
});

/** Перечитывает стили после отправки очереди: ответ чтения не опережает отправленные правки. */
const load = async (session: TypographySession) => {
    await session.autosave.flush();
    try {
        const styles = await repository.load(session.context);
        revisionOf(session).set(styles.editRevision);
        session.saved = styles;
        session.loadError = null;
    } catch (error) {
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

const typographySession = (context: TypographyContext): TypographySession => {
    const id = `${context.projectId}:${context.designSystemId}:${context.tenantId}`;
    const existing = sessions.get(id);
    if (existing) return existing;
    const session: TypographySession = {
        context,
        autosave: undefined as unknown as TypographyAutosave,
        saved: null,
        loadError: null,
        conflict: null,
        fieldErrors: {},
        live: { theme: null, designSystem: null, rerender: () => undefined },
        listeners: new Set(),
    };
    session.autosave = createTypographyAutosave({
        repository: { load: (...args) => repository.load(...args), update: (...args) => repository.update(...args) },
        context,
        revision: revisionOf(session),
        onChange: () => notify(session),
        onSaved: (_, result, change) => applySaved(session, result, change),
        onRejected: (key, error) => {
            session.fieldErrors = { ...session.fieldErrors, [`${key}|${error.field ?? 'size'}`]: error.message };
        },
        onConflict: (error) => {
            // Тема изменена в другом месте: стили перечитываются, правки ждут «Повторить».
            session.conflict = error;
            void load(session);
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
}

/** Раздел «Типографика»: стили темы, правки с автосохранением, конфликт ревизии и прежний черновик. */
export const useTypographyEditor = ({ context, designSystem, theme, rerender }: EditorInput) => {
    const session = useMemo(
        () => typographySession(context),
        [context.projectId, context.designSystemId, context.tenantId],
    );
    session.live = { theme, designSystem, rerender };
    const [version, refresh] = useReducer((value: number) => value + 1, 0);

    useEffect(() => {
        session.listeners.add(refresh);
        void load(session);
        return () => {
            session.listeners.delete(refresh);
        };
    }, [session]);

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

    const fieldError = (style: TypographyStyle, field: TypographyField) =>
        session.fieldErrors[`${queueKey(style.screen, styleKey(style))}|${field}`] ?? null;

    /** Правка стиля: недопустимое значение показывается у поля и не отправляется. */
    const edit = (style: TypographyStyle, change: TypographyStyleChange) => {
        const key = queueKey(style.screen, styleKey(style));
        const fields = Object.keys(change).flatMap((field) =>
            field === 'weights' ? Object.keys(change.weights ?? {}).map((variant) => `weights.${variant}`) : [field],
        );
        const violation = validateChange(change);
        const next = { ...session.fieldErrors };
        fields.forEach((field) => delete next[`${key}|${field}`]);
        if (violation) next[`${key}|${violation.field}`] = violation.message;
        session.fieldErrors = next;
        const tokenId = Object.values(style.variants).find(Boolean)?.tokenId;
        if (!violation && tokenId) session.autosave.schedule(key, tokenId, change);
        else notify(session);
    };

    const retry = () => {
        session.conflict = null;
        session.autosave.retry();
    };

    const draftName = designSystem.getName() || '';
    const [legacy, setLegacy] = useState(() => draftValuesOfTypes(draftName, DRAFT_VERSION, ['typography']));
    const legacyChanges = useMemo(
        () => (session.saved ? legacyTypographyChanges(legacy, session.saved) : []),
        [legacy, session.saved],
    );

    /**
     * Сохраняет записи прежнего черновика; из черновика удаляются только сохранённые записи. Записи, которые не
     * относятся к стилям темы, сохранить нельзя: они остаются до «Отбросить».
     */
    const saveLegacyDraft = async () => {
        const savedNames: string[] = [];
        let failure: unknown = null;
        for (const item of legacyChanges) {
            try {
                const result = await session.autosave.run((editRevision) =>
                    repository.update(session.context, item.tokenId, item.change, editRevision),
                );
                applySaved(session, result, item.change);
                savedNames.push(...item.names);
            } catch (error) {
                failure ??= error;
                if (error instanceof TypographyOperationError && error.kind === 'conflict') {
                    // Тема изменена в другом месте: стили и ревизия перечитываются, повторное сохранение пройдёт.
                    await load(session);
                    break;
                }
            }
        }
        removeDraftEntries(draftName, DRAFT_VERSION, savedNames);
        setLegacy(draftValuesOfTypes(draftName, DRAFT_VERSION, ['typography']));
        notify(session);
        if (failure) throw failure;
    };

    const discardLegacyDraft = () => {
        removeDraftEntries(
            draftName,
            DRAFT_VERSION,
            legacy.map((entry) => entry.name),
        );
        setLegacy([]);
    };

    return {
        styles,
        loadError: session.loadError,
        conflict: session.conflict,
        status: session.autosave.overall(),
        edit,
        retry,
        fieldError,
        reload: () => load(session),
        legacyCount: legacyStyleCount(legacy),
        saveLegacyDraft,
        discardLegacyDraft,
    };
};
