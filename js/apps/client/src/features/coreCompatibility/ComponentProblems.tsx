import { useLocation, useNavigate } from 'react-router-dom';
import type { CoreIssue } from '../../api/coreCompatibilityRepository';
import { coreIssueMessages, issueScope, issueEditorHref } from './model';
import { CoreIssueList } from '../../components/CoreIssueList';
/** Вкладка инспектора содержит только адреса проблем, без отдельного редактора исправлений. */
export const ComponentProblems = ({
    issues,
    error,
    retry,
}: {
    issues: CoreIssue[];
    error?: string;
    retry: () => void;
}) => {
    const location = useLocation();
    const navigate = useNavigate();
    const base = location.pathname.split('/components')[0];
    return (
        <section
            className="component-inspector-body"
            role="tabpanel"
            id="component-inspector-panel-problems"
            aria-labelledby="component-inspector-tab-problems"
        >
            {error && (
                <p role="alert">
                    Проверка недоступна. <button onClick={retry}>Повторить</button>
                </p>
            )}
            <CoreIssueList
                items={issues}
                selectedIssueId={new URLSearchParams(location.search).get('issueId')}
                renderItem={(issue) => (
                    <button
                        type="button"
                        key={issue.issueId}
                        id={`core-issue-${issue.issueId}`}
                        className="core-problem-row"
                        onClick={() => navigate(issueEditorHref(issue, base, location.search))}
                    >
                        <strong>{issue.location.propertyName ?? issue.location.componentName}</strong>
                        <span>{coreIssueMessages[issue.code] ?? issue.code}</span>
                        <small>{issueScope(issue)}</small>
                        <span className="core-problem-link">
                            {issue.location.propertyId ? 'Перейти к свойству' : 'Открыть валидацию'}
                        </span>
                    </button>
                )}
            />
        </section>
    );
};
