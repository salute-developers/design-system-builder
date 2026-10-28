## Why

Общий локальный контур (`./setup-local.sh`) до сих пор держится на JS-стеке: Postgres `ds_registry` поднимает `js/docker-compose.dev.yml`, а дизайн-систему `base` наполняет `db-service` сидером `seed-prod.ts` и привязывает к проекту SQL-запросом из `js/setup-docker.sh`. db-service удаляется поэтапно, и этот шаг — последняя зависимость локального контура от него. При этом `ds-service` уже умеет всё, что делал сидер: при создании дизайн-системы заводит определения токенов из `token-definitions.json`, при создании темы — значения из `token-initial-values.json`, палитру и компоненты из `component-seeds.json`, если в базе есть глобальный слой web-компонентов.

## What Changes

- Postgres `ds_registry` переезжает в `backend-kt/docker-compose.local.yml` сервисом `ds-db`; `ds-service` по умолчанию ходит в него, а не в `host.docker.internal:5433`.
- Появляется `backend-kt/bootstrap-base.sh`: через Gateway находит или создаёт проект пользователя, заливает глобальный слой web-компонентов (`dsbuilder components import-api --platform react` по `web-api-meta.json` из `js/cli`), создаёт дизайн-систему `base` с темой `base_default`. Версию скрипт не публикует: `base` остаётся черновиком. Повторный запуск ничего не дублирует.
- `./setup-local.sh` перестаёт запускать `js/setup-docker.sh`: останавливает legacy JS-стек, поднимает Kotlin backend, запускает bootstrap и поднимает только клиент из `js/docker-compose.dev.yml`. Проверка «схема Drizzle без истории Flyway» уходит: `ds-db` создаётся только Flyway.
- Документация локального контура (корневой `README.md`, `backend-kt/ds-service/README.md`, `e2e/README.md`) описывает новый порядок.

Не трогаются: `js/docker-compose.dev.yml` целиком (db-service и его Postgres остаются для standalone legacy-контура до отдельного change удаления db-service), `js/setup-docker.sh`, `seed-prod.ts`, ресурсы ds-service.

## Capabilities

### New Capabilities
- `local-base-bootstrap`: наполнение локального контура дизайн-системой `base` через Gateway и ds-service без db-service.

### Modified Capabilities
- `design-system-service-runtime`: сценарии запуска общего локального контура — база поднимается в стеке backend-kt, seed заменяется bootstrap-скриптом, проверка схемы Drizzle снимается.

## Impact

- `backend-kt/docker-compose.local.yml`, `backend-kt/start-local.sh` (без изменений интерфейса), новый `backend-kt/bootstrap-base.sh`.
- `setup-local.sh`, `README.md`, `backend-kt/ds-service/README.md`, `e2e/README.md`.
- `tools/e2e` и `e2e/*` продолжают вызывать `./setup-local.sh --reset` и не меняются.
- Для bootstrap нужны JVM-дистрибутив CLI (`frontend-kt/gradlew :cli:installJvmDist`, собирается скриптом при отсутствии) и `web-api-meta.json` (`js/cli`, `npm run generate:api-meta -- --package @salutejs/plasma-new-hope`; генерируется скриптом при отсутствии, если в `js/cli` установлены зависимости).
