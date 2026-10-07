## Why

Все возможности ветки `feat/cli-components-import-api` должны жить в Kotlin-сервисе `ds-service`: `db-service` выводится из эксплуатации. Платформы компонентов, `deprecated` и `push`/`fetch` уже перенесены, но административная ручка импорта API-меты (`import-api-meta`) осталась в `db-service`, и без неё глобальный слой нельзя наполнить после отключения старого сервиса.

## What Changes

- `ds-service` получает административный маршрут `POST /api/ds/admin/component-config/import-api-meta` с той же семантикой, что у реализации в `db-service`: аддитивная запись по паре `(name, platform)`, dry run через откат транзакции, статус устаревания алиасов (поставить, сменить сообщение, снять), `typeMismatches`, `rejected`, справочный `absent`, запись в журнал без дизайн-системы.
- Доступ только у доверенного системного администратора; роль проверяется до разбора тела.
- Gateway (local и prod) направляет точный путь `/api/admin/component-config/import-api-meta` в `ds-service` (токен пользователя, служебный проект `global`, лимит тела 16m); остальные `/api/admin/**` остаются в `db-service`.
- Реализация и тесты импорта удаляются из `db-service`; OpenAPI админ-приложения перегенерирован. Контракт для CLI не меняется: путь, тело и отчёт прежние.

## Capabilities

### New Capabilities

### Modified Capabilities

- `component-api-meta-import`: импорт обслуживает `ds-service`, проверка роли выполняется в нём, Gateway передаёт служебный проект.
- `design-system-model-api`: административный импорт API-меты — исключение из списка маршрутов, которые `ds-service` не реализует; Gateway-маршрутизация `/api/admin/**` получает точное исключение.

## Impact

- `backend-kt/ds-service/feature-components`: новые `ImportApiMeta*`, `ApiMetaRepository`, `ExposedApiMetaRepository`, маршрут `apiMetaImportRoutes`; регистрация в `ComponentsModule` и `Application`.
- `backend-kt/identity-gateway/gateway`: `nginx.local.conf`, `nginx.prod.conf.template`, `test-route-namespaces.sh`.
- `js/services/db-service`: удалены `apiMetaImport.ts`, `apiMetaManifest.ts`, маршрут и тесты; `openapi/spec.ts`; `js/apps/admin/src/api/*` перегенерированы.
- `frontend-kt` не меняется.
