import type { ExportPlan, ExportReport } from './exportPlan';
import type { ArchiveFile } from './zip';

/** Ключи `clientStorage` редактора, которые окно может читать и менять через основной поток. */
export type StorageKey = 'refresh-token' | 'context';

/** Команды окна основному потоку: только основной поток имеет доступ к API редактора. */
export type UiToMain =
    | { type: 'storage:get'; requestId: string; key: StorageKey }
    | { type: 'storage:set'; requestId: string; key: StorageKey; value: string }
    | { type: 'storage:delete'; requestId: string; key: StorageKey }
    | { type: 'export:apply'; requestId: string; plan: ExportPlan }
    | { type: 'zip:pack'; requestId: string; files: ArchiveFile[] }
    | { type: 'editor:get'; requestId: string }
    | { type: 'open-external'; url: string };

/** Ответы основного потока: результат команды хранилища или экспорта; просьба открыть адрес, если у редактора нет `openExternal`. */
export type MainToUi =
    | { type: 'storage:result'; requestId: string; value: string | null; error?: string }
    | { type: 'export:result'; requestId: string; report: ExportReport | null; error?: string }
    | { type: 'zip:result'; requestId: string; bytes: Uint8Array | null; error?: string }
    | { type: 'editor:result'; requestId: string; name: string; error?: string }
    | { type: 'open-url'; url: string };
