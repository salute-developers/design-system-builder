/* global Buffer, console, process */
// Упаковка web-плагина превью в архив для публикации в ds-service (`dsbuilder preview-plugin publish --platform react`).
//
//   npm run package
//
// 1. Проверяет, что в `js/apps/preview-web-plugin` нет незакоммиченных изменений: `commit` в manifest должен
//    описывать содержимое архива.
// 2. Собирает плагин (`npm run build`).
// 3. Дописывает в `dist/preview-plugin.json` `commit`, `version` (первые 12 символов `commit`) и `apiMetaSha256`
//    (sha256 `dist/api-meta.json`); `public/preview-plugin.json` в Git не меняется.
// 4. Упаковывает `dist` в `local-dev/web-preview/preview-web-plugin.zip` и обновляет блок происхождения архива в
//    `local-dev/README.md` (между `<!-- web-provenance:start -->` и `<!-- web-provenance:end -->`).
//
// `PREVIEW_WEB_PLUGIN_ALLOW_DIRTY=1` пропускает проверку чистоты каталога — только для проверки самой упаковки:
// такой архив не публикуют, а блок происхождения помечает его как собранный с незакоммиченными правками.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import JSZip from 'jszip';

export const MANIFEST_FILE = 'preview-plugin.json';
export const META_FILE = 'api-meta.json';
export const BUILD_ID_LENGTH = 12;
export const ARCHIVE_PATH = 'local-dev/web-preview/preview-web-plugin.zip';
export const PROVENANCE_START = '<!-- web-provenance:start -->';
export const PROVENANCE_END = '<!-- web-provenance:end -->';
/** Блок происхождения Compose-архива: блок web вставляется сразу после него. */
const COMPOSE_PROVENANCE_END = '<!-- provenance:end -->';

const COMMIT = /^[0-9a-f]{12,40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SEMVER = /^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/;
/** Фиксированное время записей архива: одинаковый `dist` даёт одинаковый zip. */
const ZIP_ENTRY_DATE = new Date('2000-01-01T00:00:00Z');

/** sha256 в нижнем регистре, шестнадцатеричная запись — как `sha256Hex` в ds-service. */
export const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * Дописывает в `<distDir>/preview-plugin.json` `commit`, `version` и `apiMetaSha256`; остальные поля
 * (`plasmaNewHopeVersion`, `components` и т. д.) сохраняются.
 *
 * @returns записанный manifest.
 */
export const enrichManifest = (distDir, commit) => {
    if (!COMMIT.test(commit)) throw new Error(`commit должен быть sha коммита, получено: ${commit}`);
    const manifestPath = join(distDir, MANIFEST_FILE);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const enriched = {
        ...manifest,
        commit,
        version: commit.slice(0, BUILD_ID_LENGTH),
        apiMetaSha256: sha256Hex(readFileSync(join(distDir, META_FILE))),
    };
    writeFileSync(manifestPath, `${JSON.stringify(enriched, null, 4)}\n`);
    return enriched;
};

/** Файлы каталога с путями относительно него через `/`, в стабильном порядке. */
export const listFiles = (dir) => {
    const files = [];
    const walk = (current) => {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) walk(path);
            else if (entry.isFile()) files.push(relative(dir, path).split(sep).join('/'));
        }
    };
    walk(dir);
    return files.sort();
};

/**
 * Проверяет manifest и состав архива по правилам ds-service для платформы `web` (`PluginManifestParser`).
 *
 * @param manifest разобранный `preview-plugin.json`.
 * @param files файлы архива: путь → содержимое.
 * @returns список нарушений; пустой — архив пройдёт проверку при публикации.
 */
export const validateWebManifest = (manifest, files) => {
    const problems = [];
    for (const required of ['index.html', MANIFEST_FILE, META_FILE]) {
        if (!files.has(required)) problems.push(`в архиве нет файла ${required}`);
    }
    if (manifest.schemaVersion !== 1) problems.push('schemaVersion должен быть 1');
    if (manifest.platform !== 'web') problems.push('platform должна быть web');
    if (!Number.isInteger(manifest.protocolVersion) || manifest.protocolVersion < 1) {
        problems.push('protocolVersion должен быть целым числом не меньше 1');
    }
    if (typeof manifest.commit !== 'string' || !COMMIT.test(manifest.commit)) {
        problems.push('commit должен быть sha коммита');
    } else if (manifest.version !== manifest.commit.slice(0, BUILD_ID_LENGTH)) {
        problems.push('version должна равняться первым 12 символам commit');
    }
    if (typeof manifest.plasmaNewHopeVersion !== 'string' || !SEMVER.test(manifest.plasmaNewHopeVersion)) {
        problems.push('plasmaNewHopeVersion должна быть семантической версией');
    }
    if (typeof manifest.apiMetaSha256 !== 'string' || !SHA256.test(manifest.apiMetaSha256)) {
        problems.push('apiMetaSha256 должна быть sha256 в нижнем регистре');
    } else if (files.has(META_FILE) && sha256Hex(files.get(META_FILE)) !== manifest.apiMetaSha256) {
        problems.push(`sha256 файла ${META_FILE} не совпадает с apiMetaSha256`);
    }
    if (typeof manifest.entrypoint !== 'string' || !manifest.entrypoint) {
        problems.push('entrypoint не задана');
    } else if (!files.has(manifest.entrypoint)) {
        problems.push(`файл entrypoint ${manifest.entrypoint} отсутствует в архиве`);
    }
    return problems;
};

