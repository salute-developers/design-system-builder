import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { authService } from '../../api';
import { userSettingsApi } from '../../modules/userSettings/data/userSettingsApi';
import { resetQueryCache } from '../../shared/data/useLoad';
import { PersonalAccessTokensPanel } from './PersonalAccessTokensPanel';

const token = { id: 'expired', name: 'Old CI', scopes: ['projects:read'], createdAt: '',
    expiresAt: '2020-01-01T00:00:00Z', revokedAt: null, lastUsedAt: null };
afterEach(() => { cleanup(); vi.restoreAllMocks(); resetQueryCache(); });

it('shows expired tokens without including them in the active count', async () => {
    vi.spyOn(userSettingsApi, 'tokens').mockResolvedValue([token]);
    vi.spyOn(userSettingsApi, 'scopes').mockResolvedValue({ scopes: [{ id: 'projects:read', title: 'Проекты', description: 'Чтение' }] });
    const count = vi.fn();
    render(<PersonalAccessTokensPanel userId="expired-owner" onActiveCount={count} />);
    expect(await screen.findByText('Old CI')).toBeInTheDocument();
    expect(screen.getByText('Истёк')).toBeInTheDocument();
    expect(count).toHaveBeenLastCalledWith(0);
});

it('discards a creation response received after the session was reset', async () => {
    vi.spyOn(userSettingsApi, 'tokens').mockResolvedValue([]);
    vi.spyOn(userSettingsApi, 'scopes').mockResolvedValue({ scopes: [{ id: 'projects:read', title: 'Проекты', description: 'Чтение' }] });
    let finish!: (value: { token: typeof token; secret: string }) => void;
    const create = vi.spyOn(userSettingsApi, 'create').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<PersonalAccessTokensPanel userId="pending-owner" onActiveCount={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Создать ключ' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Создать ключ' }));
    fireEvent.change(screen.getByPlaceholderText('Например, CI production'), { target: { value: 'CI' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Создать ключ' }).at(-1)!);
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    await act(async () => { await authService.logout(); finish({ token, secret: 'dsb_pat_late_response' }); });
    expect(screen.queryByText('dsb_pat_late_response')).not.toBeInTheDocument();
});
