## 1. Backend Client и DTO

- [x] 1.1 Найти текущие remote DTO и backend client для `theme fetch` в `dsbuilder-frontend/cli`.
- [x] 1.2 Добавить DTO `PaletteItem` с полями `id`, `type`, `shade`, `saturation`, `value`, `createdAt`, `updatedAt`.
- [x] 1.3 Добавить client method для `GET /api/projects/{projectId}/ds/palette` с тем же authenticated project request foundation.
- [x] 1.4 Покрыть parsing success и parsing failure для palette response.

## 2. Domain/Application Flow

- [x] 2.1 Добавить domain/application модель локальной palette projection без Ktor или filesystem типов.
- [x] 2.2 Расширить `theme fetch` flow загрузкой palette вместе с tenants, tokens и token values.
- [x] 2.3 Реализовать преобразование `PaletteItem` array в object `{ "$shade": { "$saturation": "$value" } }`.
- [x] 2.4 Зафиксировать deterministic behavior для duplicate `shade` и `saturation`: последнее значение из response order побеждает.
- [x] 2.5 Убедиться, что ошибка загрузки, парсинга или преобразования palette прерывает весь fetch до записи локальных artifacts.

## 3. Local Files и Config

- [x] 3.1 Расширить `.sdds/config.json` model optional top-level полем `palettePath`.
- [x] 3.2 Сохранить обратную совместимость чтения config без `palettePath`.
- [x] 3.3 Обновить local theme writer, чтобы он создавал `.sdds/tenants` и писал `.sdds/tenants/palette.json`.
- [x] 3.4 Обновить запись `.sdds/config.json`, чтобы successful `theme fetch` сохранял `palettePath = ".sdds/tenants/palette.json"`.
- [x] 3.5 Проверить, что `theme fetch` не сохраняет raw API key, runtime `--api-url` или другие secrets в config.
- [x] 3.6 Сохранить atomic write behavior для palette, tenant files и config updates.

## 4. Tests

- [x] 4.1 Добавить unit tests для palette transformation: grouping by `shade`, string key для `saturation`, duplicate handling.
- [x] 4.2 Добавить tests для successful `theme fetch`, который пишет `.sdds/tenants/palette.json` и `palettePath`.
- [x] 4.3 Добавить tests для failed palette response: нет partial `palette.json`, tenant files и config updates.
- [x] 4.4 Обновить existing CLI tests, fixtures и expected JSON snapshots под новый optional `palettePath`.
- [x] 4.5 Проверить, что alias commands и config parsing продолжают работать с config, где `palettePath` отсутствует или присутствует.

## 5. Verification

- [x] 5.1 Запустить `cd dsbuilder-frontend/cli && ./gradlew test`.
- [x] 5.2 Запустить `cd dsbuilder-frontend/cli && ./gradlew spotlessCheck`.
- [x] 5.3 Запустить `cd dsbuilder-frontend/cli && ./gradlew detekt`.
- [x] 5.4 Если `spotlessCheck` падает только из-за форматирования измененных файлов, запустить `cd dsbuilder-frontend/cli && ./gradlew spotlessApply`, проверить diff и повторить проверки.
- [x] 5.5 При широких изменениях CLI flow запустить `cd dsbuilder-frontend/cli && ./gradlew build`.
