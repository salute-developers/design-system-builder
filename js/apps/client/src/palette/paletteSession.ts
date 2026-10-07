import type { DesignSystem, Theme } from '../controllers';
import {
    buildLocalTemplate,
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
import { updateDraftToken } from '../utils/designSystemDraft';
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

/** Цветовые значения темы с учётом черновика. */
export const themePaletteInput = (current: PaletteSession): LocalThemeInput => {
    const idByName = new Map(current.tokens.map((token) => [token.name, token.id]));
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
    return { tokens: current.tokens, values, canEdit: !current.readOnly };
};

/** Записывает переписанные ссылки токенов в черновик открытой темы. */
export const applyRewriteToDraft = (
    current: PaletteSession,
    rewrite: TokenReferenceRewrite,
    resolveHex: (step: number) => string | undefined,
) => {
    const tokenIds = new Set(rewrite.tokenIds);
    const idByName = new Map(current.tokens.map((token) => [token.name, token.id]));
    for (const token of colorTokens(current.theme)) {
        const tokenId = idByName.get(stripModePrefix(token.getName()));
        if (!tokenId || !tokenIds.has(tokenId)) continue;
        let changed = false;
        for (const platform of Object.keys(token.getPlatforms())) {
            const next = paletteOperations.rewriteTokenValue(token.getValue(platform as never), rewrite, resolveHex);
            if (next === undefined) continue;
            token.setValue(platform as never, next as never);
            changed = true;
        }
        if (changed)
            updateDraftToken(current.designSystem.getName() || '', current.designSystem.getVersion() || '', token, 'save');
    }
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
