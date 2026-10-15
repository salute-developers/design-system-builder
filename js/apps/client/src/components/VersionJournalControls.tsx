import { useCallback, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';

import { authService } from '../api';
import {
    ThemeEditorRepository,
    type DesignSystemVersionDto,
    type DraftChangeDto,
    type EditorContextKey,
    type TokenDefinitionDto,
} from '../api/themeEditorRepository';
import type { AutosaveStatus } from '../api/tokenAutosaveQueue';

const repository = new ThemeEditorRepository();
const operationLabels = { created: 'Создан', updated: 'Изменён', deleted: 'Удалён' };
const platformLabels: Record<string, string> = { web: 'Web', ios: 'iOS', android: 'Android' };
const modeLabels: Record<string, string> = { light: 'Светлая тема', dark: 'Тёмная тема' };

type JournalGroup = {
    key: string;
    title: string;
    subtitle?: string;
    tokenValue: boolean;
    actorId: string | null;
    changedAt: string;
    changes: DraftChangeDto[];
};

type JournalBatch = {
    key: string;
    actorId: string | null;
    changedAt: string;
    groups: JournalGroup[];
};

const field = (change: DraftChangeDto, name: string) => change.currentValue?.[name] ?? change.previousValue?.[name];
const formatValue = (value: unknown) => {
    if (value === null || value === undefined) return 'не задано';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
};
const changedValue = (change: DraftChangeDto) =>
    `${formatValue(change.previousValue?.value)} → ${formatValue(change.currentValue?.value)}`;

const journalGroups = (changes: DraftChangeDto[], tokens: TokenDefinitionDto[]): JournalGroup[] => {
    const tokenNames = new Map(tokens.map((token) => [token.id, token.name]));
    const grouped = new Map<string, JournalGroup>();
    changes.forEach((change) => {
        if (change.entityType !== 'token-value') {
            const name = field(change, 'name');
            grouped.set(change.changeId, {
                key: change.changeId,
                title: `${operationLabels[change.operation]}${name ? `: ${String(name)}` : `: ${change.entityType}`}`,
                subtitle: change.changedPaths.join(', ') || 'Вся сущность',
                tokenValue: false,
                actorId: change.actorId,
                changedAt: change.changedAt,
                changes: [change],
            });
            return;
        }
        const tokenId = String(field(change, 'token_id') ?? change.entityId);
        const mode = String(field(change, 'mode') ?? '');
        const groupKey = [tokenId, mode, change.actorId, change.changedAt, changedValue(change)].join(':');
        const existing = grouped.get(groupKey);
        if (existing) {
            existing.changes.push(change);
            return;
        }
        grouped.set(groupKey, {
            key: groupKey,
            title: `${operationLabels[change.operation]} токен: ${tokenNames.get(tokenId) ?? tokenId}`,
            subtitle: [modeLabels[mode], changedValue(change)].filter(Boolean).join(' · '),
            tokenValue: true,
            actorId: change.actorId,
            changedAt: change.changedAt,
            changes: [change],
        });
    });
    return [...grouped.values()].sort((left, right) => right.changedAt.localeCompare(left.changedAt));
};

const journalBatches = (groups: JournalGroup[]): JournalBatch[] => {
    const batches = new Map<string, JournalBatch>();
    groups.forEach((group) => {
        const firstChange = group.changes[0];
        const batchKey = group.tokenValue
            ? `token-values:${group.actorId}:${group.changedAt}:${firstChange.operation}`
            : group.key;
        const existing = batches.get(batchKey);
        if (existing) {
            existing.groups.push(group);
            return;
        }
        batches.set(batchKey, {
            key: batchKey,
            actorId: group.actorId,
            changedAt: group.changedAt,
            groups: [group],
        });
    });
    return [...batches.values()].sort((left, right) => right.changedAt.localeCompare(left.changedAt));
};

export const VersionJournalControls = ({
    context,
    onVersionChange,
    autosaveStatus,
}: {
    context: EditorContextKey;
    onVersionChange: (versionId?: string) => void;
    autosaveStatus?: AutosaveStatus;
}) => {
    const [versions, setVersions] = useState<DesignSystemVersionDto[]>([]);
    const [changes, setChanges] = useState<DraftChangeDto[]>([]);
    const [tokens, setTokens] = useState<TokenDefinitionDto[]>([]);
    const [actorLabels, setActorLabels] = useState<Record<string, string>>({});
    const [journalOpen, setJournalOpen] = useState(false);
    const [error, setError] = useState<string>();
    const groups = useMemo(() => journalGroups(changes, tokens), [changes, tokens]);
    const batches = useMemo(() => journalBatches(groups), [groups]);

    const reloadChanges = useCallback(async () => {
        try {
            const [nextChanges, nextTokens] = await Promise.all([
                repository.listChanges(context),
                repository.listJournalTokens(context),
            ]);
            setChanges(nextChanges);
            setTokens(nextTokens);
            setError(undefined);
        } catch {
            setError('Не удалось обновить журнал');
        }
    }, [context]);

    useEffect(() => {
        const controller = new AbortController();
        repository
            .listVersions(context, controller.signal)
            .then(setVersions)
            .catch(() => !controller.signal.aborted && setError('Не удалось загрузить версии'));
        repository
            .listProjectActorLabels(context.projectId, controller.signal)
            .then(setActorLabels)
            .catch(() => undefined);
        return () => controller.abort();
    }, [context]);

    useEffect(() => {
        if (journalOpen && (autosaveStatus === undefined || autosaveStatus === 'saved')) void reloadChanges();
    }, [autosaveStatus, journalOpen, reloadChanges]);

    const actorLabel = (actorId: string | null) => {
        if (!actorId) return 'Система';
        const current = authService.getCurrentUser();
        if (current?.id === actorId) return current.displayName;
        return actorLabels[actorId] ?? `Пользователь ${actorId.slice(0, 8)}`;
    };

    const revert = async (change: DraftChangeDto) => {
        try {
            await repository.revertChange(context, change);
            await reloadChanges();
        } catch (cause) {
            if (isAxiosError(cause) && cause.response?.status === 409) {
                await reloadChanges();
                setError(
                    cause.response.data?.code === 'DRAFT_CHANGE_STALE'
                        ? 'Журнал изменился. Показаны актуальные данные.'
                        : 'Изменение нельзя отменить из-за зависимых данных.',
                );
                return;
            }
            setError('Не удалось отменить изменение');
        }
    };

    return (
        <div className="version-journal-controls">
            <label>
                <span className="visually-hidden">Версия дизайн-системы</span>
                <select
                    aria-label="Версия дизайн-системы"
                    value={context.versionId ?? ''}
                    onChange={(event) => onVersionChange(event.target.value || undefined)}
                >
                    <option value="">Текущий черновик</option>
                    {versions.map((version) => (
                        <option key={version.id} value={version.id}>
                            {version.version}
                        </option>
                    ))}
                </select>
            </label>
            <button type="button" onClick={() => setJournalOpen((open) => !open)}>
                Журнал
            </button>
            {journalOpen && (
                <section className="change-journal" aria-label="Журнал изменений">
                    <header>
                        <strong>{context.versionId ? 'Изменения версии' : 'Изменения черновика'}</strong>
                        <button type="button" onClick={() => setJournalOpen(false)} aria-label="Закрыть журнал">
                            ×
                        </button>
                    </header>
                    {error && <p role="status">{error}</p>}
                    {batches.length === 0 ? (
                        <p>Изменений нет</p>
                    ) : (
                        <ul>
                            {batches.map((batch) => (
                                <li key={batch.key}>
                                    <div className="change-journal-batch">
                                        {batch.groups.length > 1 && (
                                            <strong>Изменены токены: {batch.groups.length}</strong>
                                        )}
                                        <small>
                                            {actorLabel(batch.actorId)} · {new Date(batch.changedAt).toLocaleString()}
                                        </small>
                                        {batch.groups.map((group) => (
                                            <div className="change-journal-item" key={group.key}>
                                                <strong>{group.title}</strong>
                                                {group.subtitle && <small>{group.subtitle}</small>}
                                                {group.changes.length > 1 && (
                                                    <small>
                                                        Платформы:{' '}
                                                        {group.changes
                                                            .map(
                                                                (change) =>
                                                                    platformLabels[String(field(change, 'platform'))],
                                                            )
                                                            .filter(Boolean)
                                                            .join(', ')}
                                                    </small>
                                                )}
                                                {!context.versionId && (
                                                    <div className="change-journal-actions">
                                                        {group.changes.map((change) => (
                                                            <button
                                                                key={change.changeId}
                                                                type="button"
                                                                onClick={() => void revert(change)}
                                                            >
                                                                {group.changes.length === 1
                                                                    ? 'Отменить'
                                                                    : `Отменить ${
                                                                          platformLabels[
                                                                              String(field(change, 'platform'))
                                                                          ] ?? 'значение'
                                                                      }`}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </div>
    );
};
