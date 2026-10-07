## Контекст

В ветке Kotlin `ds-service` тема — это тенант дизайн-системы, у дизайн-системы может быть несколько
тем, а редактор открывается по маршруту `.../themes/:tenantId`. Клиент загружает тему через
`api/themeEditorRepository.ts` (`/tenants/{id}`, `/tenants/{id}/token-values`, токены дизайн-системы) и
сохраняет значения токенов `PUT /tenants/{id}/token-values` с `editRevision`; правки до сохранения живут
в черновике `ds_draft:<projectId>:<designSystemId>:<tenantId>`.

Палитры как сущности темы нет нигде:

- цвета ссылок вычисляются встроенной `@salutejs/plasma-colors` — напрямую или через
  `getRestoredColorFromPalette` из `@salutejs/plasma-tokens-utils` (около 20 вызовов);
- значение токена ссылается на палитру либо строкой `[general.red.500][0.56]`, либо внешним ключом
  `paletteId`, который клиент при загрузке превращает в ту же строку;
- в `ds-service` есть только общая библиотека `GET /palette`, изменять её может лишь системный
  администратор.

Продуктовое правило: общая «официальная» палитра — шаблон. Тема получает копию шаблона при создании и
дальше меняет её независимо; изменения темы не отражаются на шаблоне, изменения шаблона не отражаются на
существующих темах, у двух тем две разные палитры.

Прототип группирует растяжки палитры по назначению. Экземпляр растяжки в группе определяется слотом —
растяжкой, на которую ссылаются токены, — и может получить другой источник, перестройку от опорного
цвета или правки отдельных ступеней. Связи токенов при этом не рвутся: ссылка указывает на слот, а
значение берётся из экземпляра в группе токена.

Сервер палитры темы описан в изменении `add-theme-palette-api` и может появиться позже.

## Цели / Вне целей

**Цели:**

- раздел «Палитра» темы с поведением и дизайном прототипа;
- палитра темы — независимая копия шаблона;
- явная и редактируемая принадлежность токена к группе палитры;
- раздел работает до появления сервера и переключается на сервер без изменения экрана;
- превью токенов и компонентов показывают цвета палитры темы;
- одна и та же логика палитры в клиенте и на сервере, проверенная общими эталонными данными.

**Вне целей:**

- серверная часть и CLI (`add-theme-palette-api`), доставка палитры в generator;
- обновление палитры существующей темы до новой версии шаблона;
- отслеживание изменений: раздел Changes, счётчик и сброс правок, отмена и повтор, сравнение с
  опубликованной версией;
- обмен палитрой с Figma (`tokens.json`);
- связь стартового профиля темы (`sber`, `malachite`, `b2b`, `custom`) с группами палитры;
- глобальная замена и перестройка растяжки во всех группах, навигатор «вне бренда»;
- общий доступ к палитре в режиме `local`: она видна только в одном браузере.

## Архитектура

```mermaid
flowchart LR
  subgraph Client["js/apps/client"]
    Page["pages/palette"] --> App["modules/palette/application"]
    Colors["превью, пикер, состояния"] --> Resolver["restorePaletteColor"]
    App --> Port{{"PaletteRepository"}}
    Port --> Http["data/httpPaletteRepository"]
    Port --> Local["data/localPaletteRepository"]
    Local --> Domain["modules/palette/domain"]
    Resolver --> Domain
    Local --> LS[("localStorage: копия шаблона и правки")]
    Local --> Lib["шаблон: plasma-colors general + additional"]
    Local --> Draft["черновик токенов темы"]
  end
  Http -->|"/api/projects/{p}/ds/tenants/{t}/palette/*"| GW["gateway → ds-service"]
```

Экран и прикладные сценарии зависят только от порта `PaletteRepository`. Адаптер выбирается при старте
по `VITE_PALETTE_SOURCE` (`local` по умолчанию, пока сервер не влит; `api` после). Оба адаптера
возвращают одни и те же DTO контракта, поэтому переключение не меняет экран.

Модуль `domain` — чистые функции без React и HTTP: разбор ссылки, группа токена по умолчанию, состав
групп, вычисление ступени, перестройка, отображаемые имена. Его используют локальный адаптер и резолвер
цветов; сервер реализует те же правила в Kotlin и проверяется на тех же эталонных данных.

## Модель данных и контракты

DTO совпадают с контрактом `add-theme-palette-api`:

