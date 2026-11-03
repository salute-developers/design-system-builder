import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Модуль запущен напрямую (`tsx src/theme.ts` из `npm run generate:*`), а не импортирован
 * исполняемым файлом `dsbuilder-web-generator`. Пути сравниваются после разрешения ссылок:
 * глобальная установка npm запускает генератор через symlink.
 */
export const isEntrypoint = (moduleUrl: string): boolean => {
    const script = process.argv[1];
    if (!script) {
        return false;
    }
    try {
        return realpathSync(resolve(script)) === realpathSync(fileURLToPath(moduleUrl));
    } catch {
        return false;
    }
};
