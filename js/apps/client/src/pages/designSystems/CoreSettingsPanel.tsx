import { isAxiosError } from 'axios';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { StyledSelect } from '../../components/Overlay/Overlay';
import { http } from '../../api/http';
import { apiRoot } from '../../api/editorHttp';
import { invalidateEditorReads } from '../../api/editorReads';
import type { CoreSettings, CoreRelease } from '../../api/coreCompatibilityRepository';

type Selection = { channel: 'stable' | 'dev'; releaseId: string };
const releaseLabel = (release: CoreRelease) =>
    release.provenance === 'migration-snapshot' ? 'Неизвестно' : release.version;
export type CoreSaveState = { disabled: boolean; saving: boolean };
const platforms = [
    ['compose', 'Compose'],
    ['web', 'Web'],
    ['xml', 'Android View'],
    ['ios', 'iOS'],
] as const;
const selectionOf = (current?: CoreRelease): Selection => ({
    channel: current?.channel ?? 'stable',
    releaseId: current?.selectionMode === 'latest' ? 'latest' : (current?.releaseId ?? ''),
});

const selectionsOf = ({ context }: CoreSettings): Record<string, Selection> =>
    Object.fromEntries(
        platforms.map(([platform]) => [platform, selectionOf(context.coreReleases.find((r) => r.platform === platform))]),
    );

