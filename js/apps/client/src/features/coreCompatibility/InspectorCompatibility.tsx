import { PropertyWarningIndicator } from './PropertyWarningIndicator';
import { createContext, useContext } from 'react';
import type { CoreIssue } from '../../api/coreCompatibilityRepository';
import { useRemoveCoreAssignment, type IssueRepairAccess } from './coreAssignmentRemoval';
import { coreIssueMessages, issueNodeId, issueValue } from './model';
import { humanizeName } from '../../utils/text';
import { TyGlyph } from '../../components/TyGlyph';

export const InspectorCompatibilityContext = createContext<{
    issues: CoreIssue[];
    focused?: string;
    access: IssueRepairAccess;
} | null>(null);
export const useInspectorCompatibility = () => useContext(InspectorCompatibilityContext);
const AssignmentField = ({
    issues,
    compatibility,
}: {
    issues: CoreIssue[];
    compatibility: NonNullable<ReturnType<typeof useInspectorCompatibility>>;
}) => {
    const issue = issues.find((i) => i.issueId === compatibility.focused) ?? issues[0];
    const { remove, busy, error, editable } = useRemoveCoreAssignment(issue, compatibility.access);
    const label = humanizeName(issue.location.propertyName ?? 'Недоступное свойство');
    const value = issue.storedValue;
    const stored = value?.tokenId ? (value.tokenName ?? value.tokenId) : (value?.literal ?? issueValue(issue));
    return (
        <article
            className="component-variation-property-group-row core-assignment-row"
            tabIndex={-1}
            id={issueNodeId(issue)}
        >
            <div className="component-variation-style-row">
                <span className="sdds-style-role-label has-deprecated-property">
                    <PropertyWarningIndicator
                        blocking
                        message={issues.map((i) => coreIssueMessages[i.code] ?? i.code).join('\n')}
                    />
                    <b>{label}</b>
                </span>
                <div className="component-variation-property-value">
                    <div className="component-number-control is-raw core-invalid-control">
                        <input
                            aria-label={label}
                            aria-invalid="true"
                            readOnly
                            value={stored}
                            title={issueValue(issue)}
                        />
                    </div>
                    <div className="core-assignment-hint">
                        {issue.location.states.length > 0 && (
                            <small className="core-assignment-state">{issue.location.states.join(' + ')}</small>
                        )}
                        {error && (
                            <p className="component-property-error" role="alert">
                                {error}
                            </p>
                        )}
                    </div>
                    <span className="component-property-clear-slot">
                        {editable && (
                            <button
                                type="button"
                                className="component-property-clear"
                                title="Очистить значение"
                                aria-label={`Очистить значение: ${label}`}
                                disabled={busy}
                                onClick={() => void remove()}
                            >
                                <TyGlyph name="delete" />
                            </button>
                        )}
                    </span>
                </div>
            </div>
        </article>
    );
};
export const UnavailableAssignment = ({ issues }: { issues: CoreIssue[] }) => {
    const compatibility = useInspectorCompatibility();
    return compatibility ? <AssignmentField issues={issues} compatibility={compatibility} /> : null;
};