```ts
type PaletteType = 'general' | 'additional';
type SystemGroupKey = 'neutral' | 'accent' | 'status' | 'data' | 'syntax';
interface PaletteRampRef { type: PaletteType; shade: string }

interface ThemePalette {
  tenantId: string;
  editRevision: number;          // в режиме local — счётчик правок палитры в браузере
  canEdit: boolean;
  offBrand: boolean;
  groups: PaletteGroup[];
  tokens: PaletteTokenAssignment[];
}
interface PaletteGroup {
  id: string;                    // UUID у системных и пользовательских групп
  kind: 'system' | 'custom';
  systemKey: SystemGroupKey | null;
  label: string;
  ramps: PaletteRamp[];
}
interface PaletteTokenAssignment {
  tokenId: string; tokenName: string; groupId: string;
  assignment: 'explicit' | 'default';   // default — по правилу имени, пока привязки нет
}
interface PaletteRamp {
  slot: PaletteRampRef; source: PaletteRampRef; displayName: string;
  origin: 'template' | 'rebuild'; anchor: { step: number; value: string } | null;
  added: boolean; modified: boolean; linkedCount: number; steps: PaletteStep[];
}
interface PaletteStep { step: number; value: string; templateValue: string; overridden: boolean; linkedCount: number }
interface PaletteLink {
  tokenId: string; tokenName: string; displayName: string | null; groupId: string;
  mode: string | null; step: number; opacity: number | null; platforms: string[];
}
```

- `templateValue` — значение ступени источника в копии шаблона темы; `overridden` означает отличие от
  него.
- Ошибки операций: `{ error, code, details? }`, где `code` — `PALETTE_GROUP_EXISTS`,
  `PALETTE_GROUP_SYSTEM`, `PALETTE_RAMP_EXISTS`, `PALETTE_RAMP_LINKED`, `PALETTE_STEP_MISSING` или
  `TENANT_EDIT_CONFLICT`.

Состояние режима `local` хранится в `localStorage` под ключом
`ds_palette:<projectId>:<designSystemId>:<tenantId>`:

```ts
interface LocalPaletteState {
  version: 1;
  editRevision: number;
  template: Record<`${PaletteType}.${string}`, Record<string, string>>;  // копия шаблона на момент создания
  groups: { id: string; kind: 'system' | 'custom'; systemKey: SystemGroupKey | null; label: string }[];
  ramps: {
    groupId: string; slot: PaletteRampRef; source: PaletteRampRef; added: boolean;
    origin: 'template' | 'rebuild'; anchor: { step: number; value: string } | null;
    steps: Record<string, string>;                                     // правки ступеней
  }[];
  tokenGroups: Record<string, string>;                                 // tokenId → groupId, только явные
}
```

Состояние создаётся при первом открытии палитры темы в браузере: шаблон копируется из встроенной
`plasma-colors`, системные группы получают UUID.

## Программное проектирование

```ts
// modules/palette/domain
export function parsePaletteReference(value: unknown): PaletteReference | null;
export function formatPaletteReference(reference: PaletteReference): string;
export function defaultGroupForToken(tokenName: string): SystemGroupKey;
export function rampDisplayName(source: PaletteRampRef, anchor: { value: string } | null): string;
export function rebuildRamp(source: TemplateRamp, anchorStep: number, anchorHex: string): Record<number, string>;
export function buildThemePalette(input: ThemePaletteInput): ThemePalette;   // группы, привязки, значения, связи
export function resolveColorValue(palette: ThemePalette, tokenId: string, value: unknown): string | undefined;

// modules/palette/application
export interface PaletteRepository {
  load(ctx: PaletteContext): Promise<ThemePalette>;
  links(ctx: PaletteContext, query: PaletteLinksQuery): Promise<PaletteLink[]>;
  createGroup(ctx: PaletteContext, label: string, editRevision: number): Promise<PaletteMutation<PaletteGroup>>;
  deleteGroup(ctx: PaletteContext, groupId: string, editRevision: number): Promise<PaletteMutation<void>>;
  assignTokenGroup(ctx: PaletteContext, tokenId: string, groupId: string | null, editRevision: number): Promise<PaletteMutation<PaletteTokenAssignment>>;
  addRamp(ctx: PaletteContext, groupId: string, slot: PaletteRampRef, editRevision: number): Promise<PaletteMutation<PaletteRamp>>;
  replaceSource(ctx: PaletteContext, groupId: string, slot: PaletteRampRef, source: PaletteRampRef, editRevision: number): Promise<PaletteMutation<PaletteRamp>>;
  rebuild(ctx: PaletteContext, groupId: string, slot: PaletteRampRef, input: RebuildInput): Promise<PaletteMutation<PaletteRamp> | RebuildPreview>;
  updateStep(ctx: PaletteContext, groupId: string, slot: PaletteRampRef, step: number, value: string, editRevision: number): Promise<PaletteMutation<PaletteRamp>>;
  removeRamp(ctx: PaletteContext, groupId: string, slot: PaletteRampRef, input: RemoveRampInput): Promise<PaletteMutation<{ reassigned: number }>>;
}
export interface PaletteMutation<T> { editRevision: number; value: T }
export function createPaletteRepository(source: 'api' | 'local', deps: PaletteRepositoryDeps): PaletteRepository;

// palette/activePalette.ts — палитра открытой темы для резолвера цветов
export function setActivePalette(palette: ThemePalette | null): void;
export function restorePaletteColor(value: string, alphaSign?: 0 | -1, tokenId?: string): string;
```

