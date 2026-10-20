import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { http } from '../../../api/http';
import { SizeTokenOperationError } from '../application/sizeTokenRepository';
import { createHttpSizeTokenRepository } from './httpSizeTokenRepository';

const context = { projectId: 'p1', designSystemId: 'ds', tenantId: 't1' };
const base = '/api/projects/p1/ds/tenants/t1/size-tokens';

const axiosError = (status: number, data: unknown) =>
    new AxiosError('fail', 'ERR', undefined, undefined, {
        status,
        data,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
    });

const layer = { offsetX: 0, offsetY: 4, blur: 14, spread: -4, color: '#08080814' };

describe('HTTP-адаптер токенов размеров', () => {
    afterEach(() => vi.restoreAllMocks());
    const repository = createHttpSizeTokenRepository();

    it('читает раздел и приводит токены к модели экрана', async () => {
        vi.spyOn(http, 'get').mockResolvedValue({
            data: {
                editRevision: 5,
                canEdit: true,
                radii: [
                    {
                        tokenId: 'r1',
                        name: 'round.l',
                        valuePx: 16,
                        fullRounding: false,
                        platforms: { android: 18 },
                        native: { ios: 16, android: 18 },
                        platformsDiffer: false,
                        components: [{ name: 'Button', count: 2 }],
                        derived: [{ offsetPx: -2, valuePx: 14, usages: [] }],
                    },
                ],
                spacing: [
                    { tokenId: 's1', name: 'spacing.4x', valuePx: 8, platforms: {}, native: { ios: 8, android: 8 } },
                ],
                shadows: [{ tokenId: 'h1', name: 'down.soft.s', layers: [layer], fallbackElevation: 2 }],
            },
        });
        const result = await repository.load(context);
        expect(http.get).toHaveBeenCalledWith(base);
        expect(result.editRevision).toBe(5);
        expect(result.tokens.map((token) => [token.kind, token.name])).toEqual([
            ['radius', 'round.l'],
            ['spacing', 'spacing.4x'],
            ['shadow', 'down.soft.s'],
        ]);
        expect(result.tokens[1]).toMatchObject({ fullRounding: false, derived: [], components: [] });
        expect(result.tokens[2]).toMatchObject({ platforms: {}, native: { ios: null, android: null } });
    });

    it('отправляет изменение, создание и удаление с ревизией темы', async () => {
        const put = vi.spyOn(http, 'put').mockResolvedValue({
            data: {
                editRevision: 6,
                token: { tokenId: 'r1', name: 'round.l', valuePx: 16, fullRounding: false, platforms: { android: 18 } },
                values: [{ platform: 'web', value: ['1rem'], overridden: false }],
            },
        });
        const post = vi.spyOn(http, 'post').mockResolvedValue({
            data: { editRevision: 7, kind: 'radius', created: [{ tokenId: 'n', name: 'round.xxxl', valuePx: 40 }] },
        });
        const del = vi.spyOn(http, 'delete').mockResolvedValue({ data: { editRevision: 8, deletedTokenIds: ['n'] } });

        const updated = await repository.updateValue(
            context,
            'r1',
            { kind: 'dimension', valuePx: 16, platforms: { android: 18 } },
            5,
        );
        expect(put).toHaveBeenCalledWith(`${base}/r1/value`, {
            editRevision: 5,
            valuePx: 16,
            platforms: { android: 18 },
        });
        expect(updated.token).toMatchObject({ kind: 'radius', platforms: { android: 18 } });
        expect(updated.values).toHaveLength(1);

        await repository.updateValue(context, 'r1', { kind: 'dimension', valuePx: 20, platforms: {} }, 6);
        expect(put).toHaveBeenLastCalledWith(`${base}/r1/value`, { editRevision: 6, valuePx: 20 });

        put.mockResolvedValueOnce({
            data: { editRevision: 7, token: { tokenId: 'h1', name: 'down.hard.m', layers: [layer] } },
        });
        await repository.updateValue(
            context,
            'h1',
            { kind: 'shadow', layers: [layer], fallbackElevation: 4, platforms: { ios: [layer] } },
            6,
        );
        expect(put).toHaveBeenLastCalledWith(`${base}/h1/value`, {
            editRevision: 6,
            layers: [layer],
            fallbackElevation: 4,
            platforms: { ios: { layers: [layer] } },
        });

        const created = await repository.create(context, { kind: 'radius', name: 'xxxl', valuePx: 40 }, 6);
        expect(post).toHaveBeenCalledWith(base, { editRevision: 6, kind: 'radius', name: 'xxxl', valuePx: 40 });
        expect(created.created[0]).toMatchObject({ kind: 'radius', name: 'round.xxxl' });

        expect(await repository.delete(context, 'n', 7)).toEqual({ editRevision: 8, deletedTokenIds: ['n'] });
        expect(del).toHaveBeenCalledWith(`${base}/n`, { data: { editRevision: 7 } });
    });

    it('разбирает конфликт, ошибку значения с полем и недоступность сервиса', async () => {
        const put = vi.spyOn(http, 'put');
        const value = { kind: 'dimension' as const, valuePx: 1200, platforms: {} };
        put.mockRejectedValueOnce(
            axiosError(409, { error: 'TENANT_EDIT_CONFLICT', code: 'TENANT_EDIT_CONFLICT', editRevision: 9 }),
        );
        await expect(repository.updateValue(context, 'r1', value, 1)).rejects.toMatchObject({
            kind: 'conflict',
            editRevision: 9,
        });
        put.mockRejectedValueOnce(
            axiosError(400, {
                error: 'INVALID_SIZE_VALUE',
                code: 'INVALID_SIZE_VALUE',
                message: 'Значение должно быть в диапазоне 0–1000 px.',
                details: { field: 'valuePx' },
            }),
        );
        await expect(repository.updateValue(context, 'r1', value, 1)).rejects.toMatchObject({
            kind: 'invalid',
            code: 'INVALID_SIZE_VALUE',
            field: 'valuePx',
            message: 'Значение должно быть в диапазоне 0–1000 px.',
        });
        put.mockRejectedValueOnce(
            axiosError(400, {
                code: 'INVALID_SIZE_VALUE',
                message: 'Цвет должен быть в формате Hex.',
                field: 'layers[0].color',
            }),
        );
        await expect(repository.updateValue(context, 'r1', value, 1)).rejects.toMatchObject({
            field: 'layers[0].color',
        });
        put.mockRejectedValueOnce(new Error('offline'));
        const error = await repository.updateValue(context, 'r1', value, 1).catch((e) => e);
        expect(error).toBeInstanceOf(SizeTokenOperationError);
        expect(error.kind).toBe('network');
    });
});
