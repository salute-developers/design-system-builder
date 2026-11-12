import { PanelSkeleton } from '../../../../components/tokenWorkspace';
import { usePanelWidth } from '../../../../hooks/usePanelWidth';
import { INSPECTOR_PANEL } from '../../panelWidths';

import { Root } from './ComponentEditor.styles';

/**
 * Загрузка компонента в раскладке рабочего места, как скелетоны экранов токенов: шапка и холст превью, инспектор
 * сохранённой ширины со строками-заглушками.
 */
export const ComponentEditorSkeleton = () => {
    const panel = usePanelWidth(INSPECTOR_PANEL);
    return (
        <Root className="component-workbench component-editor-skeleton" role="status" aria-label="Загружаем компонент…">
            <div className="component-editor-skeleton-preview" aria-hidden="true">
                <header className="component-preview-environment-bar">
                    <span className="tw-skeleton-bar component-editor-skeleton-title" />
                </header>
            </div>
            <aside className="component-inspector" aria-hidden="true" style={panel.style}>
                <PanelSkeleton part="inspector" />
            </aside>
        </Root>
    );
};
