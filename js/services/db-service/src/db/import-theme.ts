/**
 * Импорт токенов темы из репозитория theme-converter в БД: дизайн-система, tenant, токены и их
 * значения по платформам и режимам. Читает распакованную тему (`meta.json` и
 * `<platform>/<platform>_<type>.json`), то же самое, что `dsbuilder theme fetch` кладёт на диск.
 *
 * Usage:
 *   npx tsx src/db/import-theme.ts --dir=<распакованная тема> [--library=sdds_serv] [--tenant=<имя>]
 *
 * Модель: у токена нет режима в имени (`text.default.primary`), а значение хранится по
 * (tenant, platform, mode). В файлах темы режим — префикс `light.` / `dark.` у ключа. Значение
 * цвета вида `[general.amber.300]` (с необязательной непрозрачностью `[0.56]`) — ссылка на палитру,
 * она пишется как `palette_id` (палитра должна быть засеяна: `seed-prod`).
 *
 * Повторный запуск идемпотентен: дизайн-система, tenant и токены обновляются по имени, значения
 * tenant пересоздаются целиком. Вся запись — одна транзакция (см. `import/themeImport.ts`).
 */
import { db, client } from './index';
import { importTheme } from './import/themeImport';

const arg = (name: string) =>
    process.argv
        .find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3)
        .replace(/^["']|["']$/g, '');

const dir = arg('dir');
const library = arg('library') ?? 'sdds_serv';
const tenantName = arg('tenant') ?? library;

if (!dir) {
    console.error('Usage: npx tsx src/db/import-theme.ts --dir=<распакованная тема> [--library=sdds_serv] [--tenant=<имя>]');
    process.exit(2);
}

importTheme(db, { dir, library, tenantName }, console.log)
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => client.end());
