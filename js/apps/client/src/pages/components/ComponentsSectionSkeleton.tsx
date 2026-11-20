import type { CSSProperties } from 'react';

import { PanelSkeleton } from '../../components/tokenWorkspace';
import { usePanelWidth } from '../../hooks/usePanelWidth';
import { Workspace } from '../../layouts';

import { ComponentEditorSkeleton } from './features/ComponentEditor/ComponentEditorSkeleton';
import { COMPONENTS_PANEL } from './panelWidths';

/**
 * Загрузка раздела компонентов скелетонами, как экраны токенов: строки панели компонентов слева и рабочее место
 * компонента справа.
 */
export const ComponentsSectionSkeleton = () => {
    const panel = usePanelWidth(COMPONENTS_PANEL);
    return (
        <div className="component-editor-screen" style={panel.style as CSSProperties}>
            <Workspace
                section="components"
                menuBackground="transparent"
                menuWidth="var(--panel-left, 280px)"
                menu={
                    <aside className="token-browser component-tree-panel" aria-hidden="true">
                        <PanelSkeleton part="tree" />
                    </aside>
                }
                content={<ComponentEditorSkeleton />}
            />
        </div>
    );
};
