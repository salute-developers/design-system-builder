---
name: add-component
description: Добавить web-компонент plasma в конструктор (разметка ядра, импорт в пакет .sdds/components через js/cli, заливка в ds-service, web-adapter.json, стори в web-плагине превью, сиды ds-service, проверка генератором). Use when the user asks to add, import or enable a component like TextArea, Select, Modal in DS Builder.
---

Компонент проходит путь «ядро и sdds-serv → пакет `.sdds/components` → база ds-service → превью и сгенерированный пакет → сиды». Предсказуемую часть делает `npm run import:plasma` в `js/cli`, ты читаешь его отчёт, принимаешь решения по спорным пунктам и доводишь компонент до превью, пакета и сидов. В базу данные попадают только через `dsbuilder components push`; в новые дизайн-системы — только через сиды (`npm run seeds:update`).

```
plasma-new-hope (аннотации) ─ generate:api-meta ─ components import-api ─► глобальный слой
sdds-serv (конфиги) ─ import:plasma ─► .sdds/components ─ components push ─► базовая ДС стенда
                                     └─► web-adapter.json (шаблоны), манифест генератора
базовая ДС ─ стори плагина, generate:ds ─► превью и npm-пакет
пакет компонента ─ seeds:update ─► component-seeds.json ─► каждая новая ДС
```

## Источники

| Что | Откуда |
|---|---|
| API компонента | `packages/plasma-new-hope/src/components/<X>/<X>.tokens.ts` (или `tokens.ts`), словарь `tokens` |
| Конфиг оформления | `packages/sdds-serv/src/components/<X>/<X>.config.ts(x)`; доп. appearance — `<X>.<appearance>.config.ts` |
| Обёртка и экспорты | `packages/sdds-serv/src/components/<X>/<X>.tsx`, `index.ts` |
| Стори | `packages/sdds-serv/src/components/<X>/<X>.stories.tsx`; аргументы — `utils/plasma-sb-utils/src/components/<X>/meta.ts` |
| Имена токенов темы | `.sdds/tenants/<тема>/meta.json` (выгрузка `dsbuilder theme fetch`) |

Клон plasma — `~/Documents/work/plasma` (`--plasma=` или `PLASMA_DIR`). `js/cli` и `js/apps/preview-web-plugin` ставят одну и ту же точную версию `@salutejs/plasma-new-hope` (сейчас `0.391.0-dev.0` с аннотациями Style API). Если компоненту нужны аннотации, которых в опубликованном ядре ещё нет, разметка делается в клоне plasma, а до публикации ядро временно ставится локальным tgz (`npm pack`). Такой `file:…tgz` в CI не устанавливается: до слияния его заменяют опубликованной версией.

## Подготовка

- **Стенд.** Работа идёт на локальном стенде (`backend-kt/start-local.sh`, шлюз `http://localhost:8080`). Вход CLI: `DSBUILDER_API_URL=http://localhost:8080 dsbuilder auth login` (браузер, `admin@example.com` / `password`); сессия привязана к адресу, поэтому все команды `dsbuilder` идут с тем же `DSBUILDER_API_URL`. Рабочий каталог с `.sdds` для ДС стенда: `dsbuilder init --project-id … --design-system-id … --platform react`, затем `dsbuilder theme fetch`. Общие стенды (dev, prod) — только по прямой команде пользователя. CLI должен совпадать по API с бэкендом стенда: локальный бэкенд, собранный из текущей ветки, ждёт текущий CLI — `frontend-kt/install-local-cli.sh` (ставит `~/.dsbuilder/cli/macosArm64/dsbuilder` и web-тулчейн из `js/cli`); симптом расхождения — `Status: not found` у `push`/`fetch` и `"route":"unmatched"` в логе бэкенда.
- **Аннотации ядра.** Компонент попадает в глобальный слой, только если его словарь размечен `@styleType`. Неразмеченный словарь размечай сам в `plasma-new-hope` по правилам `.agents/skills/create-core-component/SKILL.md` клона plasma; проверка — `../../node_modules/.bin/eslint <файлы> --quiet` из `packages/plasma-new-hope` (правило `@salutejs/plasma/style-api-annotations`). Компонент без своих токенов (Flow, Mask, Overlay, ViewContainer) получает пустой `<X>.tokens.ts` с `export const tokens = {};`, как Image.
- **Сборка ядра до публикации.** `npm run build` и `npm pack --ignore-scripts` в `packages/plasma-new-hope`, затем `npm install <tgz>` в `js/cli` и в `js/apps/preview-web-plugin`; после публикации — `npm install @salutejs/plasma-new-hope@<версия> --save-exact` в обоих пакетах. После смены ядра в плагине пересобери `public/api-meta.json` (`npm run generate:api-meta -- --package @salutejs/plasma-new-hope --out ../apps/preview-web-plugin/public/api-meta.json` из `js/cli`) и обнови `plasmaNewHopeVersion` и `apiMetaSha256` в `public/preview-plugin.json`: их сверяет тест манифеста.

