import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

import { BuilderShell } from '../../../components/BuilderShell/BuilderShell';
import { State } from '../../../components/Catalog/Catalog';
import { projectsApi } from '../../../modules/projects/data/projectsApi';
import { isAccessDenied, useLoad } from '../../../shared/data/useLoad';
import { useIconCatalog } from '../application/useIconCatalog';
import { IconBrowser } from './IconBrowser';

const Content = styled.section`
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    height: 100%;
    box-sizing: border-box;
    min-height: 0;
`;

const Meta = styled.p`
    margin: 0;
    color: var(--p-muted, inherit);
    font-size: 14px;
`;

const Manual = styled.output`
    display: block;
    user-select: all;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--p-surface, rgba(128, 128, 128, 0.15));
`;

const CONFIRM_MS = 1200;

const formatLoadedAt = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU').format(date);
};

/**
 * Страница каталога иконок проекта: поиск, фильтры, копирование канонического имени. С `embedded` показывается
 * разделом редактора темы (внутри его левой панели и шапки), без собственной оболочки.
 */
export const IconsPage = ({ embedded = false }: { embedded?: boolean }) => {
    const { projectId = '' } = useParams();
    const project = useLoad((signal) => projectsApi.get(projectId, signal), [projectId], `project:${projectId}`);
    const catalog = useIconCatalog(projectId);
    const [confirmed, setConfirmed] = useState<string>();
    const [manual, setManual] = useState<string>();
    const timer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => () => clearTimeout(timer.current), []);

    const shellProps = {
        title: 'Иконки',
        back: `/projects/${projectId}`,
        projectName: project.data?.name,
        projectId,
        embedded,
    };

    if (isAccessDenied(catalog.error)) return <State text="Нет доступа" kind="system" {...shellProps} />;
    if (catalog.error) {
        return (
            <State
                text="Не удалось загрузить каталог иконок"
                kind="system"
                retry={() => catalog.reload()}
                {...shellProps}
            />
        );
    }
    if (!catalog.data) return <State text="Загружаем каталог иконок…" kind="system" {...shellProps} />;

    const data = catalog.data;
    const copy = async (name: string) => {
        try {
            await navigator.clipboard.writeText(name);
            setManual(undefined);
            setConfirmed(name);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setConfirmed(undefined), CONFIRM_MS);
        } catch {
            setManual(name);
        }
    };

    return (
        <BuilderShell
            title={shellProps.title}
            back={shellProps.back}
            projectName={shellProps.projectName}
            projectId={projectId}
            embedded={embedded}
        >
            <Content>
                {!embedded && <h1>Иконки</h1>}
                {data.icons.length === 0 ? (
                    <p>
                        Каталог иконок ещё не загружен. Загрузите его командой <code>dsbuilder icons publish</code>.
                    </p>
                ) : (
                    <>
                        <Meta>
                            {data.source
                                ? `${data.source.package} ${data.source.version}, загружено ${formatLoadedAt(data.source.loadedAt)}, `
                                : ''}
                            иконок: {data.icons.length}
                        </Meta>
                        {manual && (
                            <Manual role="status" aria-label="Имя для копирования">
                                {manual}
                            </Manual>
                        )}
                        <IconBrowser
                            catalog={data}
                            confirmedName={confirmed}
                            onSelect={(icon) => void copy(icon.name)}
                        />
                    </>
                )}
            </Content>
        </BuilderShell>
    );
};
