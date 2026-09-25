# identity-authentication Specification

## Purpose
TBD - created by archiving change plasmabldr-137-add-identity-gateway-foundation. Update Purpose after archive.
## Requirements
### Requirement: Keycloak user authentication

Система SHALL использовать Keycloak как identity provider для регистрации и аутентификации пользователей.

#### Scenario: Пользователь проходит login

- **WHEN** зарегистрированный пользователь проходит login через Keycloak
- **THEN** Keycloak MUST выдать JWT, который содержит stable user identifier в `sub`

#### Scenario: Пользователь проходит self-registration

- **WHEN** новый пользователь проходит self-registration через Keycloak
- **THEN** система MUST создать identity в Keycloak без создания project membership

### Requirement: Global roles in JWT

Система SHALL использовать Keycloak global roles для platform-level доступа.

#### Scenario: Обычный пользователь получает token

- **WHEN** пользователь с ролью `user` получает JWT
- **THEN** JWT MUST позволять Auth Helper определить global role `user`

#### Scenario: System admin получает token

- **WHEN** пользователь с ролью `system_admin` получает JWT
- **THEN** JWT MUST позволять Auth Helper определить global role `system_admin`

### Requirement: JWT validation

Auth Helper SHALL проверять JWT перед тем, как Gateway пропустит запрос к защищенному API.

#### Scenario: Валидный JWT

- **WHEN** клиент отправляет запрос с валидным Keycloak JWT
- **THEN** Auth Helper MUST подтвердить подпись, issuer, audience и срок действия token

#### Scenario: Невалидный JWT

- **WHEN** клиент отправляет запрос с отсутствующим, истекшим или неверно подписанным JWT
- **THEN** Gateway MUST вернуть `401 Unauthorized`

### Requirement: Native/IDE client authorization

Keycloak realm `dsbuilder` SHALL предоставлять отдельного публичного клиента для нативных/IDE-клиентов DS Builder (начиная с плагина Android Studio / IntelliJ IDEA), использующего Authorization Code flow с обязательным PKCE и без Resource Owner Password Credentials flow.

#### Scenario: Клиент требует PKCE

- **WHEN** нативный/IDE-клиент инициирует Authorization Code flow через клиент `dsbuilder-studio-plugin`
- **THEN** Keycloak MUST требовать `code_challenge` и `code_challenge_method=S256` для завершения flow

#### Scenario: ROPC недоступен для нативного клиента

- **WHEN** клиент `dsbuilder-studio-plugin` пытается получить токен через Resource Owner Password Credentials grant
- **THEN** Keycloak MUST отклонить запрос, так как `directAccessGrantsEnabled` для этого клиента выключен

#### Scenario: Redirect ограничен loopback-адресом

- **WHEN** Keycloak завершает Authorization Code flow для клиента `dsbuilder-studio-plugin`
- **THEN** допустимый `redirect_uri` MUST соответствовать шаблону `http://127.0.0.1:{port}/callback`, где `{port}` — локальный эфемерный порт клиента
- **THEN** Keycloak MUST отклонить `redirect_uri`, не соответствующий этому шаблону

#### Scenario: Выпущенный токен проходит проверку gateway

- **WHEN** клиент `dsbuilder-studio-plugin` обменивает authorization code на токены
- **THEN** выпущенный access token MUST содержать `aud` claim, равный значению, которое ожидает `KeycloakJwtVerifier` на identity-gateway (`dsbuilder-api`)