## Шаги

Команды `npm` — из `js/cli`, `dsbuilder` — из рабочего каталога стенда с `DSBUILDER_API_URL`.

1. **Глобальный слой.** `npm run generate:api-meta -- --package @salutejs/plasma-new-hope` пишет `.sdds/web/web-api-meta.json` по аннотациям установленного ядра; `dsbuilder components import-api --platform react --from <мета> --dry-run`, затем `--apply --strict` (права системного администратора). `import-api` не меняет тип уже существующего свойства и печатает `Property type mismatches`: тип свежих свойств без значений выравнивается в базе стенда (`UPDATE properties` с проверкой «под свойством нет значений» в той же транзакции), у свойств со значениями — только по решению пользователя. Без компонента в глобальном слое push отклоняет пакет (`Component 'x' is not present in the global layer`).
2. **Сухой прогон.** `npm run import:plasma -- --sdds=<рабочий .sdds> --component=<X>`. Прочитай отчёт целиком.
3. **Спорные пункты.** «ТРЕБУЕТ РЕШЕНИЯ» обязателен к ответу. Расхождение «тип X расходится с глобальным слоем (Y)» исправляй в аннотации ядра под значения конфига (см. «Правила модели»), а не флагом; неизвестные токены темы — `--alias=<ident>=<token.name>`; радиус вне шкалы — `--shape=<prop>=<round.x>` или `dimension` в аннотации. После правки аннотаций — снова сборка ядра и шаг 1. «ПРИБЛИЖЕНИЯ» и «ПРОПУЩЕНО» перечисли пользователю в итоге.
4. **Применить.** Тот же вызов с `--apply`: записи компонента в пакете и манифест генератора `js/cli/src/generator/templates/<X>/component.json`. Повторный импорт заменяет записи компонента и сливает манифест с прежним: правленный руками манифест (Calendar) после импорта проверь и верни. `--remove --apply` снимает записи компонента из пакета, базу не трогает.
5. **Доработка пакета.** Закрой пробелы инструмента (раздел «Пробелы `import:plasma`»): состояния в `states`, строки из конфига, шрифты. Перед push в пакете должны лежать только заводимые компоненты и appearance.
6. **Заливка.** `dsbuilder components push --platform react --from .sdds/components --dry-run`, затем `--apply`. Push пишет только appearance, которые есть в пакете: `default` компонента не трогается, когда заливаешь `clear`. Отчёт: `Rejected: 0`, нет `Properties absent from the global layer`; «Token references not found» для имён типографики (`body.l.bold`), литералов цвета и `inherit`/`transparent` — норма. Сверка: `dsbuilder components fetch --platform react --to <каталог>` и сравнение с пакетом по именам свойств, стилей и значениям (типы глобального слоя могут отличаться: `0` под `dimension`). Связи `compose` из отчёта и `reuse` для стори — `POST /api/projects/<projectId>/design-systems/catalog/component-deps` с телом `{ parentId, childId, type, order? }` (токен — пароль через клиент `dsbuilder-api` keycloak, id компонентов — из базы или `GET /api/projects/<projectId>/design-systems/catalog/components`). Компонент заводится в базовой ДС и больше никуда.
7. **`web-adapter.json`.** Запись компонента (`componentName`, `name`, `description: "Imported from api-meta"`, шаблоны `styles.<appearance>.templates` — фрагмент из отчёта импорта) добавь в обе копии: `js/cli/src/data/web-adapter.json` и `js/apps/preview-web-plugin/src/data/web-adapter.json`, в порядке `componentName`, компактно как файл. Копии должны совпадать побайтно: `npx tsx --test src/components-input.test.ts`. Шаблоны в базу не заносятся.
8. **Стори в web-плагине превью** (`js/apps/preview-web-plugin`, в клиенте стори нет).
   - Файл `src/stories/<X>.story.tsx`, формат — `src/stories/types.ts`, образцы — `TextField.story.tsx`, `ButtonGroup.story.tsx`. Переноси все истории из `<X>.stories.tsx` sdds-serv; первая называется `Default`.
   - Компонент — из ядра с пустым конфигом `component(mergeConfig(xConfig as any, {}))`: оформление приходит CSS-переменными сцены по выбранным вариациям, поэтому вариации конфига (`view`, `size`…) аргументами не делаются. Вложенные DS-компоненты — из `relatedComponents` (связь `reuse`), с запасным вариантом из ядра.
   - Подключение: `src/registry.ts`, `components` в `public/preview-plugin.json`, `CLIENT_COMPONENT_MAPPER` в `test/manifest.test.ts`; нестандартные имена токенов или конфига ядра — `coreTokensByComponent`/`coreConfigNameByComponent` в `src/cssVariables.ts`.
   - Клиент: компонент не должен быть в `unsupportedWebComponents`, группа меню — в `js/apps/client/src/utils/menuItems.ts`.
   - Проверка: `npm test`, `npx tsc -p tsconfig.app.json --noEmit`, `npx eslint`, `npm run build` в плагине.
   - Публикация на локальный стенд: архив функциями `scripts/package.mjs` (`enrichManifest`, `validateWebManifest`, `zipDirectory`) в каталог вне репозитория — `npm run package` перезаписывает отслеживаемые `local-dev/web-preview/preview-web-plugin.zip` и `local-dev/README.md`; затем `dsbuilder preview-plugin publish --platform react --from <zip> --api-url http://localhost:8080 --apply`. Билд с тем же `commit` повторно не публикуется: для локальной проверки без коммита id берётся из хеша содержимого `dist`.
   - Проверь в редакторе (`/projects/<id>/design-systems/<id>/themes/<id>/components/<X>`, Playwright из `js/apps/client` с `channel: 'chrome'`): превью рисуется, ошибок страницы нет, оформление темы применяется; у компонента с несколькими appearance — переключение в списке «Конфигурация» инспектора.
