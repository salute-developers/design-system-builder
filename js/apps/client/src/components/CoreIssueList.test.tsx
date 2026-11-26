import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { CoreIssue } from '../api/coreCompatibilityRepository';
import { CoreIssueList } from './CoreIssueList';

afterEach(cleanup);
const items = Array.from({ length: 41 }, (_, index) => ({ issueId: `issue-${index}` }) as CoreIssue);
const renderItem = (issue: CoreIssue) => <p key={issue.issueId}>{issue.issueId}</p>;

it('shows bounded pages without changing issue identities', () => {
    render(<CoreIssueList items={items} renderItem={renderItem} />);
    expect(screen.getByText('issue-0')).toBeInTheDocument();
    expect(screen.queryByText('issue-20')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Далее'));
    expect(screen.getByText('issue-20')).toBeInTheDocument();
    expect(screen.getByText('Страница 2 из 3')).toBeInTheDocument();
});

it('opens the page of a linked issue and clamps it after repair', async () => {
    const view = render(<CoreIssueList items={items} selectedIssueId="issue-40" renderItem={renderItem} />);
    expect(await screen.findByText('issue-40')).toBeInTheDocument();
    expect(screen.getByText('Далее')).toBeDisabled();
    view.rerender(<CoreIssueList items={items.slice(0, 2)} selectedIssueId="issue-40" renderItem={renderItem} />);
    expect(screen.getByText('issue-0')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
