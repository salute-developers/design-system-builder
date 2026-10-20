import { useMemo } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';

import '../../styles/size-tokens.css';

import type { DesignSystem, Theme } from '../../controllers';
import type { EditorContextKey } from '../../api/editorContracts';
import { SizeTokensScreen } from './SizeTokensScreen';

interface ShapesOutletContextProps {
    designSystem?: DesignSystem | null;
    theme?: Theme | null;
    updated: object;
    rerender: () => void;
    reload: () => void;
    editorContext?: EditorContextKey;
}

/** Раздел «Отступы, радиусы и тени» темы по прототипу SDDS Portal с автосохранением правок. */
export const Shapes = () => {
    const outlet = useOutletContext<ShapesOutletContextProps>();
    const { projectId, designSystemId, tenantId } = useParams();
    const context = useMemo(
        () => (projectId && designSystemId && tenantId ? { projectId, designSystemId, tenantId } : null),
        [projectId, designSystemId, tenantId],
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
            context={context}
            designSystem={outlet.designSystem}
            theme={outlet.theme}
            rerender={outlet.rerender}
            reload={outlet.reload}
        />
    );
};
