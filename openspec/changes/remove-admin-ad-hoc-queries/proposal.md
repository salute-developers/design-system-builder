## Why

В админке `js/apps/admin` два механизма произвольных SQL-запросов: NL query, где LLM генерирует SQL по тексту и db-service его выполняет, и saved queries — сохранение таких SQL в таблицу `saved_queries` и повторный запуск. Оба выполняют произвольный SQL без привязки к проекту и правам, тянут внешний LLM-провайдер и ключ `ZAI_API_KEY` в db-service. DS Builder оставляет в админке только каталог именованных запросов из кода.

## What Changes

- **BREAKING**: удалить saved queries — таблицу `saved_queries`, маршруты `/ds/saved-queries*`, схемы валидации и OpenAPI, UI сохранения запросов в админке.
- **BREAKING**: удалить NL query — `POST /api/admin/nl-query`, LLM-клиент `src/nl-query/*`, переменную `ZAI_API_KEY` в db-service и вкладку NL Query в админке.
- Страница Queries админки оставляет только каталог именованных запросов из `/api/admin/queries`.

## Capabilities

### New Capabilities

- Нет.

### Modified Capabilities

- Нет. Saved queries и NL query не были описаны ни одной capability; их удаление фиксируется в этом proposal, в tasks и в спеке `admin-ad-hoc-queries-removed`.

## Impact

- `js/services/db-service`: удалены `savedQueries` из `schema.ts`, `validation/schema.ts`, `openapi/spec.ts`, `routes/index.ts`, `routes/api/saved-queries.ts`, `routes/misc/saved-queries.ts`, весь `src/nl-query/*` и `routes/misc/nl-query.ts`; добавлена миграция `0006_drop_saved_queries`; перегенерированы `js/apps/admin/src/api/openapi.json` и `types.gen.ts`; обновлён `js/docs/db-schema.dbml`.
- `js/apps/admin`: `QueriesPage` без NL query и saved queries, стили удалённых блоков убраны.
- `js/docker-compose.dev.yml`, `js/.env.example`, `js/README.md`: убран `ZAI_API_KEY` и описание удалённых механизмов.
- `backend-kt`, `frontend-kt`, gateway и deploy workflows не изменяются.
