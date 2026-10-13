## 1. Скрипты

- [x] 1.1 `js/setup-docker.sh`: режим `--seed-only`, идемпотентный seed, отложенные seed и привязка проекта при `DS_SCHEMA_MIGRATION_OWNER=flyway`, `DSBUILDER_RESET_VOLUMES`.
- [x] 1.2 `setup-local.sh`: порядок JS без схемы → Kotlin с Flyway → seed, опция `--reset`, проверка базы со схемой Drizzle.
- [x] 1.3 `tools/e2e` вызывает `setup-local.sh --reset`.

## 2. Документация и проверка

- [x] 2.1 Обновить `README.md`, `e2e/README.md`, `backend-kt/ds-service/README.md`.
- [x] 2.2 Прогнать `./setup-local.sh --reset`, повторный `./setup-local.sh` без опций и сценарий с базой Drizzle.
