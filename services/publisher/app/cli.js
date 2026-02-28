#!/usr/bin/env node

// CLI-обёртка для publisher.js
// Команды:
//   publisher dry-run <path-to-tgz> [--json]
//   publisher publish <path-to-tgz> --token <NPM_TOKEN> [--json]

const fs = require('fs');
const path = require('path');
const { Command, Option } = require('commander');
const { dryRun, publish } = require('./publisher.js');

function resolveTgz(p) {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) {
    throw new Error(`Файл не найден: ${abs}`);
  }
  if (!abs.endsWith('.tgz')) {
    throw new Error(`Ожидался .tgz архив, получено: ${abs}`);
  }
  return abs;
}

function printAsJsonOrText(obj, asJson) {
  if (asJson) {
    process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
    return;
  }
  if (obj && obj.info) {
    const { name, version } = obj.info;
    console.log(`package: ${name}`);
    console.log(`version: ${version}`);
  }
  if (obj && obj.packageName && obj.version) {
    console.log(`published: ${obj.packageName}@${obj.version}`);
  }
}

async function main(argv) {
  const program = new Command();
  program
    .name('publisher')
    .description('Утилита для dry-run и публикации .tgz пакетов в npm')
    .version('1.0.0');

  program
    .command('dry-run')
    .argument('<tgz>', 'Путь к .tgz архиву')
    .addOption(new Option('--json', 'Вывести результат в JSON').default(false))
    .action(async (tgz, options) => {
      try {
        const tgzPath = resolveTgz(tgz);
        const result = await dryRun(tgzPath);
        printAsJsonOrText(result, options.json);
      } catch (err) {
        console.error(`[dry-run] ${err.message || err}`);
        process.exitCode = 1;
      }
    });

  program
    .command('publish')
    .argument('<tgz>', 'Путь к .tgz архиву')
    .requiredOption('-t, --token <token>', 'NPM токен (или задайте env NPM_TOKEN)', process.env.NPM_TOKEN)
    .addOption(new Option('--json', 'Вывести результат в JSON').default(false))
    .action(async (tgz, options) => {
      try {
        const tgzPath = resolveTgz(tgz);
        const token = options.token || process.env.NPM_TOKEN;
        if (!token) {
          throw new Error('Не указан NPM токен. Передайте --token или установите переменную окружения NPM_TOKEN.');
        }
        const result = await publish(tgzPath, token);
        printAsJsonOrText(result, options.json);
      } catch (err) {
        console.error(`[publish] ${err.message || err}`);
        process.exitCode = 1;
      }
    });

  await program.parseAsync(argv);
}

process.on('unhandledRejection', (e) => {
  console.error('[unhandledRejection]', e && e.message ? e.message : e);
  process.exit(1);
});

main(process.argv);