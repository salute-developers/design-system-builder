import { useMemo } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';

import type { TokenDefinitionDto } from '../../api/themeEditorRepository';
import type { Config, DesignSystem, Theme } from '../../controllers';
import type { ThemePalette } from '../../modules/palette';
import { ColorTokensScreen } from './ColorTokensScreen';

interface ColorsOutletContextProps {
    designSystem?: DesignSystem | null;
    theme?: Theme | null;
    components?: Config[] | null;
    palette?: ThemePalette | null;
    setPalette?: (palette: ThemePalette) => void;
    tokenDefinitions?: TokenDefinitionDto[];
    incompleteTokenIds?: string[];
    updated: object;
    rerender: () => void;
    reload: () => void;
}

/** Раздел «Цвета» темы: экран Color Tokens по прототипу SDDS Portal с автосохранением правок. */
export const Colors = () => {
    const outlet = useOutletContext<ColorsOutletContextProps>();
    const { projectId, designSystemId, tenantId } = useParams();
    const [searchParams] = useSearchParams();
    const versionId = searchParams.get('versionId') ?? undefined;
    const context = useMemo(
        () => (projectId && designSystemId && tenantId ? { projectId, designSystemId, tenantId, versionId } : null),
        [projectId, designSystemId, tenantId, versionId],
    );

    if (!context || !outlet.designSystem || !outlet.theme) {
        return (
            <div className="color-tokens-screen" data-testid="color-tokens-loading">
                <div className="ct-tree-empty" role="status">
                    Загружаем цветовые токены…
                </div>
            </div>
        );
    }

    return (
        <ColorTokensScreen
            context={context}
            designSystem={outlet.designSystem}
            theme={outlet.theme}
            components={outlet.components ?? []}
            palette={outlet.palette ?? null}
            setPalette={outlet.setPalette}
            tokenDefinitions={outlet.tokenDefinitions ?? []}
            incompleteTokenIds={outlet.incompleteTokenIds ?? []}
            updated={outlet.updated}
            rerender={outlet.rerender}
            reload={outlet.reload}
        />
    );
};
