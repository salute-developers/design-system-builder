import { describe, expect, it, vi } from 'vitest';

import type { ExportPlan } from '../shared/exportPlan';
import { createBridge } from './bridge';

/** Окно плагина и родитель: команды уходят родителю, ответы приходят событием `message`. */
const createTarget = () => {
    const listeners: Array<(event: { data: unknown }) => void> = [];
    const postMessage = vi.fn();
    const open = vi.fn(() => null);
    const target = {
        parent: { postMessage },
        open,
        addEventListener: (_: string, listener: (event: { data: unknown }) => void) => listeners.push(listener),
    } as unknown as Window;
    const deliver = (data: unknown) => listeners.forEach((listener) => listener({ data }));
    return { target, postMessage, open, deliver };
};

describe('обмен с основным потоком', () => {
    it('заворачивает команду в `pluginMessage` и сопоставляет ответ по `requestId`', async () => {
        const { target, postMessage, deliver } = createTarget();
        const bridge = createBridge(target);

        const first = bridge.get('context');
        const second = bridge.get('refresh-token');
        const [[firstMessage], [secondMessage]] = postMessage.mock.calls;
        expect(firstMessage.pluginMessage).toMatchObject({ type: 'storage:get', key: 'context' });
        deliver({
            pluginMessage: { type: 'storage:result', requestId: secondMessage.pluginMessage.requestId, value: 'b' },
        });
        deliver({
            pluginMessage: { type: 'storage:result', requestId: firstMessage.pluginMessage.requestId, value: 'a' },
        });

        await expect(first).resolves.toBe('a');
        await expect(second).resolves.toBe('b');
    });

    it('работает в окне Figma: origin `null` не даёт защищённого контекста и `crypto.randomUUID`', async () => {
        vi.stubGlobal('crypto', {});
        const { target, postMessage, deliver } = createTarget();

        const first = createBridge(target).get('context');
        const { requestId } = postMessage.mock.calls[0][0].pluginMessage;
        deliver({ pluginMessage: { type: 'storage:result', requestId, value: 'saved' } });

        await expect(first).resolves.toBe('saved');
        vi.unstubAllGlobals();
    });

    it('передаёт ошибку хранилища и игнорирует чужие сообщения', async () => {
        const { target, postMessage, deliver } = createTarget();
        const bridge = createBridge(target);

        const result = bridge.set('context', 'value');
        deliver({ other: true });
        deliver({ pluginMessage: { type: 'storage:result', requestId: 'unknown', value: null } });
        const { requestId } = postMessage.mock.calls[0][0].pluginMessage;
        deliver({ pluginMessage: { type: 'storage:result', requestId, value: null, error: 'full' } });

        await expect(result).rejects.toThrow('full');
    });

    it('открывает внешнюю ссылку без ожидания ответа', () => {
        const { target, postMessage } = createTarget();
        createBridge(target).openExternal('https://example.test');
        expect(postMessage.mock.calls[0][0].pluginMessage).toEqual({
            type: 'open-external',
            url: 'https://example.test',
        });
    });

    it('открывает адрес из основного потока: `null` от `window.open` не считается ошибкой', () => {
        const { target, postMessage, open, deliver } = createTarget();
        createBridge(target);

        deliver({ pluginMessage: { type: 'open-url', url: 'https://example.test/device' } });

        expect(open).toHaveBeenCalledWith('https://example.test/device', '_blank', 'noopener');
        expect(postMessage).not.toHaveBeenCalled();
    });

    it('открывает только адреса `http` и `https`', () => {
        const { target, open, deliver } = createTarget();
        createBridge(target);

        deliver({ pluginMessage: { type: 'open-url', url: 'javascript:alert(1)' } });
        deliver({ pluginMessage: { type: 'open-url', url: 'file:///etc/passwd' } });

        expect(open).not.toHaveBeenCalled();
    });

    it('передаёт план основному потоку и возвращает отчёт или ошибку записи', async () => {
        const { target, postMessage, deliver } = createTarget();
        const bridge = createBridge(target);
        const plan = { collections: [] } as unknown as ExportPlan;

        const applied = bridge.applyExport(plan);
        const failed = bridge.applyExport(plan);
        const [[first], [second]] = postMessage.mock.calls;
        expect(first.pluginMessage).toMatchObject({ type: 'export:apply', plan });
        deliver({
            pluginMessage: { type: 'export:result', requestId: first.pluginMessage.requestId, report: { stale: 1 } },
        });
        deliver({
            pluginMessage: {
                type: 'export:result',
                requestId: second.pluginMessage.requestId,
                report: null,
                error: 'boom',
            },
        });

        await expect(applied).resolves.toEqual({ stale: 1 });
        await expect(failed).rejects.toThrow('boom');
    });

    it('отдаёт файлы на упаковку основному потоку и возвращает архив', async () => {
        const { target, postMessage, deliver } = createTarget();
        const bridge = createBridge(target);
        const files = [{ path: 'SB Sans Text/Bold.otf', data: new Uint8Array([1]) }];

        const packed = bridge.packZip(files);
        const [[message]] = postMessage.mock.calls;
        expect(message.pluginMessage).toMatchObject({ type: 'zip:pack', files });
        deliver({
            pluginMessage: {
                type: 'zip:result',
                requestId: message.pluginMessage.requestId,
                bytes: new Uint8Array([80, 75]),
            },
        });

        await expect(packed).resolves.toEqual(new Uint8Array([80, 75]));
    });
});
