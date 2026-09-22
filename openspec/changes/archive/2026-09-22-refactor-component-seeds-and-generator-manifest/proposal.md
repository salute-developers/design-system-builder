# Proposal

## Why

Prod-сиды компонентов в `js/services/db-service` лежали по таблицам в файлах на десятки тысяч строк с
захардкоженными идентификаторами, и добавление одного компонента plasma означало ручной разбор конфига
`sdds-serv`, правку восьми файлов регулярками и регулярные поломки соседних компонентов. Генератор пакета
знал только одну форму обёртки и одно имя экспорта ядра на компонент, поэтому Tabs с двумя базовыми
конфигами, Select с дженериком, Toast с HOC и компоненты без собственного конфига темы в пакет не
попадали. Превью в клиенте не умело показывать вложенные компоненты с их темой. Из-за этого в
конструкторе было включено 22 компонента из 60 с лишним, и первая партия базовых компонентов (сентябрь
2026) потребовала перестроить все три части.

## What Changes

- **BREAKING** Prod-сиды компонентов переводятся на папку на компонент
  `seeds/prod/components/<имя>/` с декларативным форматом без идентификаторов: ссылки между
  свойством, стилем и токеном задаются именами, id раздаёт сидер. Файлы по таблицам
  (`appearances.ts`, `variations.ts`, `properties.ts`, `styles.ts`, `variation_property_values.ts`,
  `invariant_property_values.ts`, `*_platform_param_adjustments.ts`, `design_system_components.ts`,
  `components/<имя>.ts`) удаляются. Реестра компонентов нет: папки находятся сканированием.
- Сид, выгрузка из базы (`db:seed-generate:prod`) и импорт из plasma пишут и читают один формат.
  `db:seed:prod --component=<X>` пересевает один компонент, очищая только его данные в базовой ДС.
- Добавляется инструмент `component:import`: читает `<X>.tokens.ts` из `plasma-new-hope` и
  `<X>.config.ts` из `sdds-serv`, пишет папку сида и манифест генератора, отчёт делит находки на
  «требует решения», «приближения» и «пропущено». Без `--apply` файлы не трогает.
- Зависимости компонентов (`component_deps`, типы `compose` и `reuse`) сидятся из одного файла по
  именам; пара с отсутствующим компонентом пропускается.
- Компонент может иметь несколько appearance (Tabs: `horizontal`, `vertical`) с общими свойствами и
  вариациями, но своим составом вариаций, дефолтами и значениями. Legacy-выдача `component-configs`
  берёт состав и порядок вариаций из объявлений appearance.
- Флаг (`pilled`, `stretch`) хранится как единственный стиль `true` без дефолта, как в ядре; стиль
  `false` не заводится. Дефолт вариации можно снять.
- Свойство типа `value` несёт строку CSS как есть (`auto`, `100%`, transition, `var(...)`),
  применяется в превью и пакете, в панели свойств не редактируется.
- **BREAKING** Web-параметр свойства именуется ключом объекта токенов ядра (`buttonHeight`), а не
  именем CSS-переменной. Билдер отдаёт значения по ключу; генератор подставляет
  `${<x>Tokens.<ключ>}`, превью берёт CSS-переменную из объекта токенов ядра.
- Генератор получает манифест компонента `app/templates/<X>/component.json` с тем, что не выводится
  из данных ДС: имена экспортов ядра, реэкспорты `index.ts`, приведение типа, дженерик, соседи без
  конфига, appearance-проп. Рядом лежат шаблоны файлов, которые нельзя сгенерировать (`Steps.tsx`,
  `TabsController.tsx`). Захардкоженная таблица имён конфигов ядра удаляется.
- Генератор раскладывает компоненты как `sdds-serv`: multi-appearance обёртка с выбором конфига по
  пропу, пустая обёртка без локального конфига, дженерик через `fixedForwardRef`, шаблонная обёртка,
  обычная; дочерние `compose`-компоненты живут в папке родителя и не экспортируются с корня.
- Клиент получает контроллер превью `controllers/componentPreview`: карта ключ токена ядра →
  CSS-переменная и runtime-конфиг темы, идентичный тому, что генератор пишет в `<X>.config.ts`.
  Стори получает связанные компоненты готовыми через `relatedComponents`; для `compose` на сцену
  кладутся переменные дочернего/родителя с синхронизацией одноимённых вариаций.
- Клиентский `utils/importComponentConfig.ts` удаляется: импорт переехал в db-service.
- В меню конструктора включаются ~35 компонентов, для каждого добавляется стори; `Typography`
  разбивается на `Body`, `Dspl`, `Heading`, `Text`, `Segment` на `SegmentGroup`, `SegmentItem`.
- Скилл `.claude/skills/add-component` и `js/docs/component-creation.md` описывают новый сценарий
  добавления компонента.

## Capabilities

### New Capabilities

- `component-seed-format`: формат prod-сидов компонента по папкам без идентификаторов, единый для
  сида, выгрузки из базы и импорта из plasma; частичный пересев одного компонента; зависимости
  компонентов по именам.
- `plasma-component-import`: инструмент импорта web-компонента из репозитория plasma в сид и
  манифест генератора с отчётом о спорных местах и правилами приведения конфига к модели.
- `generator-component-manifest`: манифест и шаблоны компонента в генераторе, стратегии обёрток,
  раскладка составных и multi-appearance компонентов в пакете.
- `component-preview-composition`: превью текущего React-клиента для компонентов с несколькими
  appearance, флагами, свойствами `value` и связанными компонентами.

### Modified Capabilities

- `component-appearance-model`: флаг как единственный стиль `true` без дефолта; тип свойства
  `value`; web-параметр свойства равен ключу объекта токенов ядра; сочетания стилей в сидах;
  legacy-выдача `component-configs` берёт вариации из объявлений appearance.

## Impact

- **js/services/db-service**: `src/db/seed-prod.ts`, `seed-generate-prod.ts`, новые
  `seeds/prod/component-seed.ts`, `component-seed-writer.ts`, `component_deps.ts`,
  `import-plasma-component.ts`, папки `seeds/prod/components/*`; роут
  `src/routes/api/legacy.ts` (`component-configs`); скрипт `component:import` в `package.json`.
  Схема `schema.ts` и миграции не меняются: `component_deps`, `appearance_variations`,
  `style_combinations` и тип `value` уже есть.
- **js/services/generator**: `app/generate.ts`, `app/creators/*`, новый
  `createCompositeComponent.ts`, `app/templates/**`, `app/componentBuilder/*` (web-параметры по ключу
  токена, `ValueProp`, `Config` по appearance), `tsconfig.json`, `package.json` (шаблоны копируются в
  `dist`, `@types/node` 22).
- **js/apps/client**: `controllers/componentPreview/*`, `controllers/componentBuilder/*` (зеркало
  генератора), `hooks/useStory.ts`, `pages/components/features/ComponentEditor*`, `stories/*`,
  `utils/menuItems.ts`; удаляется `utils/importComponentConfig.ts`.
- **Документация и процесс**: `js/docs/component-creation.md`, `.claude/skills/add-component/SKILL.md`.
- **backend-kt** и **frontend-kt** не затрагиваются. Legacy-роут остаётся единственным потребителем
  генератора и клиента; контракт `components push/fetch` не меняется.
- Зависимости: клон plasma на хосте для `component:import` (`PLASMA_DIR`), версия
  `@salutejs/plasma-new-hope` в генераторе и клиенте должна совпадать по мажору с клоном.
