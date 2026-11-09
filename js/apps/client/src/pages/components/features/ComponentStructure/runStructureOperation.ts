import type { EditorContextKey } from '../../../../api/editorContracts';

import type { StructureOperation } from './types';

/**
 * Выполняет структурную операцию и перечитывает компонент `route` (с префиксом платформы) — и после ошибки:
 * операция могла частично изменить данные. Ошибка пробрасывается дальше; созданная конфигурация открывается только
 * после успеха.
 */
export const runStructureOperation = async (
    operation: StructureOperation,
    context: EditorContextKey,
    route: string,
    reload: (route: string) => Promise<unknown> | undefined,
    open: (configurationId: string) => void,
) => {
    let opened: string | void;
    try {
        opened = await operation(context);
    } finally {
        await reload(route);
    }
    if (opened) open(opened);
};
