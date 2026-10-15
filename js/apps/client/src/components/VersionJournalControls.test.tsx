import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listVersions, listChanges, listJournalTokens, listProjectActorLabels, revertChange } = vi.hoisted(() => ({
    listVersions: vi.fn(),
    listChanges: vi.fn(),
    listJournalTokens: vi.fn(),
    listProjectActorLabels: vi.fn(),
    revertChange: vi.fn(),
}));

vi.mock('../api/themeEditorRepository', () => ({
    ThemeEditorRepository: class {
        listVersions = listVersions;
        listChanges = listChanges;
        listJournalTokens = listJournalTokens;
        listProjectActorLabels = listProjectActorLabels;
        revertChange = revertChange;
    },
}));

import { VersionJournalControls } from './VersionJournalControls';

const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };
const change = {
    changeId: 'change-1',
    versionId: 'draft-1',
    entityType: 'token',
    entityId: 'token-1',
    operation: 'updated' as const,
    changedPaths: ['/description'],
    previousValue: { description: 'before' },
    currentValue: { description: 'after' },
    actorId: 'user-1',
    changedAt: '2026-01-01T00:00:00Z',
    editRevision: 4,
};

beforeEach(() => {
    listVersions.mockReset().mockResolvedValue([
        {
            id: 'version-1',
            designSystemId: 'ds-1',
            sequenceNumber: 1,
            revision: 1,
            version: '1.0.0',
            changelog: 'First',
            publishedAt: '2026-01-01T00:00:00Z',
        },
    ]);
    listChanges.mockReset().mockResolvedValue([change]);
    listJournalTokens.mockReset().mockResolvedValue([]);
    listProjectActorLabels.mockReset().mockResolvedValue({ 'user-1': 'Иван Петров' });
    revertChange.mockReset().mockResolvedValue({});
});

afterEach(cleanup);

describe('VersionJournalControls', () => {
    it('selects a published version and hides revert in historical mode', async () => {
        const onVersionChange = vi.fn();
        const { rerender } = render(<VersionJournalControls context={context} onVersionChange={onVersionChange} />);
        fireEvent.change(await screen.findByLabelText('Версия дизайн-системы'), { target: { value: 'version-1' } });
        expect(onVersionChange).toHaveBeenCalledWith('version-1');

        rerender(
            <VersionJournalControls
                context={{ ...context, versionId: 'version-1' }}
                onVersionChange={onVersionChange}
            />,
        );
        fireEvent.click(screen.getByText('Журнал'));
        expect(await screen.findByText('Изменён: token')).toBeInTheDocument();
        expect(screen.getByText(/Иван Петров/)).toBeInTheDocument();
        expect(screen.queryByText('Отменить')).not.toBeInTheDocument();
    });

    it('reverts immediately and reloads the journal', async () => {
        render(<VersionJournalControls context={context} onVersionChange={vi.fn()} />);
        fireEvent.click(screen.getByText('Журнал'));
        fireEvent.click(await screen.findByText('Отменить'));

        await waitFor(() => expect(revertChange).toHaveBeenCalledWith(context, change));
        await waitFor(() => expect(listChanges).toHaveBeenCalledTimes(2));
    });

    it('reloads a stale journal without retrying revert', async () => {
        revertChange.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { code: 'DRAFT_CHANGE_STALE' } } });
        render(<VersionJournalControls context={context} onVersionChange={vi.fn()} />);
        fireEvent.click(screen.getByText('Журнал'));
        fireEvent.click(await screen.findByText('Отменить'));

        expect(await screen.findByText('Журнал изменился. Показаны актуальные данные.')).toBeInTheDocument();
        expect(revertChange).toHaveBeenCalledTimes(1);
        expect(listChanges).toHaveBeenCalledTimes(2);
    });

    it('reloads an open journal after autosave succeeds', async () => {
        const { rerender } = render(
            <VersionJournalControls context={context} onVersionChange={vi.fn()} autosaveStatus="saving" />,
        );
        fireEvent.click(screen.getByText('Журнал'));
        expect(listChanges).not.toHaveBeenCalled();

        rerender(<VersionJournalControls context={context} onVersionChange={vi.fn()} autosaveStatus="saved" />);

        await waitFor(() => expect(listChanges).toHaveBeenCalledTimes(1));
    });

    it('groups platform rows and shows the token, values and author', async () => {
        const tokenValueChange = (
            platform: 'web' | 'ios' | 'android',
            changeId: string,
            tokenId = 'token-1',
        ) => ({
            ...change,
            changeId,
            entityType: 'token-value',
            entityId: `value-${platform}`,
            changedPaths: ['/value'],
            previousValue: { token_id: tokenId, platform, mode: 'light', value: '#000000' },
            currentValue: { token_id: tokenId, platform, mode: 'light', value: '#ffffff' },
        });
        listChanges.mockResolvedValue([
            tokenValueChange('web', 'change-web'),
            tokenValueChange('ios', 'change-ios'),
            tokenValueChange('android', 'change-android'),
            tokenValueChange('web', 'dependent-web', 'token-2'),
            tokenValueChange('ios', 'dependent-ios', 'token-2'),
            tokenValueChange('android', 'dependent-android', 'token-2'),
        ]);
        listJournalTokens.mockResolvedValue([
            {
                id: 'token-1',
                designSystemId: 'ds-1',
                name: 'text.primary',
                type: 'color',
                displayName: 'Primary text',
                description: null,
                enabled: true,
            },
            {
                id: 'token-2',
                designSystemId: 'ds-1',
                name: 'text.primary-hover',
                type: 'color',
                displayName: 'Primary text hover',
                description: null,
                enabled: true,
            },
        ]);

        render(<VersionJournalControls context={context} onVersionChange={vi.fn()} />);
        fireEvent.click(screen.getByText('Журнал'));

        expect(await screen.findByText('Изменены токены: 2')).toBeInTheDocument();
        expect(await screen.findByText('Изменён токен: text.primary')).toBeInTheDocument();
        expect(screen.getByText('Изменён токен: text.primary-hover')).toBeInTheDocument();
        expect(screen.getAllByText('Светлая тема · #000000 → #ffffff')).toHaveLength(2);
        expect(screen.getAllByText('Платформы: Web, iOS, Android')).toHaveLength(2);
        expect(screen.getByText(/Иван Петров/)).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });
});