`restorePaletteColor` заменяет `getRestoredColorFromPalette` в местах отображения цветов токенов. Без
активной палитры или без найденной ступени он откатывается к `getRestoredColorFromPalette`, поэтому
мастер создания и экраны до загрузки палитры работают как раньше. Оформление самого приложения
продолжает использовать встроенную палитру.

Страница `pages/palette/Palette.tsx` разбита на `PaletteSidebar`, `PaletteBoard`, `PaletteInspector`,
`RampPopover`, `StepColorEditor`, `TokenGroupSelect`, `AddRampDialog`, `RemoveRampDialog`,
`CreateGroupDialog`, `DeleteGroupDialog`; состояние экрана — в хуке `usePaletteEditor`, данные — в
`useThemePalette`. `TokenGroupSelect` используется и в инспекторе палитры, и в редакторе цветового
токена.

## Решения

### Палитра темы — копия шаблона

Общая палитра служит шаблоном: тема получает её копию при создании и дальше от неё не зависит. Значения
ступеней, источники замены и превью перестройки берутся из копии темы, а не из текущей общей палитры.
Отвергнуто: хранить у темы только отличия поверх живой общей палитры — тогда правка общей палитры
администратором меняла бы цвета всех тем, где растяжку не трогали.

В режиме `local` шаблоном служит встроенная `plasma-colors`; копия сохраняется в состоянии при первом
открытии, поэтому обновление пакета не меняет уже созданную палитру.

### Явная принадлежность токена к группе

От группы токена зависит, из какого экземпляра растяжки берётся его цвет, поэтому ошибка группы — это
неверный цвет. Имя токена задаёт пользователь и не обязано содержать `accent` или `data`, а в
пользовательскую группу по имени токен попасть не может. Поэтому:

- привязка токена к группе хранится явно в палитре темы и меняется пользователем;
- правило по имени даёт только группу по умолчанию для токенов без привязки (`assignment: 'default'`);
  оно никогда не выбирает пользовательскую группу;
- токен попадает в пользовательскую группу только явной привязкой;
- при удалении пользовательской группы привязки её токенов удаляются, и токены возвращаются к группе по
  умолчанию.

Правило по умолчанию: имя без префикса режима, начинающееся с `data.`, — `data`; последний сегмент с
`accent` или `promo` — `accent`; с `positive`, `negative`, `warning` или `info` — `status`; остальное —
`neutral`.

### Группы адресуются по `id`

У каждой группы, включая системные, есть UUID; системная группа дополнительно несёт `systemKey`. Растяжки,
привязки токенов, связи и операции ссылаются на группу только по `id`. Системные группы создаются вместе
с палитрой темы, их нельзя удалить или переименовать.

### Сначала клиент, через порт и два адаптера

Сервер палитры могут влить позже, поэтому экран не должен от него зависеть. Порт `PaletteRepository`
повторяет контракт `add-theme-palette-api`, адаптер `local` выполняет те же операции в браузере.

- Операции, которые меняют только палитру (замена источника, перестройка, правка ступени, добавление
  растяжки, группы, привязка токена к группе), в режиме `local` меняют только `localStorage`. Ссылки
  токенов не меняются, поэтому сохранение темы на сервер остаётся корректным.
- Удаление растяжки со стратегией в режиме `local` записывает новые ссылки или HEX в черновик токенов
  темы; они уходят на сервер обычным сохранением `PUT /tenants/{id}/token-values`.
- В режиме `local` раздел показывает баннер «Палитра хранится в этом браузере и не публикуется».
- Когда сервер влит, `add-theme-palette-api` переключает значение по умолчанию на `api`; адаптер `local`
  остаётся для разработки и тестов.

Отвергнуто: заглушка ответов в тестовом HTTP-сервере вместо адаптера. Она не даёт показать раздел на
стенде до появления сервера и не проверяет логику палитры.

