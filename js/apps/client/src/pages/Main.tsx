import { getDsReadBoundary } from '../api/dsReadBoundary';
import { authService } from '../api/authService';
import { useCoreCompatibility } from '../hooks/useCoreCompatibility';
import { TyGlyph } from '../components/TyGlyph';
import '../styles/core-compatibility.css';
import { useChangedTokenNames } from '../features/versionJournal/useChangedTokenNames';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { IconFolderOutline, IconSettingsOutline } from '@salutejs/plasma-icons';
import { SymbolsOutline } from '@salutejs/sdds-icons/16';
import styles from '@salutejs/plasma-themes/css/plasma_infra.module.css';
import { isDebugMode, isComponentEditorEnabled } from '../utils';
import { useDesignSystem, useForceRerender } from '../hooks';
import { Debug } from './Debug';
import { EditorBody, EditorCanvas, MainItems, Root, Separator, StyledIconButton } from './Main.styles';
import { BuilderHierarchyBar, BuilderIconRail } from '../components/BuilderShell/BuilderShell';
import { ThemeSwitcher } from '../components/BuilderShell/ThemeSwitcher';
import { can } from '../features/projectPermissions';
import type { ProjectRole } from '../modules/projects/domain/project';
import { all, any, choose, Visible } from '../components/rendering';
import { IconColorSwatchOutline } from '../icons';
import { StyledSpinner as EditorLoadingSpinner } from '../components/EditorLoading/EditorLoading.styles';
import { ComponentsSectionSkeleton } from './components/ComponentsSectionSkeleton';

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
    'not-found': 'Тема недоступна',
    failed: 'Не удалось загрузить тему',
} as const;
const editorSectionLabels: Record<string, string> = {
    palette: 'Палитра',
    colors: 'Цветовые токены',
    typography: 'Типографика',
    shapes: 'Отступы, радиусы и тени',
    components: 'Компоненты',
    icons: 'Иконки',
    changes: 'Журнал изменений',
    versions: 'Версии',
    validation: 'Валидация',
    settings: 'Настройки дизайн-системы',
};
export const Main = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editorVersionId = searchParams.get('versionId') ?? undefined;
    const editorVersion = searchParams.get('version') ?? undefined;
    const location = useLocation();
    const [requestedPath, setRequestedPath] = useState<string>();
    const isSectionSwitching = all(requestedPath, requestedPath !== location.pathname);
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
        // Корневое чтение разрешает semver из URL; его смена тоже начинает новую загрузку темы.
        [projectId, designSystemId, tenantId, editorVersionId, editorVersion],
    );

    const editorSection = currentPath[editorContext ? 6 : 3];
    const editorSectionLabel = editorSectionLabels[editorSection] ?? 'Редактор';
    /** Экраны токенов и палитра сами показывают загрузку скелетонами и ошибку загрузки с «Повторить». */
    const ownsSectionStates =
        Boolean(editorContext) && ['palette', 'colors', 'typography', 'shapes', 'icons'].includes(editorSection);
    /** Раздел компонентов на время загрузки показывает свой скелетон вместо общего спиннера. */
    const componentsSkeleton = Boolean(editorContext) && editorSection === 'components';
    const sectionSelection = useMemo(
        () => ({
            section: toEditorSection(editorSection),
            component: editorSection === 'components' ? currentPath[7] : undefined,
        }),
        [editorSection, currentPath[7]],
    );
    const themeEditorPath = `/projects/${projectId}/design-systems/${designSystemId}/themes/${tenantId}/colors`;
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
        componentLoading,
        componentError,
        hasConfiguredComponents,
        reload,
        loadComponent,
        palette,
        paletteError,
        setPalette,
        autosaveStatus,
        autosaveErrorMessage,
        lastSavedAt,
        retryAutosave,
        refreshChanges,
        refreshRevision,
    } = useDesignSystem(editorContext, true, sectionSelection);
    const editorParameters = designSystem?.getParameters();
    const boundary = editorContext
        ? getDsReadBoundary(editorContext.projectId, editorContext.designSystemId)
        : undefined;
    const navigationVersionId = editorVersionId ?? boundary?.versionId;
    const themeEditorSearch = navigationVersionId ? `?${new URLSearchParams({ versionId: navigationVersionId })}` : '';

    // Режим редактирования — когда в URL выбрана конкретная тема дизайн-системы
    const isEditingDesignSystem = Boolean(editorContext);
    const isReadOnly = editorParameters?.readOnly === true;
    const isPublicView = boundary?.accessMode === 'public';
    const projectReadContext = choose(all(designSystem, !loadError, !isPublicView), undefined, editorContext);
    const compatibility = useCoreCompatibility(projectReadContext);
    // Раздел «Компоненты» показываем, если к ДС привязан хотя бы один компонент. Пока тема грузится, кнопка видна
    // вместе с остальными: иначе она появляется с задержкой и сдвигает нижние кнопки.
    const hasComponents = all(isComponentEditorEnabled(), any(hasConfiguredComponents, !designSystem));
    // Режим просмотра проектов — есть только projectId, дизайн-система не выбрана
    const isHome = !isEditingDesignSystem;
    const isEditorLoading = all(editorContext, !designSystem, !loadError);
    const sectionPending = !loadError && any(isSectionSwitching, isEditorLoading, sectionLoading);
    const journalComponents = useMemo(() => designSystem?.getComponentsData() ?? [], [designSystem]);
    const journalOpen = ['changes', 'versions'].includes(editorSection);
    const editorJournal = useJournal(
        projectReadContext,
        journalComponents,
        `${editorParameters?.draftId}:${editorParameters?.draftRevision}`,
        editorParameters?.readOnly !== false,
        journalOpen,
    );
    useReloadAfterAutosave(autosaveStatus, editorJournal.reload);
    const summaryCursor = `${editorParameters?.draftId}:${editorParameters?.draftRevision}:${lastSavedAt}:${refreshRevision}`;
    const changedTokenNames = useChangedTokenNames(
        projectReadContext,
        tokenDefinitions,
        summaryCursor,
        ['colors', 'shapes', 'typography'].includes(editorSection),
    );
    const journalHasTotal = all(journalOpen, !editorJournal.error, editorJournal.total !== undefined);
    const summaryNeeded = all(
        designSystem,
        any(!journalOpen, editorJournal.error, all(!editorJournal.loading, !journalHasTotal)),
    );
    const journalSummary = useJournalSummary(
        projectReadContext,
        `${summaryCursor}:${choose(all(summaryNeeded, journalOpen), '', editorJournal.readAt ?? '')}`,
        summaryNeeded,
    );
    const journalTotal = choose(journalHasTotal, journalSummary.total, editorJournal.total!);
    const journalCountError = choose(journalHasTotal, journalSummary.error, false);
    const reloadJournalAfterRevert = useCallback(async () => {
        await editorJournal.reloadChecked();
    }, [editorJournal.reloadChecked]);
    const railButtonClass = (section: string) =>
        `builder-rail-button ${currentPath.includes(section) ? 'is-active' : ''}`;
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
        setRequestedPath(newPath !== location.pathname ? newPath : undefined);
        navigate(`${newPath}${themeEditorSearch}`, {
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
                projectName={editorParameters?.projectName}
                main={
                    <MainItems>
                        {!editorContext && !loadError ? (
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
                        {isEditingDesignSystem && !loadError ? (
                            <>
                                <Visible when={Boolean(editorContext)}>
                                    <StyledIconButton
                                        className={railButtonClass('palette')}
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
                                        className={railButtonClass('colors')}
                                        data-testid="editor-nav-colors"
                                        aria-label={editorSectionLabels.colors}
                                        title={editorSectionLabels.colors}
                                        selected={currentPath.includes('colors')}
                                        onClick={() => onClickPanelButton('colors')}
                                    >
                                        <img className="builder-rail-icon" src={railColorsIcon} alt="" />
                                    </StyledIconButton>
                                    <StyledIconButton
                                        className={railButtonClass('typography')}
                                        data-testid="editor-nav-typography"
                                        aria-label={editorSectionLabels.typography}
                                        title={editorSectionLabels.typography}
                                        selected={currentPath.includes('typography')}
                                        onClick={() => onClickPanelButton('typography')}
                                    >
                                        <img className="builder-rail-icon" src={railTypographyIcon} alt="" />
                                    </StyledIconButton>
                                    <StyledIconButton
                                        className={railButtonClass('shapes')}
                                        data-testid="editor-nav-shapes"
                                        aria-label={editorSectionLabels.shapes}
                                        title={editorSectionLabels.shapes}
                                        selected={currentPath.includes('shapes')}
                                        onClick={() => onClickPanelButton('shapes')}
                                    >
                                        <img className="builder-rail-icon" src={railCornerRadiusIcon} alt="" />
                                    </StyledIconButton>
                                    {hasComponents ? (
                                        <>
                                            <StyledIconButton
                                                className={railButtonClass('components')}
                                                data-testid="editor-nav-components"
                                                aria-label={editorSectionLabels.components}
                                                title={editorSectionLabels.components}
                                                selected={currentPath.includes('components')}
                                                onClick={() => onClickPanelButton('components')}
                                            >
                                                <img className="builder-rail-icon" src={railComponentsIcon} alt="" />
                                            </StyledIconButton>
                                        </>
                                    ) : null}
                                    <StyledIconButton
                                        className={railButtonClass('icons')}
                                        data-testid="editor-nav-icons"
                                        aria-label={editorSectionLabels.icons}
                                        title={editorSectionLabels.icons}
                                        selected={currentPath.includes('icons')}
                                        onClick={() => onClickPanelButton('icons')}
                                    >
                                        <SymbolsOutline color="inherit" />
                                    </StyledIconButton>
                                    {!isPublicView && (
                                        <>
                                            <Separator />
                                            <StyledIconButton
                                                className={railButtonClass('changes')}
                                                data-testid="editor-nav-changes"
                                                selected={currentPath.includes('changes')}
                                                onClick={() => onClickPanelButton('changes')}
                                                aria-label="Изменения дизайн-системы"
                                                title="Изменения дизайн-системы"
                                            >
                                                <img className="builder-rail-icon" src={railChangesIcon} alt="" />
                                            </StyledIconButton>
                                            <StyledIconButton
                                                className={railButtonClass('validation')}
                                                data-testid="editor-nav-validation"
                                                selected={currentPath.includes('validation')}
                                                onClick={() => onClickPanelButton('validation')}
                                                aria-label={
                                                    compatibility.report?.blockingCount
                                                        ? 'Валидация, есть проблемы совместимости'
                                                        : 'Валидация'
                                                }
                                                title="Валидация"
                                            >
                                                <TyGlyph name="warning" />
                                                {Boolean(compatibility.report?.blockingCount) && (
                                                    <span className="core-rail-danger-dot" aria-hidden="true" />
                                                )}
                                            </StyledIconButton>
                                        </>
                                    )}
                                    <StyledIconButton
                                        className={railButtonClass('versions')}
                                        data-testid="editor-nav-versions"
                                        selected={currentPath.includes('versions')}
                                        onClick={() => onClickPanelButton('versions')}
                                        aria-label="Версии дизайн-системы"
                                        title="Версии дизайн-системы"
                                    >
                                        <img className="builder-rail-icon" src={railVersionsIcon} alt="" />
                                    </StyledIconButton>
                                    {authService.isAuthenticated() && !isPublicView && (
                                        <StyledIconButton
                                            className={railButtonClass('settings')}
                                            selected={currentPath.includes('settings')}
                                            onClick={() => onClickPanelButton('settings')}
                                            disabled={isEditorLoading}
                                            aria-label="Настройки дизайн-системы"
                                            title="Настройки дизайн-системы"
                                        >
                                            <IconSettingsOutline size="xs" color="inherit" />
                                        </StyledIconButton>
                                    )}
                                </>
                            </>
                        ) : null}
                    </MainItems>
                }
            />
            <EditorBody>
                {Boolean(editorContext) && !loadError ? (
                    <>
                        <BuilderHierarchyBar
                            title={editorSectionLabel}
                            projectName={editorParameters?.projectName ?? 'Проект'}
                            projectId={isPublicView ? undefined : projectId}
                            ariaLabel="Навигация темы"
                            rootless
                            loading={isEditorLoading}
                            breadcrumbSegments={[
                                ...(!isPublicView
                                    ? [
                                          {
                                              label: editorParameters?.projectName ?? 'Проект',
                                              to: `/projects/${projectId}`,
                                          },
                                      ]
                                    : []),
                                {
                                    label: designSystem?.getName() ?? 'Дизайн-система',
                                    to: `/projects/${projectId}/design-systems/${designSystemId}`,
                                },
                                {
                                    label: theme?.getName() ?? 'Тема',
                                    to: `${themeEditorPath}${themeEditorSearch}`,
                                    render: designSystem && editorContext && (
                                        <ThemeSwitcher
                                            context={{ ...editorContext, versionId: navigationVersionId }}
                                            currentName={theme?.getName() ?? 'Тема'}
                                            canCreate={
                                                !editorVersionId &&
                                                designSystem?.getParameters()?.readOnly === false &&
                                                can(
                                                    (designSystem.getParameters()?.effectiveRole ??
                                                        'viewer') as ProjectRole,
                                                    'tenants:write',
                                                )
                                            }
                                        />
                                    ),
                                },
                            ]}
                            action={
                                isEditorLoading ? null : (
                                    <div className="editor-version-actions">
                                        {Boolean(
                                            editorContext &&
                                            !editorContext?.versionId &&
                                            editorParameters?.readOnly === false,
                                        ) ? (
                                            <>
                                                <AutosaveIndicator
                                                    status={autosaveStatus}
                                                    errorMessage={autosaveErrorMessage}
                                                    retry={retryAutosave}
                                                    lastSavedAt={lastSavedAt}
                                                />
                                            </>
                                        ) : null}
                                        {isReadOnly && editorSection !== 'components' && (
                                            <span className="editor-readonly-badge" role="status">
                                                Только просмотр
                                            </span>
                                        )}
                                        {editorContext && (
                                            <EditorVersionSelect
                                                context={{ ...editorContext, versionId: navigationVersionId }}
                                                publishedOnly={isPublicView}
                                                draftId={editorParameters?.draftId}
                                                selectedVersion={designSystem?.getVersion()}
                                            />
                                        )}
                                        {editorContext &&
                                            designSystem &&
                                            (!editorVersionId || designSystem.getVersion()) && (
                                                <McpLinkButton
                                                    projectId={editorContext.projectId}
                                                    designSystemId={editorContext.designSystemId}
                                                    version={navigationVersionId ? designSystem.getVersion()! : 'draft'}
                                                />
                                            )}
                                        <Visible when={!isPublicView}>
                                            <JournalButton
                                                className="primary editor-changes-button"
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
                                        </Visible>
                                    </div>
                                )
                            }
                        />
                    </>
                ) : null}
                <EditorCanvas>
                    {loadError ? (
                        <div className="editor-load-error" role="alert">
                            <h1>{loadErrorMessages[loadError]}</h1>
                            {loadError === 'not-found' && <p>Проверьте ссылку или войдите, если у вас есть доступ.</p>}
                            <div className="editor-load-error-actions">
                                <button className="ps-button" type="button" onClick={reload}>
                                    Повторить
                                </button>
                                {!authService.isAuthenticated() &&
                                    (loadError === 'not-found' || loadError === 'forbidden') && (
                                        <button
                                            className="ps-button"
                                            type="button"
                                            onClick={() =>
                                                navigate(
                                                    `/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`,
                                                )
                                            }
                                        >
                                            Войти
                                        </button>
                                    )}
                            </div>
                        </div>
                    ) : componentsSkeleton && sectionPending ? (
                        <ComponentsSectionSkeleton />
                    ) : !ownsSectionStates && sectionPending ? (
                        <div
                            className="editor-section-loading"
                            role="status"
                            aria-label={isEditorLoading ? 'Загружаем тему…' : 'Открываем раздел'}
                        >
                            <EditorLoadingSpinner aria-hidden="true" />
                        </div>
                    ) : sectionError && !ownsSectionStates ? (
                        <div role="alert">
                            Не удалось загрузить раздел{' '}
                            <button type="button" onClick={reload}>
                                Повторить
                            </button>
                        </div>
                    ) : (
                        <Outlet
                            context={{
                                projectName: editorParameters?.projectName ?? designSystem?.getName(),
                                projectId: projectId ?? designSystemProjectId,
                                designSystem,
                                theme,
                                components,
                                composeComponents,
                                updated,
                                rerender,
                                reload,
                                loadComponent,
                                componentLoading,
                                componentError,
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
                                sectionError,
                                // Тема ещё не загружена целиком: экраны токенов и палитра показывают свои скелетоны.
                                sectionPending,
                            }}
                        />
                    )}
                </EditorCanvas>
                {!loadError && incompleteTokenIds.length > 0 ? (
                    <>
                        <div role="alert">
                            В теме отсутствуют значения {incompleteTokenIds.length} токенов. Редактор не смешивает их со
                            значениями другой темы.
                        </div>
                    </>
                ) : null}
            </EditorBody>
            {Boolean(isEditingDesignSystem && !loadError && !isReadOnly && isDebugMode()) ? (
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
