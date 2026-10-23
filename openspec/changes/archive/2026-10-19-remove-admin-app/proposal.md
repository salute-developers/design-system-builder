## Why

Админка `js/apps/admin` — React-инспектор реестра db-service: просмотр таблиц, схемы, OpenAPI и каталога именованных запросов. Ради неё db-service держит маршруты `/api/admin/tables|queries|schema`, gateway — отдельный блок `/api/admin/**` к db-service, ds-service — группу `admin` в контрактах исключённых маршрутов, а deploy workflow — отдельную сборку и выгрузку статики в S3. Приложение ходит в db-service мимо проектной модели прав и дублирует то, что уже дают клиент, CLI, `/api/openapi.json` и `psql`. DS Builder убирает админку и всё, что существует только ради неё.

## What Changes

- **BREAKING**: удалить приложение `js/apps/admin` вместе с его Dockerfile, конфигурацией Vite, сгенерированным клиентом OpenAPI (`openapi.json`, `types.gen.ts`) и страницами Tables, Queries, Schema, Docs, Settings.
- **BREAKING**: удалить из db-service маршруты `GET /api/admin/tables`, `GET /api/admin/tables/{name}`, `GET /api/admin/queries`, `GET /api/admin/queries/{id}`, `GET /api/admin/schema` (`src/routes/misc/*`), каталог `src/queries/catalog.ts` и раздел Admin в `src/openapi/spec.ts`.
- **BREAKING**: удалить из gateway блок `location ~ ^/api/admin(/.*)?$` к `db_service_api`; точный маршрут `POST /api/admin/component-config/import-api-meta` к ds-service остаётся без изменений.
- Убрать группу `admin` из `excluded-route-groups.json` и упоминание `/api/admin/**` из `consumer-route-audit.json` ds-service.
- Убрать сборку и публикацию админки из `deploy-front-apps-dev.yml`, `deploy-front-apps-prom.yml` и `validate-js.yml`; из `js/package.json` — скрипты `dev:admin` и `build:admin`; из `js/docker-compose.dev.yml` и `js/setup-docker.sh` — сервис `admin`.
- Убрать генерацию OpenAPI-файла в админку: `src/openapi/generate.ts` и скрипт `openapi:gen` db-service удаляются, `differential-runner.ts` читает `spec` из `src/openapi/spec.ts` напрямую.
- Удалить скилл `/sync-api-types`; `/sync-all` заканчивается на `/sync-spec`.
- Обновить документацию (`README.md`, `backend-kt/DEPLOY.md`, `js/README.md`, `js/CLAUDE.md`, `js/docs/component-creation.md`, `backend-kt/identity-gateway/README.md`) и `openspec/config.yaml`.

## Capabilities

### New Capabilities

- Нет.

### Modified Capabilities

- `design-system-model-api`: требования «Исключённые маршруты не входят в Kotlin-сервис» и «Gateway compatibility routing для исключённых API» больше не описывают `/api/admin/**` как маршруты db-service (второе заменяется требованием «Gateway compatibility routing для legacy API»); административный маршрут остаётся один — импорт API-меты в ds-service. Заодно из требования о compatibility routing уходит `saved-queries`: этих маршрутов в db-service уже нет после `remove-admin-ad-hoc-queries`.
- `component-state-model`: требование «State sets are constructed in one place» заменяется на «State sets are resolved through a single endpoint» без упоминания админки; единственный потребитель `POST /ds/state-sets/resolve` — импорт конфигурации компонентов.
- `admin-ad-hoc-queries-removed`: требование «Saved queries и NL query недоступны» заменяется на «Произвольные и административные запросы недоступны» без сценария «Страница Queries». Спека появляется в `openspec/specs` при архивации `remove-admin-ad-hoc-queries`, поэтому тот change архивируется раньше этого.

## Impact

- `js/apps/admin`: удаляется целиком.
- `js/services/db-service`: удалены `src/routes/misc/tables.ts`, `queries.ts`, `schema.ts`, `src/queries/catalog.ts`, `src/openapi/generate.ts`, скрипт `openapi:gen`, монтирование `/admin/*` в `src/routes/index.ts` и раздел Admin в `src/openapi/spec.ts`; `src/test/differential-runner.ts` импортирует `spec`. `GET /api/openapi.json` и `src/queries/theme-previews.ts` остаются.
- `backend-kt/identity-gateway/gateway`: из `nginx.local.conf` и `nginx.prod.conf.template` удалён regex-блок `/api/admin`; `test-route-namespaces.sh` проверяет его отсутствие и прежние свойства точного маршрута `import-api-meta`.
- `backend-kt/ds-service/contracts`: `excluded-route-groups.json` без группы `admin`, `consumer-route-audit.json` без fallback `/api/admin/**`.
- `js/package.json`, `js/docker-compose.dev.yml`, `js/setup-docker.sh`: убраны скрипты, сервис и проверки админки.
- `.github/workflows`: `deploy-front-apps-dev.yml` и `deploy-front-apps-prom.yml` собирают и выгружают только клиент; `validate-js.yml` без ESLint-маски и matrix-элемента `admin`.
- `.claude/skills`: удалён `sync-api-types`, обновлён `sync-all`.
- Документация: `README.md`, `backend-kt/DEPLOY.md`, `backend-kt/identity-gateway/README.md`, `js/README.md`, `js/CLAUDE.md`, `js/docs/component-creation.md`, `openspec/config.yaml`.
- `frontend-kt` не меняется: `dsbuilder components import-api` продолжает ходить в `POST /api/admin/component-config/import-api-meta`.
