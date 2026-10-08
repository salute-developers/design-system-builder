import type { DesignSystem, Theme } from '../controllers';
import {
    buildLocalTemplate,
    DRAFT_TOKEN_ID_PREFIX,
    createPaletteRepository,
    modeOfTokenName,
    paletteOperations,
    paletteSourceFromEnv,
    stripModePrefix,
    type LocalThemeInput,
    type PaletteContext,
    type PaletteRepository,
    type PaletteTokenRef,
    type TokenReferenceRewrite,
} from '../modules/palette';
import { getDraftKey, updateDraftToken } from '../utils/designSystemDraft';
import { restoreTemplateColor } from './activePalette';

/** Открытая в редакторе тема: источник токенов и черновика для адаптера `local`. */
export interface PaletteSession {
    context: PaletteContext;
    designSystem: DesignSystem;
    theme: Theme;
    tokens: PaletteTokenRef[];
    readOnly: boolean;
}

let session: PaletteSession | null = null;

export const setPaletteSession = (value: PaletteSession | null) => {
    session = value;
};

export const getPaletteSession = () => session;

const sameContext = (a: PaletteContext, b: PaletteContext) =>
    a.projectId === b.projectId && a.designSystemId === b.designSystemId && a.tenantId === b.tenantId;

const colorTokens = (theme: Theme) => theme.getTokens('color');

/**
 * Цветовые токены палитры: сохранённые на сервере и созданные в черновике. Без вторых раздел не видит их связей и
 * считает растяжку, на которую ссылается только новый токен, свободной — её можно удалить и сломать токен.
 */
export const paletteTokens = (current: PaletteSession): PaletteTokenRef[] => {
    const known = new Set(current.tokens.map((token) => token.name));
    const drafts = new Map<string, PaletteTokenRef>();
    for (const token of colorTokens(current.theme)) {
        const name = stripModePrefix(token.getName());
        if (known.has(name) || drafts.has(name)) continue;
        drafts.set(name, { id: `${DRAFT_TOKEN_ID_PREFIX}${name}`, name, displayName: token.getDisplayName() || name });
    }
    return [...current.tokens, ...drafts.values()];
};

/** Цветовые значения темы с учётом черновика. */
export const themePaletteInput = (current: PaletteSession): LocalThemeInput => {
    const tokens = paletteTokens(current);
    const idByName = new Map(tokens.map((token) => [token.name, token.id]));
    const values = colorTokens(current.theme).flatMap((token) => {
        const tokenId = idByName.get(stripModePrefix(token.getName()));
        if (!tokenId) return [];
        return Object.keys(token.getPlatforms()).map((platform) => ({
            tokenId,
            mode: modeOfTokenName(token.getName()),
            platform,
            value: token.getValue(platform as never),
        }));
    });
    return { tokens, values, canEdit: !current.readOnly };
};

/**
 * Записывает переписанные ссылки токенов в черновик открытой темы. Запись атомарна: если черновик не удалось
 * сохранить на каком-то токене, значения токенов и черновик возвращаются к исходным, ошибка пробрасывается.
 * Возвращает отмену записи — её вызывает адаптер, если не удалось сохранить саму палитру.
 */
export const applyRewriteToDraft = (
    current: PaletteSession,
    rewrite: TokenReferenceRewrite,
    resolveHex: (step: number) => string | undefined,
) => {
    const dsName = current.designSystem.getName() || '';
    const dsVersion = current.designSystem.getVersion() || '';
    const draftKey = getDraftKey(dsName, dsVersion);
    const draftBefore = localStorage.getItem(draftKey);
    const valuesBefore: Array<() => void> = [];
    const restore = () => {
        valuesBefore.forEach((undo) => undo());
        if (draftBefore === null) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, draftBefore);
    };
    const tokenIds = new Set(rewrite.tokenIds);
    const idByName = new Map(paletteTokens(current).map((token) => [token.name, token.id]));
    try {
        for (const token of colorTokens(current.theme)) {
            const tokenId = idByName.get(stripModePrefix(token.getName()));
            if (!tokenId || !tokenIds.has(tokenId)) continue;
            let changed = false;
            for (const platform of Object.keys(token.getPlatforms())) {
                const before = token.getValue(platform as never);
                const next = paletteOperations.rewriteTokenValue(before, rewrite, resolveHex);
                if (next === undefined) continue;
                token.setValue(platform as never, next as never);
                valuesBefore.push(() => token.setValue(platform as never, before as never));
                changed = true;
            }
            if (changed) updateDraftToken(dsName, dsVersion, token, 'save');
        }
    } catch (error) {
        restore();
        throw error;
    }
    return restore;
};

const requireSession = (context: PaletteContext) => {
    if (!session || !sameContext(session.context, context)) throw new Error('Тема палитры не открыта в редакторе');
    return session;
};

const newId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

export const paletteRepository: PaletteRepository = createPaletteRepository(paletteSourceFromEnv(), {
    storage: {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
    },
    newId,
    template: () => buildLocalTemplate(restoreTemplateColor),
    theme: (context) => themePaletteInput(requireSession(context)),
    applyRewrite: (context, rewrite, resolveHex) => applyRewriteToDraft(requireSession(context), rewrite, resolveHex),
});
