import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import {
    AutosaveRejection,
    StateRejection,
    autosaveErrorMessage,
    isRetryableAutosaveError,
    isUnknownIconError,
    stateRejection,
    isCoreSelectionStaleError,
} from './autosaveHttp';

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

describe('stateRejection', () => {
    it('explains a state set the property does not support', () => {
        const error = stateRejection(failure(422, { error: 'states_not_supported' }));

        expect(error).toBeInstanceOf(StateRejection);
        expect(error).toBeInstanceOf(AutosaveRejection);
        expect(autosaveErrorMessage(error)).toMatch(/не поддерживает это состояние/);
        expect(autosaveErrorMessage(stateRejection(failure(422, { code: 'state_not_in_component' })))).toMatch(
            /другому компоненту/,
        );
    });

    it('leaves other errors as they are', () => {
        const other = failure(422, { error: 'property_value_empty' });

        expect(stateRejection(other)).toBe(other);
        expect(stateRejection(failure(500, { error: 'states_not_supported' }))).not.toBeInstanceOf(StateRejection);
    });
});

it('recognizes only the Core selection conflict, including wrapped and legacy responses', () => {
    for (const data of [{ code: 'CORE_SELECTION_STALE' }, { error: 'CORE_SELECTION_STALE' }]) {
        const error = failure(409, data);
        expect(isCoreSelectionStaleError(error)).toBe(true);
        expect(isCoreSelectionStaleError(new AutosaveRejection('Core changed', error))).toBe(true);
    }
    expect(isCoreSelectionStaleError(failure(409, { code: 'revision_conflict' }))).toBe(false);
    expect(isCoreSelectionStaleError(failure(500, { code: 'CORE_SELECTION_STALE' }))).toBe(false);
    expect(isCoreSelectionStaleError(new Error('CORE_SELECTION_STALE'))).toBe(false);
});
