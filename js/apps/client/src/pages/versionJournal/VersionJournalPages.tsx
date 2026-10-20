import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';

import type { DesignSystem } from '../../controllers';
import type { DesignSystemVersionDto, DraftChangeDto, EditorContextKey } from '../../api/editorContracts';
import { versionJournalRepository as repository } from '../../api/versionJournalRepository';
import { nextPatchVersion } from '../../api/versionNumbers';
import { useVersionList } from '../../features/versionJournal/useVersionList';
import type { AutosaveStatus } from '../../api/tokenAutosaveQueue';
import { hasPersistedComponentMutation, waitForDraftAutosaveIdle } from '../../api/draftAutosaveActivity';
import {
    journalSources,
    type JournalActionViewModel,
    type JournalSection,
    type JournalSource,
} from '../../features/versionJournal/journalPresenter';
import { useJournal, useReloadAfterAutosave, errorCode } from '../../features/versionJournal/useJournal';
import { journalColor, journalValueText, type JournalValue } from '../../features/versionJournal/journalFields';
import type { JournalPaletteStep } from '../../features/versionJournal/paletteJournalPresentation';
import {
    ActionRow,
    Button,
    Center,
    CenterBody,
    CenterHeader,
    ChangeGroup,
    CountBadge,
    DiffPreview,
    EmptyState,
    FieldList,
    FilterButton,
    Form,
    Inspector,
    InspectorBody,
    InspectorFooter,
    InspectorHeader,
    InspectorRow,
    InspectorSection,
    ItemButton,
    ChangeRow,
    UndoButton,
    List,
    NotesLabel,
    Page,
    PaletteComparison,
    ReleaseNotes,
    ReleaseSection,
    SecondaryButton,
    Sidebar,
    SidebarBody,
    SidebarHeader,
    SidebarSection,
    Status,
    ValuePair,
    ValueChip,
    VersionNumberRow,
} from './VersionJournalPages.styles';

interface VersionJournalOutletContext {
    designSystem?: DesignSystem;
    editorContext?: EditorContextKey;
    autosaveStatus?: AutosaveStatus;
    updated: object;
    reload: () => void | Promise<void>;
    editorJournal?: ReturnType<typeof useJournal>;
    refreshChanges?: (changes: DraftChangeDto[]) => Promise<void>;
}

const sectionLabels: Record<JournalSection | 'all', string> = {
    all: 'Все изменения',
    themes: 'Темы',
    tokens: 'Токены',
    components: 'Компоненты',
};
const sectionDescriptions: Record<JournalSection, string> = {
    themes: 'Параметры и состав тем',
    tokens: 'Определения и значения токенов',
    components: 'Конфигурации компонентов',
};
const sourceLabels = Object.fromEntries(journalSources.map(({ id, label }) => [id, label])) as Record<
    JournalSource,
    string
>;
const operationLabels: Record<DraftChangeDto['operation'], string> = {
    created: 'Создано',
    updated: 'Изменено',
    deleted: 'Удалено',
};
const changeCount = (count: number) => {
    const ending = count % 100;
    if (ending >= 11 && ending <= 14) return `${count} изменений`;
    if (count % 10 === 1) return `${count} изменение`;
    if (count % 10 >= 2 && count % 10 <= 4) return `${count} изменения`;
    return `${count} изменений`;
};

const formattedDate = (value: string) => {
    const formatter = new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' });
    const date = new Date(value);
    return formatter.format(date);
};