9. **Проверка генератором.** Выгрузка ДС стенда → `npm run generate:ds -- --sdds <.sdds> --components <выгрузка> --out <каталог> --name base --package --core-version file:<tgz ядра>` (и `generate:components --package` без темы) → в каталоге результата `npm install --ignore-scripts`, `npm run build:styled-components`, `npm run generate:typings`. Новых ошибок `tsc` быть не должно; многозначные свойства получают шаблон из `web-adapter.json`. CSS-сборка linaria (`build:css`) падает на `refractor` через CodeArea и с опубликованным ядром — известная проблема, не связанная с компонентом.
10. **Сиды.** `npm run seeds:update -- --from <пакет> --component=<X> [--component=<Y>:<appearance>] [--dependency=<Родитель>:<Ребёнок>:reuse]` дописывает в `backend-kt/ds-service/feature-components/src/main/resources/component-seeds.json` только названные компоненты и appearance; остальные записи не меняются. **В сиды идут только данные из ядра и sdds-serv**: передавай пакет импорта (после доработки шага 5), а не выгрузку стенда, — в базе стенда бывают ручные правки пользователя. После записи обнови в `ComponentSeedsResourceTest` контрольную сумму и счётчики компонентов, связей и appearance и прогони `JAVA_TOOL_OPTIONS=-Dapi.version=1.44 ./gradlew :ds-service:feature-components:test --tests '*ComponentSeedsResourceTest*' :ds-service:runtime:test --tests '*SeedResourcesContractTest*'` из `backend-kt`. Внешняя проверка: `MINIO_PUBLIC_PORT=9010 ./start-local.sh --detach`, создать новую ДС в клиенте и сверить число компонентов и appearance с сидами. Сиды ссылаются на свойства глобального слоя: на стенде перед ними нужен `import-api` из той же меты, иначе инициализатор не заведёт ни одного компонента.
11. **Итог пользователю.** Что заведено, какие решения принял сам, что приближено, что пропущено, что осталось.

## Правила модели

