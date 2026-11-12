import type { EditorContextKey } from '../../../../api/editorContracts';

/**
 * Структурная операция редактора: выполняется после отправки автосохранения, затем компонент перечитывается.
 * Результат — ID конфигурации, которую нужно открыть после операции (созданной или дублированной).
 */
export type StructureOperation = (context: EditorContextKey) => Promise<string | void>;

export interface StructureAccess {
    context: EditorContextKey;
    run: (operation: StructureOperation) => Promise<void>;
}
