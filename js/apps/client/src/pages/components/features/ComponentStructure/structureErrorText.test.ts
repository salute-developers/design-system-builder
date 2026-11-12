import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { structureErrorText } from './structureErrorText';

const responseError = (status: number, data: unknown) =>
    new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
        status,
        statusText: '',
        data,
        headers: {},
        config: { headers: new AxiosHeaders() },
    });

describe('structureErrorText', () => {
    it('переводит сетевую ошибку axios', () => {
        expect(structureErrorText(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(
            'Нет связи с сервером. Проверьте подключение и повторите',
        );
    });

    it('переводит таймаут', () => {
        expect(structureErrorText(new AxiosError('timeout of 30000ms exceeded', 'ECONNABORTED'))).toBe(
            'Сервер не ответил вовремя. Повторите попытку',
        );
    });

    it('берёт текст известного кода раньше сообщения сервера', () => {
        const error = responseError(409, { code: 'axis_name_taken', message: 'Axis name taken' });
        expect(structureErrorText(error, { axis_name_taken: 'Вариация с таким именем уже есть' })).toBe(
            'Вариация с таким именем уже есть',
        );
    });

    it('показывает русское сообщение сервера', () => {
        expect(structureErrorText(responseError(400, { message: 'Группа «x» уже есть на этом уровне' }))).toBe(
            'Группа «x» уже есть на этом уровне',
        );
    });

    it('не показывает английское сообщение сервера, а переводит статус', () => {
        expect(structureErrorText(responseError(500, { message: 'Internal Server Error' }))).toBe(
            'Ошибка сервера. Повторите позже',
        );
        expect(structureErrorText(responseError(404, { message: 'Appearance not found' }))).toBe(
            'Компонент или его часть не найдены. Обновите страницу',
        );
    });

    it('не показывает английский текст обычной ошибки', () => {
        expect(structureErrorText(new Error('Unexpected token'))).toBe('Операция не выполнена');
        expect(structureErrorText(new Error('Не удалось сохранить изменения перед операцией'))).toBe(
            'Не удалось сохранить изменения перед операцией',
        );
    });
});
