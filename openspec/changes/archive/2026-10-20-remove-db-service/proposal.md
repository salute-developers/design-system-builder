## Why

db-service больше ничего не обслуживает: админка удалена, редактор тем и импорт дизайн-системы работают через ds-service, инструмент импорта компонентов живёт в `js/cli`, локальный контур поднимается без JS-стека и наполняется `backend-kt/bootstrap-base.sh`. Остались только код сервиса, его сиды и Drizzle-миграции, compose- и CI-описания, маршрут `/ds/legacy` в Gateway и документация, которая по-прежнему называет db-service источником истины. Всё это вводит в заблуждение и стоит сборки в CI.

## What Changes

- **Код**: удаляется `js/services/db-service` целиком (сервис, сиды, Drizzle-миграции, тесты, Dockerfile), `js/setup-docker.sh`, `js/docs/db-schema.dbml`, корневые npm-скрипты `dev:db-service`/`build:db-service`/`test:services`, из `js/docker-compose.dev.yml` — `postgres-registry` и `db-service` с томом и `depends_on` клиента. Тест клиента `colorTokens/domain/domain.test.ts` получает собственную фикстуру вместо импорта сидов.
- **Gateway**: из `nginx.local.conf` и `nginx.prod.conf.template` удаляются upstream `db_service_api` и блок `/api/projects/{id}/ds/legacy`; `test-route-namespaces.sh` проверяет их отсутствие; из `docker-compose.prod.yml` уходят сервис `db-service`, переменные `DB_SERVICE_UPSTREAM_*` и зависимость Gateway.
- **CI и проверки**: `publish-backend-images.yml` без образа `db-service`; `validate-js.yml` без контура db-service; `.verification/config` без `javascript-db-service` в strictacode и защищённых путях, baseline `javascript-db-service.json` удаляется; `backend-kt/scripts/test-ds-service-differential.sh`, `backend-kt/docker-compose.db-service-test.yml` и `backend-kt/ds-service/contracts/{consumer-route-audit,excluded-route-groups}.json` удаляются как артефакты миграции.
- **Скиллы и документация**: `.claude/skills/sync-*` удаляются; `js/CLAUDE.md`, `js/README.md`, `js/docs/component-creation.md`, `AGENTS.md`, корневой `README.md`, `backend-kt/DEPLOY.md`, `backend-kt/ds-service/README.md`, `production-env.example`, `openspec/config.yaml`, `frontend-kt/feature-components/API_META_NORMALIZERS.md`, `.agents/skills/pr-description/SKILL.md` перестают упоминать db-service как действующий сервис.
- **Спеки**: `component-seed-format` удаляется; из `design-system-service-runtime`, `design-system-model-api`, `gateway-authorization`, `container-image-delivery`, `color-token-operations-api` уходят требования о сосуществовании с db-service и legacy-маршрутах; в `component-appearance-model`, `component-state-model`, `documentation-bundle-ingestion`, `theme-palette-api`, `plasma-component-import` субъектом требований становится ds-service.

Не трогаются: `.env.prod.example` (правки `.env.*` запрещены проверкой verify — переменная `DATABASE_URL` остаётся в списке ручных действий), имена переменных `DB_SERVICE_CONNECT_TIMEOUT_MS`/`DB_SERVICE_REQUEST_TIMEOUT_MS` и диагностика `DB_SERVICE_UNAVAILABLE` в documentation-service (это его контракт, переименование — отдельный change), Flyway-миграции ds-service и `FlywayAdoptionIntegrationTest` (самодостаточны, baseline `V1` лежит в ресурсах ds-service), активный change `add-color-token-groups`.

## Capabilities

### New Capabilities
- (нет)

### Modified Capabilities
- `component-seed-format`: спека удаляется целиком (файл `openspec/specs/component-seed-format/spec.md`, без дельты: архив не принимает спеку без требований) — сидов db-service больше нет, данные `base` заводит ds-service из своих ресурсов.
- `design-system-service-runtime`: убирается требование сосуществования и отката на db-service; Flyway — единственный владелец схемы без оговорок про db-service.
- `design-system-model-api`: убираются сценарии сосуществования с db-service и строка legacy-маршрутов.
- `gateway-authorization`: убираются сценарии про исключённые маршруты и откат на upstream db-service.
- `container-image-delivery`: список образов без `db-service`.
- `color-token-operations-api`: убирается сценарий тестов манифеста db-service.
- `component-appearance-model`, `component-state-model`, `documentation-bundle-ingestion`, `theme-palette-api`, `admin-ad-hoc-queries-removed`, `component-api-meta-import`, `frontend-client-authentication`: субъект требований — ds-service или Gateway, смысл требований не меняется. Назначение (`Purpose`) спек `plasma-component-import`, `component-state-model`, `admin-ad-hoc-queries-removed`, `design-system-service-runtime`, `local-base-bootstrap` правится напрямую.

## Impact

- Удаляется около 165 МБ исходников и `node_modules` db-service, один образ в GHCR, один контур в CI.
- Ручные действия после слияния (список в `design.md`): удалить ресурсы db-service в Coolify на prod и dev, пакет `db-service` в GHCR, секреты и переменные `DATABASE_URL`, `DB_SERVICE_*` в Coolify и GitHub; `.env.prod.example` поправить отдельным коммитом с разрешением на защищённый путь.
