import { describe, expect, it, vi } from 'vitest';

import { OAuthError, TransportError } from '../auth/authEndpoints';
import type { Session } from '../auth/session';
import { createHttpClient } from './httpClient';

const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

const session = (refresh = vi.fn().mockResolvedValue('new')) =>
    ({ accessToken: 'old', refresh, expire: vi.fn().mockResolvedValue(undefined) }) as unknown as Session;

describe('запросы к API', () => {
    it('передаёт токен и пропускает пустые параметры', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(200, [1]));

        const data = await createHttpClient(session(), fetcher).get('/api/projects', {
            params: { versionId: 'v1', types: null },
        });

        expect(data).toEqual([1]);
        const [target, init] = fetcher.mock.calls[0];
        expect(String(target)).toMatch(/\/api\/projects\?versionId=v1$/);
        expect(init?.headers).toEqual({ Authorization: 'Bearer old' });
    });

    it('на `401` обновляет токен и повторяет запрос один раз', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(401)).mockResolvedValueOnce(json(200, []));

        await createHttpClient(session(), fetcher).get('/api/projects');

        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(fetcher.mock.calls[1][1]?.headers).toEqual({ Authorization: 'Bearer new' });
    });

    it('на позднем `401` берёт уже обновлённый токен без нового обновления', async () => {
        const refresh = vi.fn();
        const current = { accessToken: 'old', refresh, expire: vi.fn() } as unknown as Session;
        const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(async () => {
            (current as { accessToken: string }).accessToken = 'fresh';
            return json(401);
        });
        fetcher.mockResolvedValueOnce(json(200, []));

        await createHttpClient(current, fetcher).get('/api/projects');

        expect(refresh).not.toHaveBeenCalled();
        expect(fetcher.mock.calls[1][1]?.headers).toEqual({ Authorization: 'Bearer fresh' });
    });

    it('после второго `401` завершает сессию', async () => {
        const current = session();
        const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json(401));

        await expect(createHttpClient(current, fetcher).get('/api/projects')).rejects.toMatchObject({
            kind: 'unauthorized',
        });

        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(current.expire).toHaveBeenCalled();
    });

    it('различает недействительную сессию и недоступный сервер при обновлении', async () => {
        const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json(401));
        const invalid = session(vi.fn().mockRejectedValue(new OAuthError('invalid_grant')));
        const offline = session(vi.fn().mockRejectedValue(new TransportError('offline')));

        await expect(createHttpClient(invalid, fetcher).get('/x')).rejects.toMatchObject({ kind: 'unauthorized' });
        await expect(createHttpClient(offline, fetcher).get('/x')).rejects.toMatchObject({ kind: 'network' });
    });

    it('переводит ответы и сетевой сбой в ошибки экрана', async () => {
        const client = (response: Response) =>
            createHttpClient(session(), vi.fn<typeof fetch>().mockResolvedValue(response));
        const offline = createHttpClient(session(), vi.fn<typeof fetch>().mockRejectedValue(new TypeError('failed')));

        await expect(client(json(403)).get('/x')).rejects.toMatchObject({ kind: 'forbidden' });
        await expect(client(json(404)).get('/x')).rejects.toMatchObject({ kind: 'not-found' });
        await expect(client(json(500)).get('/x')).rejects.toMatchObject({ kind: 'server' });
        await expect(offline.get('/x')).rejects.toMatchObject({ kind: 'network' });
    });
});
