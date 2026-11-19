## ADDED Requirements

### Requirement: editor-bundle отдаёт признак состояний и доступные состояния

`ComponentEditorBundleResponse` SHALL содержать у каждого элемента `properties` поле `stateSupport` (как в
`ComponentPropertySummaryResponse`) и SHALL содержать список `states` (`ComponentStateResponse` с `id`, `name` и
`componentId`). В список входят все общие состояния и состояния этого компонента, в порядке, в котором их отдаёт
`GET /api/design-systems/catalog/states`. Изменение SHALL быть отражено в `openapi/documentation.yaml`.

#### Scenario: Состояния компонента с собственными состояниями

- **WHEN** запрашивается `editor-bundle` Compose-компонента `DropZone` с состоянием `dragging-over`
- **THEN** `states` MUST содержать `dragging-over` и все общие состояния
- **THEN** `states` MUST NOT содержать состояний других компонентов, в том числе с тем же именем

#### Scenario: Признак у свойства

- **WHEN** у свойства задан признак со списком `pressed`, `hovered` и `combinations: false`
- **THEN** элемент `properties` MUST содержать `"stateSupport": { "stateIds": [<id pressed>, <id hovered>], "combinations": false }`
- **THEN** каждый идентификатор из `stateIds` MUST присутствовать в `states` бандла
- **WHEN** признак не задан
- **THEN** элемент MUST содержать `"stateSupport": null`
