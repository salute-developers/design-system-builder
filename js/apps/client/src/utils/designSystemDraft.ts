import {
    AndroidColor,
    AndroidGradient,
    AndroidShadow,
    AndroidShape,
    AndroidSpacing,
    AndroidTypography,
    ColorToken,
    GradientToken,
    IOSColor,
    IOSGradient,
    IOSShadow,
    IOSShape,
    IOSSpacing,
    IOSTypography,
    ShadowToken,
    ShapeToken,
    SpacingToken,
    TypographyToken,
    WebColor,
    WebGradient,
    WebShadow,
    WebShape,
    WebSpacing,
    WebTypography,
} from '../controllers';

import type {
    AndroidColorToken,
    AndroidGradientToken,
    AndroidShadowToken,
    AndroidShapeToken,
    AndroidSpacingToken,
    AndroidTypographyToken,
    IOSColorToken,
    IOSGradientToken,
    IOSShadowToken,
    IOSShapeToken,
    IOSSpacingToken,
    IOSTypographyToken,
    Theme,
    Token,
    VariationType,
    WebColorToken,
    WebGradientToken,
    WebShadowToken,
    WebShapeToken,
    WebSpacingToken,
    WebTypographyToken,
} from '../controllers';

const DRAFT_PREFIX = 'ds_draft:';

interface TokenMeta {
    name: string;
    tags: string[];
    displayName: string;
}

export interface TokenChange {
    type: VariationType;
    values: {
        web: any;
        ios: any;
        android: any;
    };
    description?: string;
    enabled: boolean;
    meta?: TokenMeta;
    deleted?: boolean;
}

type DraftChanges = Record<string, TokenChange>;

export interface DraftContext {
    projectId: string;
    designSystemId: string;
    tenantId: string;
}

let activeDraftContext: DraftContext | null = null;
let pendingMutationListener:
    | ((event: {
          context: NonNullable<typeof activeDraftContext>;
          tokenName: string;
          previousTokenName?: string;
          change: TokenChange | null;
          kind: 'create' | 'update' | 'rename' | 'delete' | 'discard';
      }) => void)
    | null = null;
const draftAddedTokensByKey = new Map<string, Set<string>>();

export const setActiveDraftContext = (context: typeof activeDraftContext) => {
    activeDraftContext = context;
};

export const setPendingMutationListener = (listener: typeof pendingMutationListener) => {
    pendingMutationListener = listener;
};

const notifyPendingMutation = (
    tokenName: string,
    change: TokenChange | null,
    kind: 'create' | 'update' | 'rename' | 'delete' | 'discard',
    previousTokenName?: string,
) => {
    if (activeDraftContext && pendingMutationListener) {
        pendingMutationListener({ context: activeDraftContext, tokenName, previousTokenName, change, kind });
    }
};

const activeKey = (name: string, version: string, context: DraftContext | null = activeDraftContext) =>
    context
        ? `${DRAFT_PREFIX}${context.projectId}:${context.designSystemId}:${context.tenantId}`
        : `${DRAFT_PREFIX}${name}:${version}`;
const draftAddedTokens = (context?: DraftContext) => {
    const key = activeKey('', '', context);
    const existing = draftAddedTokensByKey.get(key) ?? new Set<string>();
    draftAddedTokensByKey.set(key, existing);
    return existing;
};

export const isDraftAddedToken = (tokenName: string) => draftAddedTokens().has(tokenName);

export const getDraftKey = (name: string, version: string, context?: DraftContext) => activeKey(name, version, context);

const loadDraftChanges = (dsName: string, dsVersion: string, context?: DraftContext): DraftChanges => {
    const raw = localStorage.getItem(getDraftKey(dsName, dsVersion, context));

    if (!raw) {
        return {};
    }

    try {
        return JSON.parse(raw) as DraftChanges;
    } catch {
        return {};
    }
};

/** Полные имена токенов (с префиксом режима), у которых есть запись в черновике. */
export const draftTokenNames = (dsName: string, dsVersion: string) =>
    new Set(Object.keys(loadDraftChanges(dsName, dsVersion)));

/** Записи черновика токенов заданных типов: полное имя с режимом и тип. */
export const draftEntriesOfTypes = (dsName: string, dsVersion: string, types: readonly VariationType[]) =>
    Object.entries(loadDraftChanges(dsName, dsVersion))
        .filter(([, change]) => types.includes(change.type))
        .map(([name, change]) => ({ name, type: change.type }));

