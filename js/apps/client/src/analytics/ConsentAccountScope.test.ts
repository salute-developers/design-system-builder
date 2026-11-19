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
