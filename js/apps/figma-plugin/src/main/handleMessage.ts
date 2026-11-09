import type { ExportPlan, ExportReport } from '../shared/exportPlan';
import type { MainToUi, UiToMain } from '../shared/messages';

/** Что нужно основному потоку от Figma: хранилище, внешний браузер и запись плана экспорта. */
export interface PluginHost {
    getValue(key: string): Promise<string | undefined>;
    setValue(key: string, value: string): Promise<void>;
    deleteValue(key: string): Promise<void>;
    openExternal(url: string): void;
    applyExport(plan: ExportPlan): Promise<ExportReport>;
    reply(message: MainToUi): void;
}

type StorageMessage = Extract<UiToMain, { type: 'storage:get' | 'storage:set' | 'storage:delete' }>;

const storageValue = async (message: StorageMessage, host: PluginHost) => {
    if (message.type === 'storage:get') return (await host.getValue(message.key)) ?? null;
    if (message.type === 'storage:set') await host.setValue(message.key, message.value);
    else await host.deleteValue(message.key);
    return null;
};

/** Экспорты идут по очереди: два одновременных прохода создали бы дубликаты коллекций. */
let exporting: Promise<unknown> = Promise.resolve();

/** Выполняет команду окна. Основной поток не знает об API и OAuth: только хранилище, браузер и документ. */
export const handleMessage = async (message: UiToMain, host: PluginHost) => {
    if (message.type === 'open-external') {
        host.openExternal(message.url);
        return;
    }
    if (message.type === 'export:apply') {
        const run = exporting.then(() => host.applyExport(message.plan));
        exporting = run.catch(() => undefined);
        try {
            host.reply({ type: 'export:result', requestId: message.requestId, report: await run });
        } catch (error) {
            const text = error instanceof Error ? error.message : String(error);
            host.reply({ type: 'export:result', requestId: message.requestId, report: null, error: text });
        }
        return;
    }
    try {
        host.reply({ type: 'storage:result', requestId: message.requestId, value: await storageValue(message, host) });
    } catch (error) {
        host.reply({ type: 'storage:result', requestId: message.requestId, value: null, error: String(error) });
    }
};
