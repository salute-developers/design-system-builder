## 1. db-service: удаление saved queries и NL query

- [x] 1.1 Удалить `savedQueries` из `src/db/schema.ts`, схемы из `src/validation/schema.ts`, регистрацию из `src/openapi/spec.ts`.
- [x] 1.2 Удалить `src/routes/api/saved-queries.ts`, `src/routes/misc/saved-queries.ts`, `src/routes/misc/nl-query.ts`, `src/nl-query/*` и их регистрацию в `src/routes/index.ts`.
- [x] 1.3 Сгенерировать миграцию `0008_drop_saved_queries` через `npm run db:generate` и применить её на локальной базе.
- [x] 1.4 Убрать `ZAI_API_KEY` из `docker-compose.dev.yml` и `.env.example`; обновить `js/docs/db-schema.dbml`, `js/README.md` и `.claude/skills/sync-routes/SKILL.md`.
- [x] 1.5 Перегенерировать `openapi.json` и `types.gen.ts` админки.

## 2. admin

- [x] 2.1 Убрать из `QueriesPage` NL query и saved queries, оставить каталог именованных запросов; убрать их стили из `Page.css`.

## 3. backend-kt и стенды

- [x] 3.1 Добавить Flyway-миграцию `V4__drop_saved_queries` в `ds-service` и обновить число миграций и итоговый отпечаток в `FlywayPostgresIntegrationTest` и `FlywayAdoptionIntegrationTest`; baseline-отпечаток в `contracts/schema-fingerprint.json` не меняется.
- [x] 3.2 Убрать saved queries и NL query из `documentation.yaml`, `contracts/excluded-route-groups.json`, `contracts/consumer-route-audit.json` и compatibility-маршрута gateway.
- [x] 3.3 Убрать `ZAI_API_KEY` из `docker-compose.prod.yml` и `.env.prod.example`.

## 4. Проверка

- [x] 4.1 `cd js/services/db-service && npm run build && npm test`.
- [x] 4.2 `cd js/apps/admin && npm run build`.
- [ ] 4.3 Прогнать dev deploy и проверить страницу Queries на `/dev/design-system-builder/admin/`.
