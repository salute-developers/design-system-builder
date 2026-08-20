## ADDED Requirements

### Requirement: Add project member by registered email

Система SHALL позволять Owner и Maintainer добавлять участника проекта по email, если пользователь уже зарегистрирован в Keycloak.

#### Scenario: Registered user is added

- **WHEN** Owner отправляет `POST /projects/{projectId}/members` с email зарегистрированного пользователя и role `editor`
- **THEN** система MUST найти пользователя в Keycloak, получить stable `userId` и создать project membership с role `editor`

#### Scenario: Maintainer adds Viewer

- **WHEN** Maintainer отправляет `POST /projects/{projectId}/members` с email зарегистрированного пользователя и role `viewer`
- **THEN** система MUST создать project membership с role `viewer`

### Requirement: Missing user does not create invite

Система SHALL отклонять добавление member, если email не найден в Keycloak, и MUST NOT создавать pending invite.

#### Scenario: Email is not registered

- **WHEN** Owner отправляет add-member request с email, которого нет в Keycloak
- **THEN** система MUST вернуть client error и MUST NOT создать membership или invitation

### Requirement: Membership stores stable user id

Система SHALL хранить project membership по stable Keycloak `userId`, а не по email.

#### Scenario: User found by email

- **WHEN** Keycloak lookup возвращает `userId` для email
- **THEN** система MUST сохранить membership с этим `userId`

### Requirement: Keycloak lookup stays outside domain

Projects Service SHALL обращаться к Keycloak через application port и data adapter.

#### Scenario: Use case adds member by email

- **WHEN** add-member use case выполняет lookup пользователя
- **THEN** use case MUST depend on identity lookup port and MUST NOT depend on Keycloak SDK types
