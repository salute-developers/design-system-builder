## ADDED Requirements

### Requirement: Локальный интерактивный каталог gateway API
Система MUST предоставлять одну локальную команду, запускающую Scalar UI с отдельными OpenAPI-источниками Authentication, Projects, Design systems и Documentation. UI MUST позволять отправлять запросы из каждого источника.

#### Scenario: Запуск локального API Reference
- **WHEN** разработчик запускает предусмотренную команду без дополнительных target
- **THEN** открывается Scalar UI с тремя источниками и Local gateway `http://localhost:8080`

### Requirement: Преобразование public paths на уровне сервиса
Система MUST преобразовывать все paths каждого зарегистрированного сервиса по одному service-level правилу source prefix → gateway prefix. Система MUST NOT требовать регистрации отдельных операций или выводить правила из nginx.

#### Scenario: Преобразование Design systems API
- **WHEN** документ `ds-service` содержит путь с префиксом `/api/ds`
- **THEN** опубликованный для Scalar путь начинается с `/api/projects/{projectId}/ds` и содержит обязательный параметр `projectId`

### Requirement: Выбор target gateway
Система MUST включать в каждый источник Local server и MUST добавлять Dev или Production server только когда соответствующий URL передан через переменную окружения. Система MUST использовать выбранный Scalar server для запросов через same-origin local proxy с закрытым каталогом настроенных gateway URL.

#### Scenario: Добавление Dev gateway
- **WHEN** при запуске задан `DS_API_REFERENCE_DEV_GATEWAY`
- **THEN** в каждом источнике доступен server Dev, а его same-origin proxy направляет запросы на этот URL

### Requirement: Публичная авторизация в преобразованных документах
Система MUST удалять из gateway-facing документов служебные trusted-header parameters и MUST описывать Bearer authentication для операций, требующих авторизации. Система MUST NOT публиковать endpoint, не покрытый service-level source prefix.

#### Scenario: Документ Projects не запрашивает внутренние headers
- **WHEN** исходная Projects OpenAPI-операция содержит `X-User-Id` или другой trusted-header parameter
- **THEN** преобразованная операция использует Bearer security и не содержит этот parameter

### Requirement: Безопасное предзаполнение запросов
Система MUST передавать в Scalar OpenAPI defaults и examples, уже известные контракту. Система MUST NOT добавлять пароль или Bearer token в defaults. Система MUST применять `DS_API_REFERENCE_PROJECT_ID` как default для параметра `projectId`, только когда переменная задана разработчиком.

#### Scenario: Предзаполнение локального projectId
- **WHEN** инструмент запущен с `DS_API_REFERENCE_PROJECT_ID`
- **THEN** project-scoped requests получают это значение в поле `projectId`

### Requirement: Интерактивные credentials и project context
Система MUST предоставлять Scalar OAuth2 password flow для защищённых gateway-facing документов. Scalar MUST получать access token через выбранный target gateway, не требуя ручного переноса токена в Bearer field. Локальная страница API Reference MUST предоставлять control `Project ID`; после его применения значение MUST использоваться как default каждого project-scoped path parameter. Страница MUST NOT требовать перехода во внешний Scalar API Client для выбора project context.

#### Scenario: Получение токена и выбор проекта в Scalar UI
- **WHEN** разработчик вводит username и password в OAuth2 password flow и выполняет авторизацию
- **THEN** Scalar запрашивает token через выбранный Local, Dev или Production target и применяет его к защищённым запросам текущего источника без копирования access token
- **AND WHEN** разработчик задаёт `Project ID` в локальной странице API Reference
- **THEN** все project-scoped requests источника Design systems используют это значение

### Requirement: Получение токена через публичный gateway контракт
Authentication source MUST документировать `POST /auth/token` как form-urlencoded запрос и ответ с access token. Он MUST NOT публиковать `/internal/**` endpoints identity-gateway. Scalar MUST не сохранять учётные данные между перезагрузками по умолчанию.

#### Scenario: Получение access token
- **WHEN** разработчик отправляет корректные учётные данные на `/auth/token`
- **THEN** Scalar отображает ответ gateway с access token, который можно применить как Bearer credential для остальных источников
