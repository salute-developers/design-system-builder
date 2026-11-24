import { useLocation, useNavigate } from 'react-router-dom';
import { ComponentProblems } from '../../../../features/coreCompatibility/ComponentProblems';
import { InspectorCompatibilityContext } from '../../../../features/coreCompatibility/InspectorCompatibility';
import type { IssueRepairAccess } from '../../../../features/coreCompatibility/coreAssignmentRemoval';
import { issueNodeId } from '../../../../features/coreCompatibility/model';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
    resolveStyleReference,
    toStyleReferenceInput,
    type Config,
    type DesignSystem,
    type Theme,
} from '../../../../controllers';
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
import { structureErrorText } from '../ComponentStructure/structureErrorText';
import { componentStructureRepository } from '../../../../api/componentStructureRepository';
import { editSource, type Selection } from './inspectorModel';
import type { StoryArgs } from '../ComponentEditorPreview/storyArgs';

interface ComponentInspectorProps {
    compatibility?: IssueRepairAccess;
    compatibilityError?: string;
    onCompatibilityReload?: () => void;
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

type InspectorTab = 'style' | 'tree' | 'problems';

const TABS: Array<{ id: InspectorTab; label: string }> = [
    { id: 'style', label: 'Стилизация' },
    { id: 'tree', label: 'Структура' },
    { id: 'problems', label: 'Проблемы' },
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
    const [repairError, setRepairError] = useState('');
    const styleReferenceAccess = useMemo(
        () => ({ designSystem, loadComponent: onLoadComponent }),
        [designSystem, onLoadComponent],
    );
    // Выбранная вкладка запоминается между открытиями редактора; без структурных операций есть только «Стилизация».
    const [storedTab, setStoredTab] = useState<InspectorTab>(readTab);
    const location = useLocation();
    const navigate = useNavigate();
    const query = new URLSearchParams(location.search);
    const componentIssues =
        props.compatibility?.report.items.filter((i) => i.location.componentId === config.getComponentId()) ?? [];
    const problems = componentIssues.filter((i) => i.severity === 'blocking');
    const requested = query.get('section');
    const enabledTabs = { style: true, tree: Boolean(structure), problems: problems.length > 0 };
    const tabs = TABS.filter((item) => enabledTabs[item.id]);
    const tab =
        tabs.find((item) => item.id === requested)?.id ?? tabs.find((item) => item.id === storedTab)?.id ?? 'style';
    const focused = problems.find(
        (i) => i.issueId === query.get('issueId') && i.location.appearanceId === config.getConfigurationId(),
    );
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
        const search = new URLSearchParams(location.search);
        search.set('section', next);
        search.delete('issueId');
        navigate({ search: search.toString() });
        try {
            if (next !== 'problems') localStorage.setItem(TAB_STORAGE_KEY, next);
        } catch {
            // Вкладка — удобство: без хранилища она просто не запоминается.
        }
        document.getElementById(`component-inspector-tab-${next}`)?.focus();
    };
    // Пересечение правится, когда в «Variants» выбрано два стиля и больше: значения сразу уходят в ds-service.
    const configurationId = config.getConfigurationId();
    const source = editSource(config, selection);
    const combination = source.kind === 'combination' ? source.styleIDs : undefined;
    useEffect(() => {
        if (!focused || tab !== 'style') return;
        const timer = window.setTimeout(() => {
            const node = document.getElementById(issueNodeId(focused));
            node?.scrollIntoView?.({ block: 'center' });
            node?.focus({ preventScroll: true });
        }, 50);
        return () => window.clearTimeout(timer);
    }, [focused?.issueId, tab, configurationId, selection, updated]);
    const [combinationError, setCombinationError] = useState<string>();
    const [combinationReset, setCombinationReset] = useState(0);
    const scope = `${configurationId}:${combination?.join('+')}`;
    const currentScope = useRef(scope);
    currentScope.current = scope;
    useEffect(() => setCombinationError(undefined), [configurationId, combination?.join('+')]);
    const changeCombination = (propertyId: string, value: string | null, states?: string[], alpha?: number) => {
        if (!structure || !combination || !configurationId) return;
        setCombinationError(undefined);
        const property = designSystem.getComponentData(config)?.sources.api.find((item) => item.id === propertyId);
        const isReference =
            value !== null && config.getPlatform() === 'compose' && property?.type === 'component_style';
        const resolved = isReference
            ? resolveStyleReference(designSystem.getComposeComponentsData(), value)
            : undefined;
        const reference = resolved ? toStyleReferenceInput(resolved) : undefined;
        if (isReference && !reference) {
            setCombinationError('Не удалось найти выбранный вложенный стиль');
            return;
        }
        structure
            .run((context) =>
                value === null
                    ? componentStructureRepository.removeCombinationValue(
                          context,
                          configurationId,
                          combination,
                          propertyId,
                          states,
                      )
                    : componentStructureRepository.setCombinationValue(
                          context,
                          configurationId,
                          combination,
                          propertyId,
                          value,
                          undefined,
                          states,
                          alpha,
                          reference,
                      ),
            )
            .catch((error: unknown) => {
                if (currentScope.current !== scope) return;
                setCombinationError(
                    structureErrorText(error, {
                        states_not_supported: 'Это состояние больше не поддерживается свойством',
                        state_not_in_component: 'Состояние не принадлежит этому компоненту',
                    }),
                );
                setCombinationReset((value) => value + 1);
            });
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
                        const index = tabs.findIndex((item) => item.id === tab);
                        const next =
                            event.key === 'Home'
                                ? 0
                                : event.key === 'End'
                                  ? tabs.length - 1
                                  : event.key === 'ArrowRight'
                                    ? (index + 1) % tabs.length
                                    : event.key === 'ArrowLeft'
                                      ? (index + tabs.length - 1) % tabs.length
                                      : undefined;
                        if (next !== undefined) {
                            event.preventDefault();
                            selectTab(tabs[next].id);
                        }
                    }}
                >
                    {tabs.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            id={`component-inspector-tab-${item.id}`}
                            className={`${item.id === tab ? 'is-active' : ''}${item.id === 'problems' ? ' has-problems' : ''}`}
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
            {tab === 'problems' ? (
                <ComponentProblems
                    issues={problems}
                    error={props.compatibilityError}
                    retry={props.onCompatibilityReload ?? (() => undefined)}
                />
            ) : tab === 'tree' && structure ? (
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
                    {repairError && (
                        <p role="alert" className="component-property-error">
                            {repairError}
                        </p>
                    )}
                    {props.compatibilityError && (
                        <p role="alert">
                            Проверка совместимости недоступна.{' '}
                            <button onClick={props.onCompatibilityReload}>Повторить</button>
                        </p>
                    )}
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
                            <InspectorCompatibilityContext.Provider
                                value={
                                    props.compatibility
                                        ? {
                                              issues: componentIssues.filter(
                                                  (i) => i.location.appearanceId === config.getConfigurationId(),
                                              ),
                                              focused: focused?.issueId,
                                              access: {
                                                  ...props.compatibility,
                                                  onFailure: setRepairError,
                                                  onRefresh: props.onCompatibilityReload,
                                              },
                                          }
                                        : null
                                }
                            >
                                <StyleReferenceContext.Provider value={styleReferenceAccess}>
                                    <InspectorSections
                                        key={combinationReset}
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
                            </InspectorCompatibilityContext.Provider>
                        </div>
                    </div>
                </section>
            )}
        </aside>
    );
};
