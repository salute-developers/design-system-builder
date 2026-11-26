import { afterEach, expect, it, vi } from 'vitest';
import { archiveCoreSave, readComponentRecovery, readPendingComponentMutation } from './componentRecovery';

const key = 'ds_pending_component:p:ds:t:Button:request';
const operation = (value = 'old', generation = 'a') => ({
    generation,
    coreSelectionRevision: 1,
    after: { value },
    idempotencyKeys: { create: value },
});
afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

it('retains the old user values for manual recovery and stops replaying the copied request', () => {
    const old = operation();
    localStorage.setItem(key, JSON.stringify(old));
    archiveCoreSave(key, old);
    expect(readPendingComponentMutation(key)).toBeNull();
    expect(JSON.parse(readComponentRecovery(key)!).after).toEqual(old.after);
    expect(localStorage.getItem(key)).toBe(JSON.stringify(old));
});

it('does not hide a newer preparation arriving while the old one is copied', () => {
    const old = operation();
    const newer = operation('new');
    localStorage.setItem(key, JSON.stringify(old));
    const nativeSet = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((slot, bytes) => {
        if (slot === key + ':recovery') nativeSet(key, JSON.stringify(newer));
        nativeSet(slot, bytes);
    });
    archiveCoreSave(key, old);
    expect(JSON.parse(readPendingComponentMutation(key)!).after).toEqual(newer.after);
    expect(readComponentRecovery(key)).toContain('old');
});

it('keeps the request pending if its recovery copy cannot be stored', () => {
    const old = operation();
    localStorage.setItem(key, JSON.stringify(old));
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => archiveCoreSave(key, old)).toThrow();
    expect(JSON.parse(readPendingComponentMutation(key)!)).toEqual(old);
});

it('can still show the saved copy if the optional last-copy pointer cannot be written', () => {
    const old = operation();
    localStorage.setItem(key, JSON.stringify(old));
    const nativeSet = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((slot, bytes) => {
        if (slot === key + ':recovery') throw new DOMException('quota', 'QuotaExceededError');
        nativeSet(slot, bytes);
    });
    archiveCoreSave(key, old);
    expect(readPendingComponentMutation(key)).toBeNull();
    expect(JSON.parse(readComponentRecovery(key)!).after).toEqual(old.after);
});

it('does not discard an independent edit in another tab', () => {
    const other = operation('other', 'b');
    localStorage.setItem(key, JSON.stringify(other));
    expect(() => archiveCoreSave(key, operation())).toThrow('другой вкладке');
    expect(JSON.parse(readPendingComponentMutation(key)!)).toEqual(other);
});

it('does not lose a valid pending edit when an older recovery copy is corrupt', () => {
    const current = operation();
    localStorage.setItem(key, JSON.stringify(current));
    localStorage.setItem(key + ':recovery:broken', '{');
    expect(JSON.parse(readPendingComponentMutation(key)!)).toEqual(current);
    expect(readComponentRecovery(key)).toBeNull();
});
