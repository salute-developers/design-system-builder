import { describe, expect, it, vi } from 'vitest';

import { handleMessage, type PluginHost } from './handleMessage';

const createHost = (stored: Record<string, string> = {}) => {
    const host: PluginHost = {
        getValue: vi.fn(async (key) => stored[key]),
        setValue: vi.fn(async (key, value) => {
            stored[key] = value;
        }),
        deleteValue: vi.fn(async (key) => {
            delete stored[key];
        }),
        openExternal: vi.fn(),
        reply: vi.fn(),
    };
    return { host, stored };
};

describe('команды основного потока', () => {
    it('читает, пишет и удаляет значение и отвечает по идентификатору запроса', async () => {
        const { host, stored } = createHost({ context: 'saved' });

        await handleMessage({ type: 'storage:get', requestId: '1', key: 'context' }, host);
        await handleMessage({ type: 'storage:set', requestId: '2', key: 'refresh-token', value: 'token' }, host);
        await handleMessage({ type: 'storage:delete', requestId: '3', key: 'context' }, host);

        expect(host.reply).toHaveBeenNthCalledWith(1, { type: 'storage:result', requestId: '1', value: 'saved' });
        expect(host.reply).toHaveBeenNthCalledWith(2, { type: 'storage:result', requestId: '2', value: null });
        expect(stored).toEqual({ 'refresh-token': 'token' });
    });

    it('возвращает пустое значение, если ключа нет', async () => {
        const { host } = createHost();
        await handleMessage({ type: 'storage:get', requestId: '1', key: 'context' }, host);
        expect(host.reply).toHaveBeenCalledWith({ type: 'storage:result', requestId: '1', value: null });
    });

    it('сообщает об ошибке хранилища, а не теряет ответ', async () => {
        const { host } = createHost();
        vi.mocked(host.getValue).mockRejectedValue(new Error('storage is full'));
        await handleMessage({ type: 'storage:get', requestId: '1', key: 'context' }, host);
        expect(host.reply).toHaveBeenCalledWith({
            type: 'storage:result',
            requestId: '1',
            value: null,
            error: 'Error: storage is full',
        });
    });

    it('открывает ссылку во внешнем браузере', async () => {
        const { host } = createHost();
        await handleMessage({ type: 'open-external', url: 'https://example.test/device' }, host);
        expect(host.openExternal).toHaveBeenCalledWith('https://example.test/device');
        expect(host.reply).not.toHaveBeenCalled();
    });
});
