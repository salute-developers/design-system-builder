import { useEffect, useMemo, useState } from 'react';

import type { Config, DesignSystem, Theme } from '../../../../controllers';
import { usePanelWidth } from '../../../../hooks';
import { INSPECTOR_PANEL } from '../../panelWidths';

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
import { InspectorGroup } from './InspectorGroup';
import { InspectorStoryArgs } from './InspectorStoryArgs';
import { InspectorConfiguration } from './InspectorConfiguration';
import { InspectorVariants } from './InspectorVariants';
import { StyleReferenceContext } from './StyleReferenceContext';
import { ComponentStructurePanel, type StructureAccess } from '../ComponentStructure';
import { componentStructureRepository } from '../../../../api/componentStructureRepository';
import { editSource, type Selection } from './inspectorModel';
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
    /** Выбор открытой конфигурации компонента. */
    onConfigurationSelect?: (configurationId: string | undefined) => void;
    /** Структурные операции; без них (только чтение) вкладки «Структура» нет. */
    structure?: StructureAccess;
    /** Догрузка компонента по маршруту для выбора стиля вложенного компонента. */
    onLoadComponent?: (route: string) => Promise<void>;
    /** Только просмотр: поля свойств неактивны, «Variants» и аргументы story работают. */
    readOnly?: boolean;
}

type InspectorTab = 'style' | 'tree';

const TABS: Array<{ id: InspectorTab; label: string }> = [
    { id: 'style', label: 'Стилизация' },
    { id: 'tree', label: 'Структура' },
];
const TAB_STORAGE_KEY = 'ds_component_inspector_tab';

const readTab = (): InspectorTab => {
    try {
        return localStorage.getItem(TAB_STORAGE_KEY) === 'tree' ? 'tree' : 'style';
    } catch {
        return 'style';
    }
};

/** Ширина инспектора: хранится рядом с шириной панели компонентов, полем `right`. */

/** Правая колонка редактора: вкладки и вкладка «Стилизация» — сочетание вариаций и его свойства. */
export const ComponentInspector = (props: ComponentInspectorProps) => {
    const { config, designSystem, theme, updated, selection, themeMode, onSelectionChange, onConfigUpdate, storyArgs } =
        props;
    const { structure, onConfigurationSelect, onLoadComponent } = props;
    const styleReferenceAccess = useMemo(
        () => ({ designSystem, loadComponent: onLoadComponent }),
        [designSystem, onLoadComponent],
    );
    // Выбранная вкладка запоминается между открытиями редактора; без структурных операций есть только «Стилизация».
    const [storedTab, setStoredTab] = useState<InspectorTab>(readTab);
    const tabs = structure ? TABS : TABS.slice(0, 1);
    const tab = structure ? storedTab : 'style';
    // Привязка свойства к вариации — сразу запросом, без перечитывания: значение следом уйдёт автосохранением.
    const linkProperty = useMemo(
        () =>
            structure
                ? (propertyId: string, variationId: string) =>
                      componentStructureRepository.linkProperty(structure.context, propertyId, variationId)
                : undefined,
        [structure],
    );
    const selectTab = (next: InspectorTab) => {
        setStoredTab(next);
        try {
            localStorage.setItem(TAB_STORAGE_KEY, next);
        } catch {
            // Вкладка — удобство: без хранилища она просто не запоминается.
        }
        document.getElementById(`component-inspector-tab-${next}`)?.focus();
    };
    // Пересечение правится, когда в «Variants» выбрано два стиля и больше: значения сразу уходят в ds-service.
    const configurationId = config.getConfigurationId();
    const source = editSource(config, selection);
    const combination = source.kind === 'combination' ? source.styleIDs : undefined;
    const [combinationError, setCombinationError] = useState<string>();
    useEffect(() => setCombinationError(undefined), [configurationId, combination?.join('+')]);
    const changeCombination = (propertyId: string, value: string | null) => {
        if (!structure || !combination || !configurationId) return;
        setCombinationError(undefined);
        structure
            .run((context) =>
                value === null
                    ? componentStructureRepository.removeCombinationValue(
                          context,
                          configurationId,
                          combination,
                          propertyId,
                      )
                    : componentStructureRepository.setCombinationValue(
                          context,
                          configurationId,
                          combination,
                          propertyId,
                          value,
                      ),
            )
            .catch(() => setCombinationError('Не удалось сохранить значение пересечения'));
    };
    const panel = usePanelWidth(INSPECTOR_PANEL);
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
                <nav
                    className="component-inspector-tabs"
                    role="tablist"
                    aria-label="Панели редактора"
                    onKeyDown={(event) => {
                        if (tabs.length < 2) return;
                        if (event.key === 'ArrowLeft' || event.key === 'Home') selectTab('style');
                        if (event.key === 'ArrowRight' || event.key === 'End') selectTab('tree');
                    }}
                >
                    {tabs.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            id={`component-inspector-tab-${item.id}`}
                            className={item.id === tab ? 'is-active' : ''}
                            aria-selected={item.id === tab}
                            aria-controls={`component-inspector-panel-${item.id}`}
                            tabIndex={item.id === tab ? 0 : -1}
                            onClick={() => selectTab(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>
            </header>
            {tab === 'tree' && structure ? (
                <section
                    className="component-inspector-body component-tree-pane"
                    role="tabpanel"
                    id="component-inspector-panel-tree"
                    aria-labelledby="component-inspector-tab-tree"
                >
                    <ComponentStructurePanel
                        config={config}
                        structure={structure}
                        selection={selection}
                        onSelectionChange={onSelectionChange}
                        onConfigurationSelect={onConfigurationSelect ?? (() => undefined)}
                    />
                </section>
            ) : (
                <section
                    className="component-inspector-body is-split"
                    role="tabpanel"
                    id="component-inspector-panel-style"
                    aria-labelledby="component-inspector-tab-style"
                >
                    {/* Конфигурация и вариации не прокручиваются: выбор источника правки всегда на месте, свойства прокручиваются под ним. */}
                    <div className="component-inspector-pinned">
                        {onConfigurationSelect && (
                            <InspectorConfiguration config={config} onConfigurationSelect={onConfigurationSelect} />
                        )}
                        <InspectorVariants
                            config={config}
                            selection={selection}
                            onSelectionChange={onSelectionChange}
                        />
                    </div>
                    <div className="component-inspector-scroll">
                        {/* Параметры story действуют только на превью: отдельно от вариаций, которые задают источник правки. */}
                        {storyArgs?.properties.length ? (
                            <InspectorGroup title="Предпросмотр">
                                <div className="component-variation-targets">
                                    <InspectorStoryArgs storyArgs={storyArgs} />
                                </div>
                            </InspectorGroup>
                        ) : null}
                        {combinationError && (
                            <p className="component-property-error" role="alert">
                                {combinationError}
                            </p>
                        )}
                        <div className="component-inspector-sections">
                            <StyleReferenceContext.Provider value={styleReferenceAccess}>
                                <InspectorSections
                                    config={config}
                                    api={api}
                                    selection={selection}
                                    tokens={tokens}
                                    updated={updated}
                                    onConfigUpdate={onConfigUpdate}
                                    onLinkProperty={linkProperty}
                                    onCombinationChange={changeCombination}
                                    readOnly={props.readOnly}
                                />
                            </StyleReferenceContext.Provider>
                        </div>
                    </div>
                </section>
            )}
        </aside>
    );
};
