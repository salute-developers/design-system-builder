import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ComponentProblems } from './ComponentProblems';
import { issueEditorHref, issueMatchesSource } from './model';
import { issue } from './testFixtures';
const Location = () => {
    const l = useLocation();
    return (
        <p data-testid="location">
            {l.pathname}
            {l.search}
        </p>
    );
};
afterEach(cleanup);
it('opens the precise configuration and retains historical version, without repair controls', () => {
    render(
        <MemoryRouter initialEntries={['/themes/t/components/compose-Button?versionId=history&section=problems']}>
            <ComponentProblems issues={[issue]} retry={vi.fn()} />
            <Location />
        </MemoryRouter>,
    );
    expect(screen.queryByText('Удалить назначение')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Перейти к свойству/ }));
    const location = screen.getByTestId('location').textContent!;
    expect(location).toContain('configuration=appearance');
    expect(location).toContain('versionId=history');
    expect(location).toContain('section=style');
    expect(location).toContain('issueId=variation');
});
it('distinguishes base, one style and exact intersections', () => {
    expect(issueMatchesSource(issue, { kind: 'invariant' })).toBe(false);
    expect(issueMatchesSource(issue, { kind: 'combination', styleIDs: ['accent', 'large'], label: '' })).toBe(true);
    expect(issueMatchesSource(issue, { kind: 'combination', styleIDs: ['large'], label: '' })).toBe(false);
});
it('keeps native/component issues in validation and links missing Core to settings', () => {
    expect(
        issueEditorHref(
            { ...issue, location: { ...issue.location, platform: 'ios' } },
            '/projects/p/design-systems/d/themes/t',
            '?versionId=v',
        ),
    ).toContain('/validation?');
    expect(
        issueEditorHref({ ...issue, code: 'CORE_SELECTION_REQUIRED' }, '/projects/p/design-systems/d/themes/t', ''),
    ).toContain('/design-systems/d/settings?');
});

it.each([
    [0, '0 проблем'],
    [1, '1 проблема'],
    [2, '2 проблемы'],
    [4, '4 проблемы'],
    [5, '5 проблем'],
    [11, '11 проблем'],
    [21, '21 проблема'],
    [22, '22 проблемы'],
    [111, '111 проблем'],
])('declines the problem count %i', async (count, expected) => {
    const { validationLabel } = await import('./model');
    expect(validationLabel(Number(count))).toBe(`Валидация (${expected})`);
});
