#!/usr/bin/env node
// Исполняемый файл npm-пакета web-генератора: `dsbuilder-web-generator <theme|components|ds|api-meta|manifests> [options]`.
// Генератор написан на TypeScript и запускается через загрузчик tsx, как `npm run generate:*` в репозитории.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { register } from 'tsx/esm/api';

// `data: true` — команда выгружает данные пакета в файл `--out` и не получает умолчаний `--sdds`/`--out`.
const COMMANDS = {
    theme: { module: '../src/theme.ts', subject: 'theme' },
    components: { module: '../src/components.ts', subject: 'components' },
    ds: { module: '../src/ds.ts', subject: 'the design system' },
    'api-meta': { module: '../src/generate-api-meta.ts', subject: 'the web API meta', data: true },
    manifests: { module: '../src/component-manifests.ts', subject: 'the component manifests', data: true },
};

const USAGE = `Usage: dsbuilder-web-generator <command> [options]

Commands:
  theme        Generate the theme (src/theme) or a theme-only package with --package
  components   Generate the components (src/components) or a components-only package with --package
  ds           Generate the whole design system or the full package with --package
  api-meta     Write the web API meta of @salutejs/plasma-new-hope installed in the current directory
               (--out <file> required; --package <name> for another components package)
  manifests    Write the component manifests of the generator as one JSON (--out <file> required)

Run dsbuilder-web-generator <command> --help for the options of a command.
By default the data is read from ./.sdds and the result is written to ./output of the current directory.
NPM_PACKAGE_SCOPE sets the scope of the generated package (default: @sddsjs).`;

/**
 * Умолчания `--sdds` и `--out` в модулях генератора указывают на его собственный каталог (так удобно в
 * репозитории); для установленной команды данные и результат лежат в текущем каталоге.
 */
const withWorkingDirectoryDefaults = (args) => {
    const given = (name) => args.some((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
    return [
        ...(given('sdds') ? [] : ['--sdds', join(process.cwd(), '.sdds')]),
        ...(given('out') ? [] : ['--out', join(process.cwd(), 'output')]),
        ...args,
    ];
};

/** `--out` обязателен; у `api-meta` пакет компонентов по умолчанию — ядро plasma. */
const dataCommandArgs = (command, args) => {
    const given = (name) => args.some((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
    if (!given('out') && !given('help') && !args.includes('-h')) {
        throw new Error(`${command}: --out <file> is required.`);
    }
    return command === 'api-meta' && !given('package') && !given('source')
        ? ['--package', '@salutejs/plasma-new-hope', ...args]
        : args;
};

const [command, ...args] = process.argv.slice(2);

if (command === '--version' || command === '-v') {
    const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    console.log(version);
} else if (command === '--help' || command === '-h') {
    console.log(USAGE);
} else if (!Object.hasOwn(COMMANDS, command ?? '')) {
    console.error(command ? `Unknown command: ${command}\n\n${USAGE}` : USAGE);
    process.exitCode = 2;
} else {
    const { module, subject, data } = COMMANDS[command];
    register();
    try {
        const { main } = await import(module);
        await main(data ? dataCommandArgs(command, args) : withWorkingDirectoryDefaults(args));
    } catch (error) {
        console.error(`Failed to generate ${subject}:`, error);
        process.exitCode = 1;
    }
}
