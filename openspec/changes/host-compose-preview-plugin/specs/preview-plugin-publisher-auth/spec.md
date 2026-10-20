## ADDED Requirements

### Requirement: Служебная учётка публикации заведена в Keycloak

Realm Keycloak SHALL содержать confidential-клиент `dsbuilder-preview-publisher` с `serviceAccountsEnabled`, без standard flow и direct access grants, и роль realm `compose_preview_publisher`, назначенную service account этого клиента. Токены клиента MUST содержать audience API, которую принимает gateway. Определения MUST входить в realm локального контура и в bootstrap production-контура.

#### Scenario: Токен служебной учётки получается через gateway

- **WHEN** CLI запрашивает токен `client_credentials` по пути `/realms/<realm>/protocol/openid-connect/token` gateway
- **THEN** Keycloak MUST выдать токен, содержащий роль `compose_preview_publisher` и audience API.

#### Scenario: Вход по паролю закрыт

- **WHEN** выполняется вход по паролю клиентом `dsbuilder-preview-publisher`
- **THEN** Keycloak MUST отказать.

### Requirement: Gateway передаёт роль публикации доверенным заголовком

`identity-gateway` SHALL сопоставлять роль `compose_preview_publisher` из токена с глобальной ролью и передавать вниз по цепочке доверенный заголовок `X-Compose-Preview-Publisher` со значением `true` или `false`. Входящий заголовок снаружи MUST удаляться, как остальные доверенные заголовки.

#### Scenario: Роль в токене

- **WHEN** токен содержит роль `compose_preview_publisher`
- **THEN** gateway MUST передать `X-Compose-Preview-Publisher: true`.

#### Scenario: Подделка заголовка снаружи

- **WHEN** внешний клиент отправляет собственный `X-Compose-Preview-Publisher: true`
- **THEN** gateway MUST заменить его значением по токену.

### Requirement: Маршрут публикации принимает большой запрос и только токены пользователей

Gateway SHALL публиковать `POST /api/admin/compose-preview/plugin-builds` с лимитом тела, достаточным для архива плагина, с проверкой токена через `auth_request` и MUST отвергать токен ключа проекта. Существующие лимиты других маршрутов MUST NOT меняться.

#### Scenario: Токен ключа проекта

- **WHEN** запрос публикации выполнен с ключом проекта
- **THEN** gateway MUST ответить `401`.

#### Scenario: Архив допустимого размера

- **WHEN** тело запроса не превышает лимит
- **THEN** gateway MUST передать запрос в `ds-service`.

### Requirement: Роль публикации не расширяет права на другие маршруты

Служебная учётка с ролью публикации SHALL иметь доступ только к маршруту публикации. Импорт `import-api-meta` MUST оставаться доступным только системному администратору, а проектные маршруты MUST требовать членства в проекте.

#### Scenario: Импорт меты служебной учёткой

- **WHEN** служебная учётка вызывает `POST /api/admin/component-config/import-api-meta`
- **THEN** ds-service MUST ответить отказом в доступе.

#### Scenario: Проектный маршрут служебной учёткой

- **WHEN** служебная учётка вызывает проектный маршрут компонентов
- **THEN** доступ MUST быть отклонён из-за отсутствия членства в проекте.

### Requirement: Учётные данные не попадают в логи

Секрет клиента SHALL передаваться только через окружение процесса и MUST NOT попадать в аргументы команд, в лог CLI и в лог сервисов.

#### Scenario: Вывод CLI

- **WHEN** CLI публикует плагин служебной учёткой
- **THEN** ни стандартный вывод, ни вывод ошибок MUST NOT содержать секрет клиента и полученный токен.
