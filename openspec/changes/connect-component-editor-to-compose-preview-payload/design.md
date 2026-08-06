## Context

Завершённый `compose-preview-host` передаёт в `ComposePreviewFrame` результат
`createBasicButtonPreviewPayload(args)`. Эта функция копирует статическую fixture и изменяет
только `text`, `disabled` и `loading`. Theme, effective properties, variation selections,
typography и assets не связаны с состоянием редактора.

При этом client уже держит:

- `Config` с variations, styles, invariant/style properties и их состояниями;
- component API metadata с `platformMappings.compose`;
- `Theme` с token values по платформам;
- выбранные styles и story props в editor state;
- mode и preview background.

Эти данные достаточны для текущего интерактивного PoC. Дополнительное обращение в `db-service`
увеличило бы latency и потребовало синхронизации с несохранённым draft. Чтобы assembler можно
было позднее перенести в общий application layer, он не должен принимать экземпляры `Config`,
`Theme` или React state напрямую.

## Goals / Non-Goals

**Goals:**

- Формировать schema-valid Preview Protocol v1 payload из текущего client draft.
- Полностью разрешать используемые Button theme tokens, включая typography, font family и
  runtime assets.
- Формировать effective Compose properties из invariants и всех выбранных styles.
- Обрабатывать variations динамически, без известных axis/style names.
- Обновлять существующий iframe без reload при любом релевантном изменении редактора.
- Сохранить distinction `literal`/`tokenRef` и interaction-state values до plugin runtime.
- Показывать в Compose mode только UiState properties, реально опубликованные выбранной story.
- Отделить Compose example controls/state от React story controls и DS Builder variations.

**Non-Goals:**

- Новый endpoint или assembler в `db-service`.
- Исторические/published snapshots и headless assembly.
- Реализация description protocol или Compose Preview Plugin в этом репозитории; client
  потребляет контракт change `refine-compose-preview-viewport-and-story-properties`.
- Вычисление Compose `ButtonStyle`, `Color`, `Dp`, `TextStyle` или `FontFamily` в client.
- Поддержка компонентов, которых нет в manifest текущего plugin.
- Интерпретация семантики variation axes или фиксированный список variation names.
- Plugin catalog, publication, signature и resolver.

## Decisions

### 1. Assembly разделяется на draft adapter и чистый assembler

Controller-facing adapter создаёт JSON-compatible нейтральный snapshot:

```ts
interface ComponentPreviewDraft {
    componentId: string;
    rendererPlatform: 'COMPOSE';
    themeValuePlatform: 'web' | 'android' | 'ios';
    themeMode: string;
    variationSelections: Record<string, string>;
    invariantProperties: PreviewPropertyDraft[];
    selectedStyleProperties: PreviewPropertyDraft[];
    themeTokens: PreviewThemeTokenDraft[];
    assets: PreviewAssetDraft[];
    example: {
        id: string;
        props: Record<string, JsonValue>;
    };
    surface: PreviewSurface;
}
```

`ComposePreviewPayloadAssembler` принимает только этот snapshot и возвращает typed
`PreviewPayloadInput = Omit<PreviewPayload, "requestId">`. Он не импортирует controllers,
React hooks или styled-components. `ComposePreviewSession` добавляет correlation ID перед
отправкой и тем самым формирует полный wire `PreviewPayload`.

Такое разделение позволяет отдельно тестировать:

- корректность projection текущего editor state;
- семантику Preview Protocol assembly;
- host transport.

### 2. Client protocol models следуют canonical JSON Schema

Текущий `PreviewPayload = Record<string, JsonValue>` заменяется discriminated unions для token
values, property sources и results. Versioned `preview-payload.schema.json` используется в tests
и на development boundary перед отправкой.

Schema snapshot должен сохранять canonical `$id` и иметь воспроизводимый способ обновления из
published/local `preview-contract` artifact. Client не вводит независимые поля или другую
семантику.

`PreviewResult` имеет только:

```ts
type PreviewResult =
    | { type: 'success'; requestId: string }
    | { type: 'failure'; requestId: string; code: string; message: string; path?: string };
```

`superseded` распознаётся как `result.type === "failure" && result.code === "superseded"`.

### 3. Variation selections являются непрозрачными данными

Adapter строит selection для каждой variation из `Config.getVariations()`:

```text
variation ID -> selected style ID
```

Выбор берётся из editor state, а при отсутствии явного значения — из текущего default, уже
предоставленного конфигурацией. Fallback на первый style не добавляется assembler.

Assembler:

- не проверяет axis names;
- не знает наборов style values;
- не считает одну variation главной;
- включает properties каждого выбранного style;
- сохраняет selections в payload только как диагностический context.

