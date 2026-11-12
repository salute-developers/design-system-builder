import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';

import { BuilderShell } from '../../../components/BuilderShell/BuilderShell';
import { State } from '../../../components/Catalog/Catalog';
import {
    InspectorHeader,
    PanelSkeleton,
    SectionHeader,
    TreeEmpty,
    TreeHeader,
    WorkspaceLoadError,
    readWidths,
    usePanelWidths,
} from '../../../components/tokenWorkspace';
import { projectsApi } from '../../../modules/projects/data/projectsApi';
import { isAccessDenied, useLoad } from '../../../shared/data/useLoad';
import { useIconCatalog } from '../application/useIconCatalog';
import {
    ICON_SIZES,
    iconAssetUrl,
    toLegacyValue,
    type IconCatalog,
    type IconEntry,
    type IconSize,
} from '../domain/iconCatalog';
import { IconFilters } from './IconFilters';
import { IconGrid } from './IconGrid';
import { IconMask } from './IconMask';
import { useIconFilter } from './useIconFilter';
import '../../../styles/size-tokens.css';
import './icons.css';

const CONFIRM_MS = 1200;
const ICONS_PANELS_KEY = 'ds_icons_panels';

const formatLoadedAt = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU').format(date);
};

const STYLE_LABELS = { outline: 'Outline', 'outline-bold': 'Outline Bold', fill: 'Fill', none: '—' } as const;

/** Строка сведений инспектора: подпись слева, значение справа. */
const Row = ({ label, children }: { label: string; children: string }) => (
    <div className="tw-field-inline">
        <span className="tw-field-label">{label}</span>
        <span className="icon-value" title={children}>
            {children}
        </span>
    </div>
);

interface DetailsProps {
    catalog: IconCatalog;
    icon?: IconEntry;
    size: IconSize;
    confirmed?: string;
    manual?: string;
    onCopy: (text: string) => void;
}

/** Правая панель: сведения о выбранной иконке и копирование имени и значения; без выбора — об источнике каталога. */
const Details = ({ catalog, icon, size, confirmed, manual, onCopy }: DetailsProps) => {
    if (!icon) {
        const source = catalog.source;
        return (
            <>
                <InspectorHeader
                    title="Каталог иконок"
                    description={source ? `${source.package} ${source.version}` : ''}
                />
                <div className="tw-section">
                    <SectionHeader title="Источник" />
                    {source && <Row label="Загружен">{formatLoadedAt(source.loadedAt)}</Row>}
                    <Row label="Иконок">{String(catalog.icons.length)}</Row>
                </div>
                <p className="icon-note">Выберите иконку, чтобы увидеть её значение и скопировать имя.</p>
            </>
        );
    }
    const value = toLegacyValue(icon, size);
    return (
        <>
            <InspectorHeader title={icon.name} description={icon.category ?? ''} />
            <div className="icon-preview">
                <IconMask url={iconAssetUrl(catalog, icon.name, size)} size={size} />
            </div>
            <div className="tw-section">
                <SectionHeader title="Сведения" />
                <Row label="Значение">{value}</Row>
                <Row label="Начертание">{STYLE_LABELS[icon.style]}</Row>
                <Row label="Размеры">{ICON_SIZES.filter((item) => icon.sizes.includes(item)).join(', ')}</Row>
                {icon.aliases.length > 0 && <Row label="Синонимы">{icon.aliases.join(', ')}</Row>}
            </div>
            <div className="icon-actions">
                <button type="button" className="tw-action-button is-secondary" onClick={() => onCopy(icon.name)}>
                    {confirmed === icon.name ? 'Скопировано' : 'Скопировать имя'}
                </button>
                <button type="button" className="tw-action-button is-secondary" onClick={() => onCopy(value)}>
                    {confirmed === value ? 'Скопировано' : 'Скопировать значение'}
                </button>
            </div>
            {manual && (
                <output className="icon-note icon-value" aria-label="Текст для копирования">
                    {manual}
                </output>
            )}
        </>
    );
};

/**
 * Загрузка и ошибка загрузки раздела: те же три панели и ширины, что у экрана, поэтому дерево слева не пропадает и
 * не прыгает, пока каталог загружается (как `SizeTokensPlaceholder` у «Размеров»).
 */
const Placeholder = ({ failed = false, onRetry }: { failed?: boolean; onRetry?: () => void }) => {
    const { left, right } = readWidths(ICONS_PANELS_KEY);
    return (
        <div className="size-tokens-screen st-shell icons-screen" data-testid="icons-loading" aria-busy={!failed}>
            <section
                className="st-workbench is-placeholder"
                style={{ '--panel-left': `${left}px`, '--panel-right': `${right}px` } as CSSProperties}
            >
                <aside className="token-browser st-tree">
                    <TreeHeader
                        title="Иконки"
                        searching={false}
                        query=""
                        onQuery={() => undefined}
                        onSearchOpen={() => undefined}
                    />
                    <div className="st-tree-body">{!failed && <PanelSkeleton part="tree" />}</div>
                </aside>
                {failed ? (
                    <div className="st-load-error">
                        <WorkspaceLoadError title="Не удалось загрузить каталог иконок" onRetry={onRetry} />
                    </div>
                ) : (
                    <>
                        <main className="preview-canvas">
                            <PanelSkeleton part="workspace" />
                        </main>
                        <aside className="properties-panel">
                            <PanelSkeleton part="inspector" />
                        </aside>
                    </>
                )}
            </section>
        </div>
    );
};

