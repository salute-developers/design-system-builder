## 1. `apps/client` — Preview Protocol v1

- [x] 1.1 Добавить versioned canonical `preview-payload.schema.json` и воспроизводимый способ
  синхронизации schema из `preview-contract`, сохранив canonical `$id`.
- [x] 1.2 Заменить generic `PreviewPayload` на typed discriminated models `PreviewPayload`,
  `PreviewPayloadInput`, token values, property sources, assets, component, example и surface.
- [x] 1.3 Исправить `PreviewResult`: удалить отдельный `superseded` type и обрабатывать его как
  `failure` с `code: "superseded"`.
- [x] 1.4 Добавить schema validation tests для assembled payload и negative contract cases.

## 2. `apps/client` — draft projection

- [x] 2.1 Сохранить и предоставить read-only stable plugin component/story IDs из уже
  загруженной platform metadata без mapping по display name.
- [x] 2.2 Расширить property projection полным `platformMappings.compose`, property type,
  base/state sources и adjustments, не разбирая существующие CSS variables.
- [x] 2.3 Добавить JSON-compatible `ComponentPreviewDraft` и adapter из `Config`, `Theme` и
  editor state без React dependencies внутри draft model.
- [x] 2.4 Разделить variation selections и example props динамически по variation IDs/names из
  config; удалить hardcoded `size/view/shape` из Compose assembly path.
- [x] 2.5 Передавать `themeMode`, явный `themeValuePlatform`, surface и revision markers theme и
  component draft.
- [x] 2.6 Добавить adapter tests для произвольных variation axes, всех выбранных styles,
  invariants, states, platform mappings и отсутствующей metadata.
- [x] 2.7 Сохранить явно переданный story `exampleProps`, если его имя совпадает с variation;
  разделять namespaces без фильтрации explicit input.

## 3. `apps/client` — `ComposePreviewPayloadAssembler`

- [x] 3.1 Реализовать чистый assembler, принимающий только `ComponentPreviewDraft` и
  возвращающий typed `PreviewPayloadInput` либо структурированные diagnostics.
- [x] 3.2 Сформировать effective properties из всех selected style properties и invariants,
  сохраняя канонические component property names и не интерпретируя Compose parameter names.
- [x] 3.3 Сохранить literal/tokenRef и state values; применить поддержанные adjustments в
  effective literal без добавления несуществующих protocol fields.
- [x] 3.4 Обнаруживать отсутствующий mapping, incompatible value и конфликт разных properties
  одного канонического property name без last-write-wins.
- [x] 3.5 Реализовать транзитивный theme resolver для color, dimension, shape, typography,
  font-family и font assets по явным mode/platform.
- [x] 3.6 Диагностировать missing/disabled token, invalid reference, cycle, incompatible type и
  недоступный обязательный asset descriptor.
- [x] 3.7 Добавить unit tests Button properties, state values, adjustments, token graph,
  typography/font assets и deterministic assembly.
- [x] 3.8 Поддержать composition одной property между variations по stable property ID,
  резолвить theme closure после override и указывать source property IDs для реальных mapping
  conflicts.
- [x] 3.9 Сохранять `paddingStart` и `paddingEnd` как независимые payload properties при общем
  platform parameter `paddings`; оставить platform binding ответственностью preview plugin.

## 4. `apps/client` — component editor integration

- [x] 4.1 Заменить `createBasicButtonPreviewPayload(args)` production path на draft adapter и
  `ComposePreviewPayloadAssembler`.
- [x] 4.2 Пересобирать payload при изменении component/theme revision, любой variation
  selection, example prop, mode или surface, не полагаясь на identity mutable controllers.
- [x] 4.3 Передавать assembled payload в существующий `ComposePreviewFrame`; request ID и
  correlation оставить ответственностью `ComposePreviewSession`.
- [x] 4.4 При assembly diagnostic сохранять последний успешный iframe render, показывать ошибку
  и оставлять доступным React renderer.
- [x] 4.5 Удалить `basicButtonFixture` из production imports; сохранить canonical fixture только
  для host/session tests и smoke harness.
- [x] 4.6 Сохранить поведение React `useStory`, CSS theme/component variables и controls.

