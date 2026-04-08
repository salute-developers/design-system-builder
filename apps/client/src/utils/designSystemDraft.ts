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

interface TokenChange {
    type: VariationType;
    values: {
        web: any;
        ios: any;
        android: any;
    };
    description?: string;
    enabled: boolean;
    meta?: TokenMeta;
}

type DraftChanges = Record<string, TokenChange>;

const draftAddedTokens = new Set<string>();

export const isDraftAddedToken = (tokenName: string) => draftAddedTokens.has(tokenName);

export const getDraftKey = (name: string, version: string) => `${DRAFT_PREFIX}${name}:${version}`;

const loadDraftChanges = (dsName: string, dsVersion: string): DraftChanges => {
    const raw = localStorage.getItem(getDraftKey(dsName, dsVersion));

    if (!raw) {
        return {};
    }

    try {
        return JSON.parse(raw) as DraftChanges;
    } catch {
        return {};
    }
};

const saveDraftChanges = (dsName: string, dsVersion: string, changes: DraftChanges) => {
    if (Object.keys(changes).length === 0) {
        localStorage.removeItem(getDraftKey(dsName, dsVersion));
        return;
    }

    localStorage.setItem(getDraftKey(dsName, dsVersion), JSON.stringify(changes));
};

export const updateDraftToken = (
    dsName: string,
    dsVersion: string,
    token?: Token,
    action: 'remove' | 'save' | 'toggle' = 'save',
) => {
    if (!token) {
        return;
    }

    const tokenName = token.getName();
    const changes = loadDraftChanges(dsName, dsVersion);

    if (action === 'remove') {
        delete changes[tokenName];

        saveDraftChanges(dsName, dsVersion, changes);
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
        return;
    }
};

export const createDraftToken = (dsName: string, dsVersion: string, token: Token) => {
    const tokenName = token.getName();
    const changes = loadDraftChanges(dsName, dsVersion);

    draftAddedTokens.add(tokenName);

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

    if (change.type === 'color') {
        const token = new ColorToken(meta, {
            web: new WebColor(change.values.web as WebColorToken[string]),
            ios: new IOSColor(change.values.ios as IOSColorToken[string]),
            android: new AndroidColor(change.values.android as AndroidColorToken[string]),
        });
        theme.addToken('color', token);
        draftAddedTokens.add(change.meta.name);
        return;
    }

    if (change.type === 'gradient') {
        const token = new GradientToken(meta, {
            web: new WebGradient(change.values.web as WebGradientToken[string]),
            ios: new IOSGradient(change.values.ios as IOSGradientToken[string]),
            android: new AndroidGradient(change.values.android as AndroidGradientToken[string]),
        });
        theme.addToken('gradient', token);
        draftAddedTokens.add(change.meta.name);
        return;
    }

    if (change.type === 'shape') {
        const token = new ShapeToken(meta, {
            web: new WebShape(change.values.web as WebShapeToken[string]),
            ios: new IOSShape(change.values.ios as IOSShapeToken[string]),
            android: new AndroidShape(change.values.android as AndroidShapeToken[string]),
        });
        theme.addToken('shape', token);
        draftAddedTokens.add(change.meta.name);
        return;
    }

    if (change.type === 'spacing') {
        const token = new SpacingToken(meta, {
            web: new WebSpacing(change.values.web as WebSpacingToken[string]),
            ios: new IOSSpacing(change.values.ios as IOSSpacingToken[string]),
            android: new AndroidSpacing(change.values.android as AndroidSpacingToken[string]),
        });
        theme.addToken('spacing', token);
        draftAddedTokens.add(change.meta.name);
        return;
    }

    if (change.type === 'shadow') {
        const token = new ShadowToken(meta, {
            web: new WebShadow(change.values.web as WebShadowToken[string]),
            ios: new IOSShadow(change.values.ios as IOSShadowToken[string]),
            android: new AndroidShadow(change.values.android as AndroidShadowToken[string]),
        });
        theme.addToken('shadow', token);
        draftAddedTokens.add(change.meta.name);
        return;
    }

    if (change.type === 'typography') {
        const token = new TypographyToken(meta, {
            web: new WebTypography(change.values.web as WebTypographyToken[string]),
            ios: new IOSTypography(change.values.ios as IOSTypographyToken[string]),
            android: new AndroidTypography(change.values.android as AndroidTypographyToken[string]),
        });
        theme.addToken('typography', token);
        draftAddedTokens.add(change.meta.name);
        return;
    }
};

export const clearDraft = (dsName?: string, dsVersion?: string) => {
    if (!dsName || !dsVersion) {
        return;
    }

    localStorage.removeItem(getDraftKey(dsName, dsVersion));
    draftAddedTokens.clear();
};

export const hasDraft = (dsName: string, dsVersion: string) => {
    return localStorage.getItem(getDraftKey(dsName, dsVersion)) !== null;
};

export const applyDraftChanges = (theme: Theme, dsName: string, dsVersion: string) => {
    const changes = loadDraftChanges(dsName, dsVersion);

    Object.entries(changes).forEach(([tokenName, change]) => {
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
