import { TyGlyph } from '../../components/TyGlyph';
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import type { DesignSystem } from '../../controllers';
import { SettingsFrame } from '../../components/BuilderShell/BuilderShell';
import { CoreIssueList } from '../../components/CoreIssueList';
import { useCoreCompatibility } from '../../hooks/useCoreCompatibility';
import { coreIssueMessages, issueEditorHref, issueScope, issueValue } from '../../features/coreCompatibility/model';

/** Общий отчёт использует тот же каркас, что настройки, и сохраняет выбранную границу версии. */
export const ValidationPage = () => {
    const { designSystem } = useOutletContext<{ designSystem?: DesignSystem; reload: () => void }>();
    const p = designSystem?.getParameters();
    const [search, setSearch] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const context =
        p?.projectId && p.designSystemId && p.tenantId
            ? {
                  projectId: p.projectId,
                  designSystemId: p.designSystemId,
                  tenantId: p.tenantId,
                  versionId: search.get('versionId') ?? undefined,
              }
            : null;
    const { report, error, reload: refresh } = useCoreCompatibility(context);
    const showCounts = report && !error;
    const issues = report?.items.filter((i) => i.severity === 'blocking') ?? [];
    const selectedId = search.get('issueId');
    const selected = issues.find((i) => i.issueId === selectedId) ?? (!selectedId ? issues[0] : undefined);
    const base = location.pathname.replace(/\/validation\/?$/, '');
    return (
        <SettingsFrame
            title="Валидация"
            entity={designSystem?.getName() ?? 'Дизайн-система'}
            sections={['Совместимость']}
            saveForm={false}
            embedded
            back={base}
            sectionBadges={{ compatibility: showCounts ? issues.length : undefined }}
            sectionActions={{
                compatibility: showCounts ? (
                    <span className="ps-count-badge" aria-label="Всего проблем">
                        {issues.length}
                    </span>
                ) : (
                    false
                ),
            }}
            asideFooter={
                selected &&
                (['web', 'compose'].includes(selected.location.platform) ||
                    selected.code === 'CORE_SELECTION_REQUIRED') ? (
                    <button
                        className="ps-button ps-button-primary"
                        type="button"
                        onClick={() => navigate(issueEditorHref(selected, base, location.search))}
                    >
                        {selected.code === 'CORE_SELECTION_REQUIRED'
                            ? 'Выбрать библиотеку'
                            : selected.location.propertyId
                              ? 'Перейти к свойству'
                              : 'Перейти к компоненту'}
                    </button>
                ) : undefined
            }
            aside={
                <div className="ps-aside-section-block core-validation-details">
                    {selected && context && report ? (
                        <>
                            <p className="ps-aside-section">
                                {selected.location.propertyName ?? selected.location.componentName}
                            </p>
                            <p className="ps-aside-section">{coreIssueMessages[selected.code] ?? selected.code}</p>
                            <p className="ps-aside-note">{issueScope(selected)}</p>
                            {selected.storedValue && (
                                <p className="ps-aside-note core-report-value">
                                    Сохранённое значение: <strong>{issueValue(selected)}</strong>
                                </p>
                            )}
                            {selected.code === 'CORE_COMPONENT_REMOVED' && (
                                <button
                                    type="button"
                                    className="ps-button ps-button-neutral"
                                    onClick={() => {
                                        const query = new URLSearchParams({ section: 'core' });
                                        if (context.versionId) query.set('versionId', context.versionId);
                                        navigate(`${base.replace(/\/themes\/[^/]+$/, '')}/settings?${query}`);
                                    }}
                                >
                                    Открыть настройки библиотек
                                </button>
                            )}
                            {selected.code === 'CORE_COMPONENT_REMOVED' && (
                                <p className="ps-aside-note">
                                    Выберите совместимую версию библиотеки в настройках либо скройте компонент в списке
                                    компонентов.
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="ps-aside-note">
                            Выберите проблему, чтобы посмотреть причину и перейти к назначению.
                        </p>
                    )}
                </div>
            }
        >
            <section id="settings-compatibility" className="settings-section core-validation-report">
                <p className="ps-description">
                    Проверка сохранённых настроек на совместимость с выбранными версиями библиотек.
                </p>
                {error && (
                    <p role="alert">
                        Не удалось проверить совместимость. <button onClick={refresh}>Повторить</button>
                    </p>
                )}
                {!report && !error && <p role="status">Проверяем совместимость…</p>}
                {report && (
                    <>
                        {!error && (
                            <>
                                {issues.length === 0 && <p role="status">Проблем совместимости нет</p>}
                                {selectedId && !selected && (
                                    <p role="status">Выбранная проблема больше не найдена. Выберите другую строку отчёта.</p>
                                )}
                            </>
                        )}
                        {[...new Set(issues.map((i) => i.location.componentId))].map((id) => {
                            const rows = issues.filter((i) => i.location.componentId === id);
                            return (
                                <section key={id} className="core-validation-group">
                                    <h2>
                                        {rows[0].location.componentName}
                                        <span className="core-problem-count">{rows.length}</span>
                                    </h2>
                                    <CoreIssueList
                                        items={rows}
                                        selectedIssueId={selected?.issueId}
                                        renderItem={(issue) => (
                                            <div
                                                className={`core-problem-entry${selected?.issueId === issue.issueId ? ' is-selected' : ''}`}
                                                key={issue.issueId}
                                                id={`core-issue-${issue.issueId}`}
                                            >
                                                <button
                                                    type="button"
                                                    className={`core-problem-row ${selected?.issueId === issue.issueId ? 'is-selected' : ''}`}
                                                    aria-pressed={selected?.issueId === issue.issueId}
                                                    onClick={() =>
                                                        setSearch((previous) => {
                                                            const next = new URLSearchParams(previous);
                                                            next.set('issueId', issue.issueId);
                                                            return next;
                                                        })
                                                    }
                                                >
                                                    <strong>{issue.location.propertyName ?? 'Компонент'}</strong>
                                                    <span>{coreIssueMessages[issue.code] ?? issue.code}</span>
                                                    <small>{issueScope(issue)}</small>
                                                </button>
                                                {['web', 'compose'].includes(issue.location.platform) && (
                                                    <button
                                                        type="button"
                                                        className="core-problem-jump"
                                                        title="Перейти к проблеме"
                                                        aria-label={`Перейти к проблеме: ${issue.location.propertyName ?? issue.location.componentName} · ${issueScope(issue)}`}
                                                        onClick={() =>
                                                            navigate(issueEditorHref(issue, base, location.search))
                                                        }
                                                    >
                                                        <TyGlyph name="arrow-up-right" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    />
                                </section>
                            );
                        })}
                    </>
                )}
            </section>
        </SettingsFrame>
    );
};
