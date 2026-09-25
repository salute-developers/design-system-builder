## ADDED Requirements

### Requirement: Interactive user OAuth session support

`core-auth` SHALL предоставлять resolver пользовательской OAuth-сессии (access token в памяти, ссылка на refresh token в защищённом хранилище) как второй, параллельный источник учётных данных наравне с существующим `ApiKeyResolver`. `core-network` SHALL поддерживать авторизацию `Authorization: Bearer <jwt>` в дополнение к существующей `Authorization: ProjectKey <key>`.

#### Scenario: core-auth предоставляет resolver пользовательской сессии

- **WHEN** клиентский модуль (например `:plugins:android-studio`) запрашивает у `core-auth` текущие учётные данные пользователя
- **THEN** `core-auth` предоставляет тип, отдельный от `ApiKeyResolver`, который отдаёт access token из памяти и не хранит его в открытом виде на диске

#### Scenario: core-network поддерживает Bearer-авторизацию

- **WHEN** HTTP-клиент `core-network` формирует запрос с пользовательской OAuth-сессией в качестве источника credential
- **THEN** клиент MUST устанавливать заголовок `Authorization: Bearer <access-token>` вместо `Authorization: ProjectKey <key>`

#### Scenario: Существующий project-key флоу не меняется

- **WHEN** клиентский модуль продолжает использовать `ApiKeyResolver` (например `:cli`)
- **THEN** поведение `core-network` для `ProjectKey`-авторизации остаётся прежним

#### Scenario: core-auth не зависит от других core-* модулей

- **WHEN** разработчик инспектирует Gradle-зависимости `core-auth` после добавления resolver'а пользовательской сессии
- **THEN** `core-auth` по-прежнему не зависит от `core-domain`, `core-network`, `core-workspace`, `core-application` или любого `feature-*` модуля
