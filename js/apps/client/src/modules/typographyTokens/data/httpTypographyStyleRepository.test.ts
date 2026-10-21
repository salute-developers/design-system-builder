import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { http } from '../../../api/http';
import { observeTokenValueRevisions } from '../../../api/subjectRevisions';
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

    it('читает стили на выбранной версии и меняет их с базовыми редакциями значений', async () => {
        const get = vi.spyOn(http, 'get').mockResolvedValue({ data: { canEdit: false } });
        const patch = vi.spyOn(http, 'patch').mockResolvedValue({
            data: { style: {}, tokens: [] },
            headers: { 'x-ds-mutation-metadata': '[{"entityType":"token-value","entityId":"v-web","revision":5}]' },
        });
        await repository.load({ ...context, versionId: 'v1' });
        expect(get).toHaveBeenCalledWith('/api/projects/p1/ds/tenants/t1/typography-styles', {
            signal: undefined,
            params: { versionId: 'v1' },
        });
        observeTokenValueRevisions(context, {
            tokenValueRevisionsByKey: { 'tok/1:web:': 4 },
            tokenValueEntityIdsByKey: { 'tok/1:web:': 'v-web' },
        });
        const addresses = [
            { tokenId: 'tok/1', platform: 'web' as const },
            { tokenId: 'tok/2', platform: 'ios' as const },
        ];
        await repository.update(context, 'tok/1', { size: 18, weights: { bold: 700 } }, addresses);
        expect(patch).toHaveBeenCalledWith('/api/projects/p1/ds/tenants/t1/typography-styles/tok%2F1', {
            size: 18,
            weights: { bold: 700 },
            baseRevisions: [
                { tokenId: 'tok/1', platform: 'web', baseRevision: 4 },
                { tokenId: 'tok/2', platform: 'ios', baseRevision: 0 },
            ],
        });
        // Метаданные подтверждённой операции становятся базовой редакцией следующей.
        await repository.update(context, 'tok/1', { size: 19 }, addresses.slice(0, 1));
        expect(patch.mock.calls[1][1]).toMatchObject({
            baseRevisions: [{ tokenId: 'tok/1', platform: 'web', baseRevision: 5 }],
        });
    });

    it('не отправляет изменения опубликованной версии', async () => {
        const patch = vi.spyOn(http, 'patch');
        await expect(repository.update({ ...context, versionId: 'v1' }, 'tok', { size: 18 }, [])).rejects.toThrow();
        expect(patch).not.toHaveBeenCalled();
    });

    it('разбирает ошибку значения, отказ прав и недоступность сервиса', async () => {
        const patch = vi.spyOn(http, 'patch');
        patch.mockRejectedValueOnce(
            axiosError(400, {
                code: 'INVALID_TYPOGRAPHY_VALUE',
                message: 'Размер и межстрочный интервал должны быть положительными числами.',
                details: { field: 'size' },
            }),
        );
        await expect(repository.update(context, 'tok', { size: -5 }, [])).rejects.toMatchObject({
            kind: 'invalid',
            code: 'INVALID_TYPOGRAPHY_VALUE',
            field: 'size',
            message: 'Размер и межстрочный интервал должны быть положительными числами.',
        });
        patch.mockRejectedValueOnce(axiosError(403, { error: 'Forbidden' }));
        await expect(repository.update(context, 'tok', { size: 18 }, [])).rejects.toMatchObject({ kind: 'forbidden' });
        patch.mockRejectedValueOnce(axiosError(503, {}));
        await expect(repository.update(context, 'tok', { size: 18 }, [])).rejects.toMatchObject({
            kind: 'network',
            retryable: true,
        });
        patch.mockRejectedValueOnce(
            axiosError(409, {
                code: 'TYPOGRAPHY_VALUES_MISSING',
                message: 'В теме нет значений стиля: screen-l.body.m.normal',
            }),
        );
        await expect(repository.update(context, 'tok', { size: 18 }, [])).rejects.toMatchObject({
            kind: 'missing-values',
            retryable: false,
            message: 'В теме нет значений стиля: screen-l.body.m.normal',
        });
        patch.mockRejectedValueOnce(new Error('offline'));
        await expect(repository.update(context, 'tok', { size: 18 }, [])).rejects.toMatchObject({ kind: 'network' });
    });
});
