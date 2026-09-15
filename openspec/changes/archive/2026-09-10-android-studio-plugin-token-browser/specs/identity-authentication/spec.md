## ADDED Requirements

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
