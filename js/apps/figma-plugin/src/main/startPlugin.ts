import type { MainToUi, UiToMain } from '../shared/messages';
import { handleMessage, type PluginHost } from './handleMessage';

/** Часть API редактора, нужная основному потоку. Figma и Pixso описывают её одинаково, кроме `openExternal`. */
export interface EditorApi {
    showUI(html: string, options: { width: number; height: number; themeColors: boolean }): void;
    clientStorage: {
        getAsync(key: string): Promise<string | undefined>;
        setAsync(key: string, value: string): Promise<void>;
        deleteAsync(key: string): Promise<void>;
    };
    ui: {
        postMessage(message: MainToUi): void;
        onmessage: ((message: UiToMain, properties: { origin: string }) => void) | undefined;
    };
    openExternal?(url: string): void;
}

/** Открывает окно плагина и подключает его команды к API редактора. */
export const startPlugin = (editor: EditorApi, html: string) => {
    editor.showUI(html, { width: 400, height: 600, themeColors: true });

    const host: PluginHost = {
        getValue: (key) => editor.clientStorage.getAsync(key),
        setValue: (key, value) => editor.clientStorage.setAsync(key, value),
        deleteValue: (key) => editor.clientStorage.deleteAsync(key),
        openExternal: (url) => {
            if (editor.openExternal) editor.openExternal(url);
            else editor.ui.postMessage({ type: 'open-url', url });
        },
        reply: (message) => editor.ui.postMessage(message),
    };

    editor.ui.onmessage = (message) => void handleMessage(message, host);
};
