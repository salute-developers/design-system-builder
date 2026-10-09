# Tasks

## 0. Решения

- [x] 0.1 Общий `output`: каждая команда заменяет только свою часть `src`.
- [x] 0.2 `src/index.ts` по фактическому содержимому `src`.
- [x] 0.3 `--package` собирает отдельный пакет темы или компонентов; имя пакета прежнее, суффикс только у файла архива.

## 1. js/cli

- [x] 1.1 Вернуть `generate:theme`: только тема, `--sdds`, `--out`, `--package`.
- [x] 1.2 `generate:components` без генерации темы.
- [x] 1.3 Опция `--out <dir>` у обеих команд; по умолчанию `js/cli/output`.
- [x] 1.4 Замена только своей части `output`, индекс по содержимому `src`.
- [x] 1.5 `--package`: пакет темы (`hasComponents: false`) и пакет компонентов (`hasTheme: false`), файлы `…-theme.tgz` / `…-components.tgz`.

## 1a. Генератор пакета

- [x] 1a.1 `createPackageJSON`: параметр `hasTheme` (по умолчанию `true`), без темы — без `copy-css-files` и `css` в `files`.
- [x] 1a.2 Проверка сервиса: пакет с темой и компонентами собирается как раньше.

## 2. platform-web

- [x] 2.1 Модуль `platform-web`, делегат платформы `REACT` с `THEME` и `COMPONENTS`.
- [x] 2.2 Поиск инструмента: `--tool`, затем `DSBUILDER_WEB_TOOL`; `doctor` проверяет `node`, `npm` и каталог `js/cli`.
- [x] 2.3 Сборка `ProcessRequest`: рабочий каталог — `js/cli`, скрипт по capability, `--sdds` рабочей копии, `--out` из `--output`, passthrough как есть.
- [x] 2.4 Регистрация в `settings.gradle.kts`, `:cli`, Koin, `PlatformDelegatesModule.kt`.

## 3. Проверка

- [x] 3.1 Тесты argv и `doctor` с фейковым `ProcessRunner`, по образцу iOS.
- [x] 3.2 `./gradlew build`; `dsbuilder theme generate --platform react` и `dsbuilder components generate --platform react [--package]` на рабочей копии.
- [x] 3.3 `USAGE.md`, README `js/cli`, `AGENTS.md`, дельты спецификаций `local-web-generation` и `platform-web-delegate`.

## 4. Web-маппинги на каждый запуск

- [x] 4.1 `generate-api-meta.ts`: логика вынесена в `buildApiMeta`, скрипт запускается только при прямом вызове.
- [x] 4.2 `generate:components` собирает маппинги из установленного `@salutejs/plasma-new-hope` (поиск от каталога `js/cli`) и не читает `web-api-meta.json`.
- [x] 4.3 Проверка: без `web-api-meta.json` компоненты совпадают с генерацией по файлу той же версии (0.383.0); `generate:api-meta` пишет файл как раньше.
- [x] 4.4 Подсказка о ненайденном генераторе называет путь из `DSBUILDER_WEB_TOOL`; пример в `USAGE.md` без конкретного пути.
