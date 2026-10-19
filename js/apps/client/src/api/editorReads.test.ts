import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), reset: () => {} }));
vi.mock('./http', () => ({ http: { get: mocks.get, post: mocks.post } }));
vi.mock('./authService', () => ({
    authService: {
        getCurrentUser: () => ({ id: 'user' }),
        onSessionReset: (listener: () => void) => {
            mocks.reset = listener;
        },
    },
}));
import { readEditor, invalidateEditorReads } from './editorReads';
const response = { data: [1] } as AxiosResponse;
const deferred = () => {
    let resolve!: (value: AxiosResponse) => void;
    const promise = new Promise<AxiosResponse>((done) => {
        resolve = done;
    });
    return { promise, resolve };
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    mocks.reset();
    mocks.get.mockReset().mockResolvedValue(response);
    mocks.post.mockReset().mockResolvedValue(response);
});
afterEach(() => {
    mocks.reset();
    vi.useRealTimers();
});

describe('чтения редактора', () => {
    it('объединяет одновременные запросы, но не кеширует готовый ответ', async () => {
        const a = readEditor('/tokens');
        const b = readEditor('/tokens');
        await vi.runAllTimersAsync();
        expect(await a).toEqual(response);
        expect(await b).toEqual(response);
        expect(mocks.get).toHaveBeenCalledTimes(1);
        const next = readEditor('/tokens');
        await vi.runAllTimersAsync();
        await next;
        expect(mocks.get).toHaveBeenCalledTimes(2);
    });
    it('разделяет историю, проекты и экспорт разных платформ', async () => {
        const calls = [
            readEditor('/p1/tokens'),
            readEditor('/p2/tokens'),
            readEditor('/p1/tokens', { params: { versionId: 'v1' } }),
            readEditor('/export', {}, { platform: 'web' }),
            readEditor('/export', {}, { platform: 'ios' }),
        ];
        await vi.runAllTimersAsync();
        await Promise.all(calls);
        expect(mocks.get).toHaveBeenCalledTimes(3);
        expect(mocks.post).toHaveBeenCalledTimes(2);
    });
    it('отмена одного владельца не прерывает другого', async () => {
        const remote = deferred();
        mocks.get.mockReturnValue(remote.promise);
        const controller = new AbortController();
        const first = readEditor('/tokens', { signal: controller.signal }).catch((error) => error);
        const second = readEditor('/tokens');
        await vi.runAllTimersAsync();
        controller.abort();
        expect((await first).code).toBe('ERR_CANCELED');
        expect(mocks.get.mock.calls[0][1].signal.aborted).toBe(false);
        remote.resolve(response);
        expect(await second).toEqual(response);
    });
    it('отмена всех владельцев удаляет ожидающий запрос', async () => {
        const controller = new AbortController();
        const request = readEditor('/tokens', { signal: controller.signal }).catch((error) => error);
        controller.abort();
        await vi.runAllTimersAsync();
        expect((await request).code).toBe('ERR_CANCELED');
        expect(mocks.get).not.toHaveBeenCalled();
    });
    it('после записи не присоединяется к чтению старого состояния', async () => {
        const remote = deferred();
        mocks.get.mockReturnValueOnce(remote.promise);
        const old = readEditor('/tokens');
        await vi.runAllTimersAsync();
        invalidateEditorReads();
        const fresh = readEditor('/tokens');
        await vi.runAllTimersAsync();
        expect(await fresh).toEqual(response);
        expect(mocks.get).toHaveBeenCalledTimes(2);
        remote.resolve({ data: [0] } as AxiosResponse);
        expect((await old).data).toEqual([0]);
    });
    it('не выпускает ответы предыдущей сессии после выхода', async () => {
        const remote = deferred();
        mocks.get.mockReturnValueOnce(remote.promise);
        const request = readEditor('/tokens').catch((error) => error);
        await vi.runAllTimersAsync();
        mocks.reset();
        remote.resolve(response);
        expect((await request).code).toBe('ERR_CANCELED');
    });
    it('допускает начальный пакет четырёх чтений, затем восемь в секунду', async () => {
        const starts: number[] = [];
        mocks.get.mockImplementation(() => {
            starts.push(Date.now());
            return response;
        });
        const requests = Array.from({ length: 16 }, (_, i) => readEditor('/tokens/' + i));
        await vi.runAllTimersAsync();
        await Promise.all(requests);
        expect(starts).toEqual(Array.from({ length: 16 }, (_, i) => Math.max(0, i - 3) * 125));
    });
    it('отменённый всплеск не оставляет длинную очередь для следующего контекста', async () => {
        const controller = new AbortController();
        const old = Array.from({ length: 100 }, (_, i) =>
            readEditor('/old/' + i, { signal: controller.signal }).catch((error) => error),
        );
        controller.abort();
        await vi.advanceTimersByTimeAsync(0);
        const fresh = readEditor('/new');
        await vi.advanceTimersByTimeAsync(126);
        expect(await fresh).toEqual(response);
        await Promise.all(old);
        expect(mocks.get.mock.calls.map((call) => call[0])).toEqual(['/new']);
    });
    it('ограниченно повторяет только временные отказы чтения', async () => {
        const unavailable = new AxiosError('busy', undefined, undefined, undefined, { status: 503 } as AxiosResponse);
        mocks.get.mockRejectedValue(unavailable);
        const request = readEditor('/tokens').catch((error) => error);
        await vi.runAllTimersAsync();
        expect(await request).toBe(unavailable);
        expect(mocks.get).toHaveBeenCalledTimes(3);
        mocks.get
            .mockReset()
            .mockRejectedValue(
                new AxiosError('denied', undefined, undefined, undefined, { status: 403 } as AxiosResponse),
            );
        const forbidden = readEditor('/tokens').catch((error) => error);
        await vi.runAllTimersAsync();
        await forbidden;
        expect(mocks.get).toHaveBeenCalledTimes(1);
    });
});
