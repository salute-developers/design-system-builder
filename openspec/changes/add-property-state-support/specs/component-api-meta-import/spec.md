## ADDED Requirements

### Requirement: API meta import maintains state support

Свойство манифеста SHALL допускать поле `stateSupport` вида `{ "states": [<имя>, ...], "combinations": <bool> }`.
Импорт SHALL разрешать имена состояний в пределах компонента свойства по требованию «Состояния свойства принадлежат
его компоненту» возможности `component-property-state-support`. Состояния компонента из того же манифеста SHALL
разрешаться после их создания. Импорт SHALL записывать признак у создаваемого свойства. У существующего свойства
платформы запроса импорт SHALL обновлять признак, если отличается флаг `combinations` или множество разрешённых
идентификаторов. Это второе, наряду со статусом устаревания алиаса, исключение из правила «существующие строки не
меняются».

#### Scenario: Новое свойство с признаком

- **WHEN** импорт создаёт свойство Compose `DropZone.paddingStart`, пришедшее с `stateSupport: { "states": ["pressed", "dragging-over"], "combinations": true }`
- **THEN** `state_combinations` созданного свойства MUST быть `true`
- **THEN** в `property_supported_states` MUST быть общий `pressed` и `dragging-over` компонента `DropZone`

#### Scenario: Признак изменился

- **WHEN** у существующего свойства признак не задан или его список отличается от манифеста
- **THEN** список и флаг MUST стать такими, как в манифесте
- **THEN** `stateSupportChanged` MUST увеличиться на единицу

#### Scenario: Имя не разрешается

- **WHEN** имя из `stateSupport.states` не является ни общим состоянием, ни состоянием компонента свойства
- **THEN** импорт MUST NOT включать это имя в список и MUST NOT создавать по нему состояние
- **THEN** отчёт MUST содержать строку `<Компонент>.<свойство>: <имя>` в `unresolvedStates`
- **THEN** остальная часть свойства MUST импортироваться

#### Scenario: Поля нет в манифесте

- **WHEN** свойство манифеста не содержит `stateSupport`
- **THEN** backend MUST NOT менять признак существующего свойства, а новое свойство MUST получить незаданный признак

#### Scenario: Некорректная форма

- **WHEN** `stateSupport` не объект с массивом строк `states` и булевым `combinations`
- **THEN** backend MUST ответить ошибкой валидации и MUST NOT изменить данные

#### Scenario: Расхождение типа

- **WHEN** свойство попало в `typeMismatches`
- **THEN** признак MUST обновляться по тем же правилам, что и у свойства без расхождения

#### Scenario: Повторный импорт и dry run

- **WHEN** тот же манифест применён повторно
- **THEN** `stateSupportChanged` MUST быть равен нулю
- **WHEN** `dryRun` равен `true`
- **THEN** `stateSupportChanged` и `unresolvedStates` MUST совпадать с применением, а признаки MUST NOT измениться

## MODIFIED Requirements

### Requirement: API meta import report

Ответ SHALL содержать:

- счётчики `createdComponents`, `createdProperties`, `createdStates`, `createdAliases`, `unchangedProperties`,
  `deprecatedMarked`, `deprecatedMessageChanged`, `deprecatedCleared` и `stateSupportChanged`;
- списки `rejected`, `typeMismatches`, `absent` и `unresolvedStates`.

Счётчика привязок к дизайн-системам MUST NOT быть.

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
