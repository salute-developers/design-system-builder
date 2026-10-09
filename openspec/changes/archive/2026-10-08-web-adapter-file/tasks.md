# Tasks

## 1. db-service

- [x] 1.1 `buildWebAdapter` (`db/export/webAdapter.ts`): массив компонентов пакета с `componentName`, `name`, `description`, `compose`, `styles.<style>.templates`; ручка `POST /ds/component-config/web-adapter` вместо `web-meta`.
- [x] 1.2 Тесты `webAdapter.test.ts`; OpenAPI и типы админки перегенерированы.
- [x] 1.3 TODO у `loadPlatformOffsets` в `componentExport.ts`: удалить вместе с поддержкой поправок платформенных параметров.

## 2. Fetch

- [x] 2.1 `WebAdapterFileSource`/`WebAdapterFileWriter`: один файл `.sdds/web/web-adapter.json`, вывод `Web adapter: <path>`.
- [x] 2.2 Тесты use case и CLI; `./gradlew build`.

## 3. Генерация в js/cli

- [x] 3.1 `component-source.ts` читает `web-adapter.json`: имя, описание, compose, шаблоны.
- [x] 3.2 `.env` загружается только скриптом `generate:components` (нужен `NPM_PACKAGE_SCOPE`).
- [x] 3.3 Проверка: пакет, собранный из ответа ручки, совпадает с пакетом из `component-configs.json` по всем 207 файлам, включая описания (с точностью до порядка строк).
