import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CoreProblems } from './CoreProblems';
import type { CoreCompatibilityReport, CoreIssue } from '../api/coreCompatibilityRepository';

const mocks = vi.hoisted(() => ({ report: vi.fn(), reload: vi.fn(), repair: vi.fn(), targets: vi.fn() }));
vi.mock('../hooks/useCoreCompatibility', () => ({
    useCoreCompatibility: () => ({ report: mocks.report(), reload: mocks.reload }),
}));
vi.mock('../api/coreCompatibilityRepository', () => ({ coreCompatibilityRepository: mocks }));
const context = { projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' };
const issue: CoreIssue = {
    issueId: 'variation:value:CORE_PROPERTY_REMOVED', code: 'CORE_PROPERTY_REMOVED', severity: 'blocking',
    location: { componentId: 'button', componentName: 'Button', platform: 'compose', appearanceId: 'appearance', appearanceName: 'Rounded',
        propertyId: 'old', propertyName: 'oldFill', valueKind: 'variation', valueId: 'value',
        styleIds: ['large', 'accent'], styleLabels: ['size=large', 'view=accent'], states: ['hovered'], revision: 9 },
    storedValue: { literal: null, tokenId: 'token', tokenName: 'background.accent', alpha: '0.5', adjustment: '2',
        targetAppearanceId: null, targetStyleIds: [], platformAdjustments: [] },
    allowedActions: ['remove', 'transfer'],
};
const report = (item = issue): CoreCompatibilityReport => ({
    context: { designSystemId: 'ds', versionId: null, draftId: 'draft', draftRevision: 14, coreReleases: [] },
    items: [item], blockingCount: 1, warningCount: 0, nextCursor: null, validatorVersion: 1,
});
const show = (readOnly = false) => render(<MemoryRouter initialEntries={[`/?section=problems&issueId=${issue.issueId}`]}>
    <CoreProblems context={context} componentId="button" readOnly={readOnly} />
</MemoryRouter>);
beforeEach(() => {
    vi.resetAllMocks();
    mocks.report.mockReturnValue(report());
    mocks.targets.mockResolvedValue([{ id: 'new', name: 'newFill', type: 'color' }]);
    mocks.repair.mockResolvedValue(undefined);
});
afterEach(cleanup);

it('shows the original scope and token and sends both revisions on transfer', async () => {
    show();
    expect(screen.getByText('size=large + view=accent · hovered')).toBeInTheDocument();
    expect(screen.getByText('background.accent (токен)')).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveAttribute('aria-current', 'true');
    await screen.findByRole('option', { name: 'newFill (color)' });
    fireEvent.change(screen.getByLabelText('Свойство для переноса'), { target: { value: 'new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Перенести' }));
    await waitFor(() => expect(mocks.repair).toHaveBeenCalledWith(context, issue, 'new', 14));
    expect(mocks.reload).toHaveBeenCalledOnce();
});

it('keeps platform templates visible and offers removal without transfer', async () => {
    const adjusted = { ...issue, allowedActions: ['remove'], storedValue: { ...issue.storedValue!,
        platformAdjustments: [{ id: 'offset', platformParamId: 'param', revision: 2, value: '4', template: 'offset $1' }] } };
    mocks.report.mockReturnValue(report(adjusted));
    show();
    expect(screen.getByText('4 offset $1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Перенести' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить назначение' }));
    await waitFor(() => expect(mocks.repair).toHaveBeenCalledWith(context, adjusted, undefined, 14));
});

it('does not offer mutations on historical data', () => {
    show(true);
    expect(screen.getByText('background.accent (токен)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Удалить назначение' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Свойство для переноса')).not.toBeInTheDocument();
    expect(mocks.targets).not.toHaveBeenCalled();
});

it('retains the assignment and refreshes the report after a rejected repair', async () => {
    mocks.repair.mockRejectedValue(new Error('CORE_PROBLEM_STALE'));
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить назначение' }));
    await screen.findByRole('alert');
    expect(screen.getByText('background.accent (токен)')).toBeInTheDocument();
    expect(mocks.reload).toHaveBeenCalledOnce();
});
