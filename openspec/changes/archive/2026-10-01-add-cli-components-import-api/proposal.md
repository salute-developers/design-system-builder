## Why

Глобальный слой компонентной модели `db-service` (`components`, `states`, `properties`, алиасы `property_platform_params`, привязка к дизайн-системе) заполняет единственный инструмент — shell-скрипт `backend-kt/scripts/import-uikit-api-meta.sh`. У него три недостатка:

- он читает `uikit-api-meta.json` по пути внутри рабочей копии `plasma-android`, которой у пользователя CLI нет; генератор стилей берёт ту же метаданную из артефакта uikit, от которого зависит проект, и импорт должен идти оттуда же, иначе база расходится с тем, что построит генератор;
- он делает порядка `4 + C·(2 + S) + P·(1..3)` последовательных HTTP-запросов (`C` — компоненты, `S` — состояния, `P` — свойства; для Compose это 79 компонентов и 1263 свойства), из-за чего ему нужны `--request-delay-ms` и повторные прогоны при обрывах;
- он живёт вне CLI: своя авторизация, свои коды выхода, зависимость от `jq` и `curl`, дублирование списка типов свойств из `propertyTypeEnum` (расхождение видно только по `skippedParams`).

`components push` уже требует, чтобы этот слой существовал: неизвестные свойства и состояния попадают в отчёт как `unknownProperties` и `unknownStates`. Заводить слой нужно тем же инструментом, которым пользуются остальные операции.

## What Changes

- **frontend-kt**: команда `dsbuilder components import-api` (dry run по умолчанию, `--apply` для записи). Платформа берётся из `.sdds/config.json`, `--platform` переопределяет. В первой версии поддержана только `compose`; для остальных платформ команда отказывает понятным сообщением.
- **frontend-kt**: capability `API_META` в контракте платформенных делегатов. Делегат `android` для `compose` запускает Gradle-задачу `readUikitComposeApiMeta` плагина `dsBuilder`, которая достаёт `uikit-compose-api-meta.json` из артефакта uikit на classpath проекта. CLI читает готовый файл и сам его нормализует.
- **frontend-kt**: нормализатор меты Compose в манифест (дедупликация по `(component, id)`, описание без `group`, состояния из `stateEnum`) и порт `ApiMetaSource`, за которым позже встанут View и iOS.
- **js/db-service**: ручка `POST /api/projects/{projectId}/ds/component-config/import-api-meta`. Принимает манифест целиком одним запросом, пишет в одной транзакции, поддерживает `dryRun` через откат. Запись аддитивная: создаёт компоненты, свойства, состояния, алиасы и привязку к дизайн-системе, существующие строки не меняет. Права — `components:write`.
- **backend-kt**: удалить `scripts/import-uikit-api-meta.sh`; обновить упоминания в `openspec/config.yaml`, `js/CLAUDE.md`, `js/services/db-service/src/test/fixtures.ts`.
- Расхождение типа существующего свойства не приводит к `PATCH`, как в скрипте: оно попадает в отчёт как `typeMismatches`. Это **BREAKING** для тех, кто полагался на то, что скрипт правит тип свойства.

Не входит: платформы `android-view`, `swiftui`, `react` (порт готов, нормализаторы — отдельными change, включая проверку, что импорт View и Compose даёт согласованный результат в БД); поле `values` у свойств типа `value`; подсказка в отчёте `components push`; изменение схемы БД и миграции.

## Capabilities

### New Capabilities
- `component-api-meta-import`: манифест API-меты компонентов, ручка `import-api-meta` в `db-service`, правила аддитивной записи в глобальный слой и отчёт.

### Modified Capabilities
- `cli-components`: команда `components import-api`, её контракт с backend, dry run, явный API URL, нормализация меты Compose.
- `cli-platform-delegates`: capability `API_META` в контракте делегата.
- `platform-android-delegate`: запуск `readUikitComposeApiMeta` для `compose` и чтение результата по соглашению плагина.

## Impact

- **frontend-kt**: `core-platform` (capability `API_META`), `platform-android` (`AndroidGradleDelegate`, карта задач), `feature-components` (домен манифеста и нормализатор, use case, порт и HTTP-адаптер, DI), `cli` (`ComponentsImportApiCliCommand`, регистрация в `ComponentsCliCommand`), тесты во всех этих модулях.
- **js/db-service**: новый роутер рядом с `component-config-import.ts`, функция записи в `src/db/import/`, zod-схема запроса, описание в `openapi/spec.ts`, регенерация типов админки (`/sync-all`), тесты `vitest`. Миграции не нужны: уникальные индексы `components_name_unique`, `properties_component_id_name_unique`, `states_component_id_name_unique`, `ppp_property_id_platform_name_unique` уже есть.
- **backend-kt**: удаление скрипта; gateway и `projects-service` не меняются, потому что путь `/api/projects/{projectId}/ds/...` и scope `components:write` уже существуют.
- **Конфигурация**: новых переменных окружения нет. Команда использует `DSBUILDER_API_URL` и ключ проекта так же, как `components push`.
- **Зависимость от plasma-android**: у проекта пользователя должен быть применён плагин `dsBuilder` с секцией `components`, как для `components generate`.
