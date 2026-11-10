import { describe, expect, it, vi } from 'vitest';

import type { ExportPlan, ExportReport } from '../shared/exportPlan';
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
        applyExport: vi.fn(),
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

    it('применяет план экспорта и возвращает отчёт или ошибку', async () => {
        const { host } = createHost();
        const plan = { collections: [] } as unknown as ExportPlan;
        const report = { failure: undefined } as unknown as ExportReport;
        vi.mocked(host.applyExport).mockResolvedValueOnce(report).mockRejectedValueOnce(new Error('locked'));

        await handleMessage({ type: 'export:apply', requestId: '7', plan }, host);
        await handleMessage({ type: 'export:apply', requestId: '8', plan }, host);

        expect(host.applyExport).toHaveBeenCalledWith(plan);
        expect(host.reply).toHaveBeenNthCalledWith(1, { type: 'export:result', requestId: '7', report });
        expect(host.reply).toHaveBeenNthCalledWith(2, {
            type: 'export:result',
            requestId: '8',
            report: null,
            error: 'locked',
        });
    });

    it('выполняет экспорты по очереди', async () => {
        const { host } = createHost();
        const order: string[] = [];
        let finishFirst: () => void = () => undefined;
        vi.mocked(host.applyExport)
            .mockImplementationOnce(async () => {
                order.push('first:start');
                await new Promise<void>((resolve) => (finishFirst = resolve));
                order.push('first:end');
                return {} as ExportReport;
            })
            .mockImplementationOnce(async () => {
                order.push('second:start');
                return {} as ExportReport;
            });
        const plan = {} as ExportPlan;

        const first = handleMessage({ type: 'export:apply', requestId: '1', plan }, host);
        const second = handleMessage({ type: 'export:apply', requestId: '2', plan }, host);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(order).toEqual(['first:start']);
        finishFirst();
        await Promise.all([first, second]);

        expect(order).toEqual(['first:start', 'first:end', 'second:start']);
    });

    it('упаковывает файлы окна в ZIP', async () => {
        const { host } = createHost();

        await handleMessage(
            { type: 'zip:pack', requestId: '3', files: [{ path: 'Шрифт/Bold.otf', data: new Uint8Array([1, 2]) }] },
            host,
        );

        const reply = vi.mocked(host.reply).mock.calls[0][0] as { type: string; requestId: string; bytes: Uint8Array };
        expect(reply).toMatchObject({ type: 'zip:result', requestId: '3' });
        // Сигнатура локального заголовка ZIP и имя в UTF-8: `Шрифт/Bold.otf`.
        expect([...reply.bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
        const name = [208, 168, 209, 128, 208, 184, 209, 132, 209, 130, 47, 66, 111, 108, 100, 46, 111, 116, 102];
        expect([...reply.bytes.subarray(30, 30 + name.length)]).toEqual(name);
    });

    it('отвечает ошибкой, если упаковать не удалось', async () => {
        const { host } = createHost();

        await handleMessage({ type: 'zip:pack', requestId: '4', files: [{ path: 'a', data: null as never }] }, host);

        expect(host.reply).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'zip:result', requestId: '4', bytes: null }),
        );
    });
});
