# Proposal

## Why

Локальная генерация в `js/cli` писала пакет в `output/components` вместе с конфигурацией сборки,
а собранный пакет получить было нельзя: только исходники. Отдельная команда `generate:theme`
дублировала тему, которую и так генерирует `generate:components`, и нигде не использовалась.

## What Changes

- Удаляется `npm run generate:theme` вместе с `src/index.ts` и `writeThemeSourceModules`:
  тема генерируется внутри `generate:components`.
- `generate:components` заменяет `js/cli/output` целиком при каждом запуске:
  - без флагов — только исходники `output/src`;
  - с `--package` — собранный пакет `output/<scope>-<name>-<version>.tgz`, как у `npm pack`.
- Пакет собирается во временном каталоге `services/generator/result-cli-*`, как в сервисе генерации:
  скрипты пакета берут eslint из `../node_modules` генератора. Архив собирает pacote (зависимости
  и `npm run build`), каталог удаляется и при ошибке; stderr сборки печатается.
- `js/.env` загружает только `generate:components` (нужен `NPM_PACKAGE_SCOPE`).

## Impact

- `js/cli`: `package.json`, `src/components.ts`, `src/theme-source.ts`, удалён `src/index.ts`, README.
- Спецификация `local-web-generation`.
