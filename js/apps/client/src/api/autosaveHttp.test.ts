import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { AutosaveRejection, autosaveErrorMessage, isRetryableAutosaveError, isUnknownIconError } from './autosaveHttp';

const failure = (status: number, data: unknown) =>
    new AxiosError('failed', undefined, undefined, undefined, { status, data } as AxiosResponse);

describe('autosaveHttp', () => {
    it('распознаёт отказ unknown_icon и не повторяет его', () => {
        const error = failure(400, { error: 'unknown_icon', code: 'unknown_icon' });
        expect(isUnknownIconError(error)).toBe(true);
        expect(isRetryableAutosaveError(error)).toBe(false);
    });

    it('показывает пользователю текст только явно помеченного отказа', () => {
        const source = failure(422, { error: 'reference_cycle' });
        const rejection = new AutosaveRejection('Ссылка на стиль создаёт цикл', source);
        expect(autosaveErrorMessage(rejection)).toBe('Ссылка на стиль создаёт цикл');
        expect(rejection.source).toBe(source);
        expect(isRetryableAutosaveError(rejection)).toBe(false);
        expect(autosaveErrorMessage(new Error('Не удалось дождаться автосохранения изменений.'))).toBeUndefined();
        expect(autosaveErrorMessage(source)).toBeUndefined();
    });

    it('не принимает другие ошибки за unknown_icon', () => {
        expect(isUnknownIconError(failure(400, { code: 'invalid_body' }))).toBe(false);
        expect(isUnknownIconError(failure(409, { code: 'unknown_icon' }))).toBe(false);
        expect(isUnknownIconError(new Error('x'))).toBe(false);
    });
});
