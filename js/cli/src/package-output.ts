import { cp, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateBaseFileStructure } from './generator/generate.ts';
import { CORE_VERSION } from './generator/utils/index.ts';

export { CORE_VERSION };

export const cliDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Префикс временного каталога сборки в системном `tmpdir`. */
export const TEMPORARY_PREFIX = 'dsbuilder-web-build-';

/** Служебное имя временного пакета, когда собираются только исходники. */
const SOURCES_ONLY_PACKAGE_NAME = 'design-system';

/** Часть пакета дизайн-системы: тема или компоненты. */
export type PackagePart = 'theme' | 'components';

export interface PackagePartOptions {
    /** Части, которые генерирует команда: одна у `generate:theme`/`generate:components`, обе у `generate:ds`. */
    parts: PackagePart[];
    /** Каталог результата; в нём заменяются только свои части. */
    outputDirectory: string;
    /** Имя пакета из `--name`; обязательно только для `--package`: на исходники `src` оно не влияет. */
    packageName?: string;
    packageVersion: string;
    coreVersion: string;
    /** Записать всю папку пакета (`package.json`, конфиги сборки, `src`) вместо исходников частей. */
    pack: boolean;
    /**
     * Пишет свои части в `src` временного пакета. `hasTheme` — будет ли в результате тема: своя часть `theme`
     * или, без `--package`, уже лежащая в `output` тема, которую команда не заменяет.
     */
    fill: (pathToDir: string, context: { hasTheme: boolean }) => Promise<void>;
}

/**
 * Генерирует части пакета и кладёт результат в `output`.
 *
 * Пакет целиком собирается во временном каталоге `dsbuilder-web-build-*` системного `tmpdir`: каталог
 * установленного генератора может быть недоступен для записи. Без `pack` в `output`
 * попадают только исходники частей (`src/theme`, `src/components` и корневой индекс), остальные части
 * не трогаются. С `pack` — вся папка пакета без сборки: файлы заготовки и `package.json` перезаписываются,
 * `src` заменяется целиком, прочее содержимое `output` (например, `node_modules`) остаётся.
 */
export async function writePackagePart(options: PackagePartOptions): Promise<string> {
    const { parts, outputDirectory, pack } = options;
    if (pack && !options.packageName) {
        throw new Error('--name is required with --package: it is the name of the published package.');
    }
    const pathToDir = await mkdtemp(join(tmpdir(), TEMPORARY_PREFIX));
    try {
        await generateBaseFileStructure({
            pathToDir,
            // Без `--package` имя попадает только во временный package.json и в результат не выходит.
            packageName: options.packageName ?? SOURCES_ONLY_PACKAGE_NAME,
            packageVersion: options.packageVersion,
            coreVersion: options.coreVersion,
            hasComponents: parts.includes('components'),
            hasTheme: parts.includes('theme'),
        });
        const hasTheme = parts.includes('theme') || (!pack && (await isDirectory(join(outputDirectory, 'src', 'theme'))));
        await options.fill(pathToDir, { hasTheme });
        // Генератор пишет индекс со ссылкой на тему всегда; в пакете из одной части её может не быть.
        await writeRootIndex(join(pathToDir, 'src'));

        if (pack) {
            await mkdir(outputDirectory, { recursive: true });
            // `src` пакета — ровно сгенерированные части: старые части рядом с новым package.json не нужны.
            await rm(join(outputDirectory, 'src'), { recursive: true, force: true });
            await cp(pathToDir, outputDirectory, { recursive: true });
            return outputDirectory;
        }

        const sourceDirectory = join(outputDirectory, 'src');
        await mkdir(sourceDirectory, { recursive: true });
        for (const part of parts) {
            const partDirectory = join(sourceDirectory, part);
            await rm(partDirectory, { recursive: true, force: true });
            await cp(join(pathToDir, 'src', part), partDirectory, { recursive: true });
        }
        await writeRootIndex(sourceDirectory);
        return parts.length === 1 ? join(sourceDirectory, parts[0]) : sourceDirectory;
    } finally {
        await rm(pathToDir, { recursive: true, force: true });
    }
}

const isDirectory = async (path: string) => (await stat(path).catch(() => null))?.isDirectory() ?? false;

/**
 * Компоненты ядра, которые sdds-serv реэкспортирует без конфига темы и которые не заводятся в ДС: `SSRProvider`
 * (имя `ssr-provider` не восстанавливается в `SSRProvider`). Корневой индекс пакета с компонентами реэкспортирует их.
 */
export const CORE_REEXPORTS = ['SSRProvider'];

/**
 * Корневой индекс по фактическому содержимому `src`, в формате генератора: экспорт каждого
 * компонента верхнего уровня (дочерние лежат в папке родителя) и темы, если они есть.
 */
async function writeRootIndex(sourceDirectory: string): Promise<void> {
    const componentsDirectory = join(sourceDirectory, 'components');
    const components = (await isDirectory(componentsDirectory))
        ? (await readdir(componentsDirectory, { withFileTypes: true }))
              .filter((entry) => entry.isDirectory())
              .map((entry) => entry.name)
              .sort()
        : [];
    const hasTheme = await isDirectory(join(sourceDirectory, 'theme'));

    const blocks = [
        components.map((name) => `export * from './components/${name}';`).join('\n'),
        components.length > 0 ? `export { ${CORE_REEXPORTS.join(', ')} } from '@salutejs/plasma-new-hope/styled-components';` : '',
        hasTheme ? "export * from './theme';" : '',
    ].filter(Boolean);
    await writeFile(join(sourceDirectory, 'index.ts'), blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '');
}
