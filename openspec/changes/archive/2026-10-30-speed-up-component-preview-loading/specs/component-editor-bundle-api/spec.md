## ADDED Requirements

### Requirement: ds-service отдаёт данные одного компонента для редактора одним запросом

ds-service SHALL обслуживать `GET /api/ds/design-systems/{designSystemId}/components/{componentId}/editor-bundle`
с обязательным параметром `platform` (`web` или `compose`) и необязательным `versionId`. Ответ
`ComponentEditorBundleResponse` SHALL содержать данные только этого компонента в этой дизайн-системе
в тех же DTO, что отдают существующие маршруты:

- `component` (`ComponentResponse`);
- `appearances` (`AppearanceResponse`) — оформления компонента в дизайн-системе;
- `export` (`ExportComponentConfigResponse`) — то же, что `POST /api/ds/component-config/export` с этой дизайн-системой, платформой и одним компонентом;
- `properties` (`ComponentPropertySummaryResponse`) — то же, что `GET /api/ds/components/{componentId}/properties`;
- `platformParams` (`PropertyPlatformParamResponse`) — параметры только этих свойств;
- `propertyVariations` (`PropertyVariationResponse`) — связи только этих свойств; пустой список для `compose`;
- `variations` (`ComponentVariationSummaryResponse`) — то же, что `GET /api/ds/components/{componentId}/variations?designSystemId=…`;
- `styles` — то же, что `GET /api/ds/design-systems/{designSystemId}/components/{componentId}/styles`;
- `webAdapter` (`ComponentWebAdapterEntryResponse` или `null`) — запись компонента из `POST /api/ds/component-config/web-adapter`; `null` для `compose`;
- `dependencies` (`ComponentDependencyResponse`) — связи, где компонент родитель или дочерний;
- `dependencyComponents` (`ComponentResponse`) — компоненты по другую сторону этих связей, привязанные к той же дизайн-системе и той же платформе.

Маршрут SHALL требовать право `components:variations:read` и SHALL быть описан в
`app/src/main/resources/openapi/documentation.yaml` и `contracts/route-manifest.json`.
Существующие маршруты SHALL NOT меняться.

#### Scenario: Web-компонент привязан к дизайн-системе

- **WHEN** участник проекта запрашивает `editor-bundle` Web-компонента `Button`, привязанного к дизайн-системе, с `platform=web`
- **THEN** ds-service MUST вернуть `200` и `ComponentEditorBundleResponse`
- **THEN** каждое поле ответа MUST совпадать с ответом соответствующего существующего маршрута, отфильтрованным до этого компонента, его свойств и этой дизайн-системы

#### Scenario: Compose-компонент

- **WHEN** запрашивается `editor-bundle` Compose-компонента с `platform=compose`
- **THEN** `export` MUST содержать экспорт для платформы `compose`
- **THEN** `propertyVariations` MUST быть пустым, а `webAdapter` MUST быть `null`

#### Scenario: Компонент другой платформы, не привязан или недоступен

- **WHEN** компонент не привязан к дизайн-системе, его платформа не совпадает с `platform`, либо дизайн-система или компонент недоступны проекту
- **THEN** ds-service MUST вернуть `404` без данных компонента

#### Scenario: Некорректная платформа

- **WHEN** `platform` отсутствует или не равен `web` либо `compose`
- **THEN** ds-service MUST вернуть `400`

#### Scenario: Чтение опубликованной версии

- **WHEN** запрос содержит `versionId` опубликованной версии дизайн-системы проекта
- **THEN** оформления, вариации, стили и экспорт MUST соответствовать этой версии так же, как у существующих маршрутов с тем же `versionId`

#### Scenario: Нет права чтения

- **WHEN** у вызывающего нет права `components:variations:read`
- **THEN** ds-service MUST вернуть `403`
