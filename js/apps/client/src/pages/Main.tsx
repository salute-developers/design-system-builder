import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { general } from '@salutejs/plasma-colors';
import {
    IconArrowLeft,
    IconGroupOutline,
    IconFolderOutline,
    IconBookOutline,
    IconCloudUploadOutline,
    IconSettingsOutline,
} from '@salutejs/plasma-icons';

import styles from '@salutejs/plasma-themes/css/plasma_infra.module.css';

import { transliterateToSnakeCase, hasDraft, isDebugMode } from '../utils';
import { IconPaletteOutline, IconShapeOutline, IconTypography } from '../icons';
import { useDesignSystem, useForceRerender } from '../hooks';
import { GrayTone, Parameters } from '../types';
import { CreateFirstName, SetupParameters, CreationProgress, PublishProgress } from '../popup';
import { Debug } from './Debug';

import { defaultParameters, popupContentPages } from './Main.utils';
import {
    EditorBody,
    EditorCanvas,
    EditorLoadingSpinner,
    MainItems,
    Root,
    Separator,
    StyledBasicButton,
    StyledIconButton,
    StyledPopup,
} from './Main.styles';
import { BuilderHierarchyBar, BuilderIconRail } from '../components/BuilderShell/BuilderShell';
import { all, any, choose, Visible } from '../components/rendering';
const loadErrorMessages = {
    forbidden: 'Нет доступа',
    'not-found': 'Theme не найдена',
    failed: 'Не удалось загрузить Theme',
} as const;