/** Удаляет из черновика записи [names]; остальные записи сохраняются. */
export const removeDraftEntries = (dsName: string, dsVersion: string, names: readonly string[]) => {
    const changes = loadDraftChanges(dsName, dsVersion);
    names.forEach((name) => {
        delete changes[name];
        draftAddedTokens().delete(name);
    });
    saveDraftChanges(dsName, dsVersion, changes);
};

export const pendingDraftTokens = (dsName: string, dsVersion: string): DraftChanges =>
    loadDraftChanges(dsName, dsVersion);

const saveDraftChanges = (dsName: string, dsVersion: string, changes: DraftChanges, context?: DraftContext) => {
    if (Object.keys(changes).length === 0) {
        localStorage.removeItem(getDraftKey(dsName, dsVersion, context));
        return;
    }

    localStorage.setItem(getDraftKey(dsName, dsVersion, context), JSON.stringify(changes));
};

export const updateDraftToken = (
    dsName: string,
    dsVersion: string,
    token?: Token,
    action: 'remove' | 'discard' | 'save' | 'toggle' = 'save',
) => {
    if (!token) {
        return;
    }

    const tokenName = token.getName();
    const changes = loadDraftChanges(dsName, dsVersion);

    if (action === 'discard') {
        delete changes[tokenName];

        saveDraftChanges(dsName, dsVersion, changes);
        notifyPendingMutation(tokenName, null, 'discard');
        return;
    }

    if (action === 'remove') {
        if (draftAddedTokens().has(tokenName)) {
            draftAddedTokens().delete(tokenName);
            delete changes[tokenName];
            saveDraftChanges(dsName, dsVersion, changes);
            notifyPendingMutation(tokenName, null, 'discard');
            return;
        }
        changes[tokenName] = {
            type: token.getType(),
            values: {
                web: token.getValue('web'),
                ios: token.getValue('ios'),
                android: token.getValue('android'),
            },
            description: token.getDescription(),
            enabled: token.getEnabled(),
            deleted: true,
        };
        saveDraftChanges(dsName, dsVersion, changes);
        notifyPendingMutation(tokenName, changes[tokenName], 'delete');
        return;
    }

    // TODO: Подумать над кейсом с отключением / включением токена
    if (action === 'save' || action === 'toggle') {
        const previousMeta = changes[tokenName]?.meta;

        changes[tokenName] = {
            type: token.getType(),
            values: {
                web: token.getValue('web'),
                ios: token.getValue('ios'),
                android: token.getValue('android'),
            },
            description: token.getDescription(),
            enabled: token.getEnabled(),
            ...(previousMeta ? { meta: previousMeta } : {}),
        };

        saveDraftChanges(dsName, dsVersion, changes);
        notifyPendingMutation(tokenName, changes[tokenName], 'update');
        return;
    }
};

export const renameDraftToken = (dsName: string, dsVersion: string, oldName: string, token: Token) => {
    const newName = token.getName();
    const changes = loadDraftChanges(dsName, dsVersion);

    delete changes[oldName];

    if (draftAddedTokens().has(oldName)) {
        draftAddedTokens().delete(oldName);
        draftAddedTokens().add(newName);
    }

    changes[newName] = {
        type: token.getType(),
        values: {
            web: token.getValue('web'),
            ios: token.getValue('ios'),
            android: token.getValue('android'),
        },
        description: token.getDescription(),
        enabled: token.getEnabled(),
        meta: {
            name: newName,
            tags: token.getTags(),
            displayName: token.getDisplayName(),
        },
    };

    saveDraftChanges(dsName, dsVersion, changes);
    notifyPendingMutation(newName, changes[newName], 'rename', oldName);
};

export const createDraftToken = (dsName: string, dsVersion: string, token: Token) => {
    const tokenName = token.getName();
    const changes = loadDraftChanges(dsName, dsVersion);

    draftAddedTokens().add(tokenName);

    changes[tokenName] = {
        type: token.getType(),
        values: {
            web: token.getValue('web'),
            ios: token.getValue('ios'),
            android: token.getValue('android'),
        },
        description: token.getDescription(),
        enabled: token.getEnabled(),
        meta: {
            name: token.getName(),
            tags: token.getTags(),
            displayName: token.getDisplayName(),
        },
    };

    saveDraftChanges(dsName, dsVersion, changes);
    notifyPendingMutation(tokenName, changes[tokenName], 'create');
};

/** Удаляет только подтверждённый сервером запрос, не меняя предметные данные редактора. */
export const confirmDraftToken = (
    dsName: string,
    dsVersion: string,
    tokenName: string,
    context?: DraftContext,
) => {
    const changes = loadDraftChanges(dsName, dsVersion, context);
    delete changes[tokenName];
    saveDraftChanges(dsName, dsVersion, changes, context);
    draftAddedTokens(context).delete(tokenName);
};

