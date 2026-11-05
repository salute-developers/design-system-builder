import { useEffect, useState } from 'react';

import type { DsBuilderApi, TenantContext } from '../api/dsBuilderApi';
import { ApiError } from '../api/httpClient';
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

const paintText = (value: PaintValue) => {
    if (value.kind === 'color') return value.css;
    if (value.kind === 'gradient') return 'Градиент';
    if (value.kind === 'unknown') return `Не разобрано: ${value.raw}`;
    return 'Нет значения';
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
                                <span className="token-name" title={token.name}>
                                    {token.label}
                                </span>
                                <span className="token-value">{paintText(token[mode])}</span>
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
                                <span className="token-name" title={style.name}>
                                    {style.label}
                                </span>
                                <span className="token-value">
                                    {style.sizePx}/{style.lineHeightPx} · {style.weights.join(', ')} · {style.fontName}
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
                                    <span className="token-name">{token.name}</span>
                                    <span className="token-value">
                                        {token.fullRounding ? 'Полное скругление' : `${token.valuePx} px`}
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
                                <span className="token-name">{token.name}</span>
                                <span className="token-value">
                                    {token.layers
                                        .map(
                                            (layer) =>
                                                `${layer.offsetX} ${layer.offsetY} ${layer.blur} ${layer.spread} ${layer.color}`,
                                        )
                                        .join('; ')}
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

/** Просмотр токенов темы на выбранной границе версии. */
export const TokensView = ({
    api,
    context,
    onForbidden,
}: {
    api: DsBuilderApi;
    context: TenantContext;
    onForbidden: () => void;
}) => {
    const [section, setSection] = useState<Section>('colors');
    const [mode, setMode] = useState<Mode>('light');
    const [screen, setScreen] = useState<TypographyScreenId>('screen-l');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<string | null>(null);

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
    const snapshotView = missing
        ? { ...snapshot, resource: { state: 'failed', error: new Error('Этой темы нет в выбранной версии.') } as const }
        : snapshot;

    return (
        <div className="tokens-view">
            <div className="filters">
                {versionsReady && (
                    <label>
                        <span>Версия</span>
                        <select value={versionId ?? DRAFT} onChange={(event) => setSelected(event.target.value)}>
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
        </div>
    );
};
