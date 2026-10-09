## Why

Проверка API через разрозненные OpenAPI-документы требует вручную сопоставлять внутренние пути сервисов с публичными путями gateway и отдельно получать токен. Нужен единый локальный интерфейс, который показывает доступные API сервисов и отправляет запросы в выбранный gateway.

## What Changes

- Добавляется локальный запуск Scalar API Reference одной командой.
- Инструмент собирает OpenAPI-документы сервисов и преобразует их к публичным путям gateway по правилам на уровне сервиса, без реестра отдельных операций.
- В интерфейсе появляются источники Authentication, Projects, Design systems и Documentation; Authentication содержит публичный маршрут получения токена.
- Для каждого источника доступны Local, Dev и Production gateway как OpenAPI servers.
- Добавляется генерация статического OpenAPI-документа `ds-service`, чтобы dev-инструмент не зависел от запущенного экземпляра сервиса.

## Capabilities

### New Capabilities

- `gateway-api-reference`: локальный интерактивный каталог публичных API gateway с отправкой запросов через Scalar.

### Modified Capabilities

- `identity-authentication`: публичный контракт gateway дополняется документированием получения токена для интерактивного API-клиента.

## Impact

- Затрагиваются `backend-kt/scripts`, OpenAPI-документы `identity-gateway`, `projects-service` и `ds-service`, а также локальная JavaScript-зависимость Scalar.
- Изменения не затрагивают БД, миграции, runtime-маршрутизацию gateway и клиентские приложения.
- Новый инструмент использует локально установленный пакет `@scalar/api-reference`; внешняя облачная платформа Scalar и её proxy не используются.
