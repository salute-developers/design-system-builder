## ADDED Requirements

### Requirement: editor-bundle отдаёт признак состояний и доступные состояния

`ComponentEditorBundleResponse` SHALL содержать у каждого элемента `properties` поле `stateSupport` (как в
`ComponentPropertySummaryResponse`) и SHALL содержать список `states` (`ComponentStateResponse`): все состояния
взаимодействия и состояния этого компонента в порядке, в котором их отдаёт
`GET /api/design-systems/catalog/states`. Изменение SHALL быть отражено в `openapi/documentation.yaml`.

#### Scenario: Состояния компонента с собственными состояниями

- **WHEN** запрашивается `editor-bundle` Compose-компонента `DropZone` с состоянием `dragging-over`
- **THEN** `states` MUST содержать `dragging-over` и все состояния взаимодействия
- **THEN** `states` MUST NOT содержать состояний других компонентов

#### Scenario: Признак у свойства

- **WHEN** у свойства `state_support` равен `interaction`
- **THEN** элемент `properties` этого свойства MUST содержать `"stateSupport": "interaction"`
- **WHEN** признак не задан
- **THEN** элемент MUST содержать `"stateSupport": null`
