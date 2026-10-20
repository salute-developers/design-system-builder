import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { general } from '@salutejs/plasma-colors';
import { IconArrowLeft, IconFolderOutline, IconSettingsOutline } from '@salutejs/plasma-icons';
import styles from '@salutejs/plasma-themes/css/plasma_infra.module.css';
import { transliterateToSnakeCase, isDebugMode, isComponentEditorEnabled } from '../utils';
import { useDesignSystem, useForceRerender } from '../hooks';
import { GrayTone, Parameters } from '../types';
import { CreateFirstName, SetupParameters, CreationProgress } from '../popup';
import { Debug } from './Debug';
import { defaultParameters, popupContentPages } from './Main.utils';
import { EditorBody, EditorCanvas, MainItems, Root, Separator, StyledIconButton, StyledPopup } from './Main.styles';
import { BuilderHierarchyBar, BuilderIconRail } from '../components/BuilderShell/BuilderShell';
import { Visible } from '../components/rendering';
import { IconColorSwatchOutline } from '../icons';
import { StyledSpinner as EditorLoadingSpinner } from '../components/EditorLoading/EditorLoading.styles';

import { AutosaveIndicator } from '../components/AutosaveIndicator';
import { EditorVersionSelect } from '../components/EditorVersionSelect';
import { useJournal, useReloadAfterAutosave } from '../features/versionJournal/useJournal';
import { Button as JournalButton } from './versionJournal/VersionJournalPages.styles';
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
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupContentPage, setPopupContentPage] = useState<keyof typeof popupContentPages | null>(
        popupContentPages.CREATE_FIRST_NAME,
    );
    const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
    const [grayTone, setGrayTone] = useState<GrayTone>('warmGray');
    const [parameters, setParameters] = useState<Parameters>(defaultParameters);
    const { accentColor, darkFillSaturation } = parameters;
    const { designSystemProjectId, designSystemName, designSystemVersion, projectId, designSystemId, tenantId } =
        useParams();
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
        loadError,
        reload,
        palette,
        paletteError,
        setPalette,
        autosaveStatus,
        lastSavedAt,
        retryAutosave,
        refreshChanges,
    } = useDesignSystem(
        Boolean(editorContext) ? editorContext! : designSystemProjectId,
        designSystemName,
        designSystemVersion,
    );

    // Режим редактирования ДС — когда в URL выбрана конкретная дизайн-система (есть name + version)
    const isEditingDesignSystem = Boolean(editorContext || Boolean(designSystemName && designSystemVersion));
    const isReadOnly = designSystem?.getParameters()?.readOnly === true;
    // Раздел «Компоненты» показываем только если к ДС привязан хотя бы один компонент в базе
    const hasComponents = isComponentEditorEnabled() && Boolean(components?.length || composeComponents.length);
    // Режим просмотра проектов — есть только projectId, дизайн-система не выбрана
    const isHome = Boolean(!isPopupOpen && !isEditingDesignSystem);
    const isEditorLoading = Boolean(editorContext && !designSystem && !loadError);
    const journalComponents = useMemo(() => designSystem?.getComponentsData() ?? [], [designSystem]);
    const editorJournal = useJournal(
        editorContext,
        journalComponents,
        designSystem,
        designSystem?.getParameters()?.readOnly !== false,
        Boolean(designSystem),
    );
    useReloadAfterAutosave(autosaveStatus, editorJournal.reload);
    const onChangeParameters = (name: keyof Parameters, value: Parameters[keyof Parameters]) => {
        setParameters((prev) => ({
            ...prev,
            [name]: value,
        }));
    };
    const onDesignSystemCreate = () => {
        setIsPopupOpen(true);
        setPopupContentPage(popupContentPages.CREATE_FIRST_NAME);
    };
    const onPopupClose = () => {
        setGrayTone('warmGray');
        setThemeMode('dark');
        setIsPopupOpen(false);
    };
    const onResetParameters = () => {
        setParameters(defaultParameters);
        setPopupContentPage(popupContentPages.CREATE_FIRST_NAME);
    };
    const onChangeGrayTone = (grayTone: string) => {
        setGrayTone(grayTone as GrayTone);
    };
    const onChangeThemeMode = (themeMode: ThemeMode) => {
        setThemeMode(themeMode);
    };
    const onNextPageCreateFirstName = (value: string) => {
        onChangeParameters('projectName', value);
        const transliteratedValue = transliterateToSnakeCase(value);
        onChangeParameters('packagesName', transliteratedValue);
        setPopupContentPage(popupContentPages.SETUP_PARAMETERS);
    };
    const onNextPageCreateSetupParameters = () => {
        setPopupContentPage(popupContentPages.CREATION_PROGRESS);
    };
    const onCreateComplete = (designSystemName: string, createdProjectId?: string) => {
        onPopupClose();
        const targetProjectId = createdProjectId ?? designSystemProjectId;
        if (targetProjectId) {
            navigate(`/${targetProjectId}/${designSystemName}/0.1.0/colors`);
        }
        onResetParameters();
    };
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
        const newPath = Boolean(editorContext)
            ? `/projects/${editorContext?.projectId}/design-systems/${editorContext?.designSystemId}/themes/${editorContext?.tenantId}/${path}`
            : `/${designSystemProjectId}/${designSystemName}/${designSystemVersion}/${path}`;
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
        onPopupClose();
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

    // TODO: Временное решение для получения projectId после создания дизайн-системы, придумать что-то получше
    useEffect(() => {
        if (designSystemProjectId) {
            setParameters((prev) => ({
                ...prev,
                projectId: designSystemProjectId,
            }));
        }
    }, [designSystemProjectId, projectId]);
    return (
        <Root className={styles[themeMode]} grayTone={grayTone} themeMode={themeMode} isPopupOpen={isPopupOpen}>
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
                                    {
                                        [
                                            <IconFolderOutline size="xs" color="inherit" />,
                                            <IconArrowLeft size="xs" color="inherit" />,
                                        ][Number(isPopupOpen)]
                                    }
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
                                        <img
                                            className="builder-rail-icon"
                                            src="/catalog/icons/rail-colors.svg"
                                            alt=""
                                        />
                                    </StyledIconButton>
                                    <StyledIconButton
                                        className={`builder-rail-button ${currentPath.includes('typography') ? 'is-active' : ''}`}
                                        data-testid="editor-nav-typography"
                                        selected={currentPath.includes('typography')}
                                        onClick={() => onClickPanelButton('typography')}
                                    >
                                        <img
                                            className="builder-rail-icon"
                                            src="/catalog/icons/rail-typography.svg"
                                            alt=""
                                        />
                                    </StyledIconButton>
                                    <StyledIconButton
                                        className={`builder-rail-button ${currentPath.includes('shapes') ? 'is-active' : ''}`}
                                        data-testid="editor-nav-shapes"
                                        selected={currentPath.includes('shapes')}
                                        onClick={() => onClickPanelButton('shapes')}
                                    >
                                        <img
                                            className="builder-rail-icon"
                                            src="/catalog/icons/rail-corner-radius.svg"
                                            alt=""
                                        />
                                    </StyledIconButton>
                                    {hasComponents ? (
                                        <>
                                            <StyledIconButton
                                                className={`builder-rail-button ${currentPath.includes('components') ? 'is-active' : ''}`}
                                                data-testid="editor-nav-components"
                                                selected={currentPath.includes('components')}
                                                onClick={() => onClickPanelButton('components')}
                                            >
                                                <img
                                                    className="builder-rail-icon"
                                                    src="/catalog/icons/rail-components.svg"
                                                    alt=""
                                                />
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
                                        <img
                                            className="builder-rail-icon"
                                            src="/catalog/icons/rail-changes.svg"
                                            alt=""
                                        />
                                    </StyledIconButton>
                                    <StyledIconButton
                                        className={`builder-rail-button ${currentPath.includes('versions') ? 'is-active' : ''}`}
                                        data-testid="editor-nav-versions"
                                        selected={currentPath.includes('versions')}
                                        onClick={() => onClickPanelButton('versions')}
                                        aria-label="Версии дизайн-системы"
                                    >
                                        <img
                                            className="builder-rail-icon"
                                            src="/catalog/icons/rail-versions.svg"
                                            alt=""
                                        />
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
                                            {!editorJournal.loading &&
                                                !editorJournal.error &&
                                                editorJournal.actions.length > 0 && (
                                                    <>
                                                        <span aria-hidden="true">·</span>
                                                        <span>{editorJournal.actions.length}</span>
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
                    {isSectionSwitching || isEditorLoading ? (
                        <div
                            className="editor-section-loading"
                            role="status"
                            aria-label={isEditorLoading ? 'Загружаем тему…' : 'Открываем раздел'}
                        >
                            <EditorLoadingSpinner aria-hidden="true" />
                        </div>
                    ) : (
                        <Outlet
                            context={{
                                projectName: designSystem?.getParameters()?.projectName ?? designSystemName,
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
                                incompleteTokenIds,
                                editorContext,
                                autosaveStatus,
                                editorJournal,
                                refreshChanges,
                                onDesignSystemCreate,
                            }}
                        />
                    )}
                </EditorCanvas>
            </EditorBody>
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
            {isPopupOpen ? (
                <>
                    <StyledPopup>
                        {popupContentPage === popupContentPages.CREATE_FIRST_NAME ? (
                            <>
                                <CreateFirstName onPrevPage={onPopupClose} onNextPage={onNextPageCreateFirstName} />
                            </>
                        ) : null}
                        {popupContentPage === popupContentPages.SETUP_PARAMETERS ? (
                            <>
                                <SetupParameters
                                    parameters={parameters}
                                    themeMode={themeMode}
                                    onChangeParameters={onChangeParameters}
                                    onPrevPage={onPopupClose}
                                    onResetParameters={onResetParameters}
                                    onChangeGrayTone={onChangeGrayTone}
                                    onChangeThemeMode={onChangeThemeMode}
                                    onNextPage={onNextPageCreateSetupParameters}
                                />
                            </>
                        ) : null}
                        {popupContentPage === popupContentPages.CREATION_PROGRESS ? (
                            <>
                                <CreationProgress
                                    parameters={parameters}
                                    accentColor={general[accentColor][darkFillSaturation]}
                                    onPrevPage={onPopupClose}
                                    onNextPage={onCreateComplete}
                                />
                            </>
                        ) : null}
                    </StyledPopup>
                </>
            ) : null}
        </Root>
    );
};
