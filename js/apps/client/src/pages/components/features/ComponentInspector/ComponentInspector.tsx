import { useMemo } from 'react';

import type { Config, DesignSystem, Theme } from '../../../../controllers';
import { usePanelWidth } from '../../../../hooks';

import type { InspectorTokenLists } from './InspectorPropertyRow';
import { InspectorSections } from './InspectorSections';
import {
    getColorTokenOptions,
    getShadowTokenOptions,
    getShapeTokenOptions,
    getTypographyTokenOptions,
    resolveColorToken,
    type ThemeMode,
} from './inspectorTokens';
import { InspectorVariants } from './InspectorVariants';
import type { Selection } from './inspectorModel';
import type { StoryArgs } from '../ComponentEditorPreview/storyArgs';

interface ComponentInspectorProps {
    config: Config;
    designSystem: DesignSystem;
    theme: Theme;
    updated: object;
    selection: Selection;
    /** Режим темы превью: цвета токенов в пикере и образцах — в этом режиме. */
    themeMode: ThemeMode;
    onSelectionChange: (variationName: string, styleID: string | undefined) => void;
    onConfigUpdate: () => void;
    /** Аргументы story превью для блока «Variants». */
    storyArgs?: StoryArgs;
}

/** Ширина инспектора: хранится рядом с шириной панели компонентов, полем `right`. */
const INSPECTOR_LIMITS = { min: 280, max: 560, initial: 440 };

/** Правая колонка редактора: вкладки и вкладка «Стилизация» — сочетание вариаций и его свойства. */
export const ComponentInspector = (props: ComponentInspectorProps) => {
    const { config, designSystem, theme, updated, selection, themeMode, onSelectionChange, onConfigUpdate, storyArgs } =
        props;
    const panel = usePanelWidth({
        storageKey: 'ds_components_panel',
        side: 'right',
        limits: INSPECTOR_LIMITS,
    });
    const api = useMemo(() => designSystem.getComponentData(config)?.sources.api ?? [], [config, designSystem]);
    const tokens = useMemo<InspectorTokenLists>(
        () => ({
            colors: getColorTokenOptions(theme, themeMode),
            shapes: getShapeTokenOptions(theme),
            shadows: getShadowTokenOptions(theme),
            typography: getTypographyTokenOptions(theme),
            resolveColor: (token) => resolveColorToken(theme, token, themeMode),
        }),
        [theme, theme.getRevision(), themeMode],
    );

    return (
        <aside className="component-inspector" aria-label="Вариации и свойства" style={panel.style}>
            <button
                type="button"
                className="component-inspector-resizer"
                aria-label="Ширина инспектора"
                title="Изменить ширину инспектора"
                {...panel.resizerProps}
            />
            <header className="component-inspector-header">
                <nav className="component-inspector-tabs" role="tablist" aria-label="Панели редактора">
                    <button
                        type="button"
                        role="tab"
                        id="component-inspector-tab-style"
                        className="is-active"
                        aria-selected="true"
                        aria-controls="component-inspector-panel-style"
                    >
                        Стилизация
                    </button>
                </nav>
            </header>
            <section
                className="component-inspector-body"
                role="tabpanel"
                id="component-inspector-panel-style"
                aria-labelledby="component-inspector-tab-style"
            >
                <InspectorVariants
                    config={config}
                    api={api}
                    selection={selection}
                    onSelectionChange={onSelectionChange}
                    onConfigUpdate={onConfigUpdate}
                    storyArgs={storyArgs}
                />
                <InspectorSections
                    config={config}
                    api={api}
                    selection={selection}
                    tokens={tokens}
                    updated={updated}
                    onConfigUpdate={onConfigUpdate}
                />
            </section>
        </aside>
    );
};
