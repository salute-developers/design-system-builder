import { useChangedTokenNames } from '../features/versionJournal/useChangedTokenNames';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { IconFolderOutline, IconSettingsOutline } from '@salutejs/plasma-icons';
import styles from '@salutejs/plasma-themes/css/plasma_infra.module.css';
import { isDebugMode, isComponentEditorEnabled } from '../utils';
import { useDesignSystem, useForceRerender } from '../hooks';
import { Debug } from './Debug';
import { EditorBody, EditorCanvas, MainItems, Root, Separator, StyledIconButton } from './Main.styles';
import { BuilderHierarchyBar, BuilderIconRail } from '../components/BuilderShell/BuilderShell';
import { Visible } from '../components/rendering';
import { IconColorSwatchOutline } from '../icons';
import { StyledSpinner as EditorLoadingSpinner } from '../components/EditorLoading/EditorLoading.styles';

import { AutosaveIndicator } from '../components/AutosaveIndicator';
import { McpLinkButton } from '../components/McpLinkButton';
import { EditorVersionSelect } from '../components/EditorVersionSelect';
import { useJournal, useReloadAfterAutosave } from '../features/versionJournal/useJournal';
import { Button as JournalButton } from './versionJournal/VersionJournalPages.styles';
import { editorSection as toEditorSection } from '../features/themeEditor/editorSections';
import { useJournalSummary } from '../features/versionJournal/useJournalSummary';
import railChangesIcon from '../assets/catalog/icons/rail-changes.svg';
import railColorsIcon from '../assets/catalog/icons/rail-colors.svg';
import railComponentsIcon from '../assets/catalog/icons/rail-components.svg';
import railCornerRadiusIcon from '../assets/catalog/icons/rail-corner-radius.svg';
import railTypographyIcon from '../assets/catalog/icons/rail-typography.svg';
import railVersionsIcon from '../assets/catalog/icons/rail-versions.svg';
const loadErrorMessages = {
    forbidden: 'Нет доступа',
    'not-found': 'Theme не найдена',
    failed: 'Не удалось загрузить Theme',
} as const;
const editorSectionLabels: Record<string, string> = {
    palette: 'Палитра',
    colors: 'Цветовые токены',
    typography: 'Типографика',
    shapes: 'Размеры и радиусы',
    components: 'Компоненты',
    changes: 'Журнал изменений',
    versions: 'Версии',
    settings: 'Настройки темы',
};
export const Main = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editorVersionId = searchParams.get('versionId') ?? undefined;
    const location = useLocation();
    const [requestedPath, setRequestedPath] = useState<string>();
    const isSectionSwitching = Boolean(requestedPath && requestedPath !== location.pathname);
    const currentPath = (isSectionSwitching ? requestedPath! : location.pathname).split('/').filter(Boolean);
    useLayoutEffect(() => {
        if (requestedPath === location.pathname) setRequestedPath(undefined);
    }, [location.pathname, requestedPath]);

    // TODO: Временное решение для обновления
    const [updated, rerender] = useForceRerender();
    const { designSystemProjectId, projectId, designSystemId, tenantId } = useParams();
    const editorContext = useMemo(
        () =>
            Boolean(projectId && designSystemId && tenantId)
                ? {
                      projectId: projectId!,
                      designSystemId: designSystemId!,
                      tenantId: tenantId!,
                      versionId: editorVersionId,
                  }
                : undefined,
        [projectId, designSystemId, tenantId, editorVersionId],
    );
    const editorSection = currentPath[editorContext ? 6 : 3];
    const editorSectionLabel = editorSectionLabels[editorSection] ?? 'Редактор';
    const sectionSelection = useMemo(
        () => ({
            section: toEditorSection(editorSection),
            component: editorSection === 'components' ? currentPath[7] : undefined,
        }),
        [editorSection, currentPath[7]],
    );
    const themeEditorPath = `/projects/${projectId}/design-systems/${designSystemId}/themes/${tenantId}/colors`;
    const themeEditorSearch = editorVersionId
        ? `?${new URLSearchParams({
              versionId: editorVersionId,
          })}`
        : '';
    const {
        designSystem,
        theme,
        components,
        composeComponents,
        incompleteTokenIds,
        tokenDefinitions,
        colorTokenGroups,
        loadError,
        sectionLoading,
        sectionError,
        hasConfiguredComponents,
        reload,
        palette,
        paletteError,
        setPalette,
        autosaveStatus,
        lastSavedAt,
        retryAutosave,
        refreshChanges,
    } = useDesignSystem(editorContext, true, sectionSelection);

    // Режим редактирования — когда в URL выбрана конкретная тема дизайн-системы
    const isEditingDesignSystem = Boolean(editorContext);
    const isReadOnly = designSystem?.getParameters()?.readOnly === true;
    // Раздел «Компоненты» показываем только если к ДС привязан хотя бы один компонент в базе
    const hasComponents = isComponentEditorEnabled() && hasConfiguredComponents;
    // Режим просмотра проектов — есть только projectId, дизайн-система не выбрана
    const isHome = !isEditingDesignSystem;
    const isEditorLoading = Boolean(editorContext && !designSystem && !loadError);
    const journalComponents = useMemo(() => designSystem?.getComponentsData() ?? [], [designSystem]);
    const journalOpen = editorSection === 'changes' || editorSection === 'versions';
    const editorJournal = useJournal(
        editorContext,
        journalComponents,
        `${designSystem?.getParameters()?.draftId}:${designSystem?.getParameters()?.draftRevision}`,
        designSystem?.getParameters()?.readOnly !== false,
        Boolean(designSystem) && journalOpen,
    );
    useReloadAfterAutosave(autosaveStatus, editorJournal.reload);
    const summaryCursor = `${designSystem?.getParameters()?.draftId}:${designSystem?.getParameters()?.draftRevision}:${lastSavedAt}`;
    const changedTokenNames = useChangedTokenNames(
        editorContext,
        tokenDefinitions,
        summaryCursor,
        Boolean(designSystem) && ['shapes', 'typography'].includes(editorSection),
    );
    const journalHasTotal = journalOpen && !editorJournal.error && editorJournal.total !== undefined;
    const summaryNeeded =
        Boolean(designSystem) &&
        (!journalOpen || Boolean(editorJournal.error) || (!editorJournal.loading && !journalHasTotal));
    const journalSummary = useJournalSummary(
        editorContext,
        `${summaryCursor}:${summaryNeeded && journalOpen ? (editorJournal.readAt ?? '') : ''}`,
        summaryNeeded,
    );
    const journalTotal = journalHasTotal ? editorJournal.total! : journalSummary.total;
    const journalCountError = journalHasTotal ? false : journalSummary.error;
    const reloadJournalAfterRevert = useCallback(async () => {
        await editorJournal.reloadChecked();
    }, [editorJournal.reloadChecked]);
    const onClickPanelButton = (path: string) => {
        if (path === '') {
            navigate('/', {
                replace: true,
            });
            return;
        }

        // Раздел идёт сразу после версии, а у разделов могут быть вложенные сегменты
        // (например выбранный компонент в /components/:componentName) — строим путь от версии,
        // чтобы при переключении раздела они сбрасывались.
        const newPath = `/projects/${editorContext?.projectId}/design-systems/${editorContext?.designSystemId}/themes/${editorContext?.tenantId}/${path}`;
        const versionQuery = editorContext?.versionId
            ? `?${new URLSearchParams({
                  versionId: editorContext.versionId,
              }).toString()}`
            : '';
        setRequestedPath(newPath !== location.pathname ? newPath : undefined);
        navigate(`${newPath}${versionQuery}`, {
            replace: true,
        });
    };
    const onHomeClick = () => {
        if (isHome) {
            return;
        }
        if (editorContext) {
            navigate(`/projects/${editorContext.projectId}/design-systems/${editorContext.designSystemId}`, {
                replace: true,
            });
        } else if (designSystemProjectId) {
            navigate(`/${designSystemProjectId}`, {
                replace: true,
            });
        }
        rerender(null);
    };

    return (
        <Root className={styles.dark} grayTone="warmGray" themeMode="dark">
            <div className="builder-shell-gradient" aria-hidden="true" />
            <BuilderIconRail
                testId="editor-rail"
                projectName={designSystem?.getParameters()?.projectName}
                main={
                    <MainItems>
                        {!editorContext ? (
                            <>
                                <StyledIconButton
                                    className={`builder-rail-button ${isHome ? 'is-active' : ''}`}
                                    selected={isHome}
                                    onClick={onHomeClick}
                                >
                                    <IconFolderOutline size="xs" color="inherit" />
                                </StyledIconButton>
                            </>
                        ) : null}
                        {isEditingDesignSystem ? (
                            <>
                                <Visible when={Boolean(editorContext)}>
                                    <StyledIconButton
                                        className={`builder-rail-button ${currentPath.includes('palette') ? 'is-active' : ''}`}
                                        data-testid="editor-nav-palette"
                                        aria-label="Палитра"
                                        title="Палитра"
                                        selected={currentPath.includes('palette')}
                                        onClick={() => onClickPanelButton('palette')}
                                    >
                                        <IconColorSwatchOutline size="xs" color="inherit" />
                                    </StyledIconButton>
                                </Visible>
                                <>
                                    <StyledIconButton
                                        className={`builder-rail-button ${currentPath.includes('colors') ? 'is-active' : ''}`}
                                        data-testid="editor-nav-colors"
                                        selected={currentPath.includes('colors')}
                                        onClick={() => onClickPanelButton('colors')}
                                    >
                                        <img className="builder-rail-icon" src={railColorsIcon} alt="" />
                                    </StyledIconButton>
                                    <StyledIconButton
                                        className={`builder-rail-button ${currentPath.includes('typography') ? 'is-active' : ''}`}
                                        data-testid="editor-nav-typography"
                                        selected={currentPath.includes('typography')}
                                        onClick={() => onClickPanelButton('typography')}
                                    >
                                        <img className="builder-rail-icon" src={railTypographyIcon} alt="" />
                                    </StyledIconButton>
                                    <StyledIconButton
                                        className={`builder-rail-button ${currentPath.includes('shapes') ? 'is-active' : ''}`}
                                        data-testid="editor-nav-shapes"
                                        selected={currentPath.includes('shapes')}
                                        onClick={() => onClickPanelButton('shapes')}
                                    >
                                        <img className="builder-rail-icon" src={railCornerRadiusIcon} alt="" />
                                    </StyledIconButton>
                                    {hasComponents ? (
                                        <>
                                            <StyledIconButton
                                                className={`builder-rail-button ${currentPath.includes('components') ? 'is-active' : ''}`}
                                                data-testid="editor-nav-components"
                                                selected={currentPath.includes('components')}
                                                onClick={() => onClickPanelButton('components')}
                                            >
                                                <img className="builder-rail-icon" src={railComponentsIcon} alt="" />
                                            </StyledIconButton>
                                        </>
                                    ) : null}
                                    <Separator />
                                    <StyledIconButton
                                        className={`builder-rail-button ${currentPath.includes('changes') ? 'is-active' : ''}`}
                                        data-testid="editor-nav-changes"
                                        selected={currentPath.includes('changes')}
                                        onClick={() => onClickPanelButton('changes')}
                                        aria-label="Изменения дизайн-системы"
                                    >
                                        <img className="builder-rail-icon" src={railChangesIcon} alt="" />
                                    </StyledIconButton>
                                    <StyledIconButton
                                        className={`builder-rail-button ${currentPath.includes('versions') ? 'is-active' : ''}`}
                                        data-testid="editor-nav-versions"
                                        selected={currentPath.includes('versions')}
                                        onClick={() => onClickPanelButton('versions')}
                                        aria-label="Версии дизайн-системы"
                                    >
                                        <img className="builder-rail-icon" src={railVersionsIcon} alt="" />
                                    </StyledIconButton>
                                    <StyledIconButton
                                        className={`builder-rail-button ${currentPath.includes('settings') ? 'is-active' : ''}`}
                                        selected={currentPath.includes('settings')}
                                        onClick={() => onClickPanelButton('settings')}
                                        disabled={Boolean(editorContext?.versionId)}
                                        aria-label="Настройки темы"
                                        title="Настройки темы"
                                    >
                                        <IconSettingsOutline size="xs" color="inherit" />
                                    </StyledIconButton>
                                </>
                            </>
                        ) : null}
                    </MainItems>
                }
            />
            <EditorBody>
                {Boolean(editorContext) ? (
                    <>
                        <BuilderHierarchyBar
                            title={editorSectionLabel}
                            projectName={designSystem?.getParameters()?.projectName ?? 'Проект'}
                            projectId={projectId}
                            ariaLabel="Навигация темы"
                            loading={isEditorLoading}
                            breadcrumbSegments={[
                                {
                                    label: designSystem?.getParameters()?.projectName ?? 'Проект',
                                    to: `/projects/${projectId}`,
                                },
                                {
                                    label: designSystem?.getName() ?? 'Дизайн-система',
                                    to: `/projects/${projectId}/design-systems/${designSystemId}`,
                                },
                                {
                                    label: theme?.getName() ?? 'Тема',
                                    to: `${themeEditorPath}${themeEditorSearch}`,
                                },
                            ]}
                            action={
                                isEditorLoading ? null : (
                                    <div className="editor-version-actions">
                                        {Boolean(
                                            editorContext &&
                                            !editorContext?.versionId &&
                                            designSystem?.getParameters()?.readOnly === false,
                                        ) ? (
                                            <>
                                                <AutosaveIndicator
                                                    status={autosaveStatus}
                                                    retry={retryAutosave}
                                                    lastSavedAt={lastSavedAt}
                                                />
                                            </>
                                        ) : null}
                                        {editorContext && (
                                            <EditorVersionSelect
                                                context={editorContext}
                                                draftId={designSystem?.getParameters()?.draftId}
                                                selectedVersion={designSystem?.getVersion()}
                                            />
                                        )}
                                        {editorContext &&
                                            designSystem &&
                                            (!editorVersionId || designSystem.getVersion()) && (
                                                <McpLinkButton
                                                    projectId={editorContext.projectId}
                                                    designSystemId={editorContext.designSystemId}
                                                    version={editorVersionId ? designSystem.getVersion()! : 'draft'}
                                                />
                                            )}
                                        <JournalButton
                                            className="primary"
                                            type="button"
                                            style={{
                                                gap: 6,
                                            }}
                                            onClick={() => onClickPanelButton('changes')}
                                        >
                                            Изменения
                                            {!journalCountError && journalTotal > 0 && (
                                                <>
                                                    <span aria-hidden="true">·</span>
                                                    <span>{journalTotal}</span>
                                                </>
                                            )}
                                        </JournalButton>
                                    </div>
                                )
                            }
                        />
                    </>
                ) : null}
                <EditorCanvas>
                    {isSectionSwitching || isEditorLoading || sectionLoading ? (
                        <div
                            className="editor-section-loading"
                            role="status"
                            aria-label={isEditorLoading ? 'Загружаем тему…' : 'Открываем раздел'}
                        >
                            <EditorLoadingSpinner aria-hidden="true" />
                        </div>
                    ) : sectionError ? (
                        <div role="alert">
                            Не удалось загрузить раздел{' '}
                            <button type="button" onClick={reload}>
                                Повторить
                            </button>
                        </div>
                    ) : (
                        <Outlet
                            context={{
                                projectName: designSystem?.getParameters()?.projectName ?? designSystem?.getName(),
                                projectId: projectId ?? designSystemProjectId,
                                designSystem,
                                theme,
                                components,
                                composeComponents,
                                updated,
                                rerender,
                                reload,
                                palette,
                                paletteError,
                                setPalette,
                                tokenDefinitions,
                                colorTokenGroups,
                                incompleteTokenIds,
                                editorContext,
                                autosaveStatus,
                                editorJournal: { ...editorJournal, reloadChecked: reloadJournalAfterRevert },
                                changedTokenNames,
                                refreshChanges,
                            }}
                        />
                    )}
                </EditorCanvas>
                {Boolean(loadError) ? (
                    <>
                        <div role="alert">{loadErrorMessages[loadError!]}</div>
                    </>
                ) : null}
                {incompleteTokenIds.length > 0 ? (
                    <>
                        <div role="alert">
                            В теме отсутствуют значения {incompleteTokenIds.length} токенов. Редактор не смешивает их со
                            значениями другой темы.
                        </div>
                    </>
                ) : null}
            </EditorBody>
            {Boolean(isEditingDesignSystem && !isReadOnly && isDebugMode()) ? (
                <>
                    <Debug
                        designSystem={designSystem}
                        theme={theme}
                        components={components}
                        rerender={rerender}
                        reload={reload}
                    />
                </>
            ) : null}
        </Root>
    );
};
