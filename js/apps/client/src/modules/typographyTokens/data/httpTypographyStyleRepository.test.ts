import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { http } from '../../../api/http';
import { createHttpTypographyStyleRepository } from './httpTypographyStyleRepository';

const context = { projectId: 'p1', designSystemId: 'ds', tenantId: 't1' };

const axiosError = (status: number, data: unknown) =>
    new AxiosError('fail', 'ERR', undefined, undefined, {
        status,
        data,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
    });

describe('HTTP-адаптер стилей типографии', () => {
    afterEach(() => vi.restoreAllMocks());
    const repository = createHttpTypographyStyleRepository();

    it('читает и меняет стили на маршрутах ds-service с ревизией темы', async () => {
        const get = vi.spyOn(http, 'get').mockResolvedValue({ data: { editRevision: 1 } });
        const patch = vi.spyOn(http, 'patch').mockResolvedValue({ data: { editRevision: 2 } });
        await repository.load(context);
        await repository.update(context, 'tok/1', { size: 18, weights: { bold: 700 } }, 1);
        expect(get).toHaveBeenCalledWith('/api/projects/p1/ds/tenants/t1/typography-styles');
        expect(patch).toHaveBeenCalledWith('/api/projects/p1/ds/tenants/t1/typography-styles/tok%2F1', {
            size: 18,
            weights: { bold: 700 },
            editRevision: 1,
        });
    });

    it('разбирает конфликт, ошибку значения и недоступность сервиса', async () => {
        const patch = vi.spyOn(http, 'patch');
        patch.mockRejectedValueOnce(axiosError(409, { code: 'TENANT_EDIT_CONFLICT', editRevision: 9 }));
        await expect(repository.update(context, 'tok', { size: 18 }, 1)).rejects.toMatchObject({
            kind: 'conflict',
            editRevision: 9,
        });
        patch.mockRejectedValueOnce(
            axiosError(400, {
                code: 'INVALID_TYPOGRAPHY_VALUE',
                message: 'Размер и межстрочный интервал должны быть положительными числами.',
                details: { field: 'size' },
            }),
        );
        await expect(repository.update(context, 'tok', { size: -5 }, 1)).rejects.toMatchObject({
            kind: 'invalid',
            code: 'INVALID_TYPOGRAPHY_VALUE',
            field: 'size',
            message: 'Размер и межстрочный интервал должны быть положительными числами.',
        });
        patch.mockRejectedValueOnce(new Error('offline'));
        await expect(repository.update(context, 'tok', { size: 18 }, 1)).rejects.toMatchObject({ kind: 'network' });
    });
});
