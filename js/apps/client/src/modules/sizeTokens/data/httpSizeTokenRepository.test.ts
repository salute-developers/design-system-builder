import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { http } from '../../../api/http';
import { observeTokenValueRevisions } from '../../../api/subjectRevisions';
import { createHttpSizeTokenRepository } from './httpSizeTokenRepository';

const context = { projectId: 'p1', designSystemId: 'ds', tenantId: 't1' };
const base = '/api/projects/p1/ds/tenants/t1/size-tokens';

const axiosError = (status: number | null, data: unknown = {}) =>
    new AxiosError(
        'fail',
        'ERR',
        undefined,
        undefined,
        status === null
            ? undefined
            : { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } },
    );

const layer = { offsetX: 0, offsetY: 4, blur: 14, spread: -4, color: '#08080814' };
const metadata = (items: Array<{ entityId: string; revision: number }>) => ({
    'x-ds-mutation-metadata': JSON.stringify(
        items.map((item) => ({ entityType: 'token-value', warnings: [], ...item })),
    ),
});

describe('HTTP-адаптер токенов размеров', () => {
    afterEach(() => vi.restoreAllMocks());
    const repository = createHttpSizeTokenRepository();

    it('читает раздел на выбранной границе и приводит токены к модели экрана', async () => {
        const get = vi.spyOn(http, 'get').mockResolvedValue({
            data: {
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
                shadows: [
                    {
                        tokenId: 'h1',
                        name: 'down.soft.s',
                        layers: [layer, { ...layer, color: '#1A1A1A29', colorRef: '[general.gray.900][0.16]' }],
                        fallbackElevation: 2,
                    },
                ],
            },
        });
        const result = await repository.load(context);
        expect(get).toHaveBeenCalledWith(base, { signal: undefined, params: undefined });
        expect(result).not.toHaveProperty('editRevision');
        expect(result.tokens.map((token) => [token.kind, token.name])).toEqual([
            ['radius', 'round.l'],
            ['spacing', 'spacing.4x'],
            ['shadow', 'down.soft.s'],
        ]);
        expect(result.tokens[1]).toMatchObject({ fullRounding: false, derived: [], components: [] });
        expect(result.tokens[2]).toMatchObject({
            platforms: {},
            native: { ios: null, android: null },
            layers: [layer, { ...layer, color: '#1A1A1A29', colorRef: '[general.gray.900][0.16]' }],
        });

        const published = await repository.load({ ...context, versionId: 'v1' });
        expect(get).toHaveBeenLastCalledWith(base, { signal: undefined, params: { versionId: 'v1' } });
        expect(published.canEdit).toBe(false);
    });

    it('строит команду изменения с platforms и базовыми редакциями и принимает редакции ответа', async () => {
        observeTokenValueRevisions(context, {
            tokenValueRevisionsByKey: { 'r/1:web:': 3, 'r/1:ios:': 3, 'r/1:android:': 2 },
            tokenValueEntityIdsByKey: { 'r/1:web:': 'v-web', 'r/1:ios:': 'v-ios', 'r/1:android:': 'v-android' },
        });
        const command = repository.command(context, {
            type: 'update',
            tokenId: 'r/1',
            value: { kind: 'dimension', valuePx: 20, platforms: { android: 18 } },
        });
        expect(command).toMatchObject({
            operation: 'update',
            method: 'PUT',
            path: `${base}/r%2F1/value`,
            tokenId: 'r/1',
            body: { valuePx: 20, platforms: { android: 18 }, baseRevisions: { web: 3, ios: 3, android: 2 } },
        });
        expect(command).not.toHaveProperty('idempotencyKey');
        const put = vi.spyOn(http, 'put').mockResolvedValue({
            data: {
                kind: 'radius',
                token: { tokenId: 'r/1', name: 'round.l', valuePx: 20, platforms: { android: 18 } },
                values: [{ platform: 'web', value: ['1.25rem'], overridden: false }],
            },
            headers: metadata([
                { entityId: 'v-web', revision: 4 },
                { entityId: 'v-android', revision: 3 },
            ]),
        });
        const result = await repository.send(context, command);
        expect(put).toHaveBeenCalledWith(`${base}/r%2F1/value`, command.body, { headers: undefined });
        expect(result).toMatchObject({
            type: 'update',
            token: { kind: 'radius', valuePx: 20, platforms: { android: 18 } },
            values: [{ platform: 'web', value: ['1.25rem'], overridden: false }],
        });
        // Технические редакции из `X-DS-Mutation-Metadata` — базовые редакции следующей правки.
        const next = repository.command(context, {
            type: 'update',
            tokenId: 'r/1',
            value: { kind: 'dimension', valuePx: 21, platforms: {} },
        });
        expect(next.body).toEqual({ valuePx: 21, platforms: {}, baseRevisions: { web: 4, ios: 3, android: 3 } });
    });

    it('отправляет цвет слоя ссылкой на палитру, если она есть, и свои слои платформ', () => {
        const command = repository.command(context, {
            type: 'update',
            tokenId: 'h1',
            value: {
                kind: 'shadow',
                layers: [{ ...layer, color: '#1A1A1A29', colorRef: '[general.gray.900][0.16]' }],
                fallbackElevation: 4,
                platforms: { ios: [layer] },
            },
        });
        expect(command.body).toEqual({
            layers: [{ ...layer, color: '[general.gray.900][0.16]' }],
            fallbackElevation: 4,
            platforms: { ios: { layers: [layer] } },
            baseRevisions: { web: 0, ios: 0, android: 0 },
        });
    });

    it('создаёт с ключом повторяемости и повторяет создание тем же ключом и телом', async () => {
        const post = vi.spyOn(http, 'post').mockResolvedValue({
            data: { kind: 'shadow', created: [{ tokenId: 'n1', name: 'down.soft.xl', layers: [layer] }] },
            headers: {},
        });
        const command = repository.command(context, {
            type: 'create',
            request: {
                kind: 'shadow',
                name: 'xl',
                variants: [{ variant: 'down.soft', layers: [layer], fallbackElevation: 2 }],
            },
        });
        expect(command).toMatchObject({ operation: 'create', method: 'POST', path: base });
        expect(command.idempotencyKey).toEqual(expect.any(String));
        const first = await repository.send(context, command);
        await repository.send(context, command);
        expect(post.mock.calls[0]).toEqual([
            base,
            command.body,
            { headers: { 'Idempotency-Key': command.idempotencyKey } },
        ]);
        expect(post.mock.calls[1]).toEqual(post.mock.calls[0]);
        expect(first).toMatchObject({ type: 'create', created: [{ kind: 'shadow', name: 'down.soft.xl' }] });
    });

    it('удаляет токен и возвращает удалённые варианты', async () => {
        const remove = vi.spyOn(http, 'delete').mockResolvedValue({
            data: { deletedTokenIds: ['a', 'b', 'c', 'd'] },
            headers: {},
        });
        const command = repository.command(context, { type: 'delete', tokenId: 'a' });
        await expect(repository.send(context, command)).resolves.toEqual({
            type: 'delete',
            deletedTokenIds: ['a', 'b', 'c', 'd'],
        });
        expect(remove).toHaveBeenCalledWith(`${base}/a`, { headers: undefined });
    });

    it('не отправляет изменения опубликованной версии', async () => {
        const put = vi.spyOn(http, 'put');
        const command = repository.command(context, {
            type: 'update',
            tokenId: 'r1',
            value: { kind: 'dimension', valuePx: 20, platforms: {} },
        });
        await expect(repository.send({ ...context, versionId: 'v1' }, command)).rejects.toMatchObject({
            kind: 'failed',
            retryable: false,
        });
        expect(put).not.toHaveBeenCalled();
    });

    it('разбирает ошибки: поле значения, имя, права, сеть и 5xx', async () => {
        const put = vi.spyOn(http, 'put');
        const command = repository.command(context, {
            type: 'update',
            tokenId: 'r1',
            value: { kind: 'dimension', valuePx: 1200, platforms: {} },
        });
        put.mockRejectedValueOnce(
            axiosError(400, {
                error: 'INVALID_SIZE_VALUE',
                code: 'INVALID_SIZE_VALUE',
                message: 'Значение должно быть в диапазоне 0–1000 px.',
                details: { field: 'valuePx' },
            }),
        );
        await expect(repository.send(context, command)).rejects.toMatchObject({
            kind: 'invalid',
            code: 'INVALID_SIZE_VALUE',
            field: 'valuePx',
            message: 'Значение должно быть в диапазоне 0–1000 px.',
            retryable: false,
        });
        put.mockRejectedValueOnce(axiosError(409, { code: 'TOKEN_NAME_CONFLICT', message: 'Имя занято' }));
        await expect(repository.send(context, command)).rejects.toMatchObject({
            kind: 'invalid',
            code: 'TOKEN_NAME_CONFLICT',
        });
        put.mockRejectedValueOnce(axiosError(403, { error: 'Forbidden' }));
        await expect(repository.send(context, command)).rejects.toMatchObject({ kind: 'forbidden' });
        put.mockRejectedValueOnce(axiosError(503, {}));
        await expect(repository.send(context, command)).rejects.toMatchObject({ kind: 'network', retryable: true });
        put.mockRejectedValueOnce(axiosError(null));
        await expect(repository.send(context, command)).rejects.toMatchObject({ kind: 'network', retryable: true });
    });
});
