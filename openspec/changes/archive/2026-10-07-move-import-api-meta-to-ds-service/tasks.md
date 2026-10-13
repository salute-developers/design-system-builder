## 1. ds-service

- [x] 1.1 Добавить доменные модели `ApiMetaImportReport` и `ApiMetaAlias` (слияние повторов, устаревание).
- [x] 1.2 Добавить `ImportApiMeta`, `ApiMetaRepository` и `ImportApiMetaUseCase` (роль системного администратора, dry run через откат).
- [x] 1.3 Реализовать `ExposedApiMetaRepository`: аддитивная запись по `(name, platform)`, проверка типа по словарю, `typeMismatches`, `rejected`, алиасы и статус устаревания, `absent`, журнал без дизайн-системы.
- [x] 1.4 Добавить DTO запроса и ответа и маршрут `POST /api/ds/admin/component-config/import-api-meta`; зарегистрировать в Koin и `Application`.

## 2. Gateway

- [x] 2.1 Направить `POST /api/admin/component-config/import-api-meta` в `ds-service` в `nginx.local.conf` и `nginx.prod.conf.template` (токен пользователя, `X-Project-Id: global`, лимит 16m).
- [x] 2.2 Обновить `test-route-namespaces.sh`.

## 3. db-service

- [x] 3.1 Удалить реализацию, маршрут и тесты импорта API-меты, регистрацию в `routes/index.ts` и описание в `openapi/spec.ts`; перегенерировать типы админ-приложения.

## 4. Проверка

- [x] 4.1 Интеграционные тесты ds-service: доступ, контракт тела, запись, dry run, платформы, устаревание, absent, журнал.
- [x] 4.2 Локальный контур: образ `ds-service`, `import-api` для compose и android-view через Gateway, повторы, `push`/`fetch`.
- [x] 4.3 Обновить основные спеки, `openspec/config.yaml`, `js/CLAUDE.md` и `consumer-route-audit.json`.
