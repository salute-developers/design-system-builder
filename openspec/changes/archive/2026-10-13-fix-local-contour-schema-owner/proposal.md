## Why

Общий локальный контур (`./setup-local.sh`) не запускается: JS-скрипт применял все Drizzle-миграции, включая `0007` (разделение платформ), а `ds-service` принимает существующую базу только на схеме baseline Flyway и сам применяет разделение платформ миграцией `V4`. Отпечатки не совпадают, и `ds-service` останавливается с `Schema fingerprint mismatch`. Сообщила команда QA, проблема воспроизводится на Mac и в WSL.

## What Changes

- Общий контур создаёт схему только Flyway: JS-контур поднимается без схемы (`DS_SCHEMA_MIGRATION_OWNER=flyway`), `ds-service` запускается без принятия существующей базы и создаёт схему `V1`–`V4`.
- Seed и привязка дизайн-системы `base` к проекту выполняются после этого (`js/setup-docker.sh --seed-only`) и пропускаются, если `base` уже есть.
- Удаление данных локального контура становится явной опцией `./setup-local.sh --reset`; E2E runner вызывает её.
- База со схемой Drizzle без истории Flyway отклоняется заранее с подсказкой про `--reset`.

## Capabilities

### Modified Capabilities

- `design-system-service-runtime`: сценарии локального запуска общего контура.

## Impact

`setup-local.sh`, `js/setup-docker.sh`, `tools/e2e`, `README.md`, `e2e/README.md`, `backend-kt/ds-service/README.md`.