export const Main = () => {
    const navigate = useNavigate();
    const currentPath = useLocation().pathname.split('/').filter(Boolean);

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
            choose(all(projectId, designSystemId, tenantId), undefined, {
                projectId: projectId!,
                designSystemId: designSystemId!,
                tenantId: tenantId!,
            }),
        [projectId, designSystemId, tenantId],
    );
    const { designSystem, theme, components, incompleteTokenIds, loadError, reload } = useDesignSystem(
        choose<string | NonNullable<typeof editorContext> | undefined>(
            Boolean(editorContext),
            designSystemProjectId,
            editorContext!,
        ),
        designSystemName,
        designSystemVersion,
    );

    // Режим редактирования ДС — когда в URL выбрана конкретная дизайн-система (есть name + version)
    const isEditingDesignSystem = any(editorContext, all(designSystemName, designSystemVersion));
    const isReadOnly = designSystem?.getParameters()?.readOnly === true;
    // Раздел «Компоненты» показываем только если к ДС привязан хотя бы один компонент в базе
    const hasComponents = Boolean(components?.length);
    // Режим просмотра проектов — есть только projectId, дизайн-система не выбрана
    const isHome = all(!isPopupOpen, !isEditingDesignSystem);
    const hasUnpublishedChanges = Boolean(
        designSystemName && designSystemVersion && hasDraft(designSystemName, designSystemVersion),
    );
    const isPublishButtonVisible = isEditingDesignSystem && !isReadOnly && !isPopupOpen && hasUnpublishedChanges;
    const isEditorLoading = all(editorContext, !designSystem, !loadError);

    const onChangeParameters = (name: keyof Parameters, value: Parameters[keyof Parameters]) => {
        setParameters((prev) => ({ ...prev, [name]: value }));
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
            navigate('/', { replace: true });
            return;
        }

        // Раздел идёт сразу после версии, а у разделов могут быть вложенные сегменты
        // (например выбранный компонент в /components/:componentName) — строим путь от версии,
        // чтобы при переключении раздела они сбрасывались.
        const newPath = choose(
            Boolean(editorContext),
            `/${designSystemProjectId}/${designSystemName}/${designSystemVersion}/${path}`,
            `/projects/${editorContext?.projectId}/design-systems/${editorContext?.designSystemId}/themes/${editorContext?.tenantId}/${path}`,
        );

        navigate(newPath, { replace: true });
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
            navigate(`/${designSystemProjectId}`, { replace: true });
        }

        rerender(null);
    };

    const onDesignSystemPublish = () => {
        setIsPopupOpen(true);
        setPopupContentPage(popupContentPages.PUBLISH_PROGRESS);
    };

    const onPublishComplete = () => {
        onClickPanelButton('colors');
        onPopupClose();

        reload();
    };

    // TODO: Временное решение для получения projectId после создания дизайн-системы, придумать что-то получше
    useEffect(() => {
        if (designSystemProjectId) {
            setParameters((prev) => ({ ...prev, projectId: designSystemProjectId }));
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
                        <Visible when={!editorContext}>
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
                        </Visible>
                        <Visible when={isEditingDesignSystem}>
                            <>
                                <StyledIconButton
                                    className={`builder-rail-button ${currentPath.includes('colors') ? 'is-active' : ''}`}
                                    data-testid="editor-nav-colors"
                                    selected={currentPath.includes('colors')}
                                    onClick={() => onClickPanelButton('colors')}
                                >
                                    <IconPaletteOutline size="xs" color="inherit" />
                                </StyledIconButton>
                                <StyledIconButton
                                    className={`builder-rail-button ${currentPath.includes('typography') ? 'is-active' : ''}`}
                                    data-testid="editor-nav-typography"
                                    selected={currentPath.includes('typography')}
                                    onClick={() => onClickPanelButton('typography')}
                                >
                                    <IconTypography size="xs" color="inherit" />
                                </StyledIconButton>
                                <StyledIconButton
                                    className={`builder-rail-button ${currentPath.includes('shapes') ? 'is-active' : ''}`}
                                    data-testid="editor-nav-shapes"
                                    selected={currentPath.includes('shapes')}
                                    onClick={() => onClickPanelButton('shapes')}
                                >
                                    <IconShapeOutline size="xs" color="inherit" />
                                </StyledIconButton>
                                <Visible when={hasComponents}>
                                    <StyledIconButton
                                        className={`builder-rail-button ${currentPath.includes('components') ? 'is-active' : ''}`}
                                        data-testid="editor-nav-components"
                                        selected={currentPath.includes('components')}
                                        onClick={() => onClickPanelButton('components')}
                                    >
                                        <IconGroupOutline size="xs" color="inherit" />
                                    </StyledIconButton>
                                </Visible>
                                <Separator />
                                <StyledIconButton className="builder-rail-button" disabled>
                                    <IconBookOutline size="xs" color="inherit" />
                                </StyledIconButton>
                            </>
                        </Visible>
                    </MainItems>
                }
            />
            <EditorBody>
                <Visible when={Boolean(editorContext)}>
                    <BuilderHierarchyBar
                        title={theme?.getName() ?? 'Тема'}
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
                        ]}
                        action={choose(
                            isEditorLoading,
                            <Link
                                className="builder-icon-button"
                                to={`/projects/${projectId}/design-systems/${designSystemId}/themes/${tenantId}/settings`}
                                aria-label="Настройки темы"
                                title="Настройки темы"
                            >
                                <IconSettingsOutline size="xs" color="inherit" />
                            </Link>,
                            <EditorLoadingSpinner role="status" aria-label="Загрузка темы" />,
                        )}
                    />
                </Visible>
                <EditorCanvas>
                    <Outlet
                        context={{
                            projectName: designSystem?.getParameters()?.projectName ?? designSystemName,
                            projectId: projectId ?? designSystemProjectId,
                            designSystem,
                            theme,
                            components,
                            updated,
                            rerender,
                            onDesignSystemCreate,
                        }}
                    />
                </EditorCanvas>
            </EditorBody>
            <Visible when={isReadOnly}>
                <div className="editor-readonly-status" role="status">
                    Режим просмотра
                </div>
            </Visible>
            <Visible when={Boolean(loadError)}>
                <div role="alert">{loadErrorMessages[loadError!]}</div>
            </Visible>
            <Visible when={incompleteTokenIds.length > 0}>
                <div role="alert">
                    В теме отсутствуют значения {incompleteTokenIds.length} токенов. Редактор не смешивает их со
                    значениями другой темы.
                </div>
            </Visible>
            <Visible when={isPublishButtonVisible}>
                <StyledBasicButton
                    text="Опубликовать"
                    contentRight={<IconCloudUploadOutline size="xs" color="inherit" />}
                    onClick={onDesignSystemPublish}
                />
            </Visible>
            <Visible when={all(isEditingDesignSystem, !isReadOnly, isDebugMode())}>
                <Debug
                    designSystem={designSystem}
                    theme={theme}
                    components={components}
                    rerender={rerender}
                    reload={reload}
                />
            </Visible>
            <Visible when={isPopupOpen}>
                <StyledPopup>
                    <Visible when={popupContentPage === popupContentPages.CREATE_FIRST_NAME}>
                        <CreateFirstName onPrevPage={onPopupClose} onNextPage={onNextPageCreateFirstName} />
                    </Visible>
                    <Visible when={popupContentPage === popupContentPages.SETUP_PARAMETERS}>
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
                    </Visible>
                    <Visible when={popupContentPage === popupContentPages.CREATION_PROGRESS}>
                        <CreationProgress
                            parameters={parameters}
                            accentColor={general[accentColor][darkFillSaturation]}
                            onPrevPage={onPopupClose}
                            onNextPage={onCreateComplete}
                        />
                    </Visible>
                    <Visible when={popupContentPage === popupContentPages.PUBLISH_PROGRESS}>
                        <PublishProgress
                            designSystem={designSystem}
                            theme={theme}
                            components={components}
                            onPrevPage={onPopupClose}
                            onNextPage={onPublishComplete}
                        />
                    </Visible>
                </StyledPopup>
            </Visible>
        </Root>
    );
};