Чтобы не смешивать selection и story state, adapter принимает `variationSelections` и
`exampleProps` как независимые namespaces. Фильтрация по именам variations допускается только
для legacy-входа с общим `componentProps`; явно переданный `exampleProps` сохраняется целиком,
даже если story property и variation имеют одинаковое имя.

### 4. Payload сохраняет канонические component property names

Каждый `PreviewPropertyDraft` содержит stable property ID, каноническое property name, type,
source value, states, adjustment и platform availability из `platformMappings`. Controller `Prop`
сохраняет полную platform metadata и предоставляет read-only projection вместо только
`webTokens`.

Для каждого канонического component property name assembler формирует `PreviewPropertyValue`:

```text
base: literal(value) | tokenRef(tokenId)
states: state -> literal(value) | tokenRef(tokenId)
```

Assembler не интерпретирует Compose parameter names и не реализует platform binding. Например,
две DS Builder properties `paddingStart` и `paddingEnd` могут обе иметь platform parameter
`paddings`, но в payload остаются отдельными ключами `paddingStart` и `paddingEnd`. Compose plugin
решает, как передать их в `ButtonStyle` builder.

Пустой Compose mapping даёт diagnostic для property, которая не объявлена platform-specific для
другой платформы. Mapping используется только как признак platform availability.

Повторение одного stable property ID в нескольких выбранных styles означает composition одной
property: более позднее значение в порядке variations из config переопределяет более раннее.
Это необходимо, например, когда Button `size` задаёт базовый `shape`, а variation
`shape=pilled` переопределяет ту же property. Конфликт разных property IDs для одного
канонического property name является явной assembly error, а не last-write-wins.

### 5. Invariants и выбранные styles собираются детерминированно

Assembler получает только properties выбранных styles. Effective набор строится в порядке,
зафиксированном продуктовой моделью:

1. properties всех выбранных styles;
2. invariant properties;
3. explicit effective adjustments.

Порядок используется только для composition значений с одним stable property ID. Если properties
с разными IDs объявляют один канонический property name с несовместимыми sources, assembler
возвращает diagnostic с property name и обоими source property IDs. Совпадение их platform
parameter names конфликтом не является. Invariant может дополнять style properties, но не молча
маскировать конфликт другой property.

Theme closure строится после composition, только от итоговых `PreviewPropertyValue`. Токены,
ссылки на которые были перекрыты более поздним значением той же property, не должны требоваться
для preview.

Adjustment применяется в draft/assembly boundary и сериализуется как effective literal, если
текущий Preview Protocol v1 не может сохранить операцию отдельно. Token reference без adjustment
остаётся `tokenRef`; provenance adjustment не добавляется в wire contract.

### 6. Theme resolver собирает транзитивное замыкание token references

Assembler начинает с token IDs, используемых effective component properties, и добавляет только
достижимые values:

```text
component property
  -> color/dimension/shape token
  -> typography token
      -> font-family token
          -> font assets
```

Для каждого token resolver:

- выбирает значение по явно переданным `themeMode` и `themeValuePlatform`;
- не выполняет fallback на другую platform/mode;
- преобразует значение в normalized Preview Protocol type;
- сохраняет token ID как key `payload.theme`;
- обнаруживает missing/disabled token, cycle и incompatible type;
- добавляет asset descriptor для каждого используемого font face.

Color нормализуется в `#RRGGBBAA`, dimensions остаются числами, shape содержит четыре radius,
typography содержит числовые size/line-height/letter-spacing/weight и ссылку на font-family
token. Platform UI types и CSS variables не создаются.

### 7. Stable component/story IDs не выводятся из display names

`payload.component.id` и `payload.example.id` берутся из существующей platform/plugin metadata,
сохранённой controller projection. Client не содержит mapping `Button -> BasicButton`.

Если metadata не содержит ID, Compose preview показывает assembly diagnostic и сохраняет
доступным React renderer. Нельзя незаметно использовать display name как fallback.

Для legacy API payload, созданного до появления `preview.compose`, допускается явный migration
binding на границе загрузки данных. В первом vertical slice он содержит только
`Button -> BasicButton` и преобразует legacy response в обычный `Meta.preview.compose` до
создания controller. Editor не выводит ID из display name и не подставляет единственный component
из plugin manifest. Явный binding не применяется, если producer уже передал `preview.compose`, и
удаляется после миграции backend metadata.

### 8. Editor пересобирает payload по явной revision

`ComponentEditor` передаёт adapter:

- config revision;
- theme revision/update marker;
- variation selections;
- example props;
- theme mode;
- resolved preview surface.

Assembler вызывается через memoized boundary, но correctness не зависит от object identity
mutable controllers. Изменение любого входного revision/value создаёт новый payload object.
`ComposePreviewSession` назначает новый `requestId`, формирует полный schema-valid
`PreviewPayload`; assembler не управляет correlation.