- Имя web-параметра свойства равно ключу словаря токенов ядра. Если словарь или базовый конфиг называются не `<x>Tokens`/`<x>Config` (`tabsTokens`, `lineSkeletonConfig`, `calendarBaseConfig`, `carouselNewConfig`), имена лежат в манифесте генератора (`coreTokensExport`, `coreConfigExport`) и в `src/cssVariables.ts` плагина; база о них не знает.
- **Тип свойства — по значениям конфига.** Составной отступ, заданный во всех стилях одним числом, — `dimension` с шаблоном; разное число чисел по стилям — `value`; `inherit`, `var(...)` вместо цвета — `value`; одиночный `0` без единиц инструмент видит `float`, верная разметка — `dimension` или `integer`.
- Шесть токенов шрифта одной группы — одно свойство `typography` `<prefix>Style` со значением вида `body.l.normal`; жирный `FontWeight` даёт `body.l.bold`, `h1…h6` — `header.h*`, `dspl*` — `display.*`. Отдельный `fontWeightSelected` без остальных частей не выражается и пропускается.
- Многозначное CSS-значение — один шаблон web-параметра на свойство (`$1` — число стиля); если меняется больше одного числа, шаблон точен для размера по умолчанию. Это ограничение модели.
- **Состояния — только `hovered`/`pressed`**, ключ токена — `<база>Hover`/`<база>Active`: генератор строит имя параметра суффиксом. `Focus`, `Selected`, `ReadOnly` и токены с другим ключом размечаются самостоятельными свойствами без `@styleState`, как `backgroundColorFocus` у TextField. Состояние без базового значения в том же стиле — тоже самостоятельное свойство.
- `disabled` и `readOnly` — не вариации: их токены уходят в инварианты.
- Радиус сначала сверяется с токенами формы `round.*`: совпали все значения — `shape`, иначе `dimension`; радиус от 500px — `round.circle`.
- Флаг хранится как в ядре: один стиль `true`, без стиля `false`; парный стиль заводится только у ориентации.
- `mergeConfig` ядра заменяет вариации целиком: частичный перенос конфига недопустим, стиль удалять нельзя (крайний случай — `--skip-style`).
- Имя appearance — kebab-case (`has-wrapper`), иначе бэкенд отвечает `appearance_name_invalid`; в пакете проп — то же имя (`appearance="has-wrapper"`), файлы и идентификаторы — camelCase.
- Имя компонента должно переживать `kebab → Pascal` (`ssr-provider` → `SsrProvider` ≠ `SSRProvider`): такой компонент push принимает, но выгрузка всей ДС потом падает с 422. Его не заводят в ДС, а реэкспортируют генератором (`CORE_REEXPORTS`).
- Тип `integer` (число колонок Grid) поддерживают клиент (числовое поле, числовой литерал в превью) и генератор (число без единиц).
- Колонка `platform` у `appearances` и `properties`: push `--platform react` ставит `web`; клиент работает только с `web`.

## Формы обёртки в генераторе

Генератор выбирает обёртку по данным и манифесту `templates/<X>/component.json`:

- **Несколько appearance по пропу** (Tabs: `orientation`, свой конфиг ядра на appearance) — `appearances: { prop, default }`, импорт через `--dir` с подпапками `horizontal/`, `vertical/`.
- **Несколько appearance с одним конфигом ядра** (`createConditionalComponent` в sdds-serv: `clear`, `transparent`, `has-wrapper`) — включается сам, когда у компонента больше одного appearance; дженерик-обёртка (Select) тоже собирает выбор и добавляет `appearance` в тип пропсов.
- **Пустой компонент** (Image, Flow, ButtonBase) — обёртка над конфигом ядра без локального конфига.
- **Шаблон обёртки** `templates/<X>/<X>.ts(x)` перекрывает сгенерированную: HOC и провайдеры (Toast, Notification), фабрика конфига (Steps), обёртка над другим компонентом (Mask и NumberFormat над TextField, Calendar как `boundCalendar`), реэкспорт ядра (Overlay, Portal). `component()` ядра типизирован как `FunctionComponent`, а `composeMask`/`composeNumberFormat` ждут `ForwardRefExoticComponent` — приводи тип.
- **`requiresTheme: true`** (ViewContainer: вид берёт `viewContainer` темы пакета) — компонент генерируется только в пакет с темой; без темы пропускается с предупреждением.
- **Дженерик** (`generic`: Select, Combobox, Dropdown), **приведение типа** (`castToProps`: Modal, Popup, Tooltip), **соседи** (`siblings`: ToolbarDivider), **реэкспорты** (`reexports`) — инструмент пишет в манифест сам.
- **Реэкспорт ядра без компонента в ДС** — `CORE_REEXPORTS` в `js/cli/src/package-output.ts` (`SSRProvider`).

## Пробелы `import:plasma` и как их закрывать

Каждый из них — кандидат на доработку инструмента через OpenSpec; пока закрывай вручную или скриптом в каталоге для временных файлов.

