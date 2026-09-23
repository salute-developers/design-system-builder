# project-authorization-policy Specification

## Purpose
TBD - created by archiving change introduce-project-authorization-policy. Update Purpose after archive.
## Requirements
### Requirement: Canonical project authorization policy

Система SHALL хранить единый versioned machine-readable policy artifact, определяющий каталог project permissions, наследование project roles, grants ролей, допустимые project-key scopes и `system_admin` override.

#### Scenario: Сервисы используют один policy artifact

- **WHEN** Projects Service и Documentation Service собираются для одного release
- **THEN** оба сервиса MUST получить один и тот же canonical policy artifact
- **AND** локальные service-конфигурации MUST NOT определять независимые копии role grants или scope catalog

#### Scenario: Policy содержит неизвестный permission

- **WHEN** role grant, inheritance или project-key scope ссылается на permission вне каталога
- **THEN** validation MUST завершиться ошибкой
- **AND** сервис MUST NOT начать обслуживать traffic с частично загруженной policy

### Requirement: Deterministic role inheritance

Policy evaluator SHALL детерминированно разворачивать inheritance project roles и MUST отклонять циклический или неизвестный inheritance graph.

#### Scenario: Editor наследует Viewer

- **WHEN** policy определяет `editor` с inheritance от `viewer`
- **THEN** effective grants Editor MUST содержать grants Viewer и собственные grants Editor

#### Scenario: Наследование содержит цикл

- **WHEN** policy roles образуют прямой или косвенный inheritance cycle
- **THEN** startup validation MUST завершиться ошибкой

### Requirement: Unified permission evaluation for actors

Policy evaluator SHALL проверять user actor по grants effective project role, project key actor — по точному набору trusted scopes, а `system_admin` — через global override.

#### Scenario: User role имеет permission

- **WHEN** trusted user actor имеет effective role, grants которой содержат требуемый permission
- **THEN** evaluator SHALL разрешить действие

#### Scenario: Project key не имеет permission

- **WHEN** trusted project key actor не содержит требуемый permission в `X-Project-Scopes`
- **THEN** evaluator MUST запретить действие

#### Scenario: System admin использует override

- **WHEN** trusted user actor имеет global role `system_admin`
- **THEN** evaluator SHALL разрешить permission, известный текущей policy

### Requirement: Fail-closed policy loading

Каждый service consumer MUST загрузить и полностью провалидировать immutable policy до readiness и MUST диагностировать используемые `policyVersion` и content hash без раскрытия credentials.

#### Scenario: Policy отсутствует

- **WHEN** configured policy artifact отсутствует или не читается
- **THEN** service readiness MUST сообщить неготовность
- **AND** service MUST NOT использовать permissive fallback

#### Scenario: Policy успешно загружена

- **WHEN** policy соответствует schema и проходит semantic validation
- **THEN** service SHALL использовать её неизменный snapshot до следующего старта
- **AND** diagnostics SHALL содержать `policyVersion` и content hash

### Requirement: Permission check не заменяет project ownership

Permission evaluation SHALL определять право actor на тип действия, а service owning the resource MUST отдельно ограничивать resource trusted `projectId`.

#### Scenario: Actor имеет permission на чужой resource

- **WHEN** actor имеет требуемый permission, но resource принадлежит другому project
- **THEN** owning service MUST вернуть `404 Not Found`
- **AND** MUST NOT раскрывать существование resource

#### Scenario: Actor не имеет permission

- **WHEN** trusted actor не имеет permission для endpoint
- **THEN** service MUST вернуть `403 Forbidden`
- **AND** MUST NOT выполнять mutation или другой побочный эффект
