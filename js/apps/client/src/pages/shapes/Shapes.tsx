import { useMemo } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';

import '../../styles/size-tokens.css';

import type { DesignSystem, Theme } from '../../controllers';
import type { ThemePalette } from '../../modules/palette';
import { SizeTokensScreen } from './SizeTokensScreen';

interface ShapesOutletContextProps {
    designSystem?: DesignSystem | null;
    theme?: Theme | null;
    palette?: ThemePalette | null;
    rerender: () => void;
    /** Токены с неопубликованными изменениями: отметка в дереве, как у «Типографики». */
    changedTokenNames?: Set<string>;
}

/** Раздел «Отступы, радиусы и тени» темы по прототипу SDDS Portal с автосохранением правок. */
export const Shapes = () => {
    const outlet = useOutletContext<ShapesOutletContextProps>();
    const { projectId, designSystemId, tenantId } = useParams();
    const [searchParams] = useSearchParams();
    // Опубликованная версия из адреса: раздел читает её значения и доступен только для чтения.
    const versionId = searchParams.get('versionId') ?? undefined;
    const context = useMemo(
        () => (projectId && designSystemId && tenantId ? { projectId, designSystemId, tenantId, versionId } : null),
        [projectId, designSystemId, tenantId, versionId],
    );

    if (!context || !outlet.designSystem || !outlet.theme) {
        return (
            <div className="size-tokens-screen st-shell st-theme-workspace" data-testid="size-tokens-loading">
                <div className="st-empty" role="status">
                    Загружаем радиусы, отступы и тени…
                </div>
            </div>
        );
    }

    return (
        <SizeTokensScreen
            key={`${context.projectId}:${context.designSystemId}:${context.tenantId}:${context.versionId ?? ''}`}
            context={context}
            designSystem={outlet.designSystem}
            theme={outlet.theme}
            palette={outlet.palette ?? null}
            rerender={outlet.rerender}
            changedTokenNames={outlet.changedTokenNames}
        />
    );
};
