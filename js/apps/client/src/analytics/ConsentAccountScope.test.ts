import { afterEach, expect, it, vi } from 'vitest';
import { authService } from '../api/authService';
import { getConsentStorageKey } from './consent';

afterEach(() => vi.restoreAllMocks());
it('namespaces account identities separately and has no anonymous fallback', () => {
    const current = vi.spyOn(authService, 'getCurrentUser');
    current.mockReturnValue({ id: 'first', displayName: 'First', initials: 'F' });
    const first = getConsentStorageKey();
    current.mockReturnValue({ id: 'second', displayName: 'Second', initials: 'S' });
    expect(getConsentStorageKey()).not.toBe(first);
    current.mockReturnValue(null);
    expect(getConsentStorageKey()).toBeUndefined();
    current.mockReturnValue({ displayName: 'Missing id', initials: 'M' });
    expect(getConsentStorageKey()).toBeUndefined();
    current.mockReturnValue({ id: 'first', displayName: 'First', initials: 'F' });
    expect(getConsentStorageKey()).toBe(first);
});

it('removes only the legacy key for this environment when the module loads', async () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({ id: 'first', displayName: 'First', initials: 'F' });
    const accountKey = getConsentStorageKey()!;
    const legacyKey = accountKey.slice(0, accountKey.lastIndexOf(':user:'));
    const otherEnvironmentKey = `${legacyKey}:other-environment`;
    localStorage.setItem(legacyKey, 'legacy');
    localStorage.setItem(accountKey, 'account');
    localStorage.setItem(otherEnvironmentKey, 'other');
    vi.resetModules();
    await import('./consent');
    expect(localStorage.getItem(legacyKey)).toBeNull();
    expect(localStorage.getItem(accountKey)).toBe('account');
    expect(localStorage.getItem(otherEnvironmentKey)).toBe('other');
    localStorage.clear();
});

it('still loads when local storage cleanup is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('Storage unavailable', 'SecurityError');
    });
    vi.resetModules();
    await expect(import('./consent')).resolves.toHaveProperty('analyticsConsent');
});
