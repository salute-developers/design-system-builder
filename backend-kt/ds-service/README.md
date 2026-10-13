# ds-service

Kotlin implementation of the DS Builder domain API. The service owns Flyway migrations and listens on port `8085` by default.

Required production configuration:

- `DS_DATABASE_URL`, `DS_DATABASE_USER`, `DS_DATABASE_PASSWORD` — PostgreSQL JDBC connection;
- `AUTHORIZATION_POLICY_PATH` — optional immutable policy override; the embedded `authorization-core` policy is the default;
- `DS_SERVICE_PORT` — HTTP port, default `8085`;
- `DS_DATABASE_POOL_SIZE` and `DS_DATABASE_CONNECTION_TIMEOUT_MS` — bounded JDBC pool settings;
- `DS_FLYWAY_ENABLED` — must remain `true` after schema ownership is transferred to Flyway;
- `DS_FLYWAY_ADOPT_EXISTING` and `DS_EXPECTED_SCHEMA_SHA256` — controlled, fingerprint-checked adoption of a pre-Flyway database. Do not enable adoption without the reviewed fingerprint in `contracts/schema-fingerprint.json`.

The fingerprint in `contracts/schema-fingerprint.json` describes the baseline schema (Flyway version `1`) that adoption accepts; later migrations, such as `V3__persist_appearance_axis_roles.sql` and `V4__component_platform_split.sql`, are applied on top of it and do not change the fingerprint. `V4` is the Flyway form of Drizzle `0007_component_platform_split.sql`: components are identified by `(name, platform)` and platform names carry `deprecated`; a database that already ran Drizzle `0007` no longer matches the baseline fingerprint and must be rebuilt from the baseline. `V3` stores the root and colour-scheme axes on `appearances` (`root_variation_id`, `color_scheme_variation_id`); `appearance_variations.is_color_scheme` is kept equal to the colour-scheme reference so that `db-service` and an earlier `ds-service` keep reading the same role.

`db-service` remains available for HTTP rollback, but it must not run a Drizzle migration job after Flyway adoption. Runtime `db-service` does not invoke Drizzle migrations; its migration command is an operator-only compatibility tool. The shared local contour (`./setup-local.sh`) does not adopt a Drizzle database at all: it starts the JavaScript stack with `DS_SCHEMA_MIGRATION_OWNER=flyway` (no Drizzle runner), starts `ds-service` with `DS_FLYWAY_ADOPT_EXISTING=false` so that Flyway creates the whole schema (`V1`–`V4`) in the empty database, and only then seeds it. A database already migrated by the Drizzle runner through `0007` matches neither the baseline fingerprint nor Flyway history: recreate it with `./setup-local.sh --reset`. The default remains `drizzle` only for the standalone legacy JS contour before adoption.

## Переход существующей базы Drizzle на Flyway

Цепочка миграций:

- V1 — схема после Drizzle `0005_component_platform.sql` включительно.
- V2 — изменения `0006_military_mephisto.sql`: `tenants.edit_revision`, нормализация
  пробелов в именах и уникальность имён тем без учёта регистра; затем заполнение
  отсутствующих значений токенов из первой темы дизайн-системы.
- V3 — роли осей appearance (`root_variation_id`, `color_scheme_variation_id`).
- V4 — разделение платформ компонентов (`V4__component_platform_split.sql`, форма Drizzle `0007`).

Это разбиение изменено до первой регистрации прежних Flyway V1/V2 на стендах.
Не применяйте этот вариант к базе, на которой уже есть история прежнего разбиения:
он несовместим с ней. Не используйте `repair` для обхода несовпадения checksum.

### Настройки Coolify для первого запуска

Сделайте резервную копию базы **с данными** и остановите приложения и задания,
которые пишут в неё, включая JS `db-service`. PostgreSQL должен оставаться
доступным. Для существующей базы после `0005`, без истории Flyway, задайте:

```env
DS_DATABASE_URL=jdbc:postgresql://<postgres-host>:5432/ds_registry
DS_DATABASE_USER=<database-user>
DS_DATABASE_PASSWORD=<database-password>
DS_FLYWAY_ADOPT_EXISTING=true
DS_EXPECTED_SCHEMA_SHA256=7770cff86df2e5b81da0e0461da2f2bec1f3bb7e2c1cfc1afc230b5a3368ea55
```

Шаблон переменных: [`production-env.example`](./production-env.example).
`DS_FLYWAY_ENABLED` должен оставаться `true`; production Compose задаёт его
автоматически. Запускайте обычный контейнер `ds-service`: отдельная команда
перехода не требуется. Сервис проверит структуру V1, создаст baseline V1, затем
Flyway применит V2 в обычном порядке. Для пустой базы оставьте
`DS_FLYWAY_ADOPT_EXISTING=false`: Flyway выполнит обе миграции с нуля.

Признаки успеха: `/ready` возвращает 200, а `flyway_schema_history` содержит
успешные записи baseline V1 и V2. После успеха установите
`DS_FLYWAY_ADOPT_EXISTING=false` и повторите запуск. Применённые миграции не
выполнятся повторно. Базой далее управляет Flyway; Drizzle migrations для неё
больше не запускаются. Возврат к состоянию до перехода — восстановление
резервной копии при остановленных писателях.

### Ошибки перехода

При несовпадении fingerprint baseline не создаётся и схема не меняется.
Не подставляйте фактический хеш вместо проверенного: неизвестные отличия требуют
отдельного анализа. База, уже обновлённая вручную до `0006` без истории Flyway,
не соответствует V1; этот сценарий требует отдельной проверки.

V2 перед изменением данных блокирует запись в `tenants` и проверяет конфликты
нормализованных имён. При `Conflicting normalized tenant names` исправьте
конфликт вручную: внутри одной дизайн-системы имена должны отличаться после
удаления крайних пробелов, сжатия пробельных последовательностей и приведения
к нижнему регистру. Автоматического переименования нет. Обновление tenants и заполнение токенов входят в одну транзакцию. При ошибке V2 все её изменения
откатываются, но зарегистрированный baseline V1 остаётся. После исправления
конфликта обычный повторный запуск выполнит V2; `repair` не требуется.

При повреждённой истории, неизвестном baseline или неизвестных применённых версиях
adoption останавливается, не исправляя историю автоматически.

### Версия отпечатка схемы

`contracts/schema-fingerprint.json` использует `schemaVersion=2` и
`algorithm=logical-columns-v2`. Колонки сравниваются по имени, типу, nullable
и default; физические номера и порядок создания не учитываются. Ограничения,
индексы, функции, триггеры и enum по-прежнему проверяются. Алгоритм проверяется
на PostgreSQL 16 и 17; текстовые определения объектов остаются строгими.

Прежний хеш `b704ff...` относится к прежней полной V1 и алгоритму версии 1;
он несовместим с новым разбиением и расчётом. Новый эталон выше проверяет только
схему после `0005`, а обновление до `0006` выполняется настоящей миграцией V2.
