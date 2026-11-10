import { useEffect, useState } from 'react';

import type { DesignSystemDto, ProjectDto, TenantDto } from '../api/types';
import type { ApplyExport, PackZip, PluginStorage } from '../bridge';
import { ApiError, type DsBuilderApi } from '../core/pluginCore';
import { useResource, type Resource } from '../hooks/useResource';
import { parseSavedContext, type SavedContext } from './contextSteps';
import { PickerStep } from './PickerStep';
import { TokensView } from './TokensView';

const CONTEXT_KEY = 'context';

/** Выбор проекта, дизайн-системы и темы, затем просмотр токенов. */
export const Browser = ({
    api,
    storage,
    applyExport,
    packZip,
    onSignOut,
}: {
    api: DsBuilderApi;
    storage: PluginStorage;
    applyExport: ApplyExport;
    packZip: PackZip;
    onSignOut: () => void;
}) => {
    const [saved, setSaved] = useState<SavedContext | null>(null);
    const [project, setProject] = useState<ProjectDto | null>(null);
    const [designSystem, setDesignSystem] = useState<DesignSystemDto | null>(null);
    const [tenant, setTenant] = useState<TenantDto | null>(null);
    // Запомненный контекст применяется только при открытии: после возврата на шаг выбирает пользователь.
    const [useSaved, setUseSaved] = useState(true);
    // Шаг, открытый крошкой или после отказа, показывает список, даже если вариант один. Следующие шаги снова пропускаются.
    const [opened, setOpened] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        storage.get(CONTEXT_KEY).then(
            (raw) => setSaved(parseSavedContext(raw)),
            () => setSaved({}),
        );
    }, [storage]);

    useEffect(() => {
        if (tenant && designSystem && project)
            void storage
                .set(
                    CONTEXT_KEY,
                    JSON.stringify({
                        projectId: project.id,
                        designSystemId: designSystem.id,
                        tenantId: tenant.id,
                    }),
                )
                .catch(() => undefined);
    }, [storage, project, designSystem, tenant]);

    const projects = useResource((signal) => api.projects(signal), [api]);
    const projectId = project?.id;
    const designSystemId = designSystem?.id;
    const systems = useResource(
        (signal) => (projectId ? api.designSystems(projectId, signal) : Promise.resolve([])),
        [api, projectId],
    );
    const tenants = useResource(
        (signal) =>
            projectId && designSystemId ? api.tenants({ projectId, designSystemId }, signal) : Promise.resolve([]),
        [api, projectId, designSystemId],
    );

    const backToProjects = () => {
        setProject(null);
        setDesignSystem(null);
        setTenant(null);
        setUseSaved(false);
        setOpened(true);
        setNotice(null);
    };
    const backToDesignSystems = () => {
        setDesignSystem(null);
        setTenant(null);
        setUseSaved(false);
        setOpened(true);
        setNotice(null);
    };
    const backToTenants = () => {
        setTenant(null);
        setUseSaved(false);
        setOpened(true);
        setNotice(null);
    };
    const choose =
        <T,>(set: (item: T) => void) =>
        (item: T) => {
            setOpened(false);
            setNotice(null);
            set(item);
        };
    const forbidden = (back: () => void, message: string) => {
        back();
        setNotice(message);
    };

    const denied = (resource: Resource<unknown>) =>
        resource.state === 'failed' && resource.error instanceof ApiError && resource.error.kind === 'forbidden';
    const systemsDenied = denied(systems.resource);
    const tenantsDenied = denied(tenants.resource);
    useEffect(() => {
        if (systemsDenied) forbidden(backToProjects, 'Нет доступа к этому проекту.');
        else if (tenantsDenied) forbidden(backToDesignSystems, 'Нет доступа к этой дизайн-системе.');
        // Переходы создаются заново на каждом рендере.
    }, [systemsDenied, tenantsDenied]);

    if (!saved)
        return (
            <p className="status" role="status">
                Загружаем…
            </p>
        );

    const projectsEmpty = projects.resource.state === 'ready' && projects.resource.data.length === 0;

    return (
        <div className="browser">
            <header className="toolbar">
                {/* Каждая крошка открывает страницу своего уровня, последняя показывает текущий и не нажимается. */}
                <nav aria-label="Контекст" className="crumbs">
                    <button
                        type="button"
                        disabled={!project || exporting}
                        aria-current={project ? undefined : 'page'}
                        onClick={backToProjects}
                    >
                        Проекты
                    </button>
                    {project && (
                        <button
                            type="button"
                            disabled={!designSystem || exporting}
                            aria-current={designSystem ? undefined : 'page'}
                            onClick={backToDesignSystems}
                        >
                            {project.name}
                        </button>
                    )}
                    {designSystem && (
                        <button
                            type="button"
                            disabled={!tenant || exporting}
                            aria-current={tenant ? undefined : 'page'}
                            onClick={backToTenants}
                        >
                            {designSystem.name}
                        </button>
                    )}
                    {tenant && (
                        <button type="button" disabled aria-current="page">
                            {tenant.name}
                        </button>
                    )}
                </nav>
                <button type="button" className="secondary" disabled={exporting} onClick={onSignOut}>
                    Выйти
                </button>
            </header>
            {notice && (
                <p className="note" role="alert">
                    {notice}
                </p>
            )}
            {!project && (
                <PickerStep
                    title="Проект"
                    {...projects}
                    loading="Загружаем проекты…"
                    empty={projectsEmpty ? 'Нет доступных проектов.' : ''}
                    savedId={useSaved ? saved.projectId : undefined}
                    automatic={!opened}
                    onSelect={choose(setProject)}
                />
            )}
            {project && !designSystem && (
                <PickerStep
                    title="Дизайн-система"
                    {...systems}
                    loading="Загружаем дизайн-системы…"
                    empty="В проекте нет дизайн-систем."
                    savedId={useSaved ? saved.designSystemId : undefined}
                    automatic={!opened}
                    onSelect={choose(setDesignSystem)}
                />
            )}
            {project && designSystem && !tenant && (
                <PickerStep
                    title="Тема"
                    {...tenants}
                    loading="Загружаем темы…"
                    empty="В дизайн-системе нет тем."
                    savedId={useSaved ? saved.tenantId : undefined}
                    automatic={!opened}
                    onSelect={choose(setTenant)}
                />
            )}
            {project && designSystem && tenant && (
                <TokensView
                    api={api}
                    context={{
                        projectId: project.id,
                        designSystemId: designSystem.id,
                        tenantId: tenant.id,
                    }}
                    themeName={tenant.name || 'Тема без названия'}
                    applyExport={applyExport}
                    packZip={packZip}
                    onExportingChange={setExporting}
                    onForbidden={() => forbidden(backToTenants, 'Нет доступа к этой теме.')}
                />
            )}
        </div>
    );
};