export const CoreSettingsPanel = ({
    projectId,
    designSystemId,
    versionId,
    readOnly = Boolean(versionId),
    onSaveStateChange,
}: {
    projectId: string;
    designSystemId: string;
    versionId?: string;
    readOnly?: boolean;
    onSaveStateChange?: (state: CoreSaveState) => void;
}) => {
    const root = apiRoot(projectId, designSystemId);
    const scope = `${root}:${versionId ?? 'draft'}`;
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    const [loadedScope, setLoadedScope] = useState('');
    const [saved, setSaved] = useState<CoreSettings>();
    const [selections, setSelections] = useState<Record<string, Selection>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [catalogRefreshes, setCatalogRefreshes] = useState<Record<string, number>>({});
    const [message, setMessage] = useState('');
    const savingRequest = useRef<AbortController | null>(null);
    const report = loadedScope === scope ? saved : undefined;
    useEffect(() => {
        const controller = new AbortController();
        savingRequest.current?.abort();
        savingRequest.current = null;
        setSaving(false);
        setError('');
        setMessage('');
        setLoadedScope('');
        void http
            .get<CoreSettings>(`${root}/core-settings`, {
                signal: controller.signal,
                params: versionId ? { versionId } : undefined,
            })
            .then(({ data }) => {
                if (controller.signal.aborted) return;
                setSaved(data);
                setSelections(selectionsOf(data));
                setLoadedScope(scope);
            })
            .catch(() => {
                if (!controller.signal.aborted) setError('Не удалось загрузить версии библиотек');
            });
        return () => {
            controller.abort();
            savingRequest.current?.abort();
        };
    }, [root, versionId, scope, loadAttempt]);
    const changes = report
        ? platforms.filter(([platform]) => {
              const original = selectionOf(report.context.coreReleases.find((r) => r.platform === platform));
              const selected = selections[platform];
              return selected && (selected.channel !== original.channel || selected.releaseId !== original.releaseId);
          })
        : [];
    const canSave = Boolean(
        report?.context.draftId &&
        !readOnly &&
        !saving &&
        changes.length &&
        changes.every(([platform]) => selections[platform].releaseId),
    );
    useEffect(() => {
        onSaveStateChange?.({ disabled: !canSave, saving });
    }, [canSave, saving, onSaveStateChange]);
    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!report || !canSave || savingRequest.current) return;
        const controller = new AbortController();
        savingRequest.current = controller;
        setSaving(true);
        setError('');
        setMessage('');
        let latest = report;
        const isCurrent = () => !controller.signal.aborted && scopeRef.current === scope;
        const completed: string[] = [];
        try {
            for (const [platform, label] of changes) {
                const { data } = await http.put<CoreSettings>(
                    `${root}/core-settings/${platform}`,
                    {
                        channel: selections[platform].channel,
                        ...(selections[platform].releaseId === 'latest'
                            ? { selectionMode: 'latest' }
                            : { releaseId: selections[platform].releaseId }),
                        expectedDraftId: latest.context.draftId,
                        expectedCoreSelectionRevision: latest.context.coreSelectionRevision,
                    },
                    { signal: controller.signal },
                );
                if (!isCurrent()) return;
                latest = data;
                setSaved(data);
                setCatalogRefreshes((old) => ({ ...old, [platform]: (old[platform] ?? 0) + 1 }));
                completed.push(label);
                invalidateEditorReads({ projectId }, { includeMetadata: true });
            }
            setMessage(
                latest.blockingCount
                    ? 'Версии библиотек сохранены. Исправьте проблемы настроек перед экспортом и публикацией.'
                    : 'Версии библиотек сохранены',
            );
        } catch (failure) {
            if (!isCurrent()) return;
            const response = isAxiosError<{ code?: string }>(failure) ? failure.response : undefined;
            const prefix = completed.length ? `Сохранены: ${completed.join(', ')}. ` : '';
            if (response?.status === 403) {
                setError(`${prefix}Нет прав на изменение настроек библиотек.`);
            } else if (response?.status === 409 && response.data?.code === 'CORE_SELECTION_STALE') {
                try {
                    const { data } = await http.get<CoreSettings>(`${root}/core-settings`, { signal: controller.signal });
                    if (!isCurrent()) return;
                    const pending = changes.slice(completed.length);
                    setSaved(data);
                    setSelections({
                        ...selectionsOf(data),
                        ...Object.fromEntries(pending.map(([platform]) => [platform, selections[platform]])),
                    });
                    invalidateEditorReads({ projectId }, { includeMetadata: true });
                    setError(`${prefix}Настройки изменились. Проверьте свой выбор и сохраните ещё раз.`);
                } catch {
                    if (isCurrent()) {
                        setError(`${prefix}Не удалось обновить настройки. Повторите сохранение.`);
                    }
                }
            } else {
                setError(`${prefix}Не удалось сохранить ${changes[completed.length]?.[1] ?? "версию"}. Несохранённый выбор оставлен в форме.`);
            }
        } finally {
            if (savingRequest.current === controller) savingRequest.current = null;
            if (scopeRef.current === scope) setSaving(false);
        }
    };
    return (
        <section className="settings-section" aria-label="Версии библиотек по платформам">
            <p className="ps-core-description">
                Версии базовых библиотек определяют доступные компоненты и свойства, проверку совместимости настроек и
                предпросмотр дизайн-системы. Выберите канал и версию для нужных платформ.
            </p>
            {error && (
                <p className="ps-hint" role="alert">
                    {error}
                </p>
            )}
            {!report && error && (
                <button className="ps-button ps-button-neutral" type="button" onClick={() => setLoadAttempt((previous) => previous + 1)}>
                    Повторить
                </button>
            )}
            {!report && !error && <p>Загружаем версии библиотек…</p>}
            <form id="core-library-settings-form" onSubmit={save}>
                {report && (
                    <div className="ps-core-platforms">
                        <div className="ps-core-columns" aria-hidden="true">
                            <span>Платформа</span>
                            <span>Канал</span>
                            <span>Версия</span>
                        </div>
                        {platforms.map(([platform, label]) => (
                            <PlatformCore
                                key={`${scope}:${platform}:${selections[platform].channel}:${catalogRefreshes[platform]}`}
                                root={root}
                                platform={platform}
                                label={label}
                                current={report.context.coreReleases.find((r) => r.platform === platform)}
                                selection={selections[platform]}
                                readOnly={readOnly}
                                disabled={saving}
                                onChange={(selection) => {
                                    setSelections((old) => ({ ...old, [platform]: selection }));
                                    setMessage('');
                                }}
                            />
                        ))}
                    </div>
                )}
            </form>
            {message && (
                <p className="ps-hint" role="status">
                    {message}
                </p>
            )}
        </section>
    );
};