const restoreDraftToken = (theme: Theme, change: TokenChange) => {
    if (!change.meta) {
        return;
    }

    const meta = {
        name: change.meta.name,
        tags: change.meta.tags,
        displayName: change.meta.displayName,
        description: change.description,
        enabled: change.enabled,
    };

    const factories: Partial<Record<VariationType, () => Token>> = {
        color: () =>
            new ColorToken(meta, {
                web: new WebColor(change.values.web as WebColorToken[string]),
                ios: new IOSColor(change.values.ios as IOSColorToken[string]),
                android: new AndroidColor(change.values.android as AndroidColorToken[string]),
            }),
        gradient: () =>
            new GradientToken(meta, {
                web: new WebGradient(change.values.web as WebGradientToken[string]),
                ios: new IOSGradient(change.values.ios as IOSGradientToken[string]),
                android: new AndroidGradient(change.values.android as AndroidGradientToken[string]),
            }),
        shape: () =>
            new ShapeToken(meta, {
                web: new WebShape(change.values.web as WebShapeToken[string]),
                ios: new IOSShape(change.values.ios as IOSShapeToken[string]),
                android: new AndroidShape(change.values.android as AndroidShapeToken[string]),
            }),
        spacing: () =>
            new SpacingToken(meta, {
                web: new WebSpacing(change.values.web as WebSpacingToken[string]),
                ios: new IOSSpacing(change.values.ios as IOSSpacingToken[string]),
                android: new AndroidSpacing(change.values.android as AndroidSpacingToken[string]),
            }),
        shadow: () =>
            new ShadowToken(meta, {
                web: new WebShadow(change.values.web as WebShadowToken[string]),
                ios: new IOSShadow(change.values.ios as IOSShadowToken[string]),
                android: new AndroidShadow(change.values.android as AndroidShadowToken[string]),
            }),
        typography: () =>
            new TypographyToken(meta, {
                web: new WebTypography(change.values.web as WebTypographyToken[string]),
                ios: new IOSTypography(change.values.ios as IOSTypographyToken[string]),
                android: new AndroidTypography(change.values.android as AndroidTypographyToken[string]),
            }),
    };

    const factory = factories[change.type];
    if (!factory) return;

    theme.addToken(change.type, factory());
    draftAddedTokens().add(change.meta.name);
};

export const clearDraft = (dsName?: string, dsVersion?: string) => {
    if (!dsName || !dsVersion) {
        return;
    }

    localStorage.removeItem(getDraftKey(dsName, dsVersion));
    draftAddedTokens().clear();
};

export const hasDraft = (dsName: string, dsVersion: string) => {
    return localStorage.getItem(getDraftKey(dsName, dsVersion)) !== null;
};

/** Черновик на момент отправки: ключ фиксируется сразу, чтобы смена tenant не подменила его. */
export interface DraftSnapshot {
    key: string;
    value: string | null;
}

export const takeDraftSnapshot = (dsName: string, dsVersion: string): DraftSnapshot => {
    const key = getDraftKey(dsName, dsVersion);
    return { key, value: localStorage.getItem(key) };
};

/**
 * Очищает черновик снимка, если он не менялся с момента снимка: правки, сделанные во время сохранения,
 * в запрос не попали и должны остаться. Возвращает, был ли черновик очищен.
 */
export const clearDraftIfUnchanged = ({ key, value }: DraftSnapshot) => {
    if (localStorage.getItem(key) !== value) {
        return false;
    }
    localStorage.removeItem(key);
    draftAddedTokensByKey.delete(key);
    return true;
};

export const applyDraftChanges = (theme: Theme, dsName: string, dsVersion: string) => {
    const changes = loadDraftChanges(dsName, dsVersion);

    Object.entries(changes).forEach(([tokenName, change]) => {
        if (change.deleted) {
            theme.removeToken(tokenName, change.type);
            return;
        }
        let token = theme.getToken(tokenName, change.type);

        if (!token) {
            restoreDraftToken(theme, change);
            token = theme.getToken(tokenName, change.type);
        }

        if (!token) {
            return;
        }

        token.setValue('web', change.values.web);
        token.setValue('ios', change.values.ios);
        token.setValue('android', change.values.android);

        if (change.description !== undefined) {
            token.setDescription(change.description);
        }

        token.setEnabled(change.enabled);
    });
};
