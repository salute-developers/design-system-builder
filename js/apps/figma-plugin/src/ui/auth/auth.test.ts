import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorageKey } from '../../shared/messages';
import type { PluginStorage } from '../bridge';
import { OAuthError, TransportError, createAuthEndpoints, type DeviceAuthorization } from './authEndpoints';
import { pollForTokens } from './deviceFlow';
import { Session } from './session';

const tokens = { accessToken: 'access', refreshToken: 'refresh' };
const device: DeviceAuthorization = {
    deviceCode: 'device',
    userCode: 'ABCD-EFGH',
    verificationUri: 'https://example.test/device?user_code=ABCD-EFGH',
    intervalSeconds: 5,
    expiresInSeconds: 600,
};

const memoryStorage = (initial: Partial<Record<StorageKey, string>> = {}) => {
    const values = new Map(Object.entries(initial));
    const storage: PluginStorage = {
        get: async (key) => values.get(key) ?? null,
        set: async (key, value) => void values.set(key, value),
        delete: async (key) => void values.delete(key),
    };
    return { storage, values };
};

describe('опрос подтверждения входа', () => {
    beforeEach(() => void vi.useFakeTimers());
    afterEach(() => void vi.useRealTimers());

    it('ждёт `interval` между запросами и возвращает токены', async () => {
        const exchangeDeviceCode = vi
            .fn()
            .mockRejectedValueOnce(new OAuthError('authorization_pending'))
            .mockResolvedValueOnce(tokens);
        const result = pollForTokens({ exchangeDeviceCode }, device, new AbortController().signal);

        await vi.advanceTimersByTimeAsync(4_999);
        expect(exchangeDeviceCode).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(exchangeDeviceCode).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(5_000);

        await expect(result).resolves.toEqual(tokens);
    });

    it('после `slow_down` увеличивает интервал на 5 секунд', async () => {
        const exchangeDeviceCode = vi
            .fn()
            .mockRejectedValueOnce(new OAuthError('slow_down'))
            .mockResolvedValueOnce(tokens);
        const result = pollForTokens({ exchangeDeviceCode }, device, new AbortController().signal);

        await vi.advanceTimersByTimeAsync(5_000);
        await vi.advanceTimersByTimeAsync(9_999);
        expect(exchangeDeviceCode).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);

        await expect(result).resolves.toEqual(tokens);
    });

    it.each(['expired_token', 'access_denied'])('прекращает опрос на `%s`', async (code) => {
        const exchangeDeviceCode = vi.fn().mockRejectedValue(new OAuthError(code));
        const result = pollForTokens({ exchangeDeviceCode }, device, new AbortController().signal);
        const failure = expect(result).rejects.toMatchObject({ code });

        await vi.advanceTimersByTimeAsync(5_000);

        await failure;
        expect(exchangeDeviceCode).toHaveBeenCalledTimes(1);
    });

    it('не прерывает ожидание из-за сетевого сбоя', async () => {
        const exchangeDeviceCode = vi
            .fn()
            .mockRejectedValueOnce(new TransportError('offline'))
            .mockResolvedValueOnce(tokens);
        const result = pollForTokens({ exchangeDeviceCode }, device, new AbortController().signal);

        await vi.advanceTimersByTimeAsync(10_000);

        await expect(result).resolves.toEqual(tokens);
    });

    it('прекращает опрос при отмене', async () => {
        const exchangeDeviceCode = vi.fn();
        const controller = new AbortController();
        const result = pollForTokens({ exchangeDeviceCode }, device, controller.signal);
        const failure = expect(result).rejects.toMatchObject({ name: 'AbortError' });

        controller.abort();

        await failure;
        await vi.advanceTimersByTimeAsync(60_000);
        expect(exchangeDeviceCode).not.toHaveBeenCalled();
    });

    it('считает код истёкшим по сроку из ответа', async () => {
        const exchangeDeviceCode = vi.fn().mockRejectedValue(new OAuthError('authorization_pending'));
        const result = pollForTokens(
            { exchangeDeviceCode },
            { ...device, expiresInSeconds: 12 },
            new AbortController().signal,
        );
        const failure = expect(result).rejects.toMatchObject({ code: 'expired_token' });

        await vi.advanceTimersByTimeAsync(15_000);

        await failure;
    });
});

