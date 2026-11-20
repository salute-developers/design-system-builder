import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { isRetryableAutosaveError, isUnknownIconError } from './autosaveHttp';

const failure = (status: number, data: unknown) =>
    new AxiosError('failed', undefined, undefined, undefined, { status, data } as AxiosResponse);

describe('autosaveHttp', () => {
    it('распознаёт отказ unknown_icon и не повторяет его', () => {
        const error = failure(400, { error: 'unknown_icon', code: 'unknown_icon' });
        expect(isUnknownIconError(error)).toBe(true);
        expect(isRetryableAutosaveError(error)).toBe(false);
    });

    it('не принимает другие ошибки за unknown_icon', () => {
        expect(isUnknownIconError(failure(400, { code: 'invalid_body' }))).toBe(false);
        expect(isUnknownIconError(failure(409, { code: 'unknown_icon' }))).toBe(false);
        expect(isUnknownIconError(new Error('x'))).toBe(false);
    });
});
