import { describe, expect, it, vi } from 'vitest';

import type { ExportPlan, ExportReport } from '../shared/exportPlan';
import type { UiToMain } from '../shared/messages';
import { startPlugin, type EditorApi } from './startPlugin';

const createEditor = (openExternal?: (url: string) => void) => {
    const stored: Record<string, string> = { context: 'saved' };
    const editor: EditorApi = {
        showUI: vi.fn(),
        clientStorage: {
            getAsync: async (key) => stored[key],
            setAsync: async (key, value) => {
                stored[key] = value;
            },
            deleteAsync: async (key) => {
                delete stored[key];
            },
        },
        ui: { postMessage: vi.fn(), onmessage: undefined },
        openExternal,
    };
    const send = (message: UiToMain) => editor.ui.onmessage?.(message, { origin: '' });
    return { editor, stored, send };
};

describe('запуск основного потока', () => {
    it('открывает окно плагина', () => {
        const { editor } = createEditor();
        startPlugin(editor, '<html>');
        expect(editor.showUI).toHaveBeenCalledWith('<html>', { width: 400, height: 600, themeColors: true });
    });

    it('подключает команды окна к хранилищу редактора', async () => {
        const { editor, stored, send } = createEditor();
        startPlugin(editor, '<html>');

        send({ type: 'storage:set', requestId: '1', key: 'refresh-token', value: 'token' });
        send({ type: 'storage:get', requestId: '2', key: 'context' });

        await vi.waitFor(() => expect(editor.ui.postMessage).toHaveBeenCalledTimes(2));
        expect(stored['refresh-token']).toBe('token');
        expect(editor.ui.postMessage).toHaveBeenCalledWith({ type: 'storage:result', requestId: '2', value: 'saved' });
    });

    it('открывает браузер через `openExternal`, если он есть', () => {
        const openExternal = vi.fn();
        const { editor, send } = createEditor(openExternal);
        startPlugin(editor, '<html>');

        send({ type: 'open-external', url: 'https://example.test/device' });

        expect(openExternal).toHaveBeenCalledWith('https://example.test/device');
        expect(editor.ui.postMessage).not.toHaveBeenCalled();
    });

    it('передаёт адрес окну, если `openExternal` нет', () => {
        const { editor, send } = createEditor();
        startPlugin(editor, '<html>');

        send({ type: 'open-external', url: 'https://example.test/device' });

        expect(editor.ui.postMessage).toHaveBeenCalledWith({ type: 'open-url', url: 'https://example.test/device' });
    });

    it('записывает план через переданную функцию', async () => {
        const report = { stale: {} } as unknown as ExportReport;
        const applyExport = vi.fn(async () => report);
        const { editor, send } = createEditor();
        startPlugin(editor, '<html>', applyExport);

        send({ type: 'export:apply', requestId: '1', plan: {} as ExportPlan });

        await vi.waitFor(() =>
            expect(editor.ui.postMessage).toHaveBeenCalledWith({ type: 'export:result', requestId: '1', report }),
        );
    });

    it('отвечает отказом, если редактор не умеет записывать план', async () => {
        const { editor, send } = createEditor();
        startPlugin(editor, '<html>');

        send({ type: 'export:apply', requestId: '1', plan: {} as ExportPlan });

        await vi.waitFor(() =>
            expect(editor.ui.postMessage).toHaveBeenCalledWith({
                type: 'export:result',
                requestId: '1',
                report: null,
                error: 'Экспорт в этот редактор пока не поддерживается.',
            }),
        );
    });
});
