## Why

React-клиент уже умеет загружать Compose Preview Plugin, управлять iframe session и передавать
canonical `BasicButton` fixture. Поэтому transport и renderer доказаны, но preview пока не
отражает реальную редактируемую тему и конфигурацию компонента: production path изменяет только
несколько example props поверх статического payload.

В текущем client draft уже находятся необходимые theme tokens, component properties, Compose
platform mappings, variation/style selections, states, adjustments и runtime story props. Для
следующего vertical slice нужен client-side assembler, который преобразует этот draft в полный
renderer-ready `PreviewPayload` без дополнительного чтения из `db-service`.

## What Changes

- В `apps/client` добавляются типизированные модели Preview Protocol v1, согласованные с
  canonical JSON Schema.
- Исправляется representation `superseded`: это `PreviewResult.Failure` с
  `code: "superseded"`, а не отдельный result type.
- Добавляется нейтральный `ComponentPreviewDraft`, отделяющий данные редактора от wire payload и
  от controller classes.
- Controller layer предоставляет draft adapter с component/plugin ID, всеми выбранными
  variation styles, invariants, properties выбранных styles, Compose platform mappings,
  состояниями, adjustments и theme token data.
- Добавляется чистый `ComposePreviewPayloadAssembler`, который формирует effective component
  properties, разрешает транзитивно используемые theme tokens и assets и возвращает
  `PreviewPayloadInput`; session добавляет `requestId` и создаёт полный wire `PreviewPayload`.
- Variation axes и styles обрабатываются по ID как редактируемые данные. Assembler не содержит
  известных имён `view`, `size`, `shape` и не выбирает styles по семантике.
- `ComponentEditorPreview` заменяет production Button fixture результатом assembler и
  пересобирает payload при изменении theme, component properties, variation selections, example
  props, mode или surface.
- `ComposePreviewSession` после ready запрашивает у plugin descriptor UiState properties
  выбранной story через `sdds.preview.describe` / `sdds.preview.description`.
- В Compose renderer нижняя панель строится только по story property descriptor plugin:
  string, boolean, int, float и single-choice. React `storyArgs` используются только в React
  renderer.
- Compose example props имеют отдельное состояние, инициализируются defaults из descriptor и не
  содержат variation selections.
- `basicButtonFixture` сохраняется только для изолированных host/session tests.
- Добавляются schema, unit и browser проверки полного Button path.
- `db-service`, Preview Protocol и Compose plugin этим change не меняются.

## Capabilities

### New Capabilities

- `compose-preview-payload-assembly`: сборка полного Compose `PreviewPayload` из текущего
  client-side draft состояния редактора.
- `compose-preview-story-controls`: построение controls и `example.props` по descriptor,
  опубликованному выбранной Compose story.

### Modified Capabilities

- `compose-preview-host`: production render получает assembled payload вместо canonical fixture,
  `PreviewResult` строго соответствует Preview Protocol v1, а session поддерживает component
  describe operation.

## Impact

- Затрагивается только `apps/client`: `composePreview`, component/theme controller projections и
  component editor integration.
- Backend endpoints и persistence model не меняются.
- Существующий React preview сохраняет текущие CSS variables, stories и controls.
- Controller API расширяется read-only projection/getters, необходимыми draft adapter; mutation
  semantics не меняются.
- Canonical Preview Protocol schema становится source of truth для payload validation и
  TypeScript-моделей.
- Client зависит от additive description contract и bridge, реализованных change
  `refine-compose-preview-viewport-and-story-properties` в `plasma-android`.
- Для Compose theme source используется явно переданный `themeValuePlatform`; assembler не
  выполняет скрытый fallback между `web`, `android` и `ios`.
- Stable plugin component ID и Compose property names берутся из уже загруженной platform
  metadata, а не выводятся из display name и не хардкодятся в editor.
- Полная server-side snapshot assembly для CLI, published versions и headless consumers остается
  отдельным будущим change.
