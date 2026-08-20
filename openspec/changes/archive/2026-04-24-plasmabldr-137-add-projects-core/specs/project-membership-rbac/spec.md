## ADDED Requirements

### Requirement: Project member roles

Система SHALL поддерживать project member roles `viewer`, `editor` и `maintainer`.

#### Scenario: Добавление member role

- **WHEN** authorized actor добавляет пользователя в проект с role `viewer`, `editor` или `maintainer`
- **THEN** система MUST создать membership с указанной role

#### Scenario: Попытка добавить owner role

- **WHEN** actor пытается создать `project_members` запись с role `owner`
- **THEN** система MUST отклонить запрос

### Requirement: Maintainer can manage non-owner members

Система SHALL позволять Maintainer управлять участниками только в пределах ролей `viewer`, `editor`, `maintainer`.

#### Scenario: Maintainer меняет роль Editor на Viewer

- **WHEN** Maintainer отправляет запрос смены роли member с `editor` на `viewer`
- **THEN** система MUST обновить role

#### Scenario: Maintainer пытается назначить Owner

- **WHEN** Maintainer пытается назначить пользователю Owner
- **THEN** система MUST вернуть `403 Forbidden`

### Requirement: Owner can manage project members

Система SHALL позволять Owner управлять участниками проекта.

#### Scenario: Owner удаляет Maintainer

- **WHEN** Owner удаляет member с role `maintainer`
- **THEN** система MUST удалить membership

### Requirement: System admin has project override

Система SHALL позволять `system_admin` выполнять project administration без membership.

#### Scenario: System admin читает проект

- **WHEN** пользователь с global role `system_admin` запрашивает любой project
- **THEN** система MUST разрешить доступ без `project_members` записи

### Requirement: Internal project role check

Projects Service SHALL предоставлять internal API для определения effective project role пользователя.

#### Scenario: Пользователь является Owner

- **WHEN** Auth Helper запрашивает role check для `userId`, равного `ownerUserId`
- **THEN** Projects Service MUST вернуть effective role `owner`

#### Scenario: Пользователь не является участником

- **WHEN** Auth Helper запрашивает role check для пользователя без membership
- **THEN** Projects Service MUST вернуть ответ, позволяющий Gateway отклонить запрос как `403 Forbidden`
