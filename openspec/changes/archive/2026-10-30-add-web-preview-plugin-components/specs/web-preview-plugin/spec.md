## ADDED Requirements

### Requirement: Реестр web-плагина покрывает все web-компоненты с story

Реестр web-плагина SHALL содержать все компоненты, для которых в клиенте есть story (`componentMapper`
в `js/apps/client/src/hooks/useStory.ts`), с их story, аргументами и отрисовкой. Отображение web-параметров
в CSS-переменные ядра SHALL учитывать исключения клиента: объекты токенов ядра не по имени компонента
(`coreTokensByComponent`) и конфиги ядра не по имени компонента (`coreConfigNameByComponent`, например
`Skeleton` → `lineSkeletonConfig`). Манифест SHALL перечислять все компоненты реестра.

#### Scenario: Манифест перечисляет все компоненты

- **WHEN** клиент читает манифест web-плагина
- **THEN** `components` MUST совпадать с ключами реестра плагина и содержать все компоненты `componentMapper` клиента

#### Scenario: Каждый компонент рисуется

- **WHEN** плагин получает базовый payload `WEB` для любого компонента реестра: пустые `properties`, выбранная story по умолчанию, связанные компоненты из реестра
- **THEN** плагин MUST ответить `success` без исключения отрисовки

#### Scenario: Компонент с собственным объектом токенов

- **WHEN** payload для `TabItem` содержит web-параметр, который в ядре описан в `tabsTokens`
- **THEN** плагин MUST задать CSS-переменную из `tabsTokens`, как клиент

### Requirement: Несколько story компонента

Описание компонента SHALL содержать список story `stories: [{id, name}]`. Запрос `describe` SHALL принимать
необязательный `storyId` и возвращать аргументы этой story; без `storyId` — story по умолчанию, первую в списке.
Payload SHALL выбирать story по `example.id`.

#### Scenario: Описание с несколькими story

- **WHEN** хост запросил `describe` для `Tooltip` без `storyId`
- **THEN** описание MUST содержать `stories` с двумя story, `storyId` первой и её аргументы

#### Scenario: Выбор другой story

- **WHEN** хост запросил `describe` для `Tooltip` с `storyId` второй story и отправил payload с этим `example.id`
- **THEN** описание MUST содержать аргументы второй story, а плагин MUST отрисовать вторую story

#### Scenario: Неизвестная story

- **WHEN** `describe` или payload ссылаются на story, которой нет у компонента
- **THEN** плагин MUST ответить `failure` с кодом `story_not_found`
