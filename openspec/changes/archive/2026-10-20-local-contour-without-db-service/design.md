## Context

`./setup-local.sh` сейчас: `js/setup-docker.sh` (Postgres `postgres-registry` на 5433, `db-service`, клиент; без Drizzle-миграций), `backend-kt/start-local.sh --detach` (`ds-service` создаёт схему Flyway в чужой базе через `host.docker.internal:5433`), затем `js/setup-docker.sh --seed-only` (`seed-prod.ts` внутри контейнера db-service и `UPDATE design_systems SET project_id` через psql).

В `ds-service` при `POST /design-systems` инициализатор `GeneratedTokenDefinitionInitializer` создаёт определения токенов из `token-definitions.json`; при `POST /tenants` — `GeneratedDesignSystemComponentInitializer` заводит компоненты и связи из `component-seeds.json` (только если все компоненты, свойства и web-параметры есть в глобальном слое; иначе молча пропускает), `GeneratedTenantTokenValueInitializer` пишет значения из `token-initial-values.json` и палитра копируется из шаблона. Глобальный слой web-компонентов заводит `POST /api/admin/component-config/import-api-meta`; его тело строит CLI (`WebApiMetaNormalizer`) из `web-api-meta.json`, повторять этот разбор в shell нельзя. Пароль `dsbuilder auth login` читается с stdin (так делает `e2e/scenarios/cli-auth-session.sh`).

## Goals / Non-Goals

**Goals:**
- Локальный контур поднимается и наполняется без `db-service` и без `js/setup-docker.sh`.
- Наполнение идёт только через Gateway и ds-service: ни psql, ни прямых SQL.
- Повторный запуск `./setup-local.sh` без `--reset` сохраняет данные и ничего не дублирует.
- `tools/e2e` работает с тем же `./setup-local.sh --reset`.

**Non-Goals:**
- Удаление db-service, его compose-сервисов, `js/setup-docker.sh`, `seed-prod.ts`, `/ds/legacy` в Gateway, CI — отдельный change.
- Перенос `web-api-meta.json` или компонентного пакета в ресурсы backend-kt: источник меты — установленное в `js/cli` ядро plasma.
- Изменения ds-service и CLI.

## Decisions

- **Postgres в стеке backend-kt.** Сервис `ds-db` (`postgres:16-alpine`, база `ds_registry`, `postgres/postgres`, том `ds_db_data`, host-порт `${DS_DB_PORT:-5433}` для psql-привычек и инструментов). `DS_DATABASE_URL` по умолчанию `jdbc:postgresql://ds-db:5432/ds_registry`; `ds-service` зависит от `ds-db` по healthcheck. `DS_FLYWAY_ADOPT_EXISTING` в локальном compose по умолчанию `false` (схему создаёт Flyway с нуля; принятие готовой базы включается явно), `setup-local.sh` передаёт его же. Порт 5433 совпадает с legacy `postgres-registry`, поэтому `setup-local.sh` сначала останавливает legacy JS-стек (`docker compose down` без томов).
- **Bootstrap — bash-скрипт `backend-kt/bootstrap-base.sh`** (curl, python3 для JSON, как `js/setup-docker.sh`), порядок:
  1. дождаться `GET /health` Gateway и `GET /api/projects` под токеном пользователя (`admin@example.com`/`password`, переопределяемые `DSBUILDER_PROJECT_USERNAME`/`DSBUILDER_PROJECT_PASSWORD`);
  2. проект: первый неархивный проект пользователя (`ownerUserId`), иначе `POST /api/projects {name: DSBUILDER_PROJECT_NAME}` — логика переезжает из `bootstrap_user_project` в `js/setup-docker.sh`;
  3. глобальный слой: `dsbuilder auth login` с паролем на stdin, затем `dsbuilder components import-api --platform react --from <web-api-meta.json> --api-url <gateway> --apply`; команда идемпотентна (повторно — `Unchanged`). Мета: `DSBUILDER_WEB_API_META`, по умолчанию `js/cli/.sdds/web/web-api-meta.json`; если файла нет, скрипт генерирует его `npm run generate:api-meta -- --package @salutejs/plasma-new-hope` в `js/cli` (нужны установленные зависимости) и останавливается с подсказкой, если их нет. CLI: `DSBUILDER_CLI`, по умолчанию `frontend-kt/cli/build/install/cli-jvm/bin/dsbuilder`, при отсутствии собирается `frontend-kt/gradlew :cli:installJvmDist` (как в `tools/e2e`);
  4. дизайн-система: если в проекте уже есть `base` (`GET /api/projects/{id}/ds/design-systems`), шаг пропускается; иначе `POST .../ds/design-systems {name: "base", projectName, description}` и `POST .../ds/tenants {designSystemId, name: "base_default"}` — порядок после import-api обязателен, иначе компоненты не заведутся;
  5. проверка: `POST .../component-config/export {designSystemId, platform: "web"}` возвращает непустой список компонентов, у темы есть значения токенов (`GET .../tenants/{id}/token-values`); пустой список компонентов — ошибка с текстом про глобальный слой, а не «успех».
- **`setup-local.sh`**: `--reset` удаляет тома обоих стеков (`backend-kt` compose `down -v`, legacy JS compose `down -v`); обычный запуск: остановить legacy JS-стек, `DS_FLYWAY_ADOPT_EXISTING=false backend-kt/start-local.sh --detach`, `backend-kt/bootstrap-base.sh`, `docker compose up -d --no-deps client` для `js/docker-compose.dev.yml` (`--no-deps`, чтобы `depends_on: db-service` клиента не поднимал legacy-стек); `--down` останавливает оба. Проверка `check_schema_owner` убирается.
- **Привязка к проекту не нужна**: дизайн-система создаётся через Gateway внутри проекта (`createOwned(context.projectId)`), SQL `UPDATE design_systems` уходит.

## Risks / Trade-offs

- [Bootstrap зависит от двух инструментов разработки: JVM CLI и `js/cli` с установленными зависимостями] → оба уже нужны для работы с web-генерацией и e2e; скрипт собирает CLI сам и печатает точную команду для `npm ci`.
- [`component-seeds.json` ds-service молча пропускает компоненты, если глобальный слой неполон] → bootstrap проверяет экспорт и падает с понятным сообщением.
- [Legacy JS-стек с `postgres-registry` на 5433 конфликтует с `ds-db`] → `setup-local.sh` останавливает его перед стартом backend; standalone `js/setup-docker.sh` живёт до change удаления db-service и не предназначен для совместного запуска.
- [Данные старого контура (`postgres_registry_data_dev`) не переносятся в `ds-db`] → локальный контур пересоздаётся bootstrap-ом за минуты; это и есть замена seed.
- [`DS_EXPECTED_SCHEMA_SHA256` в compose относится к принятию существующей базы] → при `DS_FLYWAY_ADOPT_EXISTING=false` не используется; значение остаётся для режима принятия.
- [`dsbuilder auth login` хранит одну сессию на api-url] → bootstrap логинит CLI в отдельном временном `HOME` (как `e2e/scenarios/cli-auth-session.sh`), сессия разработчика не подменяется.