### Модель слотов из прототипа

Ссылка токена остаётся строкой `[type.shade.step]` и обозначает слот в группе токена. Замена и
перестройка меняют значение слота только в этой группе, не трогая ссылки. Альтернатива — переписывать
ссылки токенов на собственные растяжки темы — потребовала бы, чтобы сервер понимал новые ссылки до
выхода клиента.

### Одинаковая логика на клиенте и сервере

Эталон `src/modules/palette/fixtures/palette-golden.json` содержит входные данные (шаблон, состояние
палитры, привязки и значения токенов) и ожидаемые результаты (группы по умолчанию, состав групп,
значения ступеней, перестройка, отображаемые имена). Клиентские тесты проверяют `domain`; тесты
`ds-service` читают тот же файл.

### Вёрстка раздела переносится из прототипа

Эталон — коммит `bae288ab81bd17bd95b0a4a2a07f5e900d6683c0` репозитория `kenymook/SDDS-Design-System`:

- разметка функций `paletteEditorV3`, `sourcePaletteFamilyMenuV3`, `sourcePaletteColorMenuV3`,
  `sourcePaletteRampBoardV3`, `sourcePaletteRampCardV3`, `sourcePaletteRampStepV3`,
  `sourcePaletteEditPopoverV3`, `sourcePaletteSelectedPanelV3`, `paletteSwatchLabelStyle` и модальных
  окон палитры в `portal/apps/portal-flow-prototype/app.js`;
- правила `.source-palette-*` в `styles.css`, включая `@media(max-width:900px)` и
  `@media(prefers-reduced-motion:reduce)`;
- значения `builder-ui-tokens.css`.

Экраны ветки уже свёрстаны по прототипу обычным CSS (`src/styles/workflow.css` с переменными `--p-*`),
поэтому правила `.source-palette-*` переносятся в `src/styles/palette.css` под тем же префиксом, а
разметка повторяется React-компонентами с теми же классами. Значения `builder-ui-tokens.css`, которых
нет среди `--p-*`, добавляются в `palette.css` как переменные раздела. Тексты интерфейса берутся из
прототипа. Выбора группы токена в прототипе нет; `TokenGroupSelect` оформляется так же, как выпадающие
списки инспектора прототипа. Глобальная тема и другие разделы не меняются.

Отвергнуто: собирать экран из компонентов Plasma — расходится с дизайном; подключить `styles.css`
прототипа целиком — тянет правила других экранов.

Готовность вёрстки подтверждается сверкой скриншотов эталонных состояний клиента и прототипа на
одинаковых данных при ширине 1440 px и 900 px. Неустранимые расхождения перечисляются здесь с причиной.

### Конфликт ревизий в режиме `api`

Операции палитры передают `editRevision` темы и получают новую. Ответ `409 TENANT_EDIT_CONFLICT`
приводит к перезагрузке палитры и уведомлению; черновик токенов сохраняется. После каждой операции
клиент обновляет `editRevision`, который использует сохранение значений токенов.

## Риски / Компромиссы

- [Логика палитры существует на двух языках] → общий эталон `palette-golden.json`, тесты обеих сторон.
- [Шаблон `local` (встроенная `plasma-colors`) и шаблон сервера (общая палитра `ds-service`) могут
  различаться] → в режиме `api` используется копия, сделанная сервером; при переходе с `local` на `api`
  палитра темы берётся с сервера, а не из браузера.
- [Смена группы токена меняет его цвет] → выбор группы показывает цвет токена в текущей и новой группе
  до подтверждения.
- [Палитра `local` не видна другим пользователям и теряется при очистке браузера] → баннер; режим
  предназначен для разработки и показа до слияния сервера.
- [Около 20 вызовов `getRestoredColorFromPalette`] → замена только в местах отображения цветов
  токенов, откат к прежнему поведению без палитры, правило ESLint против новых прямых вызовов.
- [Прототип продолжает меняться] → эталоном служит закреплённый коммит.
- [Публикация в редакторе темы сейчас скрыта] → раздел не добавляет собственной публикации; правки
  токенов уходят прежним сохранением темы.

## План проверки и развёртывания

- Автоматические: `cd js/apps/client && npm test && npm run build && npm run lint`, `cd js && npm run build`,
  `tools/verify fast|full --change add-theme-palette-editor`.
- Внешние до архивирования: прогон раздела в режиме `local` на локальном контуре, сверка скриншотов с
  прототипом.
- После слияния `add-theme-palette-api`: прогон того же сценария в режиме `api` описан в его задачах.
