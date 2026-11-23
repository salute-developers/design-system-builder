## ADDED Requirements

### Requirement: Мета платформы объявляет общие состояния генератора

Генераторы меты платформ, у которых генератор кода выражает общие состояния у любого компонента, SHALL отдавать
поле `stateSupport` вида `{ "interactionStates": [<имя>, ...], "combinations": <bool> }`:

- Compose — `UikitComposeApiMetaTask`, plasma-android;
- View — `UikitApiMetaTask`, plasma-android;
- SwiftUI — генератор `ios-api-meta.json`, plasma-ios.

Web поле не отдаёт, и `js/cli` не меняется: у web нет списка общих состояний генератора. Превью применяет любое
состояние, для которого у свойства есть токен, поэтому список свойства и запрет сочетаний выводятся из формата
web-меты (требование «API meta normalization reads state support»).

`interactionStates` SHALL перечислять общие состояния, которые генератор кода платформы выражает без привязки к
компоненту. Имена пишутся так же, как в конфигурациях оформления. Список SHALL строиться из того же кода, которым
генератор переводит состояния конфигурации в код, а не из отдельной копии. `combinations` SHALL говорить, выражает
ли генератор сочетание нескольких состояний в одном значении.

Форма корня меты MUST NOT меняться: прежние CLI и другие потребители меты читают корень Compose и SwiftUI как
массив компонентов. Поэтому поле стоит так:

- View — в корневом объекте, рядом с `components` и `sharedStates`;
- Compose и SwiftUI — у каждой записи компонента, с одним и тем же значением для всей меты.

Записи с разными значениями нормализатор SHALL считать ошибкой меты (`Invalid`).

#### Scenario: Прежний CLI читает новую мету

- **WHEN** мета собрана генератором с полем `stateSupport`, а нормализует её прежний CLI
- **THEN** нормализация MUST проходить как раньше: поле неизвестно и пропускается (`ignoreUnknownKeys`)

#### Scenario: Compose

- **WHEN** генератор Compose переводит общие состояния через `InteractiveState`
- **THEN** `interactionStates` MUST быть `focused`, `pressed`, `hovered`, `activated`, `selected`, а `combinations` MUST быть `true`

#### Scenario: Android View

- **WHEN** генератор View переводит состояния framework через `AndroidState`
- **THEN** `interactionStates` MUST быть `focused`, `pressed`, `hovered`, `activated`, `checked`, а `combinations` MUST быть `true`

#### Scenario: SwiftUI

- **WHEN** генератор iOS переводит состояния через `InteractiveState` из `SDDSThemeCore`
- **THEN** `interactionStates` MUST содержать имена этого перечисления, а `combinations` MUST быть `true`

### Requirement: API meta normalization reads state support

Нормализатор SHALL выводить признак свойства из `stateSupport` меты и из того, что мета уже описывает о
компоненте и параметре. Признак уходит в манифест полем `stateSupport` свойства:
`{ "states": [...], "combinations": <bool> }`. Нормализатор MUST NOT содержать собственных списков состояний,
которые выражает генератор платформы.

По платформам:

- **Compose.** Перегрузка `StatefulValue` даёт `interactionStates` и состояния `stateEnum` компонента.
  `InteractiveColor` без `StatefulValue` даёт только `interactionStates`. Без этих перегрузок список пуст.
- **View.** Тип свойства `color`, `dimension`, `float` или `typography` даёт `interactionStates`, `configName` из
  `stateSets` компонента и состояния из `stateValues` вхождений. Иной тип даёт пустой список.
- **SwiftUI.** `paramSimpleType`, начинающийся со `Stateful`, даёт `interactionStates` и состояния `stateEnum`
  компонента. Без такого типа список составляют состояния из поля `state` вхождений, и `combinations` равен
  `false`.
- **Web.** Список составляют состояния токенов свойства, `combinations` равен `false`. Оба вывода следуют из
  формата меты: у токена одно поле `state`, поэтому значение для сочетания в web-мете описать нельзя. Признак
  задаётся при любой версии web-меты, поля `stateSupport` для этого не нужно.

У Compose, View и SwiftUI `combinations` берётся из `stateSupport` меты, кроме случая SwiftUI без `Stateful*`. Признак сводится по всем вхождениям
`(componentName, id)`. Имена канонизируются как имена состояний компонента. Порядок — первое появление, без
дублей.

#### Scenario: Compose `InteractiveColor`

