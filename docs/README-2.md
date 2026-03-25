**DS Registry** — Node.js + Express + Drizzle ORM.
**Admin** — Vite + React + TypeScript.

## Структура

```
design-system-builder/
├── ds-registry/
│   ├── src/
│   │   ├── db/
│   │   │   ├── index.ts          # подключение к БД (postgres-js + Drizzle)
│   │   │   ├── schema.ts         # Drizzle-схема (24 таблицы)
│   │   │   ├── seed.ts           # оркестратор сидирования
│   │   │   ├── reset.ts          # полный сброс схемы
│   │   │   └── seeds/            # 01_users.ts … 21_design_system_versions.ts
│   │   ├── routes/
│   │   │   ├── index.ts          # корневой роутер
│   │   │   ├── api/              # CRUD-роуты (по одному файлу на таблицу)
│   │   │   │   ├── utils.ts      # assertFound, tryCatch
│   │   │   │   ├── users.ts
│   │   │   │   ├── design-systems.ts
│   │   │   │   ├── legacy.ts     # /api/legacy/design-systems/:id/*
│   │   │   │   └── …             # остальные 22 ресурса
│   │   │   └── misc/             # вспомогательные роуты
│   │   │       ├── tables.ts     # /api/tables
│   │   │       ├── queries.ts    # /api/queries
│   │   │       ├── nl-query.ts   # /api/nl-query
│   │   │       └── schema.ts     # /api/schema
│   │   ├── validation/
│   │   │   ├── schema.ts         # Zod-схемы для всех таблиц
│   │   │   └── middleware.ts     # validateBody, validateParams
│   │   ├── openapi/
│   │   │   ├── spec.ts           # OpenAPI 3.0 спека (авто-генерация из Drizzle + Zod)
│   │   │   └── generate.ts       # скрипт записи спеки в openapi.json
│   │   ├── queries/
│   │   │   └── catalog.ts        # каталог именованных запросов
│   │   ├── nl-query/
│   │   │   ├── llm-service.ts    # вызов Z.AI API
│   │   │   ├── schema-context.ts # контекст схемы для LLM
│   │   │   └── sql-validator.ts  # валидация (только SELECT)
│   │   ├── zod-extend.ts         # extendZodWithOpenApi (вызывается один раз)
│   │   └── index.ts              # Express-сервер
│   ├── drizzle/                  # сгенерированные SQL-миграции
│   ├── drizzle.config.ts
│   ├── .env.example
│   └── package.json
├── admin/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts         # типизированный API-клиент (openapi-fetch)
│   │   │   ├── openapi.json      # сгенерированная OpenAPI спека (артефакт)
│   │   │   └── types.gen.ts      # сгенерированные TS-типы (артефакт)
│   │   ├── pages/
│   │   │   ├── TablesPage.tsx    # /tables — просмотр таблиц
│   │   │   ├── QueriesPage.tsx   # /queries — каталог запросов
│   │   │   ├── NLQueryPage.tsx   # /nl-query — запросы на естественном языке
│   │   │   ├── SchemaPage.tsx    # /schema — ER-диаграмма
│   │   │   └── DocsPage.tsx      # /docs — Scalar API документация
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
├── .claude/
│   └── skills/                   # Claude Code скиллы
│       ├── sync-all/             # /sync-all — полная синхронизация
│       ├── sync-validation/      # /sync-validation — обновить Zod-схемы
│       ├── sync-routes/          # /sync-routes — создать/удалить роуты
│       ├── sync-spec/            # /sync-spec — обновить OpenAPI спеку
│       └── sync-api-types/       # /sync-api-types — регенерировать TS-типы
├── docker-compose.yml            # PostgreSQL 16
├── package.json                  # npm workspaces (корневой)
└── README.md
```

---

## Быстрый старт

### 1. Поднять базу данных

```bash
docker compose up -d
```

Контейнер `mock-query-db` — PostgreSQL 16 на порту **5433** (хост) → 5432 (контейнер).
Данные сохраняются в Docker volume `postgres_data`, поэтому после `docker compose down` они не пропадут.

### 2. Настроить окружение

```bash
cp ds-registry/.env.example ds-registry/.env
```

