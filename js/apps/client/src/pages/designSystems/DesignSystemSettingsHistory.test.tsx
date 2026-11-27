import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { DesignSystemSettingsPage } from './DesignSystemSettingsPage';
import { resetQueryCache } from '../../shared/data/useLoad';

vi.mock('../../api', () => ({
    authService: { getCurrentUser: () => null, isAuthenticated: () => true },
    projectsApi: {
        get: vi.fn(async () => ({ id: 'project', name: 'Project', status: 'active', effectiveRole: 'viewer' })),
    },
    designSystemsApi: { get: vi.fn(async () => ({ id: 'system', name: 'System', tenantCount: 0 })), tenants: vi.fn() },
}));
vi.mock('./CoreSettingsPanel', () => ({
    CoreSettingsPanel: ({ versionId }: { versionId?: string }) => <p>Закреплённый Core: {versionId}</p>,
}));
afterEach(() => {
    cleanup();
    resetQueryCache();
});
it('allows a viewer to open pinned Core without exposing draft settings or deletion', async () => {
    render(
        <MemoryRouter
            initialEntries={['/projects/project/design-systems/system/settings?section=core&versionId=published']}
        >
            <Routes>
                <Route
                    path="/projects/:projectId/design-systems/:designSystemId/settings"
                    element={<DesignSystemSettingsPage />}
                />
            </Routes>
        </MemoryRouter>,
    );
    expect(await screen.findByText('Закреплённый Core: published')).toBeInTheDocument();
    expect(screen.queryByText('Нет доступа')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Удалить полностью' })).not.toBeInTheDocument();
});
