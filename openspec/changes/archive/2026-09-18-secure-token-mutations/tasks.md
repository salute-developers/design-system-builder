## 1. Контракты и границы доступа

- [x] 1.1 Инвентаризировать callers `/ds/tokens` и `/ds/token-values`, включая загрузчики и admin tooling; зафиксировать допустимый trusted actor без обхода project context.
- [x] 1.2 Согласовать матрицу user roles и project-key scopes для `POST`, `PATCH`, `DELETE` с существующими Gateway и Projects Service; проверить путь `system_admin`.

## 2. Правила и запись в db-service

- [x] 2.1 Выделить тестируемые правила авторизации и проверки владения token, tenant и design system в `js/services/db-service`.
- [x] 2.2 Применить проверки к `POST`/`PATCH`/`DELETE /ds/tokens`, включая отказ для чужих и legacy unscoped token definitions.
- [x] 2.3 Применить проверки к `POST`/`PATCH`/`DELETE /ds/token-values`, включая обязательный контекст, совпадение token/tenant design system и существование `paletteId`.
- [x] 2.4 Обеспечить отсутствие частичной записи и клиентскую ошибку при конфликте уникального `(tokenId, tenantId, platform, mode)`.

## 3. API и проверки

- [x] 3.1 Обновить валидацию и OpenAPI существующих mutation routes с `403`/`404` и контрактом обязательных полей.
- [x] 3.2 Добавить focused tests правил и Express routes: допустимые роли/scopes, viewer, неизвестная роль, чужой проект, несовпадающие token/tenant, отсутствующий контекст, legacy NULL и дубли значений.
- [x] 3.3 Проверить через Gateway разрешённую запись с последующим чтением после новой сессии. Локальный `system_admin`: `POST` token и value → `201`, чтение с новым access token → `200`; временные записи удалены.
- [x] 3.4 Выполнить тесты `db-service`, `cd js && npm run build` и `/sync-all` для изменённых JS-контрактов; убедиться, что изменение схемы и миграция БД не понадобились. Пройдено 57/57 тестов и общая сборка JS; OpenAPI/типы admin пересозданы, `db/schema.ts` не менялся.