const PlatformCore = ({
    root,
    platform,
    label,
    current,
    selection,
    readOnly,
    disabled,
    onChange,
}: {
    root: string;
    platform: string;
    label: string;
    current?: CoreRelease;
    selection: Selection;
    readOnly: boolean;
    disabled: boolean;
    onChange: (value: Selection) => void;
}) => {
    const [releases, setReleases] = useState<CoreRelease[]>([]);
    const [pageRequest, setPageRequest] = useState({ offset: 0 });
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { channel, releaseId } = selection;
    useEffect(() => {
        if (readOnly) return;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        void http
            .get<CoreRelease[]>(`${root}/core-releases`, {
                signal: controller.signal,
                params: { platform, channel, offset: pageRequest.offset, limit: 50 },
            })
            .then(({ data }) => {
                if (controller.signal.aborted) return;
                setReleases((old) => (pageRequest.offset ? [...old, ...data] : data));
                setHasMore(data.length === 50);
            })
            .catch(() => {
                if (!controller.signal.aborted) setError('Не удалось загрузить версии');
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [root, platform, channel, pageRequest, readOnly]);
    const currentInChannel = current?.channel === channel ? current : undefined;
    const includeCurrent =
        currentInChannel?.provenance !== 'migration-snapshot' &&
        currentInChannel !== undefined &&
        !releases.some((r) => r.releaseId === currentInChannel.releaseId);
    const latest = currentInChannel?.selectionMode === 'latest' ? currentInChannel : releases[0];
    const versionDisabled = loading || disabled;
    const releaseOptions = [
        { value: '', label: loading ? 'Загружаем версии…' : 'Выберите версию' },
        ...(latest ? [{ value: 'latest', label: `Последняя (${latest.version})` }] : []),
        ...(includeCurrent ? [{ value: currentInChannel.releaseId, label: releaseLabel(currentInChannel) }] : []),
        ...releases.map((release) => ({ value: release.releaseId, label: releaseLabel(release) })),
    ];
    return (
        <section className="ps-core-platform" aria-label={label}>
            <span className="ps-core-platform-name">{label}</span>
            {readOnly ? (
                <>
                    <span>{current?.channel ?? (current ? 'Неизвестно' : '—')}</span>
                    <span className="ps-core-version">{current ? releaseLabel(current) : 'Библиотека не выбрана'}</span>
                </>
            ) : (
                <>
                    <div className="ps-core-fields ps-core-channel">
                        <span className="ps-core-field-label">Канал</span>
                        <StyledSelect
                            label={`${label}: канал`}
                            value={channel}
                            savedValue={current?.channel ?? undefined}
                            disabled={disabled}
                            onChange={(value) => {
                                if (value === channel) return;
                                onChange({ channel: value as Selection['channel'], releaseId: '' });
                            }}
                            options={[
                                { value: 'stable', label: 'stable' },
                                { value: 'dev', label: 'dev' },
                            ]}
                        />
                    </div>
                    <div className="ps-core-fields ps-core-version">
                        <span className="ps-core-field-label">Версия</span>
                        <StyledSelect
                            label={`${label}: версия`}
                            popoverWidth="content"
                            value={
                                current?.provenance === 'migration-snapshot' && releaseId === current.releaseId
                                    ? ''
                                    : releaseId
                            }
                            savedValue={selectionOf(current).releaseId}
                            disabled={versionDisabled}
                            onChange={(value) => onChange({ ...selection, releaseId: value })}
                            options={releaseOptions}
                        />
                        {hasMore && !error && (
                            <button
                                type="button"
                                className="ps-button ps-core-more"
                                disabled={versionDisabled}
                                onClick={() => setPageRequest({ offset: releases.length })}
                            >
                                Ещё версии
                            </button>
                        )}
                    </div>
                    {error && (
                        <p className="ps-core-row-hint" role="alert">
                            {error}{' '}
                            <button
                                type="button"
                                className="ps-button ps-button-neutral"
                                disabled={versionDisabled}
                                onClick={() => setPageRequest({ ...pageRequest })}
                            >
                                Повторить
                            </button>
                        </p>
                    )}
                </>
            )}
        </section>
    );
};
