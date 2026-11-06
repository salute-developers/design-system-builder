/** Ключи `clientStorage` редактора, которые окно может читать и менять через основной поток. */
export type StorageKey = 'refresh-token' | 'context';

/** Команды окна основному потоку: только основной поток имеет доступ к API редактора. */
export type UiToMain =
    | { type: 'storage:get'; requestId: string; key: StorageKey }
    | { type: 'storage:set'; requestId: string; key: StorageKey; value: string }
    | { type: 'storage:delete'; requestId: string; key: StorageKey }
    | { type: 'open-external'; url: string };

/** Ответ на команду хранилища или просьба открыть адрес, если у редактора нет `openExternal`. */
export type MainToUi =
    | { type: 'storage:result'; requestId: string; value: string | null; error?: string }
    | { type: 'open-url'; url: string };
