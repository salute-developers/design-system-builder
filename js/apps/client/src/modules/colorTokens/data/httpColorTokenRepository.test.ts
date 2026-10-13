import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { http } from '../../../api/http';
import { ColorTokenOperationError } from '../application/colorTokenRepository';
import { createHttpColorTokenRepository } from './httpColorTokenRepository';

const context = { projectId: 'p1', designSystemId: 'ds', tenantId: 't1' };

const axiosError = (status: number, data: unknown) =>
    new AxiosError('fail', 'ERR', undefined, undefined, {
        status,
        data,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
    });

describe('HTTP-адаптер операций цветового токена', () => {
    afterEach(() => vi.restoreAllMocks());
    const repository = createHttpColorTokenRepository();

    it('отправляет операции на маршруты ds-service с ревизией темы', async () => {
        const post = vi.spyOn(http, 'post').mockResolvedValue({ data: { editRevision: 2, value: { members: [] } } });
        const put = vi.spyOn(http, 'put').mockResolvedValue({ data: { editRevision: 3 } });
        const del = vi.spyOn(http, 'delete').mockResolvedValue({ data: { editRevision: 4 } });
        const input = { type: 'color' as const, group: 'text', name: 'x', members: [] };
        await repository.create(context, input, 1);
        await repository.updateValues(context, 'tok', { members: [] }, 2);
        await repository.delete(context, 'tok', 3);
        expect(post).toHaveBeenCalledWith('/api/projects/p1/ds/tenants/t1/color-tokens', { ...input, editRevision: 1 });
        expect(put).toHaveBeenCalledWith('/api/projects/p1/ds/tenants/t1/color-tokens/tok/values', {
            members: [],
            editRevision: 2,
        });
        expect(del).toHaveBeenCalledWith('/api/projects/p1/ds/tenants/t1/color-tokens/tok', {
            data: { editRevision: 3 },
        });
    });

    it('разбирает конфликт, недопустимое значение и недоступность сервиса', async () => {
        const put = vi.spyOn(http, 'put');
        put.mockRejectedValueOnce(
            axiosError(409, { error: 'TENANT_EDIT_CONFLICT', code: 'TENANT_EDIT_CONFLICT', editRevision: 9 }),
        );
        await expect(repository.updateValues(context, 'tok', { members: [] }, 1)).rejects.toMatchObject({
            kind: 'conflict',
            editRevision: 9,
        });
        put.mockRejectedValueOnce(
            axiosError(400, {
                error: 'INVALID_TOKEN_VALUE',
                code: 'INVALID_TOKEN_VALUE',
                message: 'Ступени нет в палитре темы',
                details: { address: 'tok:web:dark' },
            }),
        );
        await expect(repository.updateValues(context, 'tok', { members: [] }, 1)).rejects.toMatchObject({
            kind: 'invalid',
            code: 'INVALID_TOKEN_VALUE',
            message: 'Ступени нет в палитре темы',
            address: 'tok:web:dark',
        });
        put.mockRejectedValueOnce(new Error('offline'));
        const error = await repository.updateValues(context, 'tok', { members: [] }, 1).catch((e) => e);
        expect(error).toBeInstanceOf(ColorTokenOperationError);
        expect(error.kind).toBe('network');
    });
});
