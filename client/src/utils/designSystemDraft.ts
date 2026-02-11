import type { Theme, Token } from '../controllers';

const DRAFT_PREFIX = 'ds_draft:';

interface TokenChange {
    type: string;
    values: {
        web: unknown;
        ios: unknown;
        android: unknown;
    };
    description?: string;
    enabled: boolean;
}

type DraftChanges = Record<string, TokenChange>;

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

export const updateTokenChange = (
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
        changes[tokenName] = {
            type: token.getType(),
            values: {
                web: token.getValue('web'),
                ios: token.getValue('ios'),
                android: token.getValue('android'),
            },
            description: token.getDescription(),
            enabled: token.getEnabled(),
        };

        saveDraftChanges(dsName, dsVersion, changes);
        return;
    }
};

export const clearDraft = (dsName?: string, dsVersion?: string) => {
    if (!dsName || !dsVersion) {
        return;
    }

    localStorage.removeItem(getDraftKey(dsName, dsVersion));
};

export const hasDraft = (dsName: string, dsVersion: string) => {
    return localStorage.getItem(getDraftKey(dsName, dsVersion)) !== null;
};

export const applyDraftChanges = (theme: Theme, dsName: string, dsVersion: string) => {
    const changes = loadDraftChanges(dsName, dsVersion);

    Object.entries(changes).forEach(([tokenName, change]) => {
        const token = theme.getToken(tokenName, change.type as any);

        if (!token) {
            // TODO: Сделать "восстановление" добавленных токенов, которые находятся в черновике
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
