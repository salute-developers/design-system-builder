## ADDED Requirements

### Requirement: API meta import maintains common states

Манифест SHALL допускать на верхнем уровне поле `interactionStates` — список общих состояний, которые выражает
генератор платформы. Импорт SHALL заводить в общем словаре (`states` с `component_id IS NULL`) каждое имя из списка,
которого там ещё нет, и SHALL учитывать созданные строки в `createdStates`. Существующие общие состояния и их
идентификаторы MUST NOT меняться и MUST NOT удаляться, даже если имени нет в списке.

Собственные состояния компонентов из `components[].states` SHALL заводиться как раньше, даже если имя есть в общем
словаре: так состав данных не зависит от порядка импорта платформ. Такое собственное состояние — «тень» общего: по
требованию «Имя состояния разрешается одинаково во всех путях» имя находит общее состояние.

#### Scenario: Новое общее состояние

- **WHEN** манифест View содержит `interactionStates` с `checked`, а в общем словаре `checked` нет
- **THEN** импорт MUST создать общее состояние `checked` и увеличить `createdStates`

#### Scenario: Порядок импорта платформ

- **WHEN** манифест View объявляет общее `checked`, а манифест Compose — собственное `checked` у `CheckBox`, и они импортируются в любом порядке
- **THEN** после обоих импортов MUST существовать общее `checked` и собственное `checked` у `CheckBox`
- **THEN** имя `checked` для `CheckBox` MUST разрешаться в общее состояние

#### Scenario: Список признака переходит с «тени» на новое общее состояние

- **WHEN** у свойства `CheckBox` в списке собственный `checked`, а импорт другой платформы заводит общий `checked`
- **THEN** список MUST ссылаться на общий `checked` сразу после этого импорта, без переимпорта платформы `CheckBox`

#### Scenario: Поля нет в манифесте

- **WHEN** манифест не содержит `interactionStates` (прежние версии CLI или мета прежнего генератора)
- **THEN** импорт MUST NOT менять общий словарь

#### Scenario: Dry run

- **WHEN** `dryRun` равен `true`
- **THEN** `createdStates` MUST учитывать общие состояния, которые были бы созданы, а словарь MUST NOT измениться

### Requirement: API meta import maintains state support

Свойство манифеста SHALL допускать поле `stateSupport` вида `{ "states": [<имя>, ...], "combinations": <bool> }`.
Импорт SHALL разрешать имена по требованию «Имя состояния разрешается одинаково во всех путях» возможности
`component-property-state-support`: сначала общие, затем собственные состояния компонента. Общие и собственные
состояния из того же манифеста SHALL разрешаться после их создания. Импорт SHALL записывать признак у создаваемого
свойства. У существующего свойства платформы запроса импорт SHALL обновлять признак, если отличается флаг
`combinations` или множество разрешённых идентификаторов. Это второе, наряду со статусом устаревания алиаса,
исключение из правила «существующие строки не меняются».

#### Scenario: Новое свойство с признаком

- **WHEN** импорт создаёт свойство Compose `DropZone.paddingStart`, пришедшее с `stateSupport: { "states": ["pressed", "dragging-over"], "combinations": true }`
- **THEN** `state_combinations` созданного свойства MUST быть `true`
- **THEN** в `property_supported_states` MUST быть общий `pressed` и собственный `dragging-over` компонента `DropZone`

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

- **WHEN** `stateSupport` не объект с массивом строк `states` и булевым `combinations`, либо `interactionStates` не массив непустых строк
- **THEN** backend MUST ответить ошибкой валидации и MUST NOT изменить данные

#### Scenario: Расхождение типа

- **WHEN** свойство попало в `typeMismatches`
- **THEN** признак MUST обновляться по тем же правилам, что и у свойства без расхождения

#### Scenario: Повторный импорт и dry run

- **WHEN** тот же манифест применён повторно
- **THEN** `stateSupportChanged` и `createdStates` MUST быть равны нулю
- **WHEN** `dryRun` равен `true`
- **THEN** `stateSupportChanged` и `unresolvedStates` MUST совпадать с применением, а признаки MUST NOT измениться

## MODIFIED Requirements

### Requirement: API meta import report

Ответ SHALL содержать:

- счётчики `createdComponents`, `createdProperties`, `createdStates`, `createdAliases`, `unchangedProperties`,
  `deprecatedMarked`, `deprecatedMessageChanged`, `deprecatedCleared` и `stateSupportChanged`;
- списки `rejected`, `typeMismatches`, `absent` и `unresolvedStates`.

`createdStates` SHALL учитывать и общие, и собственные состояния компонентов. Счётчика привязок к
дизайн-системам MUST NOT быть.

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