describe('сессия', () => {
    const endpoints = () => ({
        refresh: vi.fn().mockResolvedValue(tokens),
        logout: vi.fn().mockResolvedValue(undefined),
    });

    it('хранит refresh token в хранилище, а access token только в памяти', async () => {
        const { storage, values } = memoryStorage();
        const session = new Session(storage, endpoints());

        await session.signIn(tokens);

        expect(values.get('refresh-token')).toBe('refresh');
        expect([...values.values()]).not.toContain('access');
        expect(session.accessToken).toBe('access');
    });

    it('восстанавливается без браузера по сохранённому токену', async () => {
        const session = new Session(memoryStorage({ 'refresh-token': 'saved' }).storage, endpoints());

        await expect(session.restore()).resolves.toBe(true);
        expect(session.accessToken).toBe('access');
    });

    it('без сохранённого токена требует вход', async () => {
        await expect(new Session(memoryStorage().storage, endpoints()).restore()).resolves.toBe(false);
    });

    it('удаляет токен на `invalid_grant`', async () => {
        const { storage, values } = memoryStorage({ 'refresh-token': 'saved' });
        const api = { ...endpoints(), refresh: vi.fn().mockRejectedValue(new OAuthError('invalid_grant')) };

        await expect(new Session(storage, api).restore()).resolves.toBe(false);

        expect(values.has('refresh-token')).toBe(false);
    });

    it('сохраняет токен при недоступном сервере', async () => {
        const { storage, values } = memoryStorage({ 'refresh-token': 'saved' });
        const api = { ...endpoints(), refresh: vi.fn().mockRejectedValue(new TransportError('offline')) };

        await expect(new Session(storage, api).restore()).rejects.toBeInstanceOf(TransportError);

        expect(values.get('refresh-token')).toBe('saved');
    });

    it('делает одно обновление на все одновременные запросы', async () => {
        const api = endpoints();
        const session = new Session(memoryStorage({ 'refresh-token': 'saved' }).storage, api);

        await Promise.all([session.refresh(), session.refresh(), session.refresh()]);

        expect(api.refresh).toHaveBeenCalledTimes(1);
    });

    it('не возвращает токены, если выход случился во время обновления', async () => {
        const { storage, values } = memoryStorage({ 'refresh-token': 'saved' });
        let finish: (value: typeof tokens) => void = () => undefined;
        const api = {
            ...endpoints(),
            refresh: vi.fn(() => new Promise<typeof tokens>((resolve) => (finish = resolve))),
        };
        const session = new Session(storage, api);

        const refreshing = session.refresh();
        await vi.waitFor(() => expect(api.refresh).toHaveBeenCalled());
        await session.signOut();
        finish(tokens);

        await expect(refreshing).rejects.toBeInstanceOf(OAuthError);
        expect(values.has('refresh-token')).toBe(false);
        expect(session.accessToken).toBeNull();
    });

    it('завершает сессию, если у пользователя сняли право на офлайн-вход', async () => {
        const { storage, values } = memoryStorage({ 'refresh-token': 'saved' });
        const api = { ...endpoints(), refresh: vi.fn().mockRejectedValue(new OAuthError('not_allowed')) };
        const session = new Session(storage, api);
        const expired = vi.fn();
        session.onExpired(expired);

        await expect(session.refresh()).rejects.toBeInstanceOf(OAuthError);

        expect(expired).toHaveBeenCalled();
        expect(values.has('refresh-token')).toBe(false);
    });

    it('завершает сессию, если токен уже удалён в другом окне', async () => {
        const session = new Session(memoryStorage().storage, endpoints());
        const expired = vi.fn();
        session.onExpired(expired);

        await expect(session.refresh()).rejects.toBeInstanceOf(OAuthError);

        expect(expired).toHaveBeenCalled();
    });

    it('очищает токены при выходе, даже если хранилище не прочиталось', async () => {
        const { storage, values } = memoryStorage({ 'refresh-token': 'saved' });
        const session = new Session({ ...storage, get: vi.fn().mockRejectedValue(new Error('broken')) }, endpoints());

        await session.signOut();

        expect(values.has('refresh-token')).toBe(false);
    });

    it('очищает токены при выходе, даже если сервер недоступен', async () => {
        const { storage, values } = memoryStorage({ 'refresh-token': 'saved' });
        const api = { ...endpoints(), logout: vi.fn().mockRejectedValue(new TransportError('offline')) };
        const session = new Session(storage, api);
        await session.signIn(tokens);

        await session.signOut();

        expect(values.has('refresh-token')).toBe(false);
        expect(session.accessToken).toBeNull();
    });
});

describe('запросы к Keycloak', () => {
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

    it('запрашивает код устройства для клиента плагина', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            json(200, {
                device_code: 'device',
                user_code: 'ABCD',
                verification_uri: 'https://example.test/device',
                verification_uri_complete: 'https://example.test/device?user_code=ABCD',
                expires_in: 600,
                interval: 5,
            }),
        );

        const result = await createAuthEndpoints(fetcher).requestDeviceCode();

        expect(result.verificationUri).toBe('https://example.test/device?user_code=ABCD');
        const [target, init] = fetcher.mock.calls[0];
        expect(String(target)).toContain('/realms/dsbuilder/protocol/openid-connect/auth/device');
        const body = new URLSearchParams(String(init?.body));
        expect(body.get('client_id')).toBe('dsbuilder-figma-plugin');
        expect(body.get('scope')?.split(' ')).toContain('offline_access');
    });

    it('не принимает неполный ответ и сохраняет прежний refresh token, если нового нет', async () => {
        const broken = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>', { status: 200 }));
        const partial = vi.fn<typeof fetch>().mockResolvedValue(json(200, { access_token: 'access' }));

        await expect(createAuthEndpoints(broken).refresh('token')).rejects.toBeInstanceOf(TransportError);
        await expect(createAuthEndpoints(partial).refresh('token')).resolves.toEqual({
            accessToken: 'access',
            refreshToken: 'token',
        });
    });

    it('подставляет значения RFC 8628, если сервер не вернул сроки', async () => {
        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValue(
                json(200, { device_code: 'd', user_code: 'u', verification_uri: 'https://example.test' }),
            );

        await expect(createAuthEndpoints(fetcher).requestDeviceCode()).resolves.toMatchObject({
            intervalSeconds: 5,
            expiresInSeconds: 600,
        });
    });

    it('различает отказ OAuth и сбой сервера', async () => {
        const denied = vi.fn<typeof fetch>().mockResolvedValue(json(400, { error: 'invalid_grant' }));
        const broken = vi.fn<typeof fetch>().mockResolvedValue(json(502, {}));
        const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(createAuthEndpoints(denied).refresh('token')).rejects.toMatchObject({ code: 'invalid_grant' });
        await expect(createAuthEndpoints(broken).refresh('token')).rejects.toBeInstanceOf(TransportError);
        await expect(createAuthEndpoints(offline).refresh('token')).rejects.toBeInstanceOf(TransportError);
    });
});
