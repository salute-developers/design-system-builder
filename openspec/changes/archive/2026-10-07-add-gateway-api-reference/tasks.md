## 1. Контракты сервисов

- [x] 1.1 Добавить публичный OpenAPI-документ Authentication с `POST /auth/token` и Bearer security scheme без секретов.
- [x] 1.2 Добавить в `ds-service` воспроизводимую Gradle-задачу генерации статического OpenAPI JSON из `OpenApiDocumentFactory`.
- [x] 1.3 Добавить тесты генерации `ds-service` OpenAPI и публичного Authentication контракта.

## 2. Локальный API Reference

- [x] 2.1 Добавить локальную Node-зависимость Scalar и статический shell API Reference.
- [x] 2.2 Реализовать каталог источников на уровне сервисов для Authentication, Projects и Design systems без регистрации отдельных операций.
- [x] 2.3 Реализовать чистое преобразование OpenAPI paths, добавление `projectId` и servers Local/Dev/Production.
- [x] 2.4 Добавить HTTP-обработчик преобразованных документов и команду `backend-kt/scripts/start-api-reference.sh`.
- [x] 2.5 Добавить тесты преобразования всех путей каждого источника и отсутствия `/internal/**` в Authentication source.
- [x] 2.6 Добавить безопасные OpenAPI defaults для Authentication и опциональный `DS_API_REFERENCE_PROJECT_ID`.
- [x] 2.7 Добавить Scalar OAuth2 password flow и локальный UI control `Project ID` для project-scoped requests.
- [x] 2.8 Перевести источник Scalar ds-service на статический OpenAPI resource и добавить Documentation service как project-scoped source.

## 3. Проверка

- [x] 3.1 Запустить форматирование, тесты и сборку изменённых Kotlin-модулей.
- [x] 3.2 Запустить build и тесты JavaScript-инструмента API Reference.
- [x] 3.3 [внешняя проверка] Запустить локальный contour, получить token через Scalar и выполнить авторизованный запрос Projects и Design systems через `http://localhost:8080`.
