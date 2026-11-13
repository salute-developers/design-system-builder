import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import type { ExportCounts, ExportPlatform, ExportReport } from '../../shared/exportPlan';
import type { ApplyExport, PackZip } from '../bridge';
import { copyText } from '../clipboard';
import { ApiError, type DsBuilderApi, type TenantContext } from '../core/pluginCore';
import { FontArchiveButton } from '../fonts/FontArchiveButton';
import type { TypographyScreenId } from '../api/types';
import { useResource } from '../hooks/useResource';
import { groupBy, searchByName, type PaintValue, type TokenSnapshot } from '../tokens/snapshot';
import { ResourceView } from './common';
import { defaultVersionId, publishedVersions } from './contextSteps';

type Section = 'colors' | 'typography' | 'sizes';
type Mode = 'light' | 'dark';

const SECTIONS: Array<{ id: Section; label: string }> = [
    { id: 'colors', label: 'Цвета' },
    { id: 'typography', label: 'Типографика' },
    { id: 'sizes', label: 'Размеры' },
];

const SCREENS: Array<{ id: TypographyScreenId; label: string }> = [
    { id: 'screen-l', label: 'Крупные' },
    { id: 'screen-m', label: 'Средние' },
    { id: 'screen-s', label: 'Мелкие' },
];

const NOT_FOUND = 'Ничего не найдено.';

const Swatch = ({ value }: { value: PaintValue }) =>
    value.kind === 'color' || value.kind === 'gradient' ? (
        <span className="swatch" style={{ background: value.css }} aria-hidden="true" />
    ) : (
        <span className="swatch is-empty" aria-hidden="true" />
    );

/** Копирование из любой строки списка: обработчик даёт `TokensView`, он же показывает подтверждение. */
const CopyContext = createContext<(text: string) => void>(() => undefined);

/** Показанный текст, который копируется нажатием; `text` — что попадёт в буфер, если отличается от показанного. */
const Copy = ({ text, children, className }: { text: string; children?: ReactNode; className?: string }) => {
    const copy = useContext(CopyContext);
    return (
        <button
            type="button"
            className={`copy ${className ?? ''}`}
            title={`Скопировать: ${text}`}
            onClick={() => copy(text)}
        >
            {children ?? text}
        </button>
    );
};

const PaintCopy = ({ value }: { value: PaintValue }) => {
    if (value.kind === 'color') return <Copy text={value.css} />;
    if (value.kind === 'gradient') return <Copy text={value.css}>Градиент</Copy>;
    if (value.kind === 'unknown') return <Copy text={value.raw}>Не разобрано: {value.raw}</Copy>;
    return <>Нет значения</>;
};

