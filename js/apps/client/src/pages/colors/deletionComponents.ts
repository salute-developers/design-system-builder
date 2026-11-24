import { useEffect, useState } from 'react';

import { componentRepository } from '../../api/componentRepository';
import type { EditorContextKey } from '../../api/editorContracts';
import { Config } from '../../controllers';

export const deletionReads = {
    /** Конфигурации всех web-компонентов дизайн-системы: раздел «Цвета» мог загрузить их не полностью. */
    load: async (context: EditorContextKey, signal: AbortSignal) =>
        (await componentRepository.loadComponentData(context, signal)).map((meta) => new Config(meta)),
};

/**
 * Компоненты для проверки ссылок перед удалением: загруженные экраном и полный список дизайн-системы. Пока полный
 * список читается — `null`; при ошибке чтения остаются загруженные экраном и признак `failed`.
 */
export const useDeletionComponents = (context: EditorContextKey, loaded: readonly Config[], active: boolean) => {
    const [state, setState] = useState<{ configs: Config[] | null; failed: boolean }>({ configs: null, failed: false });
    useEffect(() => {
        if (!active) return;
        const controller = new AbortController();
        setState({ configs: null, failed: false });
        deletionReads.load(context, controller.signal).then(
            (configs) => controller.signal.aborted || setState({ configs, failed: false }),
            () => controller.signal.aborted || setState({ configs: [], failed: true }),
        );
        return () => controller.abort();
    }, [active, context]);
    return { configs: state.configs && [...loaded, ...state.configs], failed: state.failed };
};
