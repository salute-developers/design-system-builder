## REMOVED Requirements

### Requirement: Core layer module composition

**Reason**: Прежний контракт проектных ключей заменяется самостоятельным контрактом PAT.

**Migration**: Использовать требование «Модульный состав общего ядра с PAT» этого изменения; старые проектные секреты отключаются без преобразования.

### Requirement: Interactive user OAuth session support

**Reason**: Прежний контракт проектных ключей заменяется самостоятельным контрактом PAT.

**Migration**: Использовать требование «Параллельная поддержка PAT и OAuth-сессии» этого изменения; старые проектные секреты отключаются без преобразования.

## ADDED Requirements

### Requirement: Модульный состав общего ядра с PAT
`core-auth`, `core-network`, `core-workspace` и `core-domain` SHALL оставаться shared KMP layers, поддерживающими JVM,
macOS и Node.js JS для общего CLI/MCP runtime.

#### Scenario: core-domain holds shared domain models

- **WHEN** a developer inspects `core-domain`
- **THEN** the module contains `ProjectContext`, `PersonalAccessToken`, `ProjectApiUrl`, `ProjectId`, `DesignSystemId`, `CredentialEnvName`, `ProjectAccessCheck`, and `ProjectConfigDraft`
- **THEN** the module does not depend on `core-network`, `core-auth`, `core-workspace`, `core-application`, or any `feature-*` module

#### Scenario: core-auth and core-workspace have no dependency on other core-* modules

- **WHEN** a developer inspects the Gradle module dependencies of `core-auth` and `core-workspace`
- **THEN** neither module depends on `core-domain`, on each other, or on `core-network`, `core-application`, or any `feature-*` module

#### Scenario: core-network depends only on core-auth

- **WHEN** a developer inspects the Gradle module dependencies of `core-network`
- **THEN** the module depends on `core-auth` (for the shared `EnvironmentReader` port that both PAT and API-URL resolution use)
- **THEN** the module does not depend on `core-domain`, `core-workspace`, `core-application`, or any `feature-*` module

#### Scenario: core-auth определяет credential contracts

- **WHEN** разработчик инспектирует `core-auth`
- **THEN** модуль MUST содержать shared модели/порты PAT и user session credentials
- **THEN** модуль MUST NOT зависеть от MCP SDK, CLI presentation или конкретного Node/JVM filesystem API

#### Scenario: core-network поддерживает отдельные типы Bearer

- **WHEN** разработчик инспектирует `core-network`
- **THEN** authenticated HTTP boundary MUST поддерживать отдельные PAT и OAuth credentials с общей схемой `Bearer`
- **THEN** HTTP operations MUST быть suspend и MUST NOT использовать `runBlocking`

### Requirement: Параллельная поддержка PAT и OAuth-сессии
`core-auth` SHALL предоставлять resolver пользовательской OAuth-сессии (access token в памяти, ссылка на refresh token в защищённом хранилище) как второй, параллельный источник учётных данных наравне с существующим `PatResolver`. `core-network` SHALL поддерживать авторизацию `Authorization: Bearer <jwt>` в дополнение к существующей `Authorization: Bearer <PAT>`.

#### Scenario: core-auth предоставляет resolver пользовательской сессии

- **WHEN** клиентский модуль (например `:plugins:android-studio`) запрашивает у `core-auth` текущие учётные данные пользователя
- **THEN** `core-auth` предоставляет тип, отдельный от `PatResolver`, который отдаёт access token из памяти и не хранит его в открытом виде на диске

#### Scenario: core-network поддерживает Bearer-авторизацию

- **WHEN** HTTP-клиент `core-network` формирует запрос с пользовательской OAuth-сессией в качестве источника credential
- **THEN** клиент MUST устанавливать заголовок `Authorization: Bearer <access-token>` вместо `Authorization: Bearer <PAT>`

#### Scenario: PAT не обновляется через OAuth

- **WHEN** клиентский модуль продолжает использовать `PatResolver` (например `:cli`)
- **THEN** `core-network` MUST передавать PAT как Bearer без обновления OAuth-сессии

#### Scenario: core-auth не зависит от других core-* модулей

- **WHEN** разработчик инспектирует Gradle-зависимости `core-auth` после добавления resolver'а пользовательской сессии
- **THEN** `core-auth` по-прежнему не зависит от `core-domain`, `core-network`, `core-workspace`, `core-application` или любого `feature-*` модуля
