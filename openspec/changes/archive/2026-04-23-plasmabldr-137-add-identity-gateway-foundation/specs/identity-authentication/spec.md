## ADDED Requirements

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
