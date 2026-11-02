import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../api/editorReads', () => ({ invalidateEditorReads: vi.fn(), readEditor: vi.fn() }));
import { readEditor } from '../../../api/editorReads';
import { getDraftSaveTokenValues } from '../../../api/draftAutosaveActivity';

import { observeTokenValueRevisions, tokenValueBaseRevision } from '../../../api/subjectRevisions';
import { createHttpColorTokenRepository } from './httpColorTokenRepository';
import { http } from '../../../api/http';
import { ColorTokenOperationError } from '../application/colorTokenRepository';

afterEach(() => vi.restoreAllMocks());

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
    const repository = createHttpColorTokenRepository();
    it('отправляет операции на маршруты ds-service с предметными заголовками', async () => {
        const post = vi.spyOn(http, 'post').mockResolvedValue({ data: { editRevision: 2, value: { members: [] } } });
        const put = vi.spyOn(http, 'put').mockResolvedValue({ data: { editRevision: 3 } });
        const del = vi.spyOn(http, 'delete').mockResolvedValue({ data: { editRevision: 4 } });
        const input = { type: 'color' as const, group: 'text', name: 'x', members: [] };
        await repository.create(context, input, 1);
        await repository.updateValues(context, 'tok', { members: [] }, 2);
        await repository.delete(context, 'tok', 3);
        const headers = { 'X-DS-Base-Revision': '0', 'Idempotency-Key': expect.any(String) };
        expect(post).toHaveBeenCalledWith(
            '/api/projects/p1/ds/tenants/t1/color-tokens',
            { ...input, editRevision: 1 },
            { headers },
        );
        expect(put).toHaveBeenCalledWith(
            '/api/projects/p1/ds/tenants/t1/color-tokens/tok/values',
            { members: [], editRevision: 2 },
            { headers },
        );
        expect(del).toHaveBeenCalledWith('/api/projects/p1/ds/tenants/t1/color-tokens/tok', {
            data: { editRevision: 3 },
            headers,
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

describe('редакции отдельных платформ цветового токена', () => {
    it('отправляет свою редакцию и принимает подтверждение, не затрагивая соседнюю платформу', async () => {
        const put = vi.spyOn(http, 'put');
        const context = { projectId: 'color-http', designSystemId: 's', tenantId: 't' };
        observeTokenValueRevisions(context, {
            tokenValueEntityIdsByKey: { 'token:web:light': 'web-value', 'token:ios:light': 'ios-value' },
            tokenValueRevisionsByKey: { 'token:web:light': 3, 'token:ios:light': 7 },
        });
        put.mockResolvedValue({
            data: { editRevision: 0 },
            headers: {
                'x-ds-mutation-metadata': JSON.stringify([
                    { entityType: 'token-value', entityId: 'web-value', revision: 4 },
                ]),
            },
        });
        const repository = createHttpColorTokenRepository();
        const update = {
            members: [
                {
                    tokenId: 'token',
                    values: [{ platform: 'web' as const, mode: 'light' as const, value: ['#123456'] }],
                },
            ],
        };
        await repository.updateValues(context, 'token', update, 0);
        expect(put.mock.calls[0][1].members[0].values).toEqual([
            { platform: 'web', mode: 'light', value: ['#123456'], baseRevision: 3 },
        ]);
        await repository.updateValues(context, 'token', update, 0);
        expect(put.mock.calls[1][1].members[0].values[0].baseRevision).toBe(4);
        await repository.updateValues(
            context,
            'token',
            { members: [{ tokenId: 'token', values: [{ platform: 'ios', mode: 'light', value: ['#654321'] }] }] },
            0,
        );
        expect(put.mock.calls[2][1].members[0].values[0].baseRevision).toBe(7);
    });
});

it('сверяет только записанные значения, без чтения других токенов и палитры', async () => {
    const put = vi.spyOn(http, 'put').mockResolvedValue({
        data: { editRevision: 2, type: 'color' },
        headers: {
            'x-ds-mutation-metadata': JSON.stringify([{ entityType: 'token-value', entityId: 'value-1', revision: 2 }]),
        },
    });
    vi.mocked(readEditor)
        .mockReset()
        .mockResolvedValue({
            data: [
                {
                    id: 'value-1',
                    tokenId: 'tok',
                    tenantId: 't1',
                    platform: 'web',
                    mode: 'light',
                    paletteId: null,
                    value: '#123456',
                },
            ],
        } as never);
    const result = await createHttpColorTokenRepository().updateValues(
        context,
        'tok',
        { members: [{ tokenId: 'tok', values: [] }] },
        1,
    );
    expect(put).toHaveBeenCalledOnce();
    expect(readEditor).toHaveBeenCalledExactlyOnceWith('/api/projects/p1/ds/tokens/tok/values', {
        params: { tenantId: 't1' },
    });
    expect(result.editRevision).toBe(2);
    expect(getDraftSaveTokenValues(context)).toMatchObject([{ tokenId: 'tok', values: [{ value: '#123456' }] }]);
});

it('отказ адресной сверки не повторяет подтверждённый PUT', async () => {
    const put = vi.spyOn(http, 'put').mockResolvedValue({
        data: { editRevision: 2, type: 'color' },
        headers: {
            'x-ds-mutation-metadata': JSON.stringify([{ entityType: 'token-value', entityId: 'value-1', revision: 2 }]),
        },
    });
    vi.mocked(readEditor).mockReset().mockRejectedValue(new Error('read unavailable'));
    await expect(
        createHttpColorTokenRepository().updateValues(context, 'tok', { members: [{ tokenId: 'tok', values: [] }] }, 1),
    ).resolves.toMatchObject({ editRevision: 2 });
    expect(put).toHaveBeenCalledOnce();
    expect(getDraftSaveTokenValues(context)).toBeUndefined();
});

it('полный JSON ACK градиента заменяет truncated metadata без чтения раздела', async () => {
    const values = [
        {
            id: 'value-ack',
            tokenId: 'tok',
            tenantId: 't1',
            platform: 'web',
            mode: 'light',
            value: ['linear-gradient(91deg, #000, #fff)'],
            editRevision: 27,
            overridden: false,
        },
    ];
    vi.spyOn(http, 'put').mockResolvedValue({
        data: { editRevision: 0, type: 'gradient', confirmedValues: values },
        headers: { 'x-ds-mutation-metadata-truncated': 'true' },
    });
    vi.mocked(readEditor).mockReset();
    await createHttpColorTokenRepository().updateValues(
        context,
        'tok',
        { members: [{ tokenId: 'tok', values: [] }] },
        0,
    );
    expect(readEditor).not.toHaveBeenCalled();
    expect(getDraftSaveTokenValues(context)).toMatchObject([
        { tokenId: 'tok', type: 'gradient', values: [{ value: values[0].value }] },
    ]);
    expect(tokenValueBaseRevision(context, 'tok', 'web', 'light')).toBe(27);
});
