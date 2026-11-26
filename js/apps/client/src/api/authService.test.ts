import { afterEach, describe, expect, it, vi } from 'vitest';
import { loginWithPassword, logoutOnServer, refreshTokens } from './keycloak';
import { authService } from './authService';
import { tokenStore } from './tokenStore';

vi.mock('./keycloak', () => ({
    loginWithPassword: vi.fn(),
    logoutOnServer: vi.fn(),
    refreshTokens: vi.fn(),
}));

const encodePayload = (payload: object) => {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const base64 = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    return `header.${base64}.signature`;
};

afterEach(async () => {
    await authService.logout();
    vi.resetAllMocks();
});

const tokens = (name: string) => ({ access_token: name, refresh_token: `refresh-${name}`, expires_in: 60 });
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
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

it('cancels an old queue on a different stored user even before the storage event', () => {
    tokenStore.save({ ...tokens('old'), access_token: encodePayload({ iss: 'realm', sub: 'old', sid: 'old-login' }) });
    const signal = authService.getSessionSignal();
    tokenStore.save({ ...tokens('new'), access_token: encodePayload({ iss: 'realm', sub: 'new', sid: 'new-login' }) });
    expect(() => authService.assertSession(signal)).toThrow();
    expect(signal.aborted).toBe(true);
    expect(authService.getUserKey()).toBe(JSON.stringify(['realm', 'new']));
});

it('keeps the queue alive through a token rotation for the same user and login', () => {
    const identity = { iss: 'realm', sub: 'own', sid: 'login' };
    tokenStore.save({ ...tokens('old'), access_token: encodePayload({ ...identity, iat: 1 }) });
    const signal = authService.getSessionSignal();
    tokenStore.save({ ...tokens('fresh'), access_token: encodePayload({ ...identity, iat: 2 }) });
    window.dispatchEvent(new StorageEvent('storage', { key: 'auth.access_token' }));
    expect(authService.getSessionSignal()).toBe(signal);
    expect(signal.aborted).toBe(false);
});

it('reads the original token format without writing or migrating on startup', async () => {
    tokenStore.save(tokens('existing'));
    const nativeSet = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(await authService.getValidAccessToken()).toBe('existing');
    expect(nativeSet).not.toHaveBeenCalled();
    nativeSet.mockRestore();
    expect(localStorage.getItem('auth.access_token')).toBe('existing');
    expect(localStorage.getItem('auth.refresh_token')).toBe('refresh-existing');
    expect(localStorage.getItem('auth.session')).toBeNull();
});

it('cancels the original queue when another user logs in just after refresh writes', async () => {
    const oldIdentity = { iss: 'realm', sub: 'old', sid: 'old-login' };
    tokenStore.save({ ...tokens('old'), access_token: encodePayload(oldIdentity) });
    const original = authService.getSessionSignal();
    vi.mocked(refreshTokens).mockResolvedValueOnce({
        ...tokens('refreshed'),
        access_token: encodePayload({ ...oldIdentity, iat: 2 }),
    });
    const nativeSet = localStorage.setItem.bind(localStorage);
    let switched = false;
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation((key, bytes) => {
        nativeSet(key, bytes);
        if (key === 'auth.expires_at' && !switched) {
            switched = true;
            tokenStore.save({
                ...tokens('new'),
                access_token: encodePayload({ iss: 'realm', sub: 'new', sid: 'new-login' }),
            });
        }
    });
    try {
        await expect(authService.refreshAccessToken()).rejects.toThrow('Session changed');
        expect(original.aborted).toBe(true);
        expect(() => authService.assertSession(original)).toThrow();
        expect(authService.getUserKey()).toBe(JSON.stringify(['realm', 'new']));
    } finally {
        write.mockRestore();
    }
});

it('cancels an old queue if a mixed token pair refreshes as another known user', async () => {
    tokenStore.save({
        ...tokens('mixed'),
        access_token: encodePayload({ iss: 'realm', sub: 'A', sid: 'A' }),
        refresh_token: 'refresh-B',
    });
    const old = authService.getSessionSignal();
    vi.mocked(refreshTokens).mockResolvedValueOnce({
        ...tokens('B'),
        access_token: encodePayload({ iss: 'realm', sub: 'B', sid: 'B' }),
    });
    await expect(authService.refreshAccessToken()).rejects.toThrow('Session changed');
    expect(refreshTokens).toHaveBeenCalledWith('refresh-B');
    expect(old.aborted).toBe(true);
    expect(() => authService.assertSession(old)).toThrow();
    expect(authService.getUserKey()).toBe(JSON.stringify(['realm', 'B']));
});
