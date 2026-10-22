import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const session = vi.hoisted(() => ({
    reset: () => {},
    authenticated: true,
    access: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
}));
vi.mock('./authService', () => ({
    authService: {
        getValidAccessToken: session.access,
        refreshAccessToken: session.refresh,
        logout: session.logout,
        isAuthenticated: () => session.authenticated,
        onSessionReset: (listener: () => void) => {
            session.reset = listener;
        },
    },
}));
import { http } from './http';

const fail = (config: InternalAxiosRequestConfig, status = 503): never => {
    throw new AxiosError('request failed', 'ERR_BAD_RESPONSE', config, undefined, {
        config,
        status,
        statusText: 'Failure',
        headers: {},
        data: {},
    });
};
const success = (config: InternalAxiosRequestConfig) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: { ok: true },
});
const headers = { 'Idempotency-Key': 'same-command', 'X-DS-Base-Revision': '7' };

beforeEach(() => {
    vi.useFakeTimers();
    session.reset();
    session.authenticated = true;
    session.access.mockReset().mockResolvedValue('test-access');
    session.refresh.mockReset().mockResolvedValue('refreshed-access');
    session.logout.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('повтор временно недоступных предметных команд', () => {
    it.each(['before-request', 'after-401'])('направляет на вход при отказе refresh token: %s', async (stage) => {
        const location = { href: 'http://localhost/editor', pathname: '/editor' };
        vi.stubGlobal('window', { location });
        const expired = async () => {
            session.authenticated = false;
            session.reset();
            throw new Error('refresh token expired');
        };
        if (stage === 'before-request') session.access.mockImplementationOnce(expired);
        else session.refresh.mockImplementationOnce(expired);
        const adapter = vi.fn(async (config) => fail(config, 401));
        await http.get('/tokens', { adapter }).catch(() => undefined);
        expect(session.logout).toHaveBeenCalledTimes(1);
        expect(location.href).toBe('/login?reason=expired');
        expect(adapter).toHaveBeenCalledTimes(stage === 'before-request' ? 0 : 1);
    });

    it.each(['post', 'put', 'patch', 'delete'])('повторяет %s с теми же ключом, редакцией и телом', async (method) => {
        const adapter = vi.fn(async (config) => (adapter.mock.calls.length === 1 ? fail(config) : success(config)));
        const request = http.request({ url: '/changes/revert', method, headers, data: { paths: ['/value'] }, adapter });
        await vi.runAllTimersAsync();
        expect((await request).data).toEqual({ ok: true });
        expect(adapter).toHaveBeenCalledTimes(2);
        const [first, second] = adapter.mock.calls.map(([config]) => config);
        expect(second.data).toBe(first.data);
        expect(second.headers.get('Idempotency-Key')).toBe('same-command');
        expect(second.headers.get('X-DS-Base-Revision')).toBe('7');
    });

    it('ограничивает повтор двумя попытками', async () => {
        const adapter = vi.fn(async (config) => fail(config));
        const request = http.post('/tokens', {}, { headers, adapter }).catch((error) => error);
        await vi.runAllTimersAsync();
        expect((await request).response.status).toBe(503);
        expect(adapter).toHaveBeenCalledTimes(3);
        expect(Date.now()).toBeGreaterThanOrEqual(1500);
    });

    it.each([400, 403, 409, 500])('не повторяет предметный отказ %s', async (status) => {
        const adapter = vi.fn(async (config) => fail(config, status));
        await expect(http.post('/tokens', {}, { headers, adapter })).rejects.toHaveProperty('response.status', status);
        expect(adapter).toHaveBeenCalledTimes(1);
    });

    it('не повторяет запись без ключа и не дублирует повторы чтений', async () => {
        const adapter = vi.fn(async (config) => fail(config));
        await expect(http.post('/tokens', {}, { adapter })).rejects.toHaveProperty('response.status', 503);
        await expect(http.get('/tokens', { adapter, headers })).rejects.toHaveProperty('response.status', 503);
        expect(adapter).toHaveBeenCalledTimes(2);
    });

    it('отменяет ожидание при закрытии редактора', async () => {
        const controller = new AbortController();
        const adapter = vi.fn(async (config) => fail(config));
        const request = http
            .post('/tokens', {}, { headers, adapter, signal: controller.signal })
            .catch((error) => error);
        await vi.advanceTimersByTimeAsync(0);
        controller.abort();
        expect((await request).code).toBe('ERR_CANCELED');
        await vi.runAllTimersAsync();
        expect(adapter).toHaveBeenCalledTimes(1);
    });

    it('не переносит команду в новую пользовательскую сессию', async () => {
        const adapter = vi.fn(async (config) => fail(config));
        const request = http.post('/tokens', {}, { headers, adapter }).catch((error) => error);
        await vi.advanceTimersByTimeAsync(0);
        session.reset();
        await vi.runAllTimersAsync();
        expect((await request).code).toBe('ERR_CANCELED');
        expect(adapter).toHaveBeenCalledTimes(1);
    });
});
