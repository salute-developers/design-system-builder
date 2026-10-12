## ADDED Requirements

### Requirement: ds-service переиспользует authorization-core

`ds-service` SHALL зависеть от существующего `backend-kt/authorization-core` и MUST использовать его `AuthorizationPolicyLoader`, `PolicyEvaluator`, `TrustedProjectPrincipalFactory`, `AuthorizationPolicy`, `ProjectPrincipal` и `PolicyDiagnostics` как единственную реализацию загрузки policy, trusted principal и вычисления permissions.

#### Scenario: Создание RBAC runtime

- **WHEN** `ds-service` запускается
- **THEN** приложение MUST загрузить policy через `AuthorizationPolicyLoader`
- **AND** MUST создать один immutable `PolicyEvaluator`, передаваемый всем feature-модулям через DI

#### Scenario: Разбор trusted headers

- **WHEN** `ds-service` получает запрос с trusted headers
- **THEN** presentation-адаптер MUST создать principal через `TrustedProjectPrincipalFactory`
- **AND** MUST NOT использовать локальную копию parser или собственную модель principal

#### Scenario: Проверка permission

- **WHEN** use case проверяет доступ к операции
- **THEN** тонкий адаптер `DsAccessPolicy` MUST делегировать решение `PolicyEvaluator.isAllowed`
- **AND** `ds-service` MUST NOT реализовывать собственные role inheritance, scope matching или `system_admin` override

### Requirement: Матрица permissions предметного API

`ds-service` SHALL применять permission общей policy по предметной группе и действию до обращения к данным.

| Группа операций | Чтение | Создание и изменение | Удаление |
|---|---|---|---|
| Дизайн-системы, версии, журнал изменений | `design-systems:read` | `design-systems:write` | `design-systems:delete` |
| Темы и связанные значения темы | `tenants:read` | `tenants:write` | `tenants:delete` |
| Токены, значения токенов и палитра | `tokens:read` | `tokens:write` | `tokens:delete` |
| Компоненты, связи дизайн-системы, зависимости и reuse-конфигурации | `components:read` | `components:write` | `components:delete` |
| Вариации, свойства, платформенные корректировки, внешние виды, стили, состояния и комбинации | `components:variations:read` | `components:variations:write` | `components:variations:delete` |
| `component-config` | `components:read` для `GET` и `export` | `components:write` для `import` | неприменимо |

#### Scenario: Чтение разрешено

- **WHEN** principal имеет permission чтения из строки соответствующей группы
- **THEN** `ds-service` MUST продолжить проверку ownership и выполнение запроса

#### Scenario: Мутация использует точное действие

- **WHEN** principal вызывает `POST` или `PATCH`
- **THEN** `ds-service` MUST потребовать permission записи соответствующей группы
- **AND** при `DELETE` MUST потребовать permission удаления

#### Scenario: Permission отсутствует в canonical policy

- **WHEN** route manifest требует permission, которого нет в каталоге policy
- **THEN** проверка конфигурации MUST завершиться ошибкой
- **AND** readiness `ds-service` MUST сообщить неготовность

### Requirement: Защита глобального предметного слоя

`ds-service` SHALL разрешать project principal чтение глобальных данных только через доступную ему глобальную дизайн-систему и SHALL запрещать обычному project principal создавать, изменять или удалять глобальные записи.

#### Scenario: Чтение глобальной дизайн-системы

- **WHEN** principal имеет требуемый read permission и запрашивает дизайн-систему с `project_id IS NULL`, доступную текущей модели
- **THEN** `ds-service` MUST вернуть её данные без назначения их проекту

#### Scenario: Изменение глобального слоя обычным участником проекта

- **WHEN** user или project key без `system_admin` пытается изменить глобальную запись
- **THEN** `ds-service` MUST вернуть `403 Forbidden`
- **AND** MUST NOT выполнять мутацию

#### Scenario: Доверенный импорт глобальных компонентов

- **WHEN** доверенный внутренний клиент вызывает защищённый импорт с проверенным `system_admin` principal
- **THEN** `ds-service` MAY изменить глобальный компонентный слой
- **AND** вызов MUST пройти обычную проверку известного policy permission и аудит

## MODIFIED Requirements

### Requirement: Unified permission evaluation for actors

Policy evaluator SHALL проверять user actor по grants effective project role, project key actor — по точному набору trusted scopes, а `system_admin` — через global override; `ds-service` MUST использовать этот evaluator для каждого предметного маршрута.

#### Scenario: User role имеет permission

- **WHEN** trusted user actor имеет effective role, grants которой содержат требуемый permission
- **THEN** evaluator SHALL разрешить действие

#### Scenario: Project key не имеет permission

- **WHEN** trusted project key actor не содержит требуемый permission в `X-Project-Scopes`
- **THEN** evaluator MUST запретить действие

#### Scenario: System admin использует override

- **WHEN** trusted user actor имеет global role `system_admin`
- **THEN** evaluator SHALL разрешить permission, известный текущей policy

#### Scenario: ds-service не получил trusted principal

- **WHEN** запрос достиг `ds-service` без полного набора trusted-полей для объявленного actor type
- **THEN** сервис MUST отклонить запрос без permissive fallback
- **AND** MUST NOT выполнять предметный запрос

### Requirement: Fail-closed policy loading

Каждый service consumer, включая `ds-service`, MUST загрузить и полностью провалидировать immutable policy до readiness и MUST диагностировать используемые `policyVersion` и content hash без раскрытия credentials.

#### Scenario: Policy отсутствует

- **WHEN** configured policy artifact отсутствует или не читается
- **THEN** service readiness MUST сообщить неготовность
- **AND** service MUST NOT использовать permissive fallback

#### Scenario: Policy успешно загружена

- **WHEN** policy соответствует schema и проходит semantic validation
- **THEN** service SHALL использовать её неизменный snapshot до следующего старта
- **AND** diagnostics SHALL содержать `policyVersion` и content hash

#### Scenario: Policy не покрывает route manifest

- **WHEN** startup validation `ds-service` обнаруживает route без известного permission
- **THEN** readiness MUST сообщить неготовность
- **AND** ни один предметный маршрут MUST NOT обслуживать traffic

### Requirement: Permission check не заменяет project ownership

Permission evaluation SHALL определять право actor на тип действия, а `ds-service` как владелец предметного ресурса MUST отдельно ограничивать ресурс trusted `projectId`, включая владение через дизайн-систему и промежуточные связи.

#### Scenario: Actor имеет permission на чужой resource

- **WHEN** actor имеет требуемый permission, но resource принадлежит другому project
- **THEN** owning service MUST вернуть `404 Not Found`
- **AND** MUST NOT раскрывать существование resource

#### Scenario: Actor не имеет permission

- **WHEN** trusted actor не имеет permission для endpoint
- **THEN** service MUST вернуть `403 Forbidden`
- **AND** MUST NOT выполнять mutation или другой побочный эффект

#### Scenario: Владение определяется косвенной связью

- **WHEN** компонентная сущность не содержит прямого `project_id`
- **THEN** `ds-service` MUST проверить доступ через цепочку связей до дизайн-системы текущего проекта или разрешённой глобальной дизайн-системы
- **AND** MUST вернуть `404 Not Found`, если допустимой цепочки нет