Assembly failure не отправляет частичный payload и не удаляет последний успешный iframe render.
`ComponentEditorPreview` показывает diagnostic рядом с preview и позволяет переключиться на
React.

### 9. Production fixture заменяется, test fixture сохраняется

`createBasicButtonPreviewPayload(args)` удаляется из `ComponentEditorPreview`. Canonical fixture
остаётся только в tests host/session и smoke harness, где проверяется transport независимо от
controllers.

Browser E2E использует настоящий plugin и настоящий assembled payload. Он изменяет:

- theme color token;
- component dimension или shape property;
- state-specific property;
- typography/font-family asset;
- example text/loading/disabled;
- произвольную variation selection.

Каждое изменение должно приводить к новому full payload и render без reload iframe.

### 10. Session запрашивает component description после ready

Manifest validation дополнительно требует:

```text
describeMessageType = sdds.preview.describe
descriptionMessageType = sdds.preview.description
```

После ready `ComposePreviewSession.describeComponent(componentId)` отправляет отдельный
коррелированный request и возвращает `PreviewComponentDescription`. Describe pending requests
имеют собственный timeout/cleanup, но используют те же source/origin checks и session disposal.

Describe не создаёт render `requestId`, не отправляет `PreviewPayload` и не влияет на latest
render result. Unknown component или incompatible description переводят Compose mode в
диагностируемую ошибку, сохраняя React renderer.

### 11. Compose controls являются projection descriptor

`ComponentEditorPreview` разделяет renderer-specific controls:

```text
React mode   -> useStory().storyArgs
Compose mode -> PreviewComponentDescription.properties
Common       -> DS Builder variation controls
```

Property descriptor отображается стандартным control:

| Description type | Client control |
| --- | --- |
| `string` | `TextField` |
| `boolean` | `Switch` |
| `int`, `float` | numeric `TextField` с type-safe parsing |
| `singleChoice` | `SelectButton` из `variants` |

Client не добавляет controls, которых нет в descriptor. Порядок совпадает с порядком properties
plugin. `variant` и `appearance` не должны приходить от plugin; дополнительно client отклоняет их
как incompatible description, чтобы variation fields не попали в example state.

### 12. Compose example state отделено от общего args

После получения нового descriptor client создаёт `composeExampleProps` из `defaultValue`.
Совместимые значения предыдущего descriptor сохраняются только при совпадении component,
property name, type и single-choice variants. Остальные values удаляются.

Изменение Compose control обновляет только `composeExampleProps`, после чего draft adapter и
assembler создают новый `payload.example.props`. Оно не вызывает React
`onUpdateComponentProps`, не меняет variation selection и не перезагружает iframe.

Draft adapter получает `variationSelections` и `exampleProps` раздельными аргументами. Текущий
combined `args` может сохраниться для React compatibility, но не является источником Compose
example schema.

## Risks / Trade-offs

- [Client controller потерял часть исходной metadata] -> Сохранять её в read-only draft
  projection при построении controller; не восстанавливать из CSS variables или display names.
- [Mutable controllers не меняют identity] -> Использовать явный revision/update marker в
  dependency boundary.
- [Текущий v1 не моделирует adjustment отдельно] -> Сериализовать проверенный effective literal
  и покрыть преобразование unit tests; расширение protocol делать отдельным change.
- [Каноническое property name не поддерживается plugin factory] -> Schema-valid payload может
  получить `unknown property` только как plugin diagnostic; platform binding проверяется plugin
  contract, а browser E2E фиксирует согласованный Button vertical slice.
- [Font URL недоступен origin плагина] -> Проверять descriptor и CORS в browser E2E; assembly не
  встраивает font bytes.
- [Client-side assembler понадобится другим consumers] -> Чистый draft contract позволяет
  вынести assembler в общий application layer без изменения host transport.
- [Plugin descriptor изменился после release] -> Сбрасывать несовместимые example values по
  component/name/type/variants и использовать новые defaults.
- [Describe response опоздал после смены component/plugin] -> Коррелировать operation и
  игнорировать result предыдущей session.
- [React и Compose stories поддерживают разные props] -> Хранить renderer-specific state и не
  пытаться объединять schemas.

## Migration Plan

1. Синхронизировать TypeScript contract models/schema и исправить `PreviewResult`.
2. Расширить read-only controller projections для platform metadata и stable preview IDs.
3. Добавить draft adapter и разделить variation selections/example props.
4. Реализовать theme/property resolvers и `ComposePreviewPayloadAssembler`.
5. Заменить fixture в `ComponentEditorPreview` assembled payload.
6. Добавить describe operation в manifest/session.
7. Построить Compose controls и отдельный example state из descriptor.
8. Проверить Button unit/schema/browser scenarios с настоящим plugin.

Rollback возвращает production fixture, не меняя iframe host, React renderer или persisted
данные. Новые read-only controller projections можно оставить без влияния на текущие mutations.
