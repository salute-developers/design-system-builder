import { useEffect, useMemo, useReducer } from 'react';

import type { Config, DesignSystem, Theme } from '../../controllers';
import type { TokenDefinitionDto } from '../../api/themeEditorRepository';
import { buildColorTokenViews, type ColorTokenContext, type ThemeTokenSource } from '../../modules/colorTokens';
import { groupRampName, resolveTokenGroupId, type ThemePalette } from '../../modules/palette';
import { restorePaletteColor } from '../../palette/activePalette';
import { adoptTheme, colorTokenSession, createColorTokenEditor } from './colorTokenEditor';

interface EditorInput {
    context: ColorTokenContext;
    designSystem: DesignSystem;
    theme: Theme;
    components: Config[];
    palette: ThemePalette | null;
    tokenDefinitions: TokenDefinitionDto[];
    incompleteTokenIds: string[];
    updated: object;
    reload: () => void;
}

const themeTokens = (theme: Theme): ThemeTokenSource[] =>
    (['color', 'gradient'] as const).flatMap((type) =>
        theme.getTokens(type).map((token) => ({
            name: token.getName(),
            type,
            displayName: token.getDisplayName(),
            description: token.getDescription(),
            enabled: token.getEnabled(),
            web: token.getValue('web' as never),
        })),
    );

/** Экран цветовых токенов: модель строк из темы и палитры, редактор с автосохранением и его состояние. */
export const useColorTokenEditor = (input: EditorInput) => {
    const { context, designSystem, theme, palette, tokenDefinitions, incompleteTokenIds, updated, reload } = input;
    const session = useMemo(
        () => colorTokenSession(context),
        [context.projectId, context.designSystemId, context.tenantId],
    );
    const [version, refresh] = useReducer((value: number) => value + 1, 0);

    // Сессия видит текущую тему, определения и перезагрузку; после перезагрузки темы на новую тему накладываются
    // несохранённые значения.
    adoptTheme(session, theme);
    session.designSystem = designSystem;
    session.reload = reload;
    // Определения из загрузки заменяют прежние загруженные: токены, удалённые в другом месте, уходят из сессии,
    // а созданные на экране после загрузки остаются.
    useMemo(() => {
        const names = new Set<string>();
        for (const token of tokenDefinitions) {
            if (token.type !== 'color' && token.type !== 'gradient') continue;
            session.definitions.set(token.name, { id: token.id, type: token.type });
            names.add(token.name);
        }
        // Множество живёт в сессии: экран размонтируется на время перезагрузки темы.
        session.loadedNames.forEach((name) => names.has(name) || session.definitions.delete(name));
        session.loadedNames = names;
    }, [session, tokenDefinitions]);

    useEffect(() => {
        session.listeners.add(refresh);
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

    const editor = useMemo(() => createColorTokenEditor(session), [session]);

    const incompleteNames = useMemo(() => {
        const ids = new Set(incompleteTokenIds);
        return new Set(tokenDefinitions.filter((token) => ids.has(token.id)).map((token) => token.name));
    }, [incompleteTokenIds, tokenDefinitions]);

    const views = useMemo(
        () =>
            buildColorTokenViews(themeTokens(theme), {
                resolve: (value, tokenName) => {
                    const color = restorePaletteColor(value, -1, tokenName);
                    return /^#[0-9a-f]{6,8}$/i.test(color) ? color : null;
                },
                paletteGroup: (memberName) => {
                    if (!palette) return null;
                    const groupId = resolveTokenGroupId(palette, memberName);
                    const group = palette.groups.find((item) => item.id === groupId);
                    return group ? { id: group.id, systemKey: group.systemKey, label: group.label } : null;
                },
                incomplete: incompleteNames,
                rampName: palette
                    ? (reference, tokenName) =>
                          groupRampName(palette, resolveTokenGroupId(palette, tokenName), reference)
                    : undefined,
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- тема меняется на месте, `updated` и `version` отмечают правки
        [theme, palette, updated, version, incompleteNames],
    );

    return { session, editor, views, status: session.autosave.overall(), version };
};
