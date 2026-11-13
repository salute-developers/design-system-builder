import { useEffect, useState, type ReactNode } from 'react';
import type { CoreIssue } from '../api/coreCompatibilityRepository';

const PAGE_SIZE = 20;

/** Одна страница диагностики; deep link открывает страницу выбранной проблемы. */
export const CoreIssueList = ({
    items,
    selectedIssueId,
    renderItem,
}: {
    items: CoreIssue[];
    selectedIssueId?: string | null;
    renderItem: (issue: CoreIssue) => ReactNode;
}) => {
    const [requestedPage, setPage] = useState(0);
    const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const page = Math.min(requestedPage, pageCount - 1);
    useEffect(() => {
        const selected = items.findIndex((issue) => issue.issueId === selectedIssueId);
        if (selected >= 0) setPage(Math.floor(selected / PAGE_SIZE));
    }, [items, selectedIssueId]);
    useEffect(() => {
        if (selectedIssueId) document.getElementById(`core-issue-${selectedIssueId}`)?.scrollIntoView?.({ block: 'nearest' });
    }, [selectedIssueId, page, items]);
    return (
        <>
            {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(renderItem)}
            {pageCount > 1 && (
                <nav aria-label="Страницы проблем Core">
                    <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</button>
                    <span>Страница {page + 1} из {pageCount}</span>
                    <button type="button" disabled={page + 1 === pageCount} onClick={() => setPage(page + 1)}>Далее</button>
                </nav>
            )}
        </>
    );
};
