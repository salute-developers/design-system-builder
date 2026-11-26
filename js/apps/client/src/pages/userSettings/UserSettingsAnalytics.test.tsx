import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const config = vi.hoisted(() => ({ enabled: false, mounts: 0 }));
vi.mock('../../analytics/consent', () => ({
    get analyticsConsentEnabled() {
        return config.enabled;
    },
}));
vi.mock('../../analytics/AnalyticsConsent', () => ({
    AnalyticsConsentSettings: () => {
        useEffect(() => {
            config.mounts += 1;
        }, []);
        return <p>Управление аналитикой</p>;
    },
}));
vi.mock('./PersonalAccessTokensPanel', () => ({ PersonalAccessTokensPanel: () => <p>Управление PAT</p> }));
vi.mock('../../api', () => ({ authService: { getCurrentUser: () => null } }));
vi.mock('../../modules/projects/data/projectsApi', () => ({ projectsApi: { list: async () => [] } }));
import { UserSettingsPage } from './UserSettingsPage';

afterEach(cleanup);
it.each(['/settings', '/settings?section=analytics', '/settings?section=user-general'])(
    'hides analytics and preserves PAT when disabled: %s',
    (url) => {
        config.enabled = false;
        render(
            <MemoryRouter initialEntries={[url]}>
                <UserSettingsPage />
            </MemoryRouter>,
        );
        expect(screen.queryByRole('button', { name: 'Общее', exact: true })).toBeNull();
        expect(screen.getByRole('button', { name: 'Personal Access Token', exact: true })).toHaveAttribute(
            'aria-current',
            'page',
        );
        expect(screen.queryByText('Управление аналитикой')).toBeNull();
        expect(screen.getByText('Управление PAT')).toBeVisible();
        expect(screen.getByText('Всего токенов')).toBeVisible();
    },
);

it('shows analytics management when configured even before permission is granted', () => {
    config.enabled = true;
    render(
        <MemoryRouter initialEntries={['/settings?section=analytics']}>
            <UserSettingsPage />
        </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Общее', exact: true })).toBeVisible();
    expect(screen.getByText('Управление аналитикой')).toBeVisible();
    expect(screen.getByText('Управление PAT')).not.toBeVisible();
});

it('opens General by default when navigating from the profile menu even after PAT was selected', () => {
    config.enabled = true;
    render(
        <MemoryRouter initialEntries={['/settings?section=personal-access-token']}>
            <UserSettingsPage />
        </MemoryRouter>,
    );
    expect(screen.getByText('Управление PAT')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Профиль', exact: true }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Настройки', exact: true }));
    expect(screen.getByRole('button', { name: 'Общее', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Управление аналитикой')).toBeVisible();
});

it('keeps the analytics component mounted when switching sections and resolves unknown sections consistently', () => {
    config.enabled = true;
    config.mounts = 0;
    render(
        <MemoryRouter initialEntries={['/settings?section=unknown']}>
            <UserSettingsPage />
        </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Общее', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Управление аналитикой')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Personal Access Token', exact: true }));
    expect(screen.getByText('Управление аналитикой')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Общее', exact: true }));
    expect(screen.getByText('Управление аналитикой')).toBeVisible();
    expect(config.mounts).toBe(1);
});
