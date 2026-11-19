## ADDED Requirements

### Requirement: API meta import maintains state support

Свойство манифеста SHALL допускать поле `stateSupport` со значением `none`, `interaction` или `any`. Импорт SHALL записывать
признак у создаваемого свойства и SHALL обновлять его у существующего свойства платформы запроса, если значение
отличается. Это второе, наряду со статусом устаревания алиаса, исключение из правила «существующие строки не
меняются».

#### Scenario: Новое свойство с признаком

- **WHEN** импорт создаёт свойство, пришедшее с `stateSupport: "any"`
- **THEN** у созданного свойства `state_support` MUST быть `any`

#### Scenario: Признак изменился

- **WHEN** у существующего свойства `state_support` равен `NULL` или `none`, а в манифесте пришло `interaction`
- **THEN** признак MUST стать `interaction`
- **THEN** `stateSupportChanged` MUST увеличиться на единицу

#### Scenario: Поля нет в манифесте

- **WHEN** свойство манифеста не содержит `stateSupport`
- **THEN** backend MUST NOT менять признак существующего свойства, а новое свойство MUST получить `NULL`

#### Scenario: Недопустимое значение

- **WHEN** `stateSupport` не равен `none`, `interaction` или `any`
- **THEN** backend MUST ответить ошибкой валидации и MUST NOT изменить данные

#### Scenario: Расхождение типа

- **WHEN** свойство попало в `typeMismatches`
- **THEN** признак MUST обновляться по тем же правилам, что и у свойства без расхождения

#### Scenario: Повторный импорт и dry run

- **WHEN** тот же манифест применён повторно
- **THEN** `stateSupportChanged` MUST быть равен нулю
- **WHEN** `dryRun` равен `true`
- **THEN** `stateSupportChanged` MUST совпадать с применением, а признаки MUST NOT измениться

## MODIFIED Requirements

### Requirement: API meta import report

Ответ SHALL содержать счётчики `createdComponents`, `createdProperties`, `createdStates`, `createdAliases`, `unchangedProperties`, `deprecatedMarked`, `deprecatedMessageChanged`, `deprecatedCleared`, `stateSupportChanged` и списки `rejected`, `typeMismatches` и `absent`. Счётчика привязок к дизайн-системам MUST NOT быть.

#### Scenario: Успешный ответ

- **WHEN** импорт завершён
- **THEN** ответ MUST иметь статус `200` и содержать все перечисленные поля
- **THEN** ответ MUST NOT содержать `createdLinks`

#### Scenario: Обновление признака не делает свойство изменённым по типу

- **WHEN** у существующего свойства того же типа изменился только `stateSupport`
- **THEN** свойство MUST учитываться в `unchangedProperties` и в `stateSupportChanged`

#### Scenario: Ошибка транзакции

- **WHEN** запись в БД завершается ошибкой
- **THEN** backend MUST откатить транзакцию и ответить `422` с кратким сообщением
- **THEN** причина MUST быть записана в лог сервера
