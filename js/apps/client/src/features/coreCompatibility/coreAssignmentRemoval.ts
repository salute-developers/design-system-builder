import { useState } from 'react';
import type { EditorContextKey } from '../../api/editorContracts';
import {
    coreCompatibilityRepository,
    type CoreCompatibilityReport,
    type CoreIssue,
} from '../../api/coreCompatibilityRepository';
import { waitForDraftAutosaveIdle, hasPersistedComponentMutation } from '../../api/draftAutosaveActivity';

export interface IssueRepairAccess {
    context: EditorContextKey;
    report: CoreCompatibilityReport;
    readOnly?: boolean;
    beforeRepair?: () => Promise<void>;
    onRepaired: () => void;
    onRefresh?: () => void;
    onFailure?: (message: string) => void;
}
/** Обычная очистка недоступного назначения с сохранением проверок автосохранения и ревизий. */
export const useRemoveCoreAssignment = (issue: CoreIssue, access: IssueRepairAccess) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const editable = !access.readOnly && !access.context.versionId && issue.allowedActions.includes('remove');
    const remove = async () => {
        if (!editable || busy) return;
        setBusy(true);
        setError('');
        access.onFailure?.('');
        try {
            await access.beforeRepair?.();
            await waitForDraftAutosaveIdle(access.context, 15_000);
            if (hasPersistedComponentMutation(access.context)) throw new Error('pending');
            const fresh = await coreCompatibilityRepository.read(access.context, issue.location.componentId);
            const current = fresh.items.find((item) => item.issueId === issue.issueId);
            if (
                !current ||
                current.location.revision !== issue.location.revision ||
                fresh.context.coreSelectionRevision !== access.report.context.coreSelectionRevision
            )
                throw new Error('stale');
            await coreCompatibilityRepository.repair(
                access.context,
                issue,
                undefined,
                fresh.context.draftRevision,
                fresh.context.coreSelectionRevision,
            );
            access.onRepaired();
        } catch {
            const message = 'Очистка не сохранена. Отчёт обновлён; проверьте назначение и повторите.';
            setError(message);
            access.onFailure?.(message);
            (access.onRefresh ?? access.onRepaired)();
        } finally {
            setBusy(false);
        }
    };
    return { remove, busy, error, editable };
};
