# Proposal

## Why

`dsbuilder components generate --platform react` сейчас отказывает: в реестре делегатов есть только
iOS (Swift CLI) и Android (Gradle), React никто не обслуживает. Web-генерация живёт отдельно в `js/cli`
(`npm run generate:components`), и её приходится запускать вручную. Нужно, чтобы общий CLI запускал её
так же, как инструменты других платформ.

## What Changes

- В `js/cli` генерация делится на две независимые команды, как у Android (`generateComposeTheme` /
  `generateComposeComponents`):
  - возвращается `npm run generate:theme` — генерирует только тему (`src/theme`);
  - `npm run generate:components` генерирует только компоненты (`src/components`), тему не создаёт.
  Обе принимают `--sdds`, `--out <dir>` и `--package` и не трогают результат друг друга.
- Генератор пакета (`services/generator`): `createPackageJSON` получает `hasTheme` для пакета без темы.
- Новый модуль `frontend-kt/platform-web` с делегатом платформы `REACT` по контракту `PlatformDelegate`:
  - `THEME` → `npm run generate:theme -- --sdds <workspace>/.sdds [--out <output>] <passthrough>`;
  - `COMPONENTS` → `npm run generate:components -- --sdds <workspace>/.sdds [--out <output>] <passthrough>`;
  - `--package` и прочие аргументы передаются как есть; `doctor` проверяет `node`/`npm` и инструмент.
- Инструмент находится по пути к каталогу `js/cli` (вариант «а»): `--tool <path>` или переменная
  окружения `DSBUILDER_WEB_TOOL`. Установщика нет: это режим разработки, рядом с репозиторием.
- Регистрация: `settings.gradle.kts`, зависимость `:cli`, Koin-модуль делегата, строка в
  `PlatformDelegatesModule.kt`.

## Decisions

1. **Общий `output`.** Каждая команда заменяет только свою часть: `generate:theme` — `src/theme`,
   `generate:components` — `src/components`. Результат другой команды остаётся.
2. **`src/index.ts`** собирается по фактическому содержимому `src`: экспорт `./theme` — только если тема
   есть, экспорты компонентов — только если есть компоненты.
3. **`--package` у каждой команды собирает свой пакет**: только тема или только компоненты.
   - Пакет темы генератор уже умеет (`hasComponents: false`).
   - Для пакета компонентов в `createPackageJSON` добавляется `hasTheme` (по умолчанию `true`, поведение
     сервиса не меняется): без темы пропускаются `copy-css-files` и `css` в `files`. Остальная сборка
     (копия `src` для linaria, rollup, babel, typings) работает по содержимому `src`.
   - Имя пакета не делится: как и раньше, из метаданных темы или `--ds-name`. Чтобы архивы не
     перезаписывали друг друга в `output`, суффикс получает только имя файла:
     `<scope>-<name>-<version>-theme.tgz` и `…-components.tgz`.
   - Пакет компонентов не тянет тему: CSS-переменные темы приложение подключает отдельным пакетом.

## Web-маппинги на каждый запуск

`generate:components` больше не читает `.sdds/web/web-api-meta.json`: маппинги Style API собираются на
каждый запуск из `@salutejs/plasma-new-hope`, установленного в `js/cli`, тем же кодом, что и
`generate:api-meta` (`buildApiMeta`). Так они всегда соответствуют установленной версии пакета, а
ручного шага нет. `generate:api-meta` остаётся отдельным инструментом для выгрузки файла.

## Out of Scope

- Вариант «б»: npm-пакет `js/cli` с бинарником и установщик через `ToolchainInstaller` — отдельной задачей.