## 5. Validation

- [x] 5.1 Проверить schema-valid wire payload после добавления session `requestId` к
  `PreviewPayloadInput`, собранному из реального Button `Config` и `Theme`.
- [x] 5.2 В browser E2E с настоящим `preview-compose-plugin` проверить изменение color token,
  dimension/shape property и state-specific value без reload iframe.
- [x] 5.3 Проверить typography с font-family asset и ошибки missing token/asset.
- [x] 5.4 Проверить изменение example text/loading/disabled и произвольной variation selection
  без hardcoded axis names.
- [x] 5.5 Выполнить focused unit/component/browser tests, `npm run build` и `npm run lint` в
  `apps/client`.
- [x] 5.6 Подтвердить, что `db-service`, Preview Protocol, Compose plugin, plugin catalog и
  поддержка новых компонентов не изменены этим change.

## 6. `apps/client` — component description transport

- [x] 6.1 Добавить TypeScript-модели `PreviewComponentDescription`,
  `PreviewExamplePropertyDescription` и коррелированного description result по canonical schema.
- [x] 6.2 Расширить manifest types/validation direct API и message types
  `sdds.preview.describe` / `sdds.preview.description`.
- [x] 6.3 Реализовать `ComposePreviewSession.describeComponent(componentId)` с отдельной
  correlation map, timeout, source/origin checks, reload и disposal cleanup.
- [x] 6.4 Не связывать describe operations с render latest-request-wins и pending render
  requests.
- [x] 6.5 Добавить session/manifest tests success, unknown component, malformed descriptor,
  timeout, stale response и disposal.

## 7. `apps/client` — Compose story controls

- [x] 7.1 После ready запросить description выбранного component и передать его из
  `ComposePreviewFrame` в component editor integration без перезагрузки iframe.
- [x] 7.2 Добавить отдельное `composeExampleProps`, инициализируемое typed defaults из
  descriptor; удалять values отсутствующих или несовместимых properties.
- [x] 7.3 Рендерить string, boolean, int, float и single-choice controls в порядке descriptor.
- [x] 7.4 В Compose mode показывать только descriptor controls, в React mode — только
  `useStory().storyArgs`; variation controls оставить общими и отдельными.
- [x] 7.5 Запретить `variant` и `appearance` в Compose example controls и не смешивать
  `composeExampleProps` с variation selections.
- [x] 7.6 Передавать draft adapter явные `variationSelections` и `exampleProps` вместо combined
  args в Compose path.
- [x] 7.7 При изменении Compose control собирать новый full payload без вызова React story state
  и без reload iframe.

## 8. Story controls validation

- [x] 8.1 Добавить component tests exact BasicButton controls: `label`, `value`, `icon`,
  `spacing`, `hasFixedWidth`, `enabled`, `loading`.
- [x] 8.2 Проверить отсутствие React-only props и DS Builder variation fields в Compose
  `example.props`.
- [x] 8.3 Проверить typed editing каждого property kind и reset при смене descriptor/component.
- [x] 8.4 В cross-origin browser E2E запросить descriptor настоящего plugin, изменить каждый
  BasicButton UiState control и получить новый успешный render без reload iframe.
- [x] 8.5 Повторно выполнить focused tests, `npm run build` и `npm run lint` в `apps/client`.

## 9. Review corrections

- [x] 9.1 Исправить client build и добавить regression-проверку.
- [x] 9.2 Брать stable Compose component/story IDs только из `Meta.preview.compose` и не
  подставлять единственный component manifest для неподдерживаемых configs.
- [x] 9.3 После iframe reload повторять ready, description и render lifecycle.
- [x] 9.4 Удалить checked-in Compose plugin ZIP; browser smoke должен принимать внешний
  independently built artifact.
- [x] 9.5 Сделать schema в `design-system-builder-kt/preview/contract` канонической, а локальный
  client schema — проверяемым синхронизируемым snapshot.
- [x] 9.6 Вынести importer UIKit API metadata из этого репозитория в
  `design-system-builder-kt/scripts` и переписать его на shell.
- [x] 9.7 Выполнить unit tests, build, lint, schema check и browser smoke.
