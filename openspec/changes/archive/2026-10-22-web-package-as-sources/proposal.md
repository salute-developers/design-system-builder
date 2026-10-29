## Зачем

`--package` у `generate:theme`, `generate:components` и `generate:ds` собирает пакет и отдаёт только
`.tgz`. Командам нужна сама папка пакета — `package.json`, конфиги сборки и `src`, — чтобы собрать,
поправить и опубликовать её своим конвейером.

## Что меняется

- С `--package` в `--out` пишется вся папка пакета без сборки и без архива: файлы заготовки и
  `package.json` перезаписываются, `src` заменяется целиком, прочее содержимое каталога остаётся.
- Сборка папки остаётся в окружении `js/cli`: скрипты пакета, как и раньше, берут инструменты
  из `js/cli/node_modules`; `lint` вызывает `eslint` из `PATH`, а не по пути `../node_modules`.
- Пакет из одной темы собирается из терминала: `copy-linaria-components.sh` не ищет компоненты
  без `src/components` и не вызывает `perl` без файлов.
- Зависимость `pacote` и `@types/pacote` из `js/cli` удаляется.

## Возможности

### Новые возможности

Нет.

### Изменяемые возможности

- `local-web-generation`: результат `--package` — папка пакета вместо архива.

## Влияние

- `js/cli`: `src/package-output.ts`, справка `theme.ts`/`components.ts`/`ds.ts`,
  `generator/creators/createPackageJSON.ts`, `generator/constants/scripts/copy-linaria-components.sh`,
  `package.json`,
  `package-lock.json`, новый тест `src/package-output.test.ts`.
- `frontend-kt`: не меняется, `--package` по-прежнему передаётся после `--`.
