# project-member-lookup Specification

## Purpose
TBD - created by archiving change plasmabldr-137-add-project-member-lookup. Update Purpose after archive.
## Requirements
### Requirement: Add project member by registered identity

Система SHALL позволять Owner и Maintainer добавлять участника проекта по email или username, если пользователь уже зарегистрирован в Keycloak.

#### Scenario: Registered user is added

- **WHEN** Owner отправляет `POST /projects/{projectId}/members` с email зарегистрированного пользователя и role `editor`
- **THEN** система MUST найти пользователя в Keycloak, получить stable `userId` и создать project membership с role `editor`

#### Scenario: Maintainer adds Viewer

- **WHEN** Maintainer отправляет `POST /projects/{projectId}/members` с email зарегистрированного пользователя и role `viewer`
- **THEN** система MUST создать project membership с role `viewer`

#### Scenario: Registered user is added by username

- **WHEN** Owner отправляет `POST /projects/{projectId}/members` с username зарегистрированного пользователя в поле `email`
- **THEN** система MUST найти пользователя по точному email или username
- **THEN** система MUST создать membership по stable `userId`

### Requirement: Registered users can be searched for member selection

Projects Service SHALL предоставлять authenticated пользователю поиск зарегистрированных Keycloak users по имени, username или электронной почте.

#### Scenario: Пользователь ищет кандидата

- **WHEN** authenticated user вызывает `GET /projects/member-candidates?query={query}` с запросом длиной не менее двух символов
- **THEN** система MUST вернуть не более 10 зарегистрированных пользователей, совпадающих по имени, username или электронной почте
- **THEN** каждый элемент MUST содержать stable `userId`, `username`, `email` и `displayName`, если соответствующие поля доступны

### Requirement: Member lists expose human-readable identities

Projects Service SHALL включать доступные `displayName`, `username` и `email` зарегистрированного пользователя в responses участника и владельца проекта, чтобы UI мог отображать и фильтровать людей без использования opaque `userId`.

#### Scenario: Участники отображаются по имени и почте

- **WHEN** authenticated project member запрашивает проект и список его участников
- **THEN** responses MUST содержать доступные identity attributes владельца и участников
- **THEN** отсутствие необязательного identity attribute MUST NOT изменять stable `userId` membership

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
