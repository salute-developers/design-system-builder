import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const cliDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Генератор использует CommonJS: подключаем его из ES-модуля через require с обработчиком TypeScript от tsx.
const require = createRequire(import.meta.url);
const { generateBaseFileStructure } =
    require('../../services/generator/app/generate.ts') as typeof import('../../services/generator/app/generate.ts');
export const { CORE_VERSION } =
    require('../../services/generator/app/utils/index.ts') as typeof import('../../services/generator/app/utils/index.ts');

// pacote — зависимость генератора, у CLI своей нет: разрешаем его из пакета генератора.
const generatorDirectory = resolve(cliDirectory, '..', 'services', 'generator');
const generatorRequire = createRequire(join(generatorDirectory, 'package.json'));
const pacote = generatorRequire('pacote') as { tarball(spec: string): Promise<Buffer> };

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
    /** Собрать пакет и записать `.tgz` вместо исходников. */
    pack: boolean;
    /** Пишет свои части в `src` временного пакета. */
    fill: (pathToDir: string) => Promise<void>;
}

/**
 * Генерирует части пакета и кладёт результат в `output`, не трогая остальные части.
 *
 * Пакет целиком собирается во временном каталоге: в `output` попадают только исходники частей
 * (`src/theme`, `src/components` и корневой индекс) или архив. Каталог лежит внутри сервиса
 * генерации, как его `result-*`: скрипты пакета берут eslint из `../node_modules`.
 */
export async function writePackagePart(options: PackagePartOptions): Promise<string> {
    const { parts, outputDirectory, pack } = options;
    if (pack && !options.packageName) {
        throw new Error('--name is required with --package: it is the name of the published package.');
    }
    const pathToDir = await mkdtemp(join(generatorDirectory, 'result-cli-'));
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
        await options.fill(pathToDir);
        // Генератор пишет индекс со ссылкой на тему всегда; в пакете из одной части её может не быть.
        await writeRootIndex(join(pathToDir, 'src'));

        if (pack) {
            const { fileName, tarball } = await packTarball(pathToDir, parts);
            const tarballPath = join(outputDirectory, fileName);
            await mkdir(outputDirectory, { recursive: true });
            await writeFile(tarballPath, tarball);
            return tarballPath;
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
        hasTheme ? "export * from './theme';" : '',
    ].filter(Boolean);
    await writeFile(join(sourceDirectory, 'index.ts'), blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '');
}

/**
 * Собирает пакет и упаковывает его так же, как сервис генерации: pacote запускает `prepare`
 * (установку зависимостей и `npm run build`) и складывает файлы из `files` package.json.
 * Имя архива — как у `npm pack`: `@scope/name@1.0.0` → `scope-name-1.0.0.tgz`; у пакета из одной части —
 * с её суффиксом (`…-theme.tgz`). Имя самого пакета не меняется, суффикс нужен, чтобы архивы частей не
 * перезаписывали друг друга и полный пакет.
 */
async function packTarball(pathToDir: string, parts: PackagePart[]): Promise<{ fileName: string; tarball: Buffer }> {
    const { name, version } = JSON.parse(await readFile(join(pathToDir, 'package.json'), 'utf8')) as {
        name: string;
        version: string;
    };
    try {
        const tarball = await pacote.tarball(pathToDir);
        const suffix = parts.length === 1 ? `-${parts[0]}` : '';
        return { fileName: `${name.replace(/^@/, '').replace('/', '-')}-${version}${suffix}.tgz`, tarball };
    } catch (error) {
        // pacote гасит вывод `npm run build`; без stderr причина сборки не видна.
        const { stdout, stderr } = error as { stdout?: string; stderr?: string };
        console.error(stderr || stdout || '');
        throw error;
    }
}
