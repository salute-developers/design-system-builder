import { useMemo } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';

import type { TokenDefinitionDto } from '../../api/themeEditorRepository';
import type { Config, DesignSystem, Theme } from '../../controllers';
import type { ThemePalette } from '../../modules/palette';
import { ColorTokensScreen, ColorTokensState } from './ColorTokensScreen';

interface ColorsOutletContextProps {
    designSystem?: DesignSystem | null;
    theme?: Theme | null;
    components?: Config[] | null;
    palette?: ThemePalette | null;
    setPalette?: (palette: ThemePalette) => void;
    tokenDefinitions?: TokenDefinitionDto[];
    colorTokenGroups?: import('../../modules/colorTokens/domain/types').TokenGroupDto[];
    incompleteTokenIds?: string[];
    updated: object;
    rerender: () => void;
    reload: () => void;
    /** Ошибка загрузки раздела: экран показывает «Не удалось загрузить цветовые токены» и «Повторить». */
    sectionError?: unknown;
    /** Раздел ещё загружается: тема в контексте — оболочка без токенов. */
    sectionPending?: boolean;
    /** Токены с неопубликованными изменениями темы: от них зависит сброс изменений токена. */
    changedTokenNames?: Set<string>;
}

/** Раздел «Цвета» темы: экран Color Tokens по Figma с автосохранением правок. */
export const Colors = () => {
    const outlet = useOutletContext<ColorsOutletContextProps>();
    const { projectId, designSystemId, tenantId } = useParams();
    const [searchParams] = useSearchParams();
    const versionId = searchParams.get('versionId') ?? undefined;
    const context = useMemo(
        () => (projectId && designSystemId && tenantId ? { projectId, designSystemId, tenantId, versionId } : null),
        [projectId, designSystemId, tenantId, versionId],
    );

    if (outlet.sectionError) return <ColorTokensState error onRetry={outlet.reload} />;
    if (!context || !outlet.designSystem || !outlet.theme || outlet.sectionPending) return <ColorTokensState />;

    return (
        <ColorTokensScreen
            context={context}
            designSystem={outlet.designSystem}
            theme={outlet.theme}
            components={outlet.components ?? []}
            palette={outlet.palette ?? null}
            setPalette={outlet.setPalette}
            tokenDefinitions={outlet.tokenDefinitions ?? []}
            colorTokenGroups={outlet.colorTokenGroups}
            incompleteTokenIds={outlet.incompleteTokenIds ?? []}
            updated={outlet.updated}
            rerender={outlet.rerender}
            reload={outlet.reload}
            changedTokenNames={outlet.changedTokenNames}
        />
    );
};
