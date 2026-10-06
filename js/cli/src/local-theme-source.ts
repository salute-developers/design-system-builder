import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

interface LocalConfig {
    tenants: { name: string; directoryPath?: string }[];
    palettePath?: string;
}

/**
 * Читает config.json и возвращает абсолютные пути к метаданным темы, палитре и web-вариациям.
 * Без tenantName выбирает единственный tenant; при нескольких требует явного выбора.
 */
export async function resolveLocalThemePaths(sddsDirectory: string, tenantName?: string) {
    const configPath = join(sddsDirectory, 'config.json');
    const config = JSON.parse(await readFile(configPath, 'utf8')) as LocalConfig;
    if (!Array.isArray(config.tenants) || config.tenants.length === 0) {
        throw new Error(`No tenants configured in ${configPath}.`);
    }
    if (!tenantName && config.tenants.length > 1) {
        throw new Error(`Choose --tenant from: ${config.tenants.map(({ name }) => name).join(', ')}.`);
    }
    const tenant = tenantName
        ? config.tenants.find(({ name }) => name === tenantName)
        : config.tenants[0];
    if (!tenant) {
        throw new Error(`Unknown tenant "${tenantName}" in ${configPath}.`);
    }

    // Пути с префиксом .sdds/ привязываем к выбранному каталогу --sdds, чтобы данные
    // можно было переносить. Остальные относительные пути считаем от его родителя.
    const resolveConfigPath = (path: string) => {
        const portablePath = path.replace(/^\.\//, '');
        return portablePath.startsWith('.sdds/')
            ? resolve(sddsDirectory, portablePath.slice('.sdds/'.length))
            : resolve(dirname(sddsDirectory), path);
    };
    const tenantDirectory = tenant.directoryPath
        ? resolveConfigPath(tenant.directoryPath)
        : join(sddsDirectory, 'tenants', tenant.name);
    return {
        meta: join(tenantDirectory, 'meta.json'),
        palette: config.palettePath
            ? resolveConfigPath(config.palettePath)
            : join(sddsDirectory, 'tenants', 'palette.json'),
        variations: join(tenantDirectory, 'web'),
    };
}
