# gateway-authorization Specification

## Purpose
Защита проектных маршрутов на Gateway, формирование доверенного контекста и изоляция внутренних маршрутов сервисов.

## Requirements

### Requirement: Gateway protects project routes

Gateway SHALL направлять project-scoped routes через internal auth flow перед проксированием в downstream-сервисы, включая `ds-service`.

#### Scenario: Запрос к project-scoped API

- **WHEN** клиент обращается к `/projects/{projectId}/...`
- **THEN** Gateway MUST запросить Auth Helper до проксирования запроса

#### Scenario: Запрос без доступа

- **WHEN** Auth Helper возвращает отказ доступа
- **THEN** Gateway MUST вернуть клиенту `401 Unauthorized` или `403 Forbidden` без вызова downstream-сервиса

#### Scenario: Прямой доступ к ds-service

- **WHEN** внешний клиент пытается обратиться к внутреннему порту `ds-service`, минуя Gateway
- **THEN** сетевой контур MUST запретить внешний доступ
- **AND** сам `ds-service` MUST отклонить запрос без корректного trusted context

### Requirement: Trusted request context headers

Gateway SHALL передавать downstream-сервисам нормализованный trusted context только после успешной проверки и SHALL передавать `ds-service` все поля principal, необходимые общей RBAC-политике.

#### Scenario: User actor context

- **WHEN** authenticated user получает доступ к project-scoped route
- **THEN** Gateway MUST передать `X-Actor-Type`, `X-User-Id`, `X-Project-Id`, `X-Project-Role` и `X-System-Admin`

#### Scenario: Project key actor context

- **WHEN** валидный project access key получает доступ к project-scoped route
- **THEN** Gateway MUST передать `X-Actor-Type`, `X-Project-Id`, `X-Project-Key-Id`, `X-Project-Scopes` и `X-System-Admin`

#### Scenario: Incoming trusted headers are spoofed

- **WHEN** внешний клиент отправляет `X-User-Id`, `X-Project-Role`, `X-Project-Scopes` или другие trusted headers
- **THEN** Gateway MUST удалить incoming values и установить только значения, полученные от Auth Helper

#### Scenario: Project id не совпадает

- **WHEN** `projectId` публичного пути не совпадает с проверенным `X-Project-Id`
- **THEN** Gateway MUST отклонить запрос до переписывания пути и предметной операции
- **AND** MUST NOT передавать запрос в `ds-service`

### Requirement: Internal endpoints are not externally available

Gateway SHALL запрещать внешний доступ к internal endpoints.

#### Scenario: Внешний запрос к internal route

- **WHEN** внешний клиент обращается к `/internal/**`
- **THEN** Gateway MUST отклонить запрос без проксирования во внутренний сервис

### Requirement: Gateway направляет предметный API в ds-service

Gateway SHALL направлять согласованный набор `/api/projects/{projectId}/ds/**` в `ds-service` после project-scoped авторизации и SHALL переписывать публичный префикс во внутренний `/api/ds` без изменения остатка пути и query string.

#### Scenario: Вызов перенесённого маршрута

- **WHEN** авторизованный клиент вызывает маршрут из route manifest `ds-service`
- **THEN** Gateway MUST передать запрос в `ds-service`
- **AND** MUST сохранить HTTP-метод, query string, тело и допустимые заголовки
- **AND** MUST установить trusted context из Auth Helper

#### Scenario: Исключённый маршрут временно остаётся в db-service

- **WHEN** клиент вызывает исключённый маршрут `/api/projects/{projectId}/ds/legacy/**`
- **THEN** Gateway MUST ответить `404`: upstream db-service удалён
- **AND** общее правило `/ds/**` MUST направлять разрешённый набор в `ds-service`

#### Scenario: Атомарный откат

- **WHEN** оператор откатывает предметный API
- **THEN** откат выполняется версией образа `ds-service`
- **AND** конфигурация Gateway MUST остаться прежней: единственный upstream предметного API — `ds-service`

### Requirement: Успешный CORS preflight допускает ограниченное переиспользование

Публичный Ktor-вход backend-kt/app SHALL возвращать `Access-Control-Max-Age: 600` для успешного OPTIONS разрешённого origin при локальном и production-запуске с корректным `Vary: Origin`. Оптимизация SHALL NOT расширять допустимые origin, методы или заголовки и SHALL NOT кешировать решение авторизации фактической команды.

#### Scenario: Повторный запрос разрешённого origin
- **WHEN** браузер повторяет запрос с тем же CORS-контекстом в пределах объявленного времени
- **THEN** успешный preflight MUST быть пригоден для переиспользования браузером
- **THEN** фактический GET или изменяющий запрос MUST по-прежнему проходить прежнюю авторизацию шлюза

#### Scenario: Запрещённый origin
- **WHEN** OPTIONS получен от origin вне разрешённого списка
- **THEN** Gateway MUST NOT возвращать разрешающий CORS-ответ для этого origin
- **THEN** наличие кеша другого origin MUST NOT давать доступ

#### Scenario: Доступ отозван после preflight
- **WHEN** браузер сохранил успешный preflight, но право на проект отозвано
- **THEN** последующий предметный запрос MUST быть отклонён серверной авторизацией

### Requirement: Оптимизация сохраняет публичную границу монолита

Подсчёт каталога SHALL выполняться внутри процесса через прикладные интерфейсы. Оптимизация SHALL NOT открывать внутренние маршруты или обходить пользовательскую авторизацию. Исторические nginx-конфигурации SHALL NOT изменяться.

#### Scenario: Прямой вызов внутреннего пути
- **WHEN** клиент обращается к /internal/** или прямому /api/ds/** через публичный порт
- **THEN** app MUST сохранять действующий запрет обхода project-scoped авторизации
- **THEN** публичный список MUST включать только проекты user-scoped контекста