- **Состояния не переносятся в `states`.** Инструмент пишет `xxxHover` отдельным ключом, push ищет его внутри базового свойства (иначе «Properties absent from the global layer»). Перенеси ключи с `state` из меты в `states` базового свойства.
- **Словарь `*Tokens` вместо `tokens`** (Tree, Table) не читается: `--tokens=` на копию файла с переименованным экспортом.
- **CSS-переменные темы в конфиге** (RatingInput: `var(--text-primary)`, `var(--plasma-typo-h3-bold-font-weight)`) заводятся `value`: переведи в пакете в токены (`text.default.primary`, `header.h3.bold`).
- **Токен темы, которого нет в ДС** (`syntaxYellow` у CodeArea): импорт с копией конфига, где идентификатор заменён фолбэком из `sdds-themes`.
- **Смешанная шрифтовая группа** (CodeInput: семейство `dsplM` и начертание `bodyM`; CodeArea: моноширинный литерал и размеры `bodyL`) пропускается целиком: размечай части `value` и допиши значения по размерам в пакет (`${bodyMBold.fontWeight}` → `var(--plasma-typo-body-m-bold-font-weight)`).
- **Дополнительный appearance** (`X.clear.config.ts`): временная раскладка `<appearance>/<Appearance><X>.config.ts` вместе с соседними файлами конфига, импорт `--dir=<раскладка> --root=appearance` в отдельный пакет, где лежат только новые appearance; манифест генератора сохрани до импорта и верни после. Свойства, у которых в глобальном слое тип `value`, а в новом appearance вывелся другой, бери строкой из конфига (`${textSecondary}` → `var(--text-secondary)`); имя группы шрифта сверяй с метой (у Select `textFieldTitleCaptionTypography`).
- **Вызов функции ядра в конфиге** (`${getBaseGridView({...}, 'default')}` у Grid — медиазапросы по ширинам точек перелома) импорт не переносит: генератору задай `breakpointView: { function, paramSuffix }` в манифесте, а стори строит вид той же функцией из переменных сцены.
- **Фрагменты-вставки** (`${baseItemView}` у Steps) не разбираются: раскрой руками, сверь число свойств с числом ключей `tokens.` в конфиге.
- **`intersections`** (Steps) не переносятся — «ПРОПУЩЕНО».

- **Дефолт с опечаткой в sdds-serv** (`tooltipSize: 'm'` при вариации `eventTooltipSize` у Calendar, CalendarDouble, DatePicker, DateTimePicker): импорт не находит дефолта, и превью не применяет стили размера — подсказка событий без оформления. После импорта проверь, что у каждой вариации со стилями-размерами есть дефолт (`bindings[].defaultValue`), и ставь его по смыслу конфига.

## Стори: прецеденты

- `args` не разливается в компонент целиком: служебные аргументы разбирай (`const { itemsCount, ...rest } = args`).
- Кнопка-триггер не в левом верхнем углу (там переключатель историй): отступ сверху не меньше `3.25rem`. Modal и Popup — через `frame` на контейнер внутри сцены; Tour рисуется порталом в `body`, переменные сцены копируются на его корень.
- Широкое содержимое (Table) — в рамке `width: 100%; overflow-x: auto`: сцена центрирует и обрезает левый край.
- Большой попап (DateTimePicker — календарь с временем шире 1000px, DatePicker, TimePicker): поле ставь к верхнему левому краю сцены (`alignSelf: 'flex-start'`, отступ сверху `3.25rem`), `placement` по умолчанию `bottom-start`. Иначе пикер с `placement = ['top', 'bottom']` открывается туда, где больше места, и попап срезается краем сцены.
- Обёртка над другим компонентом без своих значений в ДС (Mask, NumberFormat над TextField): превью не кладёт на сцену переменные вложенного компонента, и голый компонент ядра остаётся без оформления. Заведи связь `reuse` (в базе и в сидах через `--dependency`), бери вложенный компонент из `relatedComponents` и строй обёртку поверх него (`useMemo(() => composeMask(TextField), [TextField])`); вид и размер вложенного — аргументы стори.
- Компонент с выбором (Steps, Tabs, Segment, пикеры) хранит состояние в стори.
- Стори дочернего компонента (TabItem, SegmentItem, StepItem) показывает один элемент; вид элемента на странице родителя — аргумент стори.
- Компонент с фабричным конфигом (Steps) стори строит сама из `<Имя>Config` в `relatedComponents`.

## Когда не использовать инструмент

Конфиг написан не в форме `variations: { axis: { style: css\`...\` } }` или у компонента нет обёртки в sdds-serv (прямой реэкспорт ядра). Тогда запись пакета пиши через `writeComponentEntries` из `js/cli/src/component-package.ts` (образец формата — выгрузка `dsbuilder components fetch`), манифест — `--manifest --apply` или руками, обёртку — шаблоном.
