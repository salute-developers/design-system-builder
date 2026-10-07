# ds-service

Kotlin implementation of the DS Builder domain API. The service owns Flyway migrations and listens on port `8085` by default.

Required production configuration:

- `DS_DATABASE_URL`, `DS_DATABASE_USER`, `DS_DATABASE_PASSWORD` — PostgreSQL JDBC connection;
- `AUTHORIZATION_POLICY_PATH` — optional immutable policy override; the embedded `authorization-core` policy is the default;
- `DS_SERVICE_PORT` — HTTP port, default `8085`;
- `DS_DATABASE_POOL_SIZE` and `DS_DATABASE_CONNECTION_TIMEOUT_MS` — bounded JDBC pool settings;
- `DS_FLYWAY_ENABLED` — must remain `true` after schema ownership is transferred to Flyway;
- `DS_FLYWAY_ADOPT_EXISTING` and `DS_EXPECTED_SCHEMA_SHA256` — controlled, fingerprint-checked adoption of a pre-Flyway database. Do not enable adoption without the reviewed fingerprint in `contracts/schema-fingerprint.json`.

The fingerprint in `contracts/schema-fingerprint.json` describes the baseline schema (Flyway version `1`) that adoption accepts; later migrations, such as `V3__persist_appearance_axis_roles.sql`, are applied on top of it and do not change the fingerprint. `V3` stores the root and colour-scheme axes on `appearances` (`root_variation_id`, `color_scheme_variation_id`); `appearance_variations.is_color_scheme` is kept equal to the colour-scheme reference so that `db-service` and an earlier `ds-service` keep reading the same role.

`db-service` remains available for HTTP rollback, but it must not run a Drizzle migration job after Flyway adoption. Runtime `db-service` does not invoke Drizzle migrations; its migration command is an operator-only compatibility tool. Run the shared local contour with `DS_SCHEMA_MIGRATION_OWNER=flyway` after adoption so `js/setup-docker.sh` starts `db-service` without invoking the Drizzle runner. The default remains `drizzle` only for the standalone legacy JS contour before adoption.
