import { afterEach, describe, expect, it, vi } from 'vitest';
import { loginWithPassword, logoutOnServer, refreshTokens } from './keycloak';
import { authService } from './authService';
import { tokenStore } from './tokenStore';

vi.mock('./keycloak', () => ({
    loginWithPassword: vi.fn(), logoutOnServer: vi.fn(), refreshTokens: vi.fn(),
}));

const encodePayload = (payload: object) => {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const base64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `header.${base64}.signature`;
};

afterEach(async () => {
    await authService.logout();
    vi.resetAllMocks();
});

const tokens = (name: string) => ({ access_token: name, refresh_token: `refresh-${name}`, expires_in: 60 });
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

describe('authService refresh session ownership', () => {
    it.each(['success', 'failure'] as const)('ignores old refresh %s after a new login', async (outcome) => {
        tokenStore.save(tokens('old'));
        const old = deferred<ReturnType<typeof tokens>>();
        vi.mocked(refreshTokens).mockReturnValueOnce(old.promise);
        const pending = authService.refreshAccessToken();
        const rejected = expect(pending).rejects.toThrow();
        vi.mocked(loginWithPassword).mockResolvedValue(tokens('new'));
        await authService.login('new', 'password');
        const reset = vi.fn();
        const unsubscribe = authService.onSessionReset(reset);
        if (outcome === 'success') old.resolve(tokens('stale'));
        else old.reject(new Error('expired'));
        await rejected;
        expect(tokenStore.access).toBe('new');
        expect(tokenStore.refresh).toBe('refresh-new');
        expect(reset).not.toHaveBeenCalled();
        expect(logoutOnServer).not.toHaveBeenCalled();
        unsubscribe();
    });

    it('does not reuse or clear a newer in-flight refresh', async () => {
        tokenStore.save(tokens('old'));
        const old = deferred<ReturnType<typeof tokens>>();
        const current = deferred<ReturnType<typeof tokens>>();
        vi.mocked(refreshTokens).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
        const first = authService.refreshAccessToken();
        const rejected = expect(first).rejects.toThrow();
        vi.mocked(loginWithPassword).mockResolvedValue(tokens('new'));
        await authService.login('new', 'password');
        const second = authService.refreshAccessToken();
        expect(second).not.toBe(first);
        old.reject(new Error('expired'));
        await rejected;
        expect(authService.refreshAccessToken()).toBe(second);
        current.resolve(tokens('fresh'));
        await expect(second).resolves.toBe('fresh');
        expect(tokenStore.access).toBe('fresh');
    });

    it('cannot restore tokens after logout', async () => {
        tokenStore.save(tokens('old'));
        const old = deferred<ReturnType<typeof tokens>>();
        vi.mocked(refreshTokens).mockReturnValueOnce(old.promise);
        const pending = authService.refreshAccessToken();
        const rejected = expect(pending).rejects.toThrow();
        await authService.logout();
        old.resolve(tokens('stale'));
        await rejected;
        expect(authService.isAuthenticated()).toBe(false);
    });

    it('clears the current failed session and coalesces its refresh', async () => {
        tokenStore.save(tokens('old'));
        const old = deferred<ReturnType<typeof tokens>>();
        vi.mocked(refreshTokens).mockReturnValueOnce(old.promise);
        const pending = authService.refreshAccessToken();
        expect(authService.refreshAccessToken()).toBe(pending);
        const rejected = expect(pending).rejects.toThrow('expired');
        old.reject(new Error('expired'));
        await rejected;
        expect(authService.isAuthenticated()).toBe(false);
    });
});

describe('authService current user', () => {
    it('reads the current Keycloak identity from access-token claims', () => {
        tokenStore.save({
            access_token: encodePayload({
                sub: 'user-1',
                name: 'Алексей Иванов',
                preferred_username: 'alex',
                email: 'alex@example.com',
            }),
            refresh_token: 'refresh',
            expires_in: 60,
        });

        expect(authService.getCurrentUser()).toEqual({
            id: 'user-1',
            username: 'alex',
            email: 'alex@example.com',
            displayName: 'Алексей Иванов',
            initials: 'АИ',
        });
    });

    it('does not invent profile data for a malformed token', () => {
        tokenStore.save({ access_token: 'not-a-jwt', refresh_token: 'refresh', expires_in: 60 });
        expect(authService.getCurrentUser()).toBeNull();
    });
});