В `ds-registry/.env` уже подходящие значения по умолчанию:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mock_query
PORT=8081
ZAI_API_KEY=your-zai-api-key-here   # для NL-запросов
```

### 3. Установить зависимости

```bash
npm install
```

### 4. Применить миграции и заполнить БД

```bash
npm run db:migrate --workspace=ds-registry
npm run db:seed:dev --workspace=ds-registry
```

### 5. Запустить проект

В двух терминалах:

```bash
# терминал 1 — ds-registry (порт 8081)
npm run dev:ds-registry

# терминал 2 — admin (порт 5173)
npm run dev:admin
```

Приложение: [http://localhost:5173](http://localhost:5173)
API-документация: [http://localhost:5173/docs](http://localhost:5173/docs)

---

## База данных (Docker)

### Запуск и остановка

```bash
docker compose up -d          # поднять
docker compose down           # остановить (данные сохраняются)
docker compose down -v        # остановить и удалить данные
```

### Подключение вручную

```bash
docker exec -it mock-query-db psql -U postgres -d mock_query
```

### Drizzle ORM — команды

Выполняются из корня через `--workspace=ds-registry`:

| Команда | Описание |
|---------|----------|
| `npm run db:generate --workspace=ds-registry` | Сгенерировать SQL-миграцию после изменения `schema.ts` |
| `npm run db:migrate --workspace=ds-registry` | Применить миграции к БД |
| `npm run db:seed:dev --workspace=ds-registry` | Заполнить БД тестовыми данными |
| `npm run db:reset --workspace=ds-registry` | Полный сброс схемы (после — нужен migrate + seed) |
| `npm run db:studio --workspace=ds-registry` | Открыть Drizzle Studio |

### Типичные сценарии

**Первый запуск:**
```bash
docker compose up -d
npm run db:migrate --workspace=ds-registry
npm run db:seed:dev --workspace=ds-registry
```

**Изменил схему (`schema.ts`) или роуты (`routes/api/`):**
```bash
npm run db:generate --workspace=ds-registry   # только если менялась schema.ts
npm run db:migrate --workspace=ds-registry    # только если менялась schema.ts
/sync-all   # обновляет validation, routes, openapi и admin-типы
```

**Что-то сломалось / начать с чистого листа:**
```bash
npm run db:reset --workspace=ds-registry
npm run db:migrate --workspace=ds-registry
npm run db:seed:dev --workspace=ds-registry
```

---

## API-типы для админки

Типы генерируются из OpenAPI-спеки автоматически — без запущенного бэкенда:

```bash
npm run api:gen
```

Команда последовательно:
1. Запускает `ds-registry/src/openapi/generate.ts` → записывает `admin/src/api/openapi.json`
2. Запускает `openapi-typescript` → генерирует `admin/src/api/types.gen.ts`

После этого в коде админки доступен типизированный клиент:

```typescript
import { api } from "../api/client";

const { data } = await api.GET("/users");
const { data: user } = await api.GET("/users/{id}", {
  params: { path: { id: "..." } },
});
```

Запускать после любых изменений в схеме БД или после `/sync-all`.

---

## Claude Code скиллы

Скиллы для синхронизации файлов при изменении схемы БД или роутов (`routes/api/`).

| Скилл | Что делает |
|-------|-----------|
| `/sync-all` | Запускает все четыре скилла по порядку |
| `/sync-validation` | Обновляет `validation/schema.ts` |
| `/sync-routes` | Создаёт/удаляет файлы в `routes/api/`, обновляет `routes/index.ts` |
| `/sync-spec` | Обновляет `openapi/spec.ts` |
| `/sync-api-types` | Регенерирует `openapi.json` и `types.gen.ts` |

---

## Страницы

| Путь | Описание |
|------|----------|
| `/tables` | Просмотр всех таблиц БД |
| `/queries` | Каталог запросов с параметрами |
| `/nl-query` | Запросы на естественном языке (Cmd+Enter) |
| `/schema` | Интерактивная ER-диаграмма |
| `/docs` | Scalar API документация (OpenAPI) |

---

## Cloudflare Tunnel (публичный доступ)

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:5173
```

В консоли появится URL вида `https://xxx-xxx-xxx.trycloudflare.com`.
Каждый запуск — новый случайный URL.
Backend должен быть запущен — админка проксирует `/api` на `localhost:8081`.