/**
 * Упаковывает содержимое `sourceDir` в zip: пути относительно каталога, без общего корня и без записей каталогов.
 *
 * @returns байты архива.
 */
export const zipDirectory = async (sourceDir) => {
    const zip = new JSZip();
    for (const path of listFiles(sourceDir)) {
        zip.file(path, readFileSync(join(sourceDir, path)), { date: ZIP_ENTRY_DATE, createFolders: false });
    }
    return zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
        platform: 'UNIX',
    });
};

/** Строки блока происхождения web-архива для `local-dev/README.md`. */
export const formatProvenance = ({ manifest, archiveSha256, dirty }) =>
    [
        `- Web plugin archive: build \`${manifest.version}\` (commit \`${manifest.commit}\`), ` +
            `plasma-new-hope \`${manifest.plasmaNewHopeVersion}\`, protocol ${manifest.protocolVersion}, ` +
            `sha256 \`${archiveSha256}\`.`,
        `- Web API meta: sha256 \`${manifest.apiMetaSha256}\`; built by \`npm run package\` in \`js/apps/preview-web-plugin\`.`,
        ...(dirty ? ['- Built with uncommitted changes in `js/apps/preview-web-plugin`: do not publish this archive.'] : []),
    ].join('\n');

/**
 * Заменяет содержимое блока `web-provenance`. Без блока он создаётся сразу после блока происхождения Compose
 * (`<!-- provenance:end -->`), а без него — в конце файла; блок Compose не меняется.
 */
export const updateProvenance = (readme, lines) => {
    const block = `${PROVENANCE_START}\n${lines}\n${PROVENANCE_END}`;
    const start = readme.indexOf(PROVENANCE_START);
    const end = readme.indexOf(PROVENANCE_END);
    if (start !== -1 && end > start) {
        return readme.slice(0, start) + block + readme.slice(end + PROVENANCE_END.length);
    }
    const compose = readme.indexOf(COMPOSE_PROVENANCE_END);
    if (compose !== -1) {
        const at = compose + COMPOSE_PROVENANCE_END.length;
        return `${readme.slice(0, at)}\n\n${block}${readme.slice(at)}`;
    }
    return `${readme.replace(/\n*$/, '')}\n\n${block}\n`;
};

const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        stdio: options.inherit ? 'inherit' : 'pipe',
        cwd: options.cwd,
        // `npm` на Windows — `npm.cmd`, его запускает только оболочка.
        shell: process.platform === 'win32',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} завершилась с кодом ${result.status}\n${result.stderr ?? ''}`);
    }
    return (result.stdout ?? '').trimEnd();
};

const main = async () => {
    const pluginDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const repoRoot = run('git', ['rev-parse', '--show-toplevel'], { cwd: pluginDir });
    const allowDirty = process.env.PREVIEW_WEB_PLUGIN_ALLOW_DIRTY === '1';

    const changes = run('git', ['status', '--porcelain', '--', '.'], { cwd: pluginDir });
    if (changes && !allowDirty) {
        console.error(
            'В js/apps/preview-web-plugin есть незакоммиченные изменения:\n' +
                `${changes}\n` +
                'Архив записывает commit исходников в preview-plugin.json, поэтому собирается только из ' +
                'закоммиченного состояния. Закоммитьте или уберите изменения и повторите `npm run package`.',
        );
        process.exit(1);
    }
    if (changes) console.warn('PREVIEW_WEB_PLUGIN_ALLOW_DIRTY=1: архив собирается с незакоммиченными изменениями.');

    run('npm', ['run', 'build'], { cwd: pluginDir, inherit: true });

    const distDir = join(pluginDir, 'dist');
    const commit = run('git', ['rev-parse', 'HEAD'], { cwd: pluginDir });
    const manifest = enrichManifest(distDir, commit);
    const files = new Map(listFiles(distDir).map((path) => [path, readFileSync(join(distDir, path))]));
    const problems = validateWebManifest(manifest, files);
    if (problems.length) throw new Error(`Manifest не пройдёт проверку ds-service:\n- ${problems.join('\n- ')}`);

    const archive = await zipDirectory(distDir);
    const archivePath = join(repoRoot, ARCHIVE_PATH);
    mkdirSync(dirname(archivePath), { recursive: true });
    writeFileSync(archivePath, archive);
    const archiveSha256 = sha256Hex(archive);

    const readmePath = join(repoRoot, 'local-dev/README.md');
    if (existsSync(readmePath)) {
        const lines = formatProvenance({ manifest, archiveSha256, dirty: Boolean(changes) });
        writeFileSync(readmePath, updateProvenance(readFileSync(readmePath, 'utf8'), lines));
    }

    console.log(
        `${ARCHIVE_PATH}: build ${manifest.version}, ${files.size} files, ${Buffer.byteLength(archive)} bytes, ` +
            `sha256 ${archiveSha256}`,
    );
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
}
