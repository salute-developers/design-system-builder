## ADDED Requirements

### Requirement: Client получает story property description от plugin

После готовности Compose plugin client SHALL запрашивать
`PreviewComponentDescription` выбранного component через коррелированную describe operation.

#### Scenario: Description успешно получено

- **WHEN** session ready и выбранный component поддерживается plugin
- **THEN** client MUST получить ordered property descriptors до показа Compose story controls.

#### Scenario: Description получить невозможно

- **WHEN** describe завершается failure, timeout или incompatible response
- **THEN** client MUST показать диагностируемую Compose error
- **AND** React renderer MUST оставаться доступным.

#### Scenario: Component изменился

- **WHEN** editor выбирает другой component либо plugin session
- **THEN** result предыдущего describe request MUST быть проигнорирован
- **AND** client MUST запросить description нового component.

### Requirement: Compose controls соответствуют только story description

В Compose renderer `ComponentEditorPreview` SHALL строить example controls исключительно по
properties актуального `PreviewComponentDescription`.

#### Scenario: Primitive property отображается

- **WHEN** description содержит string, boolean, int или float property
- **THEN** client MUST показать соответствующий typed input с default value.

#### Scenario: Single-choice property отображается

- **WHEN** description содержит `singleChoice` property
- **THEN** client MUST показать selector только с объявленными variants
- **AND** selected value MUST принадлежать этому списку.

#### Scenario: Property отсутствует в description

- **WHEN** React story либо локальное состояние содержит дополнительный prop
- **THEN** Compose mode MUST NOT показывать для него control
- **AND** MUST NOT отправлять его в Compose `example.props`.

### Requirement: Variation и example controls разделены

DS Builder variation controls SHALL оставаться основанными на component config, а Compose
example controls SHALL оставаться основанными на plugin story description.

#### Scenario: Compose mode открыт

- **WHEN** component имеет variation axes и story properties
- **THEN** variation selectors MUST отображаться отдельно от story controls
- **AND** `variant` и `appearance` MUST NOT отображаться как story controls.

#### Scenario: Renderer переключён

- **WHEN** пользователь переключается между React и Compose
- **THEN** React mode MUST использовать `useStory().storyArgs`
- **AND** Compose mode MUST использовать только plugin description
- **AND** renderer-specific example state MUST NOT перезаписывать состояние другого renderer.

### Requirement: Изменение Compose control обновляет UiState без reload

Client SHALL обновлять `composeExampleProps`, собирать новый полный payload и передавать его в
существующую session при изменении поддержанного story control.

#### Scenario: BasicButton property изменено

- **WHEN** пользователь изменяет `label`, `value`, `icon`, `spacing`, `hasFixedWidth`, `enabled`
  либо `loading`
- **THEN** новый typed value MUST попасть в `payload.example.props`
- **AND** Compose plugin MUST применить его через `StateTransformer`
- **AND** iframe MUST NOT перезагружаться.