/** Экран каталога: слева категории, по центру фильтры и сетка, справа сведения об иконке. */
const Screen = ({ catalog }: { catalog: IconCatalog }) => {
    const filter = useIconFilter(catalog);
    const { panels, separator } = usePanelWidths(ICONS_PANELS_KEY);
    const [searchOpen, setSearchOpen] = useState(false);
    const [selected, setSelected] = useState<IconEntry>();
    const [confirmed, setConfirmed] = useState<string>();
    const [manual, setManual] = useState<string>();
    const timer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => () => clearTimeout(timer.current), []);

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setManual(undefined);
            setConfirmed(text);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setConfirmed(undefined), CONFIRM_MS);
        } catch {
            setManual(text);
        }
    };

    const categoryRow = (name: string | null, count: number) => (
        <div key={name ?? 'all'} className="st-tree-row-wrap tw-tree-row">
            <button
                type="button"
                className={`st-tree-row tw-tree-item ${filter.category === name ? 'is-selected' : ''}`}
                aria-current={filter.category === name ? 'true' : undefined}
                onClick={() => filter.setCategory(name)}
            >
                <span className="tw-tree-item-label">{name ?? 'Все'}</span>
                <b className="tw-tree-item-value st-tree-row-value">{count}</b>
            </button>
        </div>
    );

    return (
        <div
            className="size-tokens-screen st-shell icons-screen"
            data-testid="icons-screen"
            data-editor-section="icons"
        >
            <section
                className="st-workbench"
                style={{ '--panel-left': `${panels.left}px`, '--panel-right': `${panels.right}px` } as CSSProperties}
            >
                <button type="button" className="panel-resizer panel-resizer-left" {...separator('left')} />
                <button type="button" className="panel-resizer panel-resizer-right" {...separator('right')} />
                <aside className="token-browser st-tree">
                    <TreeHeader
                        title="Иконки"
                        placeholder="Найти иконку"
                        searchLabel="Поиск иконок"
                        searching={searchOpen}
                        query={filter.query}
                        onQuery={filter.setQuery}
                        onSearchOpen={setSearchOpen}
                    />
                    <nav className="st-tree-body" aria-label="Категории">
                        {categoryRow(null, catalog.icons.length)}
                        {filter.categories.map((item) => categoryRow(item.name, item.count))}
                    </nav>
                </aside>
                <main className="preview-canvas">
                    <div className="icon-board">
                        <div className="icon-board-bar">
                            <IconFilters
                                style={filter.style}
                                size={filter.size}
                                onStyle={filter.setStyle}
                                onSize={filter.setSize}
                            />
                            <span className="icon-board-count" role="status">
                                Найдено: {filter.icons.length}
                            </span>
                        </div>
                        {filter.icons.length === 0 ? (
                            <div className="icon-board-empty">
                                <TreeEmpty>Ничего не найдено</TreeEmpty>
                                <button type="button" className="tw-action-button is-secondary" onClick={filter.reset}>
                                    Сбросить фильтры
                                </button>
                            </div>
                        ) : (
                            <IconGrid
                                catalog={catalog}
                                icons={filter.icons}
                                size={filter.size}
                                selectedName={selected?.name}
                                onSelect={setSelected}
                            />
                        )}
                    </div>
                </main>
                <aside className="properties-panel">
                    <Details
                        catalog={catalog}
                        icon={selected}
                        size={
                            selected && selected.sizes.includes(filter.size)
                                ? filter.size
                                : (selected?.sizes[0] ?? filter.size)
                        }
                        confirmed={confirmed}
                        manual={manual}
                        onCopy={(text) => void copy(text)}
                    />
                </aside>
            </section>
        </div>
    );
};

/**
 * Страница каталога иконок проекта: категории слева, поиск, фильтры и сетка по центру, сведения об иконке справа.
 * Раздел редактора темы: внутри его рейла и шапки, без собственной оболочки (`embedded`).
 */
export const IconsPage = ({ embedded = false }: { embedded?: boolean }) => {
    const { projectId = '' } = useParams();
    const project = useLoad((signal) => projectsApi.get(projectId, signal), [projectId], `project:${projectId}`);
    const catalog = useIconCatalog(projectId);

    const shellProps = {
        title: 'Иконки',
        back: `/projects/${projectId}`,
        projectName: project.data?.name,
        projectId,
        embedded,
    };

    if (isAccessDenied(catalog.error)) return <State text="Нет доступа" kind="system" {...shellProps} />;
    if (embedded && catalog.error) return <Placeholder failed onRetry={() => catalog.reload()} />;
    if (embedded && !catalog.data) return <Placeholder />;
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
    const body =
        data.icons.length === 0 ? (
            <p className="icon-note">
                Каталог иконок ещё не загружен. Загрузите его командой <code>dsbuilder icons publish</code>.
            </p>
        ) : (
            <Screen catalog={data} />
        );

    if (embedded) return body;
    return (
        <BuilderShell
            title={shellProps.title}
            back={shellProps.back}
            projectName={shellProps.projectName}
            projectId={projectId}
            embedded={embedded}
        >
            {body}
        </BuilderShell>
    );
};
