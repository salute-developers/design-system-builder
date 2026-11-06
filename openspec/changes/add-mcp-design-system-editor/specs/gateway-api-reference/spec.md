## MODIFIED Requirements

### Requirement: Преобразование public paths на уровне сервиса

Система MUST преобразовывать пути по общей декларативной классификации областей project, DS, catalog и admin. Правила MUST соответствовать регистрации публичных маршрутов и MUST NOT поддерживаться отдельным ручным списком операций в API Reference или выводиться из nginx.

#### Scenario: Преобразование Design systems API

- **WHEN** документ ds-service описывает ресурс конкретной DS
- **THEN** опубликованный путь MUST начинаться с /api/projects/{projectId}/design-systems/{designSystemId} и содержать оба обязательных path-параметра
- **THEN** коллекция систем MUST требовать только projectId, а каталоговые и административные операции MUST сохранять свои отдельные области


### Requirement: Публичная авторизация в преобразованных документах

Система MUST удалять из gateway-facing документов служебные trusted-header parameters и MUST описывать Bearer authentication для операций, требующих авторизации. Система MUST NOT публиковать endpoint, не покрытый декларативной областью сервиса.

#### Scenario: Документ Projects не запрашивает внутренние headers

- **WHEN** исходная Projects OpenAPI-операция содержит `X-User-Id` или другой trusted-header parameter
- **THEN** преобразованная операция использует Bearer security и не содержит этот parameter