const Colors = ({ snapshot, query, mode }: { snapshot: TokenSnapshot; query: string; mode: Mode }) => {
    const groups = groupBy(searchByName(snapshot.colors, query));
    if (!groups.length) return <p className="status">{NOT_FOUND}</p>;
    return (
        <>
            {groups.map(({ group, items }) => (
                <section key={group}>
                    <h3>{group}</h3>
                    <ul className="tokens">
                        {items.map((token) => (
                            <li key={token.id}>
                                <Swatch value={token[mode]} />
                                <span className="token-name">
                                    <Copy text={token.label} />
                                </span>
                                <span className="token-value">
                                    <PaintCopy value={token[mode]} />
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </>
    );
};

const Typography = ({
    snapshot,
    query,
    screen,
}: {
    snapshot: TokenSnapshot;
    query: string;
    screen: TypographyScreenId;
}) => {
    const styles = snapshot.typography.find((item) => item.screen === screen)?.styles ?? [];
    const groups = groupBy(searchByName(styles, query));
    if (!groups.length) return <p className="status">{NOT_FOUND}</p>;
    return (
        <>
            {groups.map(({ group, items }) => (
                <section key={group}>
                    <h3>{group}</h3>
                    <ul className="tokens">
                        {items.map((style) => (
                            <li key={style.id}>
                                <span className="token-name">
                                    <Copy text={style.label} />
                                </span>
                                <span className="token-value">
                                    <Copy text={`${style.sizePx}/${style.lineHeightPx}`} /> ·{' '}
                                    <Copy text={style.weights.join(', ')} /> · <Copy text={style.fontName} />
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </>
    );
};

const withLabel = <T extends { name: string }>(items: T[]) => items.map((item) => ({ ...item, label: item.name }));

const shadowText = (layers: TokenSnapshot['shadows'][number]['layers']) =>
    layers.map((layer) => `${layer.offsetX} ${layer.offsetY} ${layer.blur} ${layer.spread} ${layer.color}`).join('; ');

const Sizes = ({ snapshot, query }: { snapshot: TokenSnapshot; query: string }) => {
    const radii = searchByName(withLabel(snapshot.radii), query);
    const spacing = searchByName(withLabel(snapshot.spacing), query);
    const shadows = searchByName(withLabel(snapshot.shadows), query);
    if (!radii.length && !spacing.length && !shadows.length) return <p className="status">{NOT_FOUND}</p>;
    const dimensions = [
        { title: 'Радиусы', items: radii },
        { title: 'Отступы', items: spacing },
    ];
    return (
        <>
            {dimensions
                .filter(({ items }) => items.length)
                .map(({ title, items }) => (
                    <section key={title}>
                        <h3>{title}</h3>
                        <ul className="tokens">
                            {items.map((token) => (
                                <li key={token.id}>
                                    <span className="token-name">
                                        <Copy text={token.name} />
                                    </span>
                                    <span className="token-value">
                                        {token.fullRounding ? (
                                            <Copy text="Полное скругление" />
                                        ) : (
                                            <Copy text={`${token.valuePx}px`}>{token.valuePx} px</Copy>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            {shadows.length > 0 && (
                <section>
                    <h3>Тени</h3>
                    <ul className="tokens">
                        {shadows.map((token) => (
                            <li key={token.id}>
                                <span className="token-name">
                                    <Copy text={token.name} />
                                </span>
                                <span className="token-value">
                                    <Copy text={shadowText(token.layers)} />
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
};

const DRAFT = 'draft';

const KINDS: Array<{ key: keyof ExportCounts; label: string }> = [
    { key: 'collections', label: 'Коллекции' },
    { key: 'variables', label: 'Переменные' },
    { key: 'textStyles', label: 'Текстовые стили' },
    { key: 'effectStyles', label: 'Стили эффектов' },
    { key: 'paintStyles', label: 'Стили заливки' },
];

type ExportState =
    | { state: 'idle' }
    | { state: 'running' }
    | { state: 'done'; report: ExportReport; version: string }
    | { state: 'failed'; message: string };

/** Пропуски с одной причиной идут одной строкой: 54 стиля без шрифта не растягивают окно. */
const groupSkips = (skipped: ExportReport['skipped']) => {
    const groups = new Map<string, string[]>();
    skipped.forEach(({ name, reason }) => groups.set(reason, [...(groups.get(reason) ?? []), name]));
    return [...groups.entries()].map(([reason, names]) => ({ reason, names }));
};

/** Свёрнутый список с группировкой по причине. */
const ReasonList = ({ title, entries, testId }: { title: string; entries: ExportReport['skipped']; testId: string }) =>
    entries.length > 0 ? (
        <details data-testid={testId}>
            <summary>
                {title}: {entries.length}
            </summary>
            <ul>
                {groupSkips(entries).map(({ reason, names }) => (
                    <li key={reason}>
                        <span className="export-reason">
                            {reason} · {names.length}
                        </span>
                        <span className="export-names">{names.join(', ')}</span>
                    </li>
                ))}
            </ul>
        </details>
    ) : null;

const ExportResult = ({
    report,
    version,
    onClose,
    loadFont,
    packZip,
}: {
    report: ExportReport;
    version: string;
    onClose: () => void;
    loadFont: (url: string) => Promise<Uint8Array>;
    packZip: PackZip;
}) => (
    <section className="export-report" data-testid="export-report" aria-label="Отчёт экспорта">
        <header>
            <span className="export-title">
                Тема «{report.source.themeName}», {version}, {PLATFORMS[report.source.platform ?? 'web']}
            </span>
            <button type="button" className="link" onClick={onClose}>
                Скрыть
            </button>
        </header>
        {report.failure && (
            <p className="error" role="alert">
                Экспорт прерван: {report.failure}
            </p>
        )}
        <table>
            <thead>
                <tr>
                    <th scope="col" />
                    <th scope="col">Создано</th>
                    <th scope="col">Обновлено</th>
                    <th scope="col">Устарело</th>
                </tr>
            </thead>
            <tbody>
                {KINDS.map(({ key, label }) => (
                    <tr key={key}>
                        <th scope="row">{label}</th>
                        <td>{report.created[key]}</td>
                        <td>{report.updated[key]}</td>
                        <td>{report.stale[key]}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        {report.missingFonts.length > 0 && (
            <p className="export-fonts" data-testid="missing-fonts">
                Не найдены шрифты: {report.missingFonts.join(', ')}. Установите их на компьютер и повторите экспорт:
                Figma desktop видит шрифты, установленные в системе (в браузере нужен Figma Font Installer). Переменные
                типографики уже созданы, текстовые стили появятся после повторного экспорта.
            </p>
        )}
        {report.fontFiles.length > 0 && (
            <FontArchiveButton families={report.fontFiles} load={loadFont} pack={packZip} />
        )}
        <ReasonList title="Создано с оговоркой" entries={report.notes ?? []} testId="export-notes" />
        <ReasonList title="Пропущено" entries={report.skipped} testId="export-skipped" />
    </section>
);

const errorText = (error: unknown) => {
    if (error instanceof ApiError && error.kind === 'not-found') return 'Этой темы нет в выбранной версии.';
    return error instanceof Error ? error.message : String(error);
};

/** Экспорт выбранной темы и версии в переменные и стили открытого файла Figma. */
const PLATFORMS: Record<ExportPlatform, string> = { web: 'Web', ios: 'iOS', android: 'Android' };

const ExportPanel = ({
    run,
    version,
    resetKey,
    onRunning,
    onForbidden,
    loadFont,
    packZip,
}: {
    run: ((platform: ExportPlatform) => Promise<ExportReport>) | null;
    version: string;
    /** Смена темы или версии убирает прошлый отчёт, но не прерывает идущий экспорт. */
    resetKey: string;
    onRunning: (running: boolean) => void;
    onForbidden: () => void;
    loadFont: (url: string) => Promise<Uint8Array>;
    packZip: PackZip;
}) => {
    const [result, setResult] = useState<ExportState>({ state: 'idle' });
    // В файле одна платформа: повторный экспорт с другой платформой перезаписывает значения тех же переменных.
    const [platform, setPlatform] = useState<ExportPlatform>('web');
    useEffect(() => {
        setResult((current) => (current.state === 'running' ? current : { state: 'idle' }));
    }, [resetKey]);
    const start = () => {
        if (!run) return;
        setResult({ state: 'running' });
        onRunning(true);
        run(platform)
            .then(
                (report) => setResult({ state: 'done', report, version }),
                (error: unknown) => {
                    setResult({ state: 'failed', message: errorText(error) });
                    if (error instanceof ApiError && error.kind === 'forbidden') onForbidden();
                },
            )
            .finally(() => onRunning(false));
    };
    return (
        <div className="export">
            <div role="group" aria-label="Платформа" className="segments">
                {(Object.keys(PLATFORMS) as ExportPlatform[]).map((item) => (
                    <button
                        key={item}
                        type="button"
                        aria-pressed={platform === item}
                        disabled={result.state === 'running'}
                        onClick={() => setPlatform(item)}
                    >
                        {PLATFORMS[item]}
                    </button>
                ))}
            </div>
            <button type="button" disabled={!run || result.state === 'running'} onClick={start}>
                {result.state === 'running' ? 'Экспортируем…' : 'Экспортировать в Figma'}
            </button>
            {result.state === 'done' && (
                <ExportResult
                    report={result.report}
                    version={result.version}
                    onClose={() => setResult({ state: 'idle' })}
                    loadFont={loadFont}
                    packZip={packZip}
                />
            )}
            {result.state === 'failed' && (
                <div className="error" role="alert">
                    <p>Не удалось экспортировать: {result.message}</p>
                    <button type="button" className="secondary" onClick={start}>
                        Повторить
                    </button>
                </div>
            )}
        </div>
    );
};

/** Просмотр токенов темы на выбранной границе версии. */
export const TokensView = ({
    api,
    context,
    themeName,
    applyExport,
    packZip,
    onForbidden,
    onExportingChange = () => undefined,
}: {
    api: DsBuilderApi;
    context: TenantContext;
    themeName: string;
    applyExport: ApplyExport;
    packZip: PackZip;
    onForbidden: () => void;
    /** Пока идёт экспорт, родитель блокирует переходы: иначе отчёт потеряется. */
    onExportingChange?: (exporting: boolean) => void;
}) => {
    const [section, setSection] = useState<Section>('colors');
    const [mode, setMode] = useState<Mode>('light');
    const [screen, setScreen] = useState<TypographyScreenId>('screen-l');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [copied, setCopied] = useState<{ text: string; ok: boolean } | null>(null);
    const hideCopied = useRef<ReturnType<typeof setTimeout>>();
    const mounted = useRef(true);
    const copy = (text: string) => {
        void copyText(text).then((ok) => {
            // Запасной путь через `navigator.clipboard` асинхронный: экран мог уже закрыться.
            if (!mounted.current) return;
            setCopied({ text, ok });
            clearTimeout(hideCopied.current);
            hideCopied.current = setTimeout(() => setCopied(null), 2000);
        });
    };
    useEffect(
        () => () => {
            mounted.current = false;
            clearTimeout(hideCopied.current);
        },
        [],
    );

    const versions = useResource((signal) => api.versions(context, signal), [api, context.designSystemId]);
    const versionsReady = versions.resource.state === 'ready';
    const versionId =
        selected ?? (versions.resource.state === 'ready' ? (defaultVersionId(versions.resource.data) ?? DRAFT) : null);
    const snapshot = useResource(
        (signal): Promise<TokenSnapshot | null> =>
            versionId ? api.snapshot(context, versionId === DRAFT ? null : versionId, signal) : Promise.resolve(null),
        [api, context.tenantId, versionId],
    );

    const denied = [versions.resource, snapshot.resource].some(
        (resource) =>
            resource.state === 'failed' && resource.error instanceof ApiError && resource.error.kind === 'forbidden',
    );
    useEffect(() => {
        if (denied) onForbidden();
        // Обработчик создаётся заново на каждом рендере родителя.
    }, [denied]);

    // Новой темы может не быть в опубликованной версии: выбор версии остаётся на экране.
    const missing =
        snapshot.resource.state === 'failed' &&
        snapshot.resource.error instanceof ApiError &&
        snapshot.resource.error.kind === 'not-found';
    const versionLabel =
        versionId === DRAFT
            ? 'черновик'
            : `версия ${
                  (versions.resource.state === 'ready'
                      ? versions.resource.data.find((version) => version.id === versionId)?.version
                      : undefined) ?? ''
              }`;
    const runExport = versionId
        ? async (platform: ExportPlatform) =>
              applyExport(await api.exportPlan(context, versionId === DRAFT ? null : versionId, themeName, platform))
        : null;

    const snapshotView = missing
        ? { ...snapshot, resource: { state: 'failed', error: new Error('Этой темы нет в выбранной версии.') } as const }
        : snapshot;

    return (
        <div className="tokens-view">
            <div className="filters">
                {versionsReady && (
                    <label>
                        <span>Версия</span>
                        <select
                            value={versionId ?? DRAFT}
                            disabled={exporting}
                            onChange={(event) => setSelected(event.target.value)}
                        >
                            {publishedVersions(versions.resource.state === 'ready' ? versions.resource.data : []).map(
                                (version) => (
                                    <option key={version.id} value={version.id}>
                                        {version.version}
                                    </option>
                                ),
                            )}
                            <option value={DRAFT}>Черновик</option>
                        </select>
                    </label>
                )}
                <input
                    type="search"
                    aria-label="Найти токен"
                    placeholder="Найти токен"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>
            {versionId === DRAFT && (
                <p className="note" data-testid="draft-note">
                    Значения черновика ещё не опубликованы.
                </p>
            )}
            <ExportPanel
                run={runExport}
                version={versionLabel}
                resetKey={`${context.tenantId}:${versionId}`}
                onRunning={(running) => {
                    setExporting(running);
                    onExportingChange(running);
                }}
                onForbidden={onForbidden}
                loadFont={(url) => api.fontFile(url)}
                packZip={packZip}
            />
            <div role="tablist" aria-label="Раздел" className="tabs">
                {SECTIONS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={section === item.id}
                        onClick={() => setSection(item.id)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            {section === 'colors' && (
                <div role="group" aria-label="Режим" className="segments">
                    {(['light', 'dark'] as const).map((item) => (
                        <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}>
                            {item === 'light' ? 'Light' : 'Dark'}
                        </button>
                    ))}
                </div>
            )}
            {section === 'typography' && (
                <div role="group" aria-label="Экран" className="segments">
                    {SCREENS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            aria-pressed={screen === item.id}
                            onClick={() => setScreen(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
            {/* Область озвучивания есть всегда: экранный диктор читает изменение текста, а не появление узла. */}
            <p
                className={copied ? `copy-toast${copied.ok ? '' : ' is-error'}` : 'copy-toast is-hidden'}
                aria-live="polite"
                data-testid="copy-toast"
            >
                {copied ? (copied.ok ? `Скопировано: ${copied.text}` : 'Не удалось скопировать') : ''}
            </p>
            <CopyContext.Provider value={copy}>
                <div className="token-list">
                    {versions.resource.state === 'failed' ? (
                        <ResourceView {...versions} loading="">
                            {() => null}
                        </ResourceView>
                    ) : (
                        <ResourceView {...snapshotView} loading="Загружаем токены…">
                            {(data) =>
                                !data ? (
                                    <p className="status" role="status">
                                        Загружаем токены…
                                    </p>
                                ) : section === 'colors' ? (
                                    <Colors snapshot={data} query={query} mode={mode} />
                                ) : section === 'typography' ? (
                                    <Typography snapshot={data} query={query} screen={screen} />
                                ) : (
                                    <Sizes snapshot={data} query={query} />
                                )
                            }
                        </ResourceView>
                    )}
                </div>
            </CopyContext.Provider>
        </div>
    );
};
