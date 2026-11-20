## MODIFIED Requirements

### Requirement: Canonical project authorization policy

Система SHALL хранить единый versioned machine-readable policy artifact, определяющий каталог project permissions, наследование project roles, grants ролей, допустимые PAT scopes и `system_admin` override.

#### Scenario: Сервисы используют один policy artifact

- **WHEN** Projects Service и Documentation Service собираются для одного release
- **THEN** оба сервиса MUST получить один и тот же canonical policy artifact
- **AND** локальные service-конфигурации MUST NOT определять независимые копии role grants или scope catalog

#### Scenario: Policy содержит неизвестный permission

- **WHEN** role grant, inheritance или PAT scope ссылается на permission вне каталога
- **THEN** validation MUST завершиться ошибкой
- **AND** сервис MUST NOT начать обслуживать traffic с частично загруженной policy

## REMOVED Requirements

### Requirement: Unified permission evaluation for actors

**Reason**: Прежний контракт проектных ключей заменяется самостоятельным контрактом PAT.

**Migration**: Использовать требование «Проверка разрешений пользователей и PAT» этого изменения; старые проектные секреты отключаются без преобразования.

## ADDED Requirements

### Requirement: Проверка разрешений пользователей и PAT
Policy evaluator SHALL проверять user actor по grants effective project role, PAT actor — по пересечению актуальных прав владельца (проектная роль либо глобальный администратор) и точного набора scopes, а OAuth-пользователя `system_admin` — через global override; `ds-service` MUST использовать этот evaluator для каждого предметного маршрута.

#### Scenario: User role имеет permission

- **WHEN** trusted user actor имеет effective role, grants которой содержат требуемый permission
- **THEN** evaluator SHALL разрешить действие

#### Scenario: PAT не имеет permission

- **WHEN** trusted PAT actor не содержит требуемый permission в `X-Project-Scopes`
- **THEN** evaluator MUST запретить действие

#### Scenario: System admin использует override

- **WHEN** trusted user actor имеет global role `system_admin`
- **THEN** evaluator SHALL разрешить permission, известный текущей policy

#### Scenario: ds-service не получил trusted principal

- **WHEN** запрос достиг `ds-service` без полного набора trusted-полей для объявленного actor type
- **THEN** сервис MUST отклонить запрос без permissive fallback
- **AND** MUST NOT выполнять предметный запрос


#### Scenario: PAT не обходит ограничения роли

- **WHEN** PAT содержит нужный scope, но владелец не является глобальным администратором и его актуальная проектная роль не разрешает операцию
- **THEN** evaluator MUST запретить действие

#### Scenario: Глобальный администратор с PAT

- **WHEN** операция выполняется с PAT владельца с глобальными административными правами
- **THEN** evaluator MUST разрешить проектный доступ без членства, но MUST проверить scopes и отказать при отсутствии требуемого scope
