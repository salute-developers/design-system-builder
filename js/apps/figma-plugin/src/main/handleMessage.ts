import type { MainToUi, UiToMain } from '../shared/messages';

/** Что нужно основному потоку от Figma: хранилище и внешний браузер. */
export interface PluginHost {
    getValue(key: string): Promise<string | undefined>;
    setValue(key: string, value: string): Promise<void>;
    deleteValue(key: string): Promise<void>;
    openExternal(url: string): void;
    reply(message: MainToUi): void;
}

const storageValue = async (message: Exclude<UiToMain, { type: 'open-external' }>, host: PluginHost) => {
    if (message.type === 'storage:get') return (await host.getValue(message.key)) ?? null;
    if (message.type === 'storage:set') await host.setValue(message.key, message.value);
    else await host.deleteValue(message.key);
    return null;
};

/** Выполняет команду окна. Основной поток не знает об API и OAuth: только хранилище и браузер. */
export const handleMessage = async (message: UiToMain, host: PluginHost) => {
    if (message.type === 'open-external') {
        host.openExternal(message.url);
        return;
    }
    try {
        host.reply({ type: 'storage:result', requestId: message.requestId, value: await storageValue(message, host) });
    } catch (error) {
        host.reply({ type: 'storage:result', requestId: message.requestId, value: null, error: String(error) });
    }
};
