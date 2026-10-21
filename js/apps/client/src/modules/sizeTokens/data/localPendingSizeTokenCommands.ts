import type { SizeTokenContext, PendingSizeTokenCommands, SizeTokenCommand } from '../application/sizeTokenRepository';

/** Префикс ключей неподтверждённых команд темы в `localStorage`. */
export const pendingSizeTokenPrefix = ({ projectId, designSystemId, tenantId }: SizeTokenContext) =>
    `ds_pending_size_tokens:${projectId}:${designSystemId}:${tenantId}:`;

const isCommand = (value: unknown): value is SizeTokenCommand => {
    const command = value as Partial<SizeTokenCommand> | null;
    return Boolean(
        command &&
        typeof command.id === 'string' &&
        typeof command.path === 'string' &&
        ['PUT', 'POST', 'DELETE'].includes(command.method ?? '') &&
        ['update', 'create', 'delete'].includes(command.operation ?? ''),
    );
};

/**
 * Неподтверждённые команды `size-tokens` темы в `localStorage`. Без хранилища браузера очередь работает в памяти:
 * команда не переживёт закрытие страницы, но правки текущей страницы сохраняются.
 */
export const createLocalPendingSizeTokenCommands = (context: SizeTokenContext): PendingSizeTokenCommands => {
    const prefix = pendingSizeTokenPrefix(context);
    return {
        save(key, command) {
            try {
                localStorage.setItem(prefix + key, JSON.stringify(command));
            } catch {
                // Хранилище недоступно или заполнено: команда останется только в очереди страницы.
            }
        },
        remove(key, commandId) {
            try {
                if (commandId) {
                    const stored = JSON.parse(localStorage.getItem(prefix + key) ?? 'null') as SizeTokenCommand | null;
                    if (stored && stored.id !== commandId) return;
                }
                localStorage.removeItem(prefix + key);
            } catch {
                // Подтверждённое состояние сервера главнее записи хранилища.
            }
        },
        list() {
            const result: Array<{ key: string; command: SizeTokenCommand }> = [];
            try {
                const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(
                    (key): key is string => Boolean(key?.startsWith(prefix)),
                );
                keys.forEach((storageKey) => {
                    let command: unknown = null;
                    try {
                        command = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
                    } catch {
                        command = null;
                    }
                    if (isCommand(command)) result.push({ key: storageKey.slice(prefix.length), command });
                    // Повреждённая запись не должна мешать остальным повторам.
                    else localStorage.removeItem(storageKey);
                });
            } catch {
                return result;
            }
            return result;
        },
    };
};
