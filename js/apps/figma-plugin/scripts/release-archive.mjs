import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const TAG_PREFIX = 'tokens-plugin-v';

const PROD_GATEWAY = 'https://gateway.design-system-builder.ru';
const YANDEX_GATEWAY = 'https://d5dudn29fhuoodkn4tik.iwzqm34r.apigw.yandexcloud.net';

/**
 * Состав архивов релиза. Figma ходит в боевой gateway: его разрешает `networkAccess` манифеста. Pixso ходит через шлюз
 * Yandex Cloud: так плагин работает и в сетях, где домен боевого gateway закрыт.
 */
export const EDITORS = {
    figma: {
        archive: (version) => `ds-builder-tokens-figma-${version}.zip`,
        folder: 'ds-builder-tokens-figma',
        files: [
            ['manifest.json', 'manifest.json'],
            ['dist/code.js', 'dist/code.js'],
            ['dist/ui.html', 'dist/ui.html'],
        ],
        gateway: PROD_GATEWAY,
        install: [
            'Плагин DS Builder Tokens для Figma',
            '',
            'Установка работает только в приложении Figma для компьютера: в браузерной версии нет импорта плагина.',
            '',
            '1. Распакуйте архив в постоянную папку. Не удаляйте и не переносите её: Figma читает плагин из этой папки.',
            '2. Откройте любой файл в приложении Figma.',
            '3. Выберите Plugins → Development → Import plugin from manifest.',
            '4. Укажите manifest.json из распакованной папки.',
            '5. Запускайте плагин из Plugins → Development → DS Builder Tokens.',
            '',
            'Обновление: замените содержимое папки файлами из нового архива. Импортировать плагин заново не нужно.',
        ],
    },
    pixso: {
        archive: (version) => `ds-builder-tokens-pixso-${version}.zip`,
        folder: 'ds-builder-tokens-pixso',
        files: [
            ['dist-pixso/manifest.json', 'manifest.json'],
            ['dist-pixso/code.js', 'code.js'],
            ['dist-pixso/ui.html', 'ui.html'],
        ],
        gateway: YANDEX_GATEWAY,
        install: [
            'Плагин DS Builder Tokens для Pixso',
            '',
            '1. Распакуйте архив в постоянную папку: manifest.json, code.js и ui.html должны лежать рядом.',
            '2. Откройте файл в Pixso.',
            '3. Выберите «Плагины» → «Develop a plugin» → «Upload a plugin».',
            '4. Укажите manifest.json из распакованной папки.',
            '5. Плагин появится на вкладке «Local plugin».',
            '',
            'Обновление: загрузите manifest.json из нового архива тем же способом. Если на вкладке «Local plugin» осталась',
            'прежняя версия, удалите её.',
        ],
    },
};

/** Версия релиза из тега `tokens-plugin-vX.Y.Z`; она должна совпадать с версией `package.json`. */
export const releaseVersion = (tag, packageVersion) => {
    const match = new RegExp(`^${TAG_PREFIX}(\\d+\\.\\d+\\.\\d+)$`).exec(tag);
    if (!match) throw new Error(`Тег «${tag}» не похож на ${TAG_PREFIX}X.Y.Z`);
    if (match[1] !== packageVersion) {
        throw new Error(`Версия тега ${match[1]} не совпадает с версией package.json ${packageVersion}`);
    }
    return match[1];
};

/** Окно плагина ходит в gateway своего редактора и не содержит адресов разработки. */
export const checkWindow = (html, editor) => {
    const { gateway } = EDITORS[editor];
    if (!html.includes(gateway)) throw new Error(`${editor}: окно не обращается к ${gateway}`);
    const other = Object.values(EDITORS)
        .map((item) => item.gateway)
        .find((address) => address !== gateway && html.includes(address));
    if (other) throw new Error(`${editor}: окно обращается к чужому gateway ${other}`);
    for (const address of ['http://localhost:8080', 'https://gateway-dev.design-system-builder.ru']) {
        if (html.includes(address)) throw new Error(`${editor}: окно обращается к адресу разработки ${address}`);
    }
};

/** Манифест указывает на файлы, которые кладутся в архив. */
export const checkManifest = (manifest, editor) => {
    const files = EDITORS[editor].files.map(([, target]) => target);
    for (const field of ['main', 'ui']) {
        if (!files.includes(manifest[field])) throw new Error(`${editor}: ${field} манифеста не найден в архиве`);
    }
};

/** Собирает архив редактора из готовой сборки и возвращает его путь. */
export const packEditor = (root, editor, version, output) => {
    const config = EDITORS[editor];
    const staging = join(output, 'staging', config.folder);
    rmSync(staging, { recursive: true, force: true });
    for (const [source, target] of config.files) {
        const from = resolve(root, source);
        if (!existsSync(from)) throw new Error(`Нет ${source}: сначала соберите плагин для ${editor}`);
        mkdirSync(join(staging, target, '..'), { recursive: true });
        copyFileSync(from, join(staging, target));
    }
    checkManifest(JSON.parse(readFileSync(join(staging, 'manifest.json'), 'utf8')), editor);
    const window = config.files.find(([, target]) => target.endsWith('ui.html'))[1];
    checkWindow(readFileSync(join(staging, window), 'utf8'), editor);
    // Латинское имя файла: кириллица в именах zip искажается при распаковке встроенными средствами Windows.
    writeFileSync(join(staging, 'README.txt'), `${config.install.join('\n')}\n\nВерсия ${version}\n`);
    const archive = resolve(output, config.archive(version));
    rmSync(archive, { force: true });
    execFileSync('zip', ['-r', '-X', '-q', archive, config.folder], { cwd: join(output, 'staging') });
    return archive;
};

if (realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const [command, tag, output = 'release'] = process.argv.slice(2);
        const root = process.cwd();
        const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
        // `version` проверяет тег до сборки: ошибка в теге не должна стоить полной сборки.
        if (command === 'version') console.log(releaseVersion(tag, version));
        else if (EDITORS[command])
            console.log(packEditor(root, command, releaseVersion(tag, version), resolve(root, output)));
        else throw new Error('Использование: release-archive.mjs <version|figma|pixso> <тег> [каталог]');
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