- **WHEN** у Compose `Slider.thumbColor` есть перегрузка `InteractiveColor`, а `stateEnum` у `Slider` нет
- **THEN** `states` MUST совпадать с `interactionStates` меты и MUST NOT содержать `disabled` и `readonly`

#### Scenario: Compose `StatefulValue`

- **WHEN** у Compose `DropZone.paddingStart` есть перегрузка `StatefulValue`, а в `stateEnum` есть `dragging-over`
- **THEN** `states` MUST содержать `interactionStates` и `dragging-over`

#### Scenario: View с пустым `stateValues`

- **WHEN** у View `BasicButton.backgroundColor` тип `color` и пустой `stateValues`
- **THEN** `states` MUST NOT быть пустым

#### Scenario: SwiftUI `StatefulFillStyle`

- **WHEN** у SwiftUI `CheckBox.toggleIconColor` оба вхождения имеют тип `StatefulFillStyle` без поля `state`
- **THEN** `states` MUST NOT быть пустым

#### Scenario: Web

- **WHEN** у web-свойства `Button.backgroundColor` есть токены только для `pressed` и `hovered`
- **THEN** признак MUST быть `{ "states": ["pressed", "hovered"], "combinations": false }`
- **WHEN** у web-свойства нет токенов с `state`
- **THEN** признак MUST быть `{ "states": [], "combinations": false }`

#### Scenario: Общие состояния уходят в манифест

- **WHEN** в мете Compose, View или SwiftUI есть `stateSupport`
- **THEN** манифест MUST содержать на верхнем уровне `interactionStates` из меты, чтобы импорт завёл недостающие общие состояния
- **WHEN** импортируется web-мета
- **THEN** манифест MUST NOT содержать `interactionStates`; деление состояний токенов на общие и собственные остаётся прежним

#### Scenario: Мета без поля

- **WHEN** в мете Compose, View или SwiftUI нет `stateSupport` (мета прежнего генератора)
- **THEN** манифест MUST NOT содержать `interactionStates`, ни одно свойство MUST NOT содержать `stateSupport`, и импорт MUST NOT менять признаки и общий словарь

#### Scenario: Признак уходит в запрос

- **WHEN** CLI формирует тело `import-api-meta` командой `components import-api` или публикацией плагина превью
- **THEN** свойство с признаком MUST содержать `stateSupport` со списком `states` и флагом `combinations`
- **THEN** свойство без признака MUST NOT содержать `stateSupport`

#### Scenario: Печать отчёта

- **WHEN** backend вернул ненулевой `stateSupportChanged` или непустой `unresolvedStates`
- **THEN** CLI MUST напечатать счётчик вместе со счётчиками `deprecated*`, а строки `unresolvedStates` — отдельным разделом
- **THEN** они MUST NOT влиять на код выхода, в том числе с `--strict`
- **WHEN** ответ прежней версии backend не содержит этих полей
- **THEN** CLI MUST считать счётчик равным нулю, а список пустым

### Requirement: Нативная выдача состояний пересечения с наследуемой базой

При преобразовании общего формата в нативный CLI SHALL подставлять наследуемую базу свойства
пересечения, содержащего только состояния. Подстановка SHALL сохранять тип, прозрачность и поправку
базы и состояния меньших пересечений; состояния с отличающимся типом SHALL сохранять свой тип.
Преобразование MUST NOT записывать подставленную базу в исходную конфигурацию.
Если базы нет ни в одном источнике, CLI MUST отклонить выдачу с диагностикой свойства и требованием
задать или унаследовать базу, вместо выдачи некорректного пакета.

#### Scenario: Размер с наследуемой базой

- **WHEN** размер имеет базу 16 в стиле и состояние `pressed=40` на пересечении без собственной базы
- **THEN** нативное свойство MUST содержать базу 16 и состояние 40
- **THEN** исходная общая конфигурация MUST остаться без базовой записи пересечения

#### Scenario: Состояния нескольких уровней пересечения

- **WHEN** базовый стиль задаёт `focused`, меньшее пересечение задаёт `hovered`, а выбранное пересечение задаёт `pressed`
- **THEN** нативное свойство MUST сохранить все три набора состояний и наследуемую базу

#### Scenario: Отсутствующая база

- **WHEN** у свойства пересечения есть состояния, но базового значения нет ни в одном источнике
- **THEN** CLI MUST отклонить нативную выдачу с диагностикой отсутствующей базы
