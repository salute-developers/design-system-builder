import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { EditorContextKey, ComponentPropertyDto } from '../api/editorContracts';
import { coreCompatibilityRepository, type CoreIssue } from '../api/coreCompatibilityRepository';
import { useCoreCompatibility } from '../hooks/useCoreCompatibility';
import { CoreIssueList } from './CoreIssueList';

const messages: Record<string, string> = {
    CORE_COMPONENT_REMOVED: 'Компонент отсутствует в Core',
    CORE_PROPERTY_REMOVED: 'Свойство отсутствует в Core',
    CORE_STATE_REMOVED: 'Состояние отсутствует в Core',
    CORE_VALUE_TYPE_CONFLICT: 'Тип значения не подходит свойству',
    CORE_PLATFORM_PARAM_REMOVED: 'Платформенный параметр отсутствует в Core',
    CORE_PROPERTY_DEPRECATED: 'Свойство устарело',
    CORE_TOKEN_UNAVAILABLE: 'Токен недоступен',
    CORE_COMPONENT_REFERENCE_UNAVAILABLE: 'Вложенное оформление недоступно',
    CORE_COMPONENT_TARGET_CONFLICT: 'Core не допускает выбранный вложенный компонент',
};

export const CoreProblems = ({
    context,
    componentId,
    readOnly,
    onRepaired,
}: {
    context: EditorContextKey;
    componentId?: string;
    readOnly?: boolean;
    onRepaired?: () => void;
}) => {
    const { report, error, reload } = useCoreCompatibility(context, componentId);
    const location = useLocation();
    const navigate = useNavigate();
    const selected = new URLSearchParams(location.search).get('issueId');
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string>();
    const [targets, setTargets] = useState<ComponentPropertyDto[]>([]);
    const [targetByIssue, setTargetByIssue] = useState<Record<string, string>>({});
    useEffect(() => {
        let cancelled = false;
        setTargets([]);
        if (componentId && !readOnly && !context.versionId) {
            void coreCompatibilityRepository
                .targets(context, componentId)
                .then((items) => {
                    if (!cancelled) setTargets(items);
                })
                .catch(() => { if (!cancelled) setFailure('Не удалось загрузить свойства для переноса. Обновите отчёт.'); });
        }
        return () => {
            cancelled = true;
        };
    }, [
        componentId,
        context.projectId,
        context.designSystemId,
        context.versionId,
        readOnly,
        report?.context.coreReleases.map((r) => r.releaseId).join(','),
    ]);
    const repair = async (issue: CoreIssue, target?: string) => {
        setBusy(true);
        setFailure(undefined);
        try {
            await coreCompatibilityRepository.repair(context, issue, target, report?.context.draftRevision);
            reload();
            onRepaired?.();
        } catch {
            setFailure(
                'Исправление не сохранено. Возможно, данные изменились или перенос несовместим. Обновите отчёт и повторите.',
            );
            reload();
        } finally {
            setBusy(false);
        }
    };
    return (
        <section aria-label="Проблемы Core">
            <h2>Проблемы</h2>
            {error && (
                <p role="alert">
                    Не удалось проверить совместимость.{' '}
                    <button type="button" onClick={reload}>
                        Повторить
                    </button>
                </p>
            )}
            {!report && !error && <p>Проверяем совместимость…</p>}
            {failure && <p role="alert">{failure}</p>}
            {report && (
                <>
                    <p>
                        Во всей ДС: {report.blockingCount} блокирующих проблем, {report.warningCount} предупреждений.
                    </p>
                    {report.context.coreReleases.some((r) => r.provenance === 'migration-snapshot') && (
                        <p>Историческое происхождение технического снимка Core неизвестно.</p>
                    )}
                    {report.items.length === 0 && <p>Для выбранного компонента проблем нет.</p>}
                    <CoreIssueList items={report.items} selectedIssueId={selected} renderItem={(issue) => {
                        const l = issue.location;
                        const value = issue.storedValue;
                        return (
                            <article
                                key={issue.issueId}
                                id={`core-issue-${issue.issueId}`}
                                aria-current={selected === issue.issueId ? 'true' : undefined}
                            >
                                <h3>{messages[issue.code] ?? issue.code}</h3>
                                <p>
                                    {l.componentName} · {l.appearanceName ?? 'default'} ·{' '}
                                    {l.propertyName ?? l.propertyId}
                                </p>
                                <p>
                                    {l.styleLabels.length ? l.styleLabels.join(' + ') : 'База'} ·{' '}
                                    {l.states.length ? l.states.join(' + ') : 'Без состояния'}
                                </p>
                                {value && (
                                    <dl>
                                        <dt>Сохранённое значение</dt>
                                        <dd>
                                            {value.tokenId
                                                ? `${value.tokenName ?? value.tokenId} (токен)`
                                                : (value.literal ?? 'Не задано')}
                                        </dd>
                                        {value.alpha && (
                                            <>
                                                <dt>Alpha</dt>
                                                <dd>{value.alpha}</dd>
                                            </>
                                        )}
                                        {value.adjustment && (
                                            <>
                                                <dt>Поправка</dt>
                                                <dd>{value.adjustment}</dd>
                                            </>
                                        )}
                                        {value.targetAppearanceId && (
                                            <>
                                                <dt>Вложенное оформление</dt>
                                                <dd>
                                                    {value.targetAppearanceId} · {value.targetStyleIds.join(', ')}
                                                </dd>
                                            </>
                                        )}
                                        {value.platformAdjustments.map((a) => (
                                            <div key={a.id}>
                                                <dt>Платформенная поправка {a.platformParamId}</dt>
                                                <dd>
                                                    {a.value ?? ''} {a.template ?? ''}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const search = new URLSearchParams(location.search);
                                        search.set('issueId', issue.issueId);
                                        search.set('section', 'problems');
                                        navigate({ search: search.toString() });
                                    }}
                                >
                                    Ссылка на проблему
                                </button>
                                {!readOnly && !context.versionId && issue.allowedActions.includes('remove') && (
                                    <button type="button" disabled={busy} onClick={() => void repair(issue)}>
                                        Удалить назначение
                                    </button>
                                )}
                                {!readOnly &&
                                    !context.versionId &&
                                    issue.allowedActions.includes('transfer') &&
                                    componentId && (
                                        <>
                                            <select
                                                aria-label="Свойство для переноса"
                                                value={targetByIssue[issue.issueId] ?? ''}
                                                onChange={(event) =>
                                                    setTargetByIssue((current) => ({
                                                        ...current,
                                                        [issue.issueId]: event.target.value,
                                                    }))
                                                }
                                            >
                                                <option value="">Выберите свойство</option>
                                                {targets
                                                    .filter((target) => target.id !== l.propertyId)
                                                    .map((target) => (
                                                        <option key={target.id} value={target.id}>
                                                            {target.name} ({target.type})
                                                        </option>
                                                    ))}
                                            </select>
                                            <button
                                                type="button"
                                                disabled={busy || !targetByIssue[issue.issueId]}
                                                onClick={() => void repair(issue, targetByIssue[issue.issueId])}
                                            >
                                                Перенести
                                            </button>
                                        </>
                                    )}
                                {!!value?.platformAdjustments.length && (
                                    <p>Перенос с отдельными платформенными поправками недоступен.</p>
                                )}
                            </article>
                        );
                    }} />
                </>
            )}
        </section>
    );
};
