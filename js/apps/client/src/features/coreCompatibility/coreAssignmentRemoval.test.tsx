import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useRemoveCoreAssignment } from './coreAssignmentRemoval';
import { context, issue, report } from './testFixtures';
const mocks = vi.hoisted(() => ({ read: vi.fn(), repair: vi.fn(), idle: vi.fn(), pending: vi.fn() }));
vi.mock('../../api/coreCompatibilityRepository', () => ({ coreCompatibilityRepository: mocks }));
vi.mock('../../api/draftAutosaveActivity', () => ({
    waitForDraftAutosaveIdle: mocks.idle,
    hasPersistedComponentMutation: mocks.pending,
}));
const refresh = vi.fn();
const flush = vi.fn();
const Field = ({ versionId, readOnly = false }: { versionId?: string; readOnly?: boolean }) => {
    const removal = useRemoveCoreAssignment(issue, {
        context: { ...context, versionId },
        report: report(),
        readOnly,
        beforeRepair: flush,
        onRepaired: refresh,
    });
    return (
        <>
            <input readOnly aria-label="Прежнее значение" value={issue.storedValue?.tokenName ?? ''} />
            {removal.editable && (
                <button disabled={removal.busy} onClick={() => void removal.remove()}>
                    Очистить значение
                </button>
            )}
            {removal.error && <p role="alert">{removal.error}</p>}
        </>
    );
};
beforeEach(() => {
    vi.resetAllMocks();
    mocks.read.mockResolvedValue(report());
    mocks.idle.mockResolvedValue(undefined);
    mocks.pending.mockReturnValue(false);
    mocks.repair.mockResolvedValue(undefined);
});
afterEach(cleanup);
it('clears the original assignment only after autosave and fresh revision checks', async () => {
    mocks.read.mockResolvedValue({ ...report(), context: { ...report().context, draftRevision: 20 } });
    render(<Field />);
    fireEvent.click(screen.getByRole('button', { name: 'Очистить значение' }));
    await waitFor(() => expect(mocks.repair).toHaveBeenCalledWith(context, issue, undefined, 20, 7));
    expect(flush).toHaveBeenCalledOnce();
    expect(mocks.idle).toHaveBeenCalledWith(context, 15000);
    expect(refresh).toHaveBeenCalledOnce();
});
it.each(['value', 'core', 'pending'])('keeps the previous value if %s changed', async (kind) => {
    if (kind === 'value')
        mocks.read.mockResolvedValue(report({ ...issue, location: { ...issue.location, revision: 10 } }));
    if (kind === 'core')
        mocks.read.mockResolvedValue({ ...report(), context: { ...report().context, coreSelectionRevision: 8 } });
    if (kind === 'pending') mocks.pending.mockReturnValue(true);
    render(<Field />);
    fireEvent.click(screen.getByRole('button', { name: 'Очистить значение' }));
    await screen.findByRole('alert');
    expect(mocks.repair).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('background.accent');
});
it.each([{ readOnly: true }, { versionId: 'history' }])('disables cleanup for read-only boundaries', (props) => {
    render(<Field {...props} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(mocks.read).not.toHaveBeenCalled();
});
