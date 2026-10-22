import { useEffect, useMemo, useReducer } from 'react';

import type { Config, DesignSystem, Theme } from '../../controllers';
import type { TokenDefinitionDto } from '../../api/themeEditorRepository';
import { buildColorTokenViews, type ColorTokenContext, type ThemeTokenSource } from '../../modules/colorTokens';
import { groupRampName, resolveTokenGroupId, type ThemePalette } from '../../modules/palette';
import { restorePaletteColor } from '../../palette/activePalette';
import {
    adoptTheme,
    adoptGroups,
    colorTokenSession,
    createColorTokenEditor,
    refreshStructure,
    setPlacements,
} from './colorTokenEditor';

interface EditorInput {
    context: ColorTokenContext;
    designSystem: DesignSystem;
    theme: Theme;
    components: Config[];
    palette: ThemePalette | null;
    tokenDefinitions: TokenDefinitionDto[];
    colorTokenGroups?: import('../../modules/colorTokens/domain/types').TokenGroupDto[];
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
    const {
        context,
        designSystem,
        theme,
        palette,
        tokenDefinitions,
        colorTokenGroups,
        incompleteTokenIds,
        updated,
        reload,
    } = input;
    const session = useMemo(
        () => colorTokenSession(context),
        [context.projectId, context.designSystemId, context.tenantId, context.versionId],
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
        setPlacements(
            session,
            tokenDefinitions.map((token) => ({
                name: token.name,
                groupId: token.groupId ?? null,
                position: token.position ?? 0,
                publishedIn: token.publishedIn ?? null,
            })),
        );
    }, [session, tokenDefinitions]);

    useMemo(() => {
        if (colorTokenGroups !== undefined) adoptGroups(session, colorTokenGroups);
    }, [session, colorTokenGroups]);

    // Группы общие для тем дизайн-системы и читаются отдельно от темы; места определений приходят с ними.
    const [groupsError, setGroupsError] = useReducer((_: string | null, value: string | null) => value, null);
    useEffect(() => {
        if (colorTokenGroups !== undefined) {
            setGroupsError(null);
            return;
        }
        refreshStructure(session)
            .then(() => setGroupsError(null))
            .catch((error: unknown) => setGroupsError(error instanceof Error ? error.message : String(error)));
    }, [session, tokenDefinitions, colorTokenGroups]);

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
                placement: (memberName) => session.placements.get(memberName) ?? null,
                incomplete: incompleteNames,
                rampName: palette
                    ? (reference, tokenName) =>
                          groupRampName(palette, resolveTokenGroupId(palette, tokenName), reference)
                    : undefined,
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- тема меняется на месте, `updated` и `version` отмечают правки
        [theme, palette, updated, version, incompleteNames],
    );

    return { session, editor, views, groups: session.groups, groupsError, status: session.autosave.overall(), version };
};