const PreviewValue = ({ value, fieldLabel }: { value: JournalValue; fieldLabel?: string }) => {
    const label = journalValueText(value, fieldLabel);
    const color = journalColor(value);
    const truncate = typeof value === 'string' && /^\[(?:general|additional)\./.test(value);
    return (
        <ValueChip $truncate={truncate} title={label}>
            {color && <i aria-hidden="true" style={{ backgroundColor: color }} />}
            <b>{label}</b>
        </ValueChip>
    );
};

const PaletteChanges = ({ steps }: { steps: JournalPaletteStep[] }) => {
    const changed = steps.filter((step) => step.before?.toUpperCase() !== step.after?.toUpperCase());
    const changedNumbers = new Set(changed.map(({ step }) => step));
    return (
        <PaletteComparison>
            <p>
                {changed.length
                    ? `Изменено ступеней: ${changed.length} из ${steps.length}. Изменённые отмечены рамкой.`
                    : 'Цвета ступеней не изменились. Изменились только параметры перестроения.'}
            </p>
            {(['before', 'after'] as const).map((side) => (
                <div key={side}>
                    <span>{side === 'before' ? 'Было' : 'Стало'}</span>
                    <div className="palette-comparison-steps">
                        {steps.map((step) => {
                            const value = step[side];
                            const modified = changedNumbers.has(step.step);
                            const label = `Ступень ${step.step}: ${value ?? 'Не задано'}${modified ? ' · изменена' : ''}`;
                            return (
                                <div
                                    key={step.step}
                                    className="palette-comparison-step"
                                    data-changed={modified}
                                    title={label}
                                    aria-label={label}
                                >
                                    <i aria-hidden="true" style={{ backgroundColor: journalColor(value) }} />
                                    <span>
                                        {step.step}
                                        {modified ? ' •' : ''}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
            {changed.length > 0 && (
                <details>
                    <summary>Точные значения изменённых ступеней</summary>
                    <table aria-label="Изменённые цвета растяжки">
                        <thead>
                            <tr>
                                <th scope="col">Ступень</th>
                                <th scope="col">Было</th>
                                <th scope="col">Стало</th>
                            </tr>
                        </thead>
                        <tbody>
                            {changed.map((step) => (
                                <tr key={step.step}>
                                    <th scope="row">{step.step}</th>
                                    {(['before', 'after'] as const).map((side) => (
                                        <td key={side}>
                                            <span
                                                className="palette-comparison-color"
                                                aria-hidden="true"
                                                style={{ backgroundColor: journalColor(step[side]) }}
                                            />
                                            <code>{step[side] ?? 'Не задано'}</code>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </details>
            )}
        </PaletteComparison>
    );
};

const ChangePreview = ({ action }: { action: JournalActionViewModel }) => {
    if (action.structural || action.paletteSteps || action.changedFields.length > 1) return null;
    const field = action.changedFields[0];
    if (!field) return <small>{operationLabels[action.operation]}</small>;
    return (
        <DiffPreview aria-hidden="true">
            <PreviewValue value={field.before} fieldLabel={field.label} />
            <i>→</i>
            <PreviewValue value={field.after} fieldLabel={field.label} />
        </DiffPreview>
    );
};

const nextVersion = (versions: DesignSystemVersionDto[]) => nextPatchVersion(versions.map(({ version }) => version));

const useJournalRevert = (
    context: EditorContextKey | undefined,
    onReload: () => Promise<void>,
    refreshChanges?: (changes: DraftChangeDto[]) => Promise<void>,
) => {
    const [operationError, setOperationError] = useState<string>();
    const [reverting, setReverting] = useState<string>();
    const [refreshFailed, setRefreshFailed] = useState(false);
    const pendingRefresh = useRef<JournalActionViewModel>();
    const running = useRef(false);
    const refresh = async (action: JournalActionViewModel) => {
        if (context) await waitForDraftAutosaveIdle(context, 10_000);
        await Promise.all([refreshChanges?.(action.changes), onReload()]);
        setRefreshFailed(false);
    };
    const revert = async (action: JournalActionViewModel) => {
        if (!action.canRevert || running.current || refreshFailed) return;
        running.current = true;
        setReverting(action.key);
        setOperationError(undefined);
        let committed = false;
        try {
            if (!context) throw new Error('Контекст журнала недоступен');
            for (const change of action.changes) {
                if (action.revertPaths) await repository.revertChange(context, change, action.revertPaths);
                else await repository.revertChange(context, change);
            }
            committed = true;
            pendingRefresh.current = action;
            await refresh(action);
        } catch (cause) {
            const code = errorCode(cause);
            setRefreshFailed(committed);
            setOperationError(
                committed
                    ? 'Изменение отменено, но данные редактора не обновлены. Повторите загрузку данных.'
                    : code === 'DRAFT_CHANGE_STALE'
                      ? 'Черновик уже изменился. Журнал обновлён; выберите изменение ещё раз.'
                      : code === 'REVERT_DEPENDENCY_CONFLICT'
                        ? 'Изменение нельзя отменить из-за зависимых изменений. Журнал обновлён.'
                        : 'Не удалось полностью отменить изменение. Журнал обновлён.',
            );
            await onReload();
        } finally {
            running.current = false;
            setReverting(undefined);
        }
    };
    const retryRefresh = async () => {
        const action = pendingRefresh.current;
        if (!action || running.current) return;
        running.current = true;
        setReverting(action.key);
        try {
            await refresh(action);
            setOperationError(undefined);
        } catch {
            setOperationError('Не удалось обновить данные редактора. Повторите загрузку данных.');
        } finally {
            running.current = false;
            setReverting(undefined);
        }
    };
    return { revert, reverting, operationError, refreshFailed, retryRefresh };
};

const JournalDetails = ({
    action,
    context,
    onReload,
    allowSourceNavigation = true,
    onClose,
    revertState,
}: {
    action?: JournalActionViewModel;
    context?: EditorContextKey;
    onReload: () => Promise<void>;
    allowSourceNavigation?: boolean;
    onClose?: () => void;
    revertState?: ReturnType<typeof useJournalRevert>;
}) => {
    const navigate = useNavigate();
    const ownRevertState = useJournalRevert(context, onReload);
    const { revert, reverting, operationError, refreshFailed } = revertState ?? ownRevertState;
    if (!action) {
        return (
            <Inspector aria-label="Подробности изменения">
                <InspectorBody>
                    <Status>Выберите изменение, чтобы увидеть подробности.</Status>
                </InspectorBody>
            </Inspector>
        );
    }

    return (
        <Inspector aria-label="Подробности изменения">
            <InspectorHeader>
                <strong>{action.title}</strong>
                <span>
                    {[
                        operationLabels[action.operation],
                        action.platformLabel,
                        action.groupLabel && `Группа: ${action.groupLabel}`,
                        action.actorLabel,
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
                <small>{formattedDate(action.changedAt)}</small>
            </InspectorHeader>
            <InspectorBody>
                <InspectorSection $compactHeading>
                    <h2>Изменение</h2>
                    <FieldList>
                        {action.changedFields.map((field, index) => (
                            <div key={`${field.path}:${index}`}>
                                <dt>{field.label}</dt>
                                <dd>
                                    <ValuePair>
                                        <div>
                                            <span>Было</span>
                                            <PreviewValue value={field.before} fieldLabel={field.label} />
                                        </div>
                                        <div>
                                            <span>Стало</span>
                                            <PreviewValue value={field.after} fieldLabel={field.label} />
                                        </div>
                                    </ValuePair>
                                </dd>
                            </div>
                        ))}
                    </FieldList>
                </InspectorSection>
                {action.paletteSteps && (
                    <InspectorSection>
                        <h2>Цвета растяжки</h2>
                        <PaletteChanges steps={action.paletteSteps} />
                    </InspectorSection>
                )}
                <InspectorSection>
                    <h2>Сведения</h2>
                    <InspectorRow>
                        <span>Область</span>
                        <strong>{sourceLabels[action.source]}</strong>
                    </InspectorRow>
                    <InspectorRow>
                        <span>Автор</span>
                        <strong>{action.actorLabel}</strong>
                    </InspectorRow>
                    <InspectorRow>
                        <span>Дата</span>
                        <strong>{formattedDate(action.changedAt)}</strong>
                    </InspectorRow>
                </InspectorSection>
                {!revertState && operationError && <Status role="alert">{operationError}</Status>}
            </InspectorBody>
            <InspectorFooter>
                {allowSourceNavigation && action.navigation.kind !== 'unavailable' && (
                    <SecondaryButton
                        type="button"
                        disabled={Boolean(reverting) || refreshFailed}
                        onClick={() => {
                            if (action.navigation.kind !== 'unavailable') {
                                navigate({ pathname: action.navigation.pathname, search: action.navigation.search });
                            }
                        }}
                    >
                        Перейти к источнику
                    </SecondaryButton>
                )}
                {allowSourceNavigation && action.navigation.kind === 'unavailable' && (
                    <Status>Источник больше недоступен.</Status>
                )}
                {!allowSourceNavigation && (
                    <Status>Чтобы открыть эту версию в редакторе, выберите её в верхней панели.</Status>
                )}
                {action.canRevert && (
                    <SecondaryButton
                        type="button"
                        disabled={Boolean(reverting) || refreshFailed}
                        onClick={() => void revert(action)}
                    >
                        {reverting ? 'Отменяем…' : 'Отменить изменение'}
                    </SecondaryButton>
                )}
                {onClose && (
                    <SecondaryButton type="button" onClick={onClose}>
                        К сведениям о версии
                    </SecondaryButton>
                )}
            </InspectorFooter>
        </Inspector>
    );
};

export const DesignSystemChangesPage = () => {
    const { designSystem, editorContext, autosaveStatus, editorJournal, refreshChanges } =
        useOutletContext<VersionJournalOutletContext>();
    const components = designSystem?.getComponentsData() ?? [];
    const ownJournal = useJournal(
        editorJournal ? undefined : editorContext,
        components,
        designSystem,
        designSystem?.getParameters()?.readOnly !== false,
    );
    const journal = editorJournal ?? ownJournal;
    const [filter, setFilter] = useState<JournalSource | 'all'>('all');
    const filtered = filter === 'all' ? journal.actions : journal.actions.filter(({ source }) => source === filter);
    const revertState = useJournalRevert(editorContext, journal.reload, refreshChanges);
    const [selectedKey, setSelectedKey] = useState<string>();
    const selected = filtered.find(({ key }) => key === selectedKey) ?? filtered[0];
    useEffect(() => {
        setFilter('all');
        setSelectedKey(undefined);
    }, [editorContext?.designSystemId]);
    useReloadAfterAutosave(editorJournal ? undefined : autosaveStatus, journal.reload);
    const groups = journalSources
        .map(({ id, label }) => ({ source: id, label, actions: filtered.filter((action) => action.source === id) }))
        .filter(({ actions }) => actions.length > 0);

    return (
        <Page>
            <Sidebar aria-label="Фильтры журнала">
                <SidebarHeader>
                    <strong>Черновик изменений</strong>
                </SidebarHeader>
                <SidebarBody>
                    <SidebarSection>
                        <List>
                            <FilterButton
                                $selected={filter === 'all'}
                                aria-pressed={filter === 'all'}
                                onClick={() => {
                                    setFilter('all');
                                    setSelectedKey(undefined);
                                }}
                            >
                                <span>Все изменения</span>
                                {journal.actions.length > 0 && <CountBadge>{journal.actions.length}</CountBadge>}
                            </FilterButton>
                        </List>
                    </SidebarSection>
                    <SidebarSection>
                        <small>По источнику</small>
                        <List>
                            {journalSources.map(({ id, label }) => (
                                <FilterButton
                                    key={id}
                                    $selected={filter === id}
                                    aria-pressed={filter === id}
                                    onClick={() => {
                                        setFilter(id);
                                        setSelectedKey(undefined);
                                    }}
                                >
                                    <span>{label}</span>
                                    {journal.actions.some((item) => item.source === id) && (
                                        <CountBadge>
                                            {journal.actions.filter((item) => item.source === id).length}
                                        </CountBadge>
                                    )}
                                </FilterButton>
                            ))}
                        </List>
                    </SidebarSection>
                </SidebarBody>
            </Sidebar>
            <Center aria-label="Список изменений">
                <CenterHeader>
                    <strong>{filter === 'all' ? 'Все изменения' : sourceLabels[filter]}</strong>
                    <span>{changeCount(filtered.length)}</span>
                </CenterHeader>
                <CenterBody>
                    {journal.loading && <Status role="status">Загрузка журнала…</Status>}
                    {journal.error && (
                        <Status role="alert">
                            {journal.error}
                            <ActionRow>
                                <Button onClick={() => void journal.reload()}>Повторить</Button>
                            </ActionRow>
                        </Status>
                    )}
                    {revertState.operationError && <Status role="alert">{revertState.operationError}</Status>}
                    {revertState.refreshFailed && (
                        <Button
                            type="button"
                            disabled={Boolean(revertState.reverting)}
                            onClick={() => void revertState.retryRefresh()}
                        >
                            Повторить загрузку данных
                        </Button>
                    )}
                    {!journal.loading && !journal.error && filtered.length === 0 && (
                        <EmptyState>
                            <h2>Изменений пока нет</h2>
                            <p>
                                {filter === 'all'
                                    ? 'Неопубликованных изменений нет. Вернитесь в редактор, чтобы изменить дизайн-систему.'
                                    : 'По этому источнику изменений пока нет.'}
                            </p>
                        </EmptyState>
                    )}
                    {!journal.loading &&
                        groups.map(({ source, label, actions }) => (
                            <ChangeGroup key={source}>
                                <h2>
                                    {label} · {actions.length}
                                </h2>
                                {actions.map((action) => (
                                    <ChangeRow key={action.key} $selected={selected?.key === action.key}>
                                        <ItemButton
                                            type="button"
                                            $selected={selected?.key === action.key}
                                            aria-pressed={selected?.key === action.key}
                                            onClick={() => setSelectedKey(action.key)}
                                        >
                                            <span>
                                                <strong>{action.title}</strong>
                                                <small>
                                                    {[
                                                        [
                                                            ...new Set(action.changedFields.map(({ label }) => label)),
                                                        ].join(', '),
                                                        action.platformLabel,
                                                        action.groupLabel && `Группа: ${action.groupLabel}`,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </small>
                                            </span>
                                            <ChangePreview action={action} />
                                        </ItemButton>
                                        {action.canRevert && (
                                            <UndoButton
                                                type="button"
                                                aria-label={`Отменить изменение: ${[action.title, action.revertPaths && action.changedFields[0]?.label, action.platformLabel].filter(Boolean).join(' · ')}`}
                                                title="Отменить изменение"
                                                disabled={Boolean(revertState.reverting) || revertState.refreshFailed}
                                                onClick={() => void revertState.revert(action)}
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    width="16"
                                                    height="16"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    aria-hidden="true"
                                                >
                                                    <path d="M4.5 8.5A8 8 0 1 1 4 14" />
                                                    <path d="M4.5 4v4.5H9" />
                                                </svg>
                                            </UndoButton>
                                        )}
                                    </ChangeRow>
                                ))}
                            </ChangeGroup>
                        ))}
                </CenterBody>
            </Center>
            <JournalDetails
                action={selected}
                context={editorContext}
                onReload={journal.reload}
                revertState={revertState}
            />
        </Page>
    );
};

export const DesignSystemVersionsPage = () => {
    const {
        designSystem,
        editorContext,
        autosaveStatus,
        editorJournal,
        reload: reloadEditor,
    } = useOutletContext<VersionJournalOutletContext>();
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedVersionId = searchParams.get('historyVersionId') ?? undefined;
    const historicalContext = useMemo(
        () => (editorContext ? { ...editorContext, versionId: selectedVersionId } : undefined),
        [editorContext, selectedVersionId],
    );
    const components = designSystem?.getComponentsData() ?? [];
    const canReuseEditorJournal = Boolean(editorJournal && selectedVersionId === editorContext?.versionId);
    const ownJournal = useJournal(
        !canReuseEditorJournal ? historicalContext : undefined,
        components,
        designSystem,
        Boolean(selectedVersionId || designSystem?.getParameters()?.readOnly),
        Boolean(designSystem),
    );
    const journal = canReuseEditorJournal ? editorJournal! : ownJournal;
    const draftContext = useMemo(
        () => (editorContext ? { ...editorContext, versionId: undefined } : undefined),
        [editorContext],
    );
    const canReuseEditorDraft = Boolean(editorJournal && !editorContext?.versionId);
    const backgroundDraftJournal = useJournal(
        selectedVersionId && !canReuseEditorDraft ? draftContext : undefined,
        components,
        designSystem,
        true,
    );
    const draftJournal = !selectedVersionId ? journal : canReuseEditorDraft ? editorJournal! : backgroundDraftJournal;
    const navigate = useNavigate();
    const {
        versions,
        loading: versionsLoading,
        error: versionsError,
        reload: reloadVersions,
    } = useVersionList(editorContext);
    const [version, setVersion] = useState('0.1.0');
    const [changelog, setChangelog] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [publicationResult, setPublicationResult] = useState<string>();
    const [selectedHistoryActionKey, setSelectedHistoryActionKey] = useState<string>();
    const readOnly = Boolean(selectedVersionId) || designSystem?.getParameters()?.readOnly !== false;

    useEffect(() => {
        setVersion('0.1.0');
        setChangelog('');
        setPublicationResult(undefined);
        setSelectedHistoryActionKey(undefined);
    }, [editorContext?.designSystemId]);

    useEffect(() => {
        if (!versionsLoading && !versionsError)
            setVersion((current) => (current === '0.1.0' ? nextVersion(versions) : current));
    }, [versions, versionsLoading, versionsError]);
    useReloadAfterAutosave(editorJournal ? undefined : autosaveStatus, journal.reload);

    const selectVersion = (id?: string) => {
        const next = new URLSearchParams(searchParams);
        if (id) next.set('historyVersionId', id);
        else next.delete('historyVersionId');
        setSelectedHistoryActionKey(undefined);
        setSearchParams(next);
    };
    const selectedHistoryAction = selectedVersionId
        ? journal.actions.find(({ key }) => key === selectedHistoryActionKey)
        : undefined;
    const selectAction = (action: JournalActionViewModel) => {
        if (selectedVersionId) {
            setSelectedHistoryActionKey(action.key);
        } else if (action.navigation.kind !== 'unavailable') {
            const next = new URLSearchParams(action.navigation.search);
            if (editorContext?.versionId) next.set('versionId', editorContext.versionId);
            else next.delete('versionId');
            navigate({ pathname: action.navigation.pathname, search: next.toString() });
        }
    };
    const selectedVersion = versions.find(({ id }) => id === selectedVersionId);
    const latestVersion = [...versions].sort((left, right) => right.sequenceNumber - left.sequenceNumber)[0];
    const validVersion = /^\d+\.\d+\.\d+$/.test(version);
    const canPublish = !readOnly && !versionsLoading && validVersion && journal.actions.length > 0 && !publishing;
    const publish = async (event: FormEvent) => {
        event.preventDefault();
        if (!canPublish || !editorContext) return;
        setPublishing(true);
        try {
            try {
                await waitForDraftAutosaveIdle(editorContext, 10_000);
            } catch {
                setPublicationResult(
                    'Изменения ещё не сохранены. Дождитесь завершения автосохранения и повторите публикацию.',
                );
                return;
            }
            if (hasPersistedComponentMutation(editorContext)) {
                setPublicationResult(
                    'Есть несохранённое изменение компонента. Откройте редактор компонентов, дождитесь сохранения и повторите публикацию.',
                );
                return;
            }
            const current = await repository.getDesignSystem(editorContext);
            if (!current.draftId || current.draftRevision == null) throw new Error('Активный черновик недоступен');
            const published = await repository.publish(
                editorContext,
                current.draftId,
                current.draftRevision,
                version,
                changelog.trim(),
                crypto.randomUUID(),
            );
            setPublicationResult(`Версия ${published.version} создана`);
            setChangelog('');
            setVersion(nextVersion([...versions, published]));
            await Promise.resolve(reloadEditor());
            await reloadVersions();
        } catch (cause) {
            if (errorCode(cause) === 'DRAFT_STALE') {
                setPublicationResult(
                    'Черновик изменился. Состав публикации обновлён; проверьте его и повторите публикацию.',
                );
                await Promise.resolve(reloadEditor());
                await Promise.all([reloadVersions(), journal.reload()]);
            } else {
                setPublicationResult('Не удалось создать версию. Черновик не опубликован.');
            }
        } finally {
            setPublishing(false);
        }
    };
    const actionGroups = (['themes', 'tokens', 'components'] as JournalSection[])
        .map((section) => ({ section, actions: journal.actions.filter((action) => action.section === section) }))
        .filter(({ actions }) => actions.length > 0);
    const versionTitle = selectedVersion
        ? `v${selectedVersion.version}`
        : selectedVersionId
          ? 'Версия не найдена'
          : `v${version}`;

    return (
        <Page>
            <Sidebar aria-label="Версии дизайн-системы">
                <SidebarHeader>
                    <strong>Версии</strong>
                </SidebarHeader>
                <SidebarBody>
                    <SidebarSection>
                        <List>
                            <FilterButton
                                aria-label="Черновик публикации"
                                $selected={!selectedVersionId}
                                aria-pressed={!selectedVersionId}
                                onClick={() => selectVersion()}
                            >
                                <span>Черновик публикации</span>
                                {!draftJournal.loading && !draftJournal.error && draftJournal.actions.length > 0 && (
                                    <CountBadge>{draftJournal.actions.length}</CountBadge>
                                )}
                            </FilterButton>
                        </List>
                    </SidebarSection>
                    <SidebarSection>
                        <small>Опубликованные</small>
                        <List>
                            {versions.map((item) => (
                                <FilterButton
                                    key={item.id}
                                    $selected={item.id === selectedVersionId}
                                    aria-pressed={item.id === selectedVersionId}
                                    onClick={() => selectVersion(item.id)}
                                >
                                    <span>v{item.version}</span>
                                    <span>{item.id === latestVersion?.id ? 'Текущая' : ''}</span>
                                </FilterButton>
                            ))}
                        </List>
                    </SidebarSection>
                    {versionsLoading && <Status role="status">Загрузка версий…</Status>}
                    {versionsError && (
                        <Status role="alert">
                            {versionsError}
                            <ActionRow>
                                <Button onClick={() => void reloadVersions()}>Повторить</Button>
                            </ActionRow>
                        </Status>
                    )}
                    {!versionsLoading && !versionsError && versions.length === 0 && (
                        <Status>
                            Опубликованных версий пока нет. Первая появится после публикации непустого черновика.
                        </Status>
                    )}
                </SidebarBody>
            </Sidebar>
            <Center aria-label="Состав версии">
                <CenterHeader>
                    <strong>{versionTitle}</strong>
                    <span>
                        {selectedVersion
                            ? `Опубликована · ${formattedDate(selectedVersion.publishedAt)}`
                            : selectedVersionId
                              ? 'Недоступна'
                              : `Черновик публикации · ${changeCount(journal.actions.length)}`}
                    </span>
                </CenterHeader>
                <CenterBody>
                    {!versionsLoading && selectedVersionId && !selectedVersion && (
                        <EmptyState role="alert">
                            <h2>Версия не найдена</h2>
                            <p>Выбранная версия не существует или больше недоступна.</p>
                        </EmptyState>
                    )}
                    {(!selectedVersionId || selectedVersion) && (
                        <Form id="version-publication-form" onSubmit={publish}>
                            <ReleaseSection>
                                <h2>Версия</h2>
                                {selectedVersion ? (
                                    <InspectorRow>
                                        <span>Номер версии</span>
                                        <strong>v{selectedVersion.version}</strong>
                                    </InspectorRow>
                                ) : (
                                    <VersionNumberRow>
                                        <span>
                                            <strong>Номер версии</strong>
                                            <small>
                                                Текущая версия ·{' '}
                                                {latestVersion ? `v${latestVersion.version}` : 'ещё не опубликована'}
                                            </small>
                                        </span>
                                        <input
                                            aria-label="Номер версии"
                                            value={version}
                                            onChange={(event) => setVersion(event.target.value)}
                                            disabled={readOnly}
                                            aria-invalid={!validVersion}
                                        />
                                    </VersionNumberRow>
                                )}
                                {!validVersion && !selectedVersionId && (
                                    <Status role="alert">Используйте формат major.minor.patch</Status>
                                )}
                            </ReleaseSection>
                            <ReleaseSection>
                                <h2>Примечания к версии</h2>
                                {selectedVersion ? (
                                    <ReleaseNotes>{selectedVersion.changelog}</ReleaseNotes>
                                ) : (
                                    <NotesLabel>
                                        <span>Описание</span>
                                        <textarea
                                            aria-label="Описание"
                                            placeholder="Необязательно"
                                            value={changelog}
                                            onChange={(event) => setChangelog(event.target.value)}
                                            disabled={readOnly}
                                        />
                                    </NotesLabel>
                                )}
                            </ReleaseSection>
                            <ReleaseSection>
                                <h2>Включённые изменения</h2>
                                {journal.loading && <Status role="status">Загрузка состава…</Status>}
                                {journal.error && (
                                    <Status role="alert">
                                        {journal.error}
                                        <ActionRow>
                                            <Button type="button" onClick={() => void journal.reload()}>
                                                Повторить
                                            </Button>
                                        </ActionRow>
                                    </Status>
                                )}
                                {!journal.loading && !journal.error && journal.actions.length === 0 && (
                                    <Status>Публиковать нечего. Откройте редактор и внесите изменения.</Status>
                                )}
                                {!journal.loading &&
                                    actionGroups.map(({ section, actions }) => (
                                        <ChangeGroup key={section}>
                                            <h2>
                                                {sectionLabels[section]} · {actions.length}
                                            </h2>
                                            {actions.map((action) => (
                                                <ItemButton
                                                    type="button"
                                                    key={action.key}
                                                    onClick={() => selectAction(action)}
                                                >
                                                    <span>
                                                        <strong>{action.title}</strong>
                                                        <small>
                                                            {[
                                                                action.revertPaths
                                                                    ? action.changedFields
                                                                          .map(({ label }) => label)
                                                                          .join(', ')
                                                                    : sectionDescriptions[section],
                                                                action.platformLabel,
                                                                action.groupLabel && `Группа: ${action.groupLabel}`,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' · ')}
                                                        </small>
                                                    </span>
                                                    <small>
                                                        {action.actorLabel} · {formattedDate(action.changedAt)}
                                                    </small>
                                                </ItemButton>
                                            ))}
                                        </ChangeGroup>
                                    ))}
                            </ReleaseSection>
                        </Form>
                    )}
                </CenterBody>
            </Center>
            {selectedHistoryAction ? (
                <JournalDetails
                    action={selectedHistoryAction}
                    context={historicalContext}
                    onReload={journal.reload}
                    allowSourceNavigation={false}
                    onClose={() => setSelectedHistoryActionKey(undefined)}
                />
            ) : (
                <Inspector aria-label="Публикация дизайн-системы">
                    <InspectorHeader>
                        <strong>
                            {selectedVersionId
                                ? selectedVersion
                                    ? `Версия ${selectedVersion.version}`
                                    : 'Версия не найдена'
                                : 'Черновик публикации'}
                        </strong>
                        <span>
                            {selectedVersionId
                                ? 'Только для чтения'
                                : `v${version} · ${canPublish ? 'готово к публикации' : 'подготовка'}`}
                        </span>
                        <small>
                            {selectedVersion
                                ? formattedDate(selectedVersion.publishedAt)
                                : changeCount(journal.actions.length)}
                        </small>
                    </InspectorHeader>
                    <InspectorBody>
                        <InspectorSection>
                            <h2>Состояние</h2>
                            <InspectorRow>
                                <span>Текущая версия</span>
                                <strong>{latestVersion ? `v${latestVersion.version}` : 'Не опубликована'}</strong>
                            </InspectorRow>
                            <InspectorRow>
                                <span>Режим</span>
                                <strong>{selectedVersionId ? 'Просмотр' : 'Черновик'}</strong>
                            </InspectorRow>
                            <InspectorRow>
                                <span>Изменения</span>
                                <strong>{journal.actions.length}</strong>
                            </InspectorRow>
                        </InspectorSection>
                        <InspectorSection>
                            <h2>{selectedVersionId ? 'Версия' : 'После публикации'}</h2>
                            <p>
                                {selectedVersionId
                                    ? 'Выбор здесь меняет только историю. Чтобы открыть версию в редакторе, выберите её в верхней панели.'
                                    : 'Версия станет доступна только для чтения, а активный журнал начнётся заново.'}
                            </p>
                        </InspectorSection>
                        {publicationResult && <Status role="status">{publicationResult}</Status>}
                    </InspectorBody>
                    {!selectedVersionId && !readOnly && (
                        <InspectorFooter>
                            <SecondaryButton
                                type="button"
                                onClick={() => navigate({ pathname: '../changes', search: searchParams.toString() })}
                            >
                                Открыть изменения
                            </SecondaryButton>
                            <Button type="submit" form="version-publication-form" disabled={!canPublish}>
                                {publishing ? 'Публикуем…' : 'Опубликовать версию'}
                            </Button>
                        </InspectorFooter>
                    )}
                </Inspector>
            )}
        </Page>
    );
};
