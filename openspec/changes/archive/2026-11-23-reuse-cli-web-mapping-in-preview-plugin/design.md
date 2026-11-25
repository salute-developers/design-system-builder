## Context

Генератор `js/cli` (npm-пакет `@sddsjs/design-system-builder-generator`, исходники TypeScript запускаются через `tsx`, публикация ручная) и web-плагин превью `js/apps/preview-web-plugin` (React + Vite) по-разному используют одни и те же правила маппинга свойств компонента на параметры ядра. Генератор пишет код пакета со ссылками на переменные темы, плагин — живые значения из payload превью. Сами правила при этом общие и реализованы дважды:

| Правило / данные | Генератор `js/cli` | Плагин |
|---|---|---|
| API-мета | `buildApiMeta` на каждый запуск, тип `ApiMetaComponent` в `component-source.ts` | закоммиченный `public/api-meta.json` (побайтно равен результату CLI), свои типы и индекс в `resolve/meta.ts` |
| Параметры свойства | `toApi`: параметры меты с `id` свойства без `state` | `indexMeta`: то же плюс группировка по состояниям |
| Ключ состояния | `Prop.getAdditionalTokens`: `<param>Hover`/`<param>Active` | `stateParamFor`: тот же суффикс плюс выбор по мете |
| `web-adapter.json` | `src/data/web-adapter.json`, поиск шаблона в `component-source.ts` | копия, `indexTemplates`/`templateFor` |
| Подстановка `$1…$n` | `replaceAdjustmentPlaceholders` в `Prop.createWebToken` | `applyTemplate` |
| px → `rem` | `DEFAULT_FONT_SIZE` в `DimensionProp`, `ShapeProp` | `toRem`, `REM_BASE` |
| Поле типографики | `TypographyProp.createWebToken`: ключ значения входит в имя параметра | `typographyPartFor`: `part` меты, иначе то же правило |
| `compose`-связи | `compose` в `web-adapter.json` → `deps` | захардкоженный `composeDependencies` |
| Имя переменной типографики темы | `formattedTokenName` в `props/typography.ts` и `createTypographyTokens.ts`: `display` → `dspl`, группа `header` опускается (`h3-bold`), как в `plasma-typo` и конфигах sdds-serv | `typographyVariableBase`: `header-h3-bold`, `display-l` — таких переменных в plasma нет; третья копия в `import-plasma-component.ts` ошибается так же, как плагин. Четвёртая копия — в `ds-service` (`feature-themes/.../TypographyStyleNaming.kt`, `variableKeys`, `GENERATOR_PREFIXES`, проверка уникальности имён); она совпадает с генератором, Kotlin модуль не переиспользует, но при изменении правила её нужно менять вместе |
| Объект токенов и конфиг ядра компонента | `getPlasmaTokensName`/`getPlasmaConfigName` + `coreTokensExport`/`coreConfigExport` манифестов `templates/<X>/component.json` | ручные таблицы `coreTokensByComponent`/`coreConfigNameByComponent` в `cssVariables.ts`; уже расходятся с манифестами (нет `CalendarDouble`, соседей Drawer и Toolbar) |

Свои, не общие задачи у каждой стороны остаются своими. У генератора это ссылки `var(--…)` на тему, запись конфигов и обёрток. У плагина это разбор payload и протокола, значения токенов темы из payload (цвет с `alpha`, тени, градиенты, шрифты), переменные темы окружения, предупреждения и имена CSS-переменных по объектам ядра.

## Goals / Non-Goals

**Goals:**
- Общие правила и данные описаны один раз — в `js/cli`, отдельными функциями, которые ничего не знают ни о генераторе кода, ни о превью, ни о payload.
- Генератор пользуется этими функциями сам. Так они не становятся кодом «для плагина» и проверяются снимками генератора.
- Плагин не хранит копий `web-adapter.json` и API-меты и не реализует общие правила заново, а импортирует их из npm-пакета.
- Поведение генератора не меняется. Превью меняется только в именах переменных типографики `header` и `display` — это исправление ошибки (решение 6).

**Non-Goals:**
- Переносить в CLI логику превью: разбор payload, протокол, тему окружения, предупреждения, `resolvePayload`.
- Переносить имена CSS-переменных по объектам ядра (`cssVariables.ts`): генератор их не вычисляет, а пишет `${<tokens>.<key>}`.
- Переносить эвристики превью (`stateParamFor`, `indexTemplates`/`templateFor`, `paramNames`): генератор ими не пользуется.
- Менять протокол превью, формат архива плагина и проверки `ds-service`.

## Decisions

### 1. Модуль `src/web-mapping` — только правила, которыми пользуется генератор

Критерий включения: функцию вызывает сам генератор. Эвристики, нужные только превью, остаются в плагине поверх этих примитивов.

| Файл | Функции и данные | Кто в генераторе вызывает | Дубль в плагине |
|---|---|---|---|
| `api-meta.ts` | типы `ApiMeta`, `ApiMetaComponent`, `ApiMetaParam`; `basePropertyParams(component, property)` — параметры свойства без `state`; `STATE_PARAM_SUFFIX` (`hovered: 'Hover'`, `pressed: 'Active'`) | `generate-api-meta.ts` (типы вместо своих `Param`/`ComponentMeta`), `toApi` в `component-source.ts`, `Prop.getAdditionalTokens` | типы и суффиксы в `resolve/meta.ts` |
| `web-adapter.ts` | типы записи; `webAdapter` (данные `../data/web-adapter.json`); `applyTemplate(template, values)`; `toComponentName(kebab)`; `composeOf(entry, adapter)` → `[{ id, name }]` в порядке `compose`, имя через запись адаптера или `toComponentName` | `components-input.ts` (встроенный адаптер без `--web`), `Prop.createWebToken`, `deps` в `component-source.ts` | копия JSON, `applyTemplate`, `composeDependencies` |
| `units.ts` | `REM_BASE = 16`, `pxToRem(px)`, `adjustedRadius(radius, adjustmentPx)` → `calc(<радиус> + <поправка>rem)` | `DimensionProp`, `ShapeProp` | `toRem`, `REM_BASE`, `calc(...)` в `resolve/tokens.ts` |
| `typography.ts` | `TYPOGRAPHY_PARTS`; `typographyPartFor(paramName, part?)`; `typographyVariableBase(tokenId)` — правило генератора тем | `TypographyProp.createWebToken`, `formattedTokenName`, `createTypographyTokens.ts`, `import-plasma-component.ts` | `typographyPartFor`, `typographyVariableBase` |
| `core-exports.ts` | `coreTokensExportName(component, manifest?)`, `coreConfigExportName(component, manifest?)` — имя из манифеста или `<x>Tokens`/`<x>Config`; тип `CoreExportNames` (поля манифеста с именами экспортов) | `getPlasmaTokensName`/`getPlasmaConfigName` (переносятся сюда) и их вызовы в `generate.ts`, `createComponent.ts`, `createComponentConfig.ts` | `getCoreTokens`/`getCoreConfig` с ручными таблицами |
| `theme-variables.ts` | `colorVariableName(category, subcategory, name)` → `--<категория>-<имя>` или `--<подкатегория>-<категория>-<имя>`; `DERIVED_STATE_TOKEN_SUFFIX` (`hovered: '-hover'`, `pressed: '-active'`) | `props/color.ts`, `createColorTokens.ts`, `createGradientTokens.ts`, `createViewContainerTokens.ts`, `import-plasma-component.ts` | `themeVariableName`, `DERIVED_STATE_SUFFIX` |
| `index.ts` | реэкспорт | — | — |

В плагине остаются, но строятся на примитивах модуля:
- `indexMeta` с группировкой по состояниям и `paramNames` (распознавание старого формата WEB);
- `stateParamFor` — выбор параметра состояния по мете;
- `indexTemplates`/`templateFor` — первый шаблон по всем конфигурациям, потому что конфигурацию плагин не знает. У генератора своя политика `templateOf`: только конфигурации из выгрузки.

Функции чистые. Модуль не импортирует `node:*`, `@salutejs/plasma-new-hope` и код вне себя, кроме `../data/web-adapter.json`; это проверяет тест CLI. Слов «превью» и «payload» в модуле нет.

`buildApiMeta` остаётся в `generate-api-meta.ts`: она читает файлы и запускает компилятор TypeScript. Наружу она выходит подкомандой (решение 3).

### 2. Генератор переходит на функции модуля

- `Prop.createWebToken` вызывает `applyTemplate`; `getAdditionalTokens` берёт `STATE_PARAM_SUFFIX`.
- `DimensionProp` вызывает `pxToRem`, `ShapeProp` — `adjustedRadius`. `DEFAULT_FONT_SIZE` удаляется: других потребителей у неё нет.
- `TypographyProp.createWebToken` выбирает поле через `typographyPartFor(name)`. На всех 1186 типографических параметрах текущей меты результат совпадает с прежним сопоставлением ключей. Ветка с темой (`getWebTokenValue(theme)`) пропускает параметр без поля, как и сейчас.
- `ColorProp.getCSSVar`, `createColorTokens`, `createGradientTokens`, `createViewContainerTokens`, `import-plasma-component.ts` вызывают `colorVariableName`; `ColorProp` берёт суффиксы из `DERIVED_STATE_TOKEN_SUFFIX`.
- `component-source.ts`: `toApi` вызывает `basePropertyParams`, `deps` строятся из `composeOf` (те же `childId`, `childName`, `order`), `toComponentName` из модуля. `readComponentsMeta` принимает данные адаптера, а не путь: `components-input.ts` читает файл `--web` или берёт `webAdapter`.
- `generate-api-meta.ts` использует типы меты модуля.
- `formattedTokenName` (`props/typography.ts`), `createTypographyTokens.ts` и `import-plasma-component.ts` вызывают `typographyVariableBase`. Для генератора тем результат прежний; импортёр начинает писать `h3-bold` вместо `header-h3-bold` (решение 6).
- `getPlasmaTokensName`/`getPlasmaConfigName` из `generator/utils` становятся реэкспортами `coreTokensExportName`/`coreConfigExportName`; `ComponentManifest` генератора расширяет `CoreExportNames` модуля.

Существующие тесты и снимки генератора проходят без изменения ожидаемых результатов. `applyTemplate` совпадает с `replaceAdjustmentPlaceholders`, включая `$0`, `$01` и незаполненные номера.

### 3. Публикация: точка входа и подкоманда

`package.json` CLI:

```json
"exports": {
  "./web-mapping": "./src/web-mapping/index.ts",
  "./package.json": "./package.json"
}
```

Пакет уже публикует исходники (`files: ["bin", "src"]`), Vite, Vitest и `tsc -b` потребителя компилируют `.ts` из `node_modules` сами. Импорты внутри модуля пишутся с `.ts`, JSON — `with { type: 'json' }`; в `js/cli/tsconfig.json` включается `resolveJsonModule`. Модуль проверяется и обычным `typecheck` CLI, и `tsconfig.web-mapping.json` с флагами браузерного потребителя (`moduleResolution: bundler`, `lib: DOM`, `types: []` — чтобы глобальные `process` и `Buffer` не проходили проверку, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`), чтобы ошибка не всплыла после публикации. `bin` импортирует модули относительными путями, `exports` его не затрагивает.

Подкоманда `dsbuilder-web-generator manifests --out <файл>` пишет манифесты генератора одним JSON: `{ "<X>": <содержимое templates/<X>/component.json> }`. Это данные пакета, а не что-то для конкретного потребителя: генератор читает те же файлы по одному. Подкоманда нужна, потому что браузерный код не может прочитать каталог шаблонов. Плагин берёт манифест компонента как `manifests[name]`; соседи без конфига (`siblings` Drawer и Toolbar) в реестр плагина не входят, отдельный поиск по ним не нужен. `--out` обязателен.

Подкоманда `dsbuilder-web-generator api-meta --out <файл> [--package <имя>]` — это `generate:api-meta` в установленном пакете. `generate-api-meta.ts` экспортирует `main(argv)` вместо чтения `process.argv`, скрипт репозитория вызывает её с `process.argv.slice(2)`. Пакет ядра (по умолчанию `@salutejs/plasma-new-hope`) ищется от текущего каталога вверх по `node_modules`. `--out` для подкоманды обязателен: умолчание скрипта `<cliDirectory>/.sdds/web/web-api-meta.json` у установленного пакета указывало бы внутрь `node_modules`. Без `--out` подкоманда завершается ошибкой; `withWorkingDirectoryDefaults` для неё ничего не подставляет.

Тесты модуля лежат в `src/web-mapping/*.test.ts`. Скрипт `test` меняется на `tsx --test 'src/**/*.test.ts'`, иначе подкаталог не запускается. Тестам ядро не нужно.

### 4. Плагин зависит от опубликованного пакета точной версией

`preview-web-plugin/package.json` получает `"@sddsjs/design-system-builder-generator": "<версия>"` без диапазона. Порядок выпуска: функции в CLI → `version` CLI → ручная публикация → версия зависимости в плагине. До публикации плагин в этой ветке проверяется через `npm install ../../cli --no-save`.

Альтернатива — `file:../../cli`. Отклонена: переиспользование идёт через npm-пакет, и плагин собирается из выпущенной версии, а не из рабочего дерева CLI.

### 5. Что меняется в плагине

- Импортируются из `@sddsjs/design-system-builder-generator/web-mapping`: типы меты, `STATE_PARAM_SUFFIX`, `webAdapter`, `applyTemplate`, `composeOf`, `pxToRem`, `adjustedRadius`, `TYPOGRAPHY_PARTS`, `typographyPartFor`, `typographyVariableBase`, `colorVariableName`, `DERIVED_STATE_TOKEN_SUFFIX`, `coreTokensExportName`, `coreConfigExportName`. Собственные реализации и таблицы `coreTokensByComponent`/`coreConfigNameByComponent` удаляются: `getCoreTokens`/`getCoreConfig` берут имя объекта из функций модуля по манифестам и находят объект в экспорте ядра.
- Остаются свои: `indexMeta` (поверх типов модуля), `stateParamFor` (поверх `STATE_PARAM_SUFFIX`), `indexTemplates`/`templateFor` (поверх `webAdapter`), `resolvePayload`, `findPreconvertedCss`, `properties.ts`, разбор режима в `themeVariableName` (поверх `colorVariableName`), перевод токенов темы из payload в CSS, `typographyValues`, `warnings.ts`, `cssVariables.ts`, `payload.ts`, протокол и мост.
- `src/resolve/api-meta.ts` — единственное место, где импортируется сгенерированный `public/api-meta.json` (`apiMeta` по умолчанию для `resolvePayload`, `findPreconvertedCss` и тестов).
- Удаляются `src/data/web-adapter.json` и закоммиченный `public/api-meta.json`. Мету и манифесты строит скрипт `generate` (`dsbuilder-web-generator api-meta --out public/api-meta.json && dsbuilder-web-generator manifests --out src/generated/component-manifests.json`), на него ссылаются `predev`, `prebuild`, `pretest`, `pretest:watch`; оба файла добавляются в `.gitignore`. Создаётся `README.md` плагина: порядок выпуска CLI → плагин и ручной `npm run generate` для IDE и прямого `vitest` на чистом клоне.
- `apiMetaSha256` удаляется из `public/preview-plugin.json`: клиент `js/apps/client` его не читает, а `scripts/package.mjs` уже дописывает его в `dist` при упаковке. `plasmaNewHopeVersion` остаётся и сверяется тестом.

Альтернатива построению меты подкомандой — Vite-плагин в `buildStart`. Отклонена: конфиг Vite не импортирует TypeScript из `node_modules`, всё равно понадобился бы дочерний процесс.

### 6. Имена переменных типографики: правило генератора, исправление импортёра и сидов

Правильные имена — как у генератора тем: в `plasma-typo` и темах plasma объявлены `--plasma-typo-h3-bold-*` и `--plasma-typo-dspl-l-*`, а в исходниках plasma (все пакеты, клон от 2026-11-16) нет ни одной переменной `--plasma-typo-header-h*`. Конфиг Calendar в sdds-serv ссылается на токен `${h3Bold.fontWeight}`, в примере ядра — на `var(--plasma-typo-h3-bold-font-weight)`.

`--plasma-typo-header-h*` появились из-за ошибки импортёра `import:plasma`. Он переводит `${h3Bold.fontWeight}` своим правилом (`import-plasma-component.ts:421-426`, «как TypographyProp», но без пропуска `header`) и получает `var(--plasma-typo-header-h3-bold-font-weight)`. Так же `${dsplLBold.fontWeight}` превращается в `display-l-bold`: `typoValue` (`import-plasma-component.ts:460`) правильно находит токен `display.l.bold`, но имя переменной склеивается без замены `display` → `dspl`. Отсюда ссылки в `component-seeds.json`: `header-hN` у Heading, Calendar, CalendarDouble, DatePicker, DateTimePicker и `display-*` у Dspl. В пакете, собранном генератором, они не разрешаются: тема объявляет `h3-bold` и `dspl-l-bold`. В превью они разрешаются только потому, что плагин ошибается так же. А правильные ссылки CodeInput на `dspl-*` в превью сейчас не работают: плагин объявляет `display-*`.

Исправление:
- плагин, генератор и импортёр берут одно правило `typographyVariableBase`;
- в `component-seeds.json` значения `var(--plasma-typo-header-hN-…)` заменяются на `var(--plasma-typo-hN-…)`, а `var(--plasma-typo-display-…)` — на `var(--plasma-typo-dspl-…)`; sha256 сидов в `ComponentSeedsResourceTest` обновляется;
- фикстура клиента `js/apps/client/src/composePreview/__fixtures__/webBase.snapshot.json` (снимок базовой ДС для тестов сборки payload) содержит те же значения и обновляется той же заменой, чтобы снимок соответствовал сидам.

Тогда одни и те же ссылки работают и в превью, и в собранном пакете.

### 7. Объекты ядра компонента — по манифестам генератора

Плагин находит объект токенов и базовый конфиг ядра компонента теми же функциями, что генератор (`coreTokensExportName`, `coreConfigExportName`), по манифестам из подкоманды `manifests`. Ручные таблицы плагина исчезают. Компоненты, которые в таблицах плагина отсутствовали (`CalendarDouble`, соседи Drawer и Toolbar), получают имена из манифестов; сейчас они совпадают с именами по умолчанию, поэтому превью не меняется.

### 8. Существующие значения — Flyway-миграция V23 во всех редакциях

Сиды пишутся только в новую ДС и при добавлении компонента из шаблона, поэтому уже созданные ДС исправляет миграция `V23__fix_typography_variable_names.sql` в `ds-service`.

Значения свойств после V7 лежат только в редакциях: `invariant_property_value_revisions`, `variation_property_value_revisions`, `style_combination_revisions`, `*_platform_param_adjustment_revisions` (колонка `value`). Черновик и опубликованные версии читают одни и те же строки (последняя редакция не позже границы), поэтому отдельно «только черновики» исправить нельзя: правка на месте исправляет все границы.

Миграция повторяет приём V15: на время UPDATE отключает только триггер `<таблица>_touch_draft` (единственный, который реагирует на UPDATE: он запрещает менять редакции), меняет значения регулярными выражениями и включает триггер обратно. Замены: `--plasma-typo-header-(h[1-6])-` → `--plasma-typo-\1-`, `--plasma-typo-display-` (кроме `display-font-family`) → `--plasma-typo-dspl-`. Переменные семейства группы (`--plasma-typo-header-font-family`, `--plasma-typo-display-font-family`) правильные и не трогаются. Прежние значения сохраняются в `v23_typography_backup`.

Побочных эффектов нет: ревизия черновика не растёт, записи журнала не появляются (журнал вычисляется сравнением границ, а значение меняется на обеих сторонах одинаково), состояния правки не меняются. Если пользователь уже вручную исправил значение в черновике, его черновая редакция станет равна предыдущей и пропадёт из журнала; лишняя строка редакции безвредна.

Альтернатива — новые черновые редакции стартовой задачей (как V21). Отклонена: даёт записи журнала от `system` и не исправляет опубликованные версии.

## Risks / Trade-offs

- [Правка общих функций требует публикации CLI до сборки плагина] → шаг в tasks и README плагина; локальная проверка через `npm install ../../cli --no-save`.
- [Перевод генератора на общие функции незаметно меняет сгенерированный код] → снимки и тесты генератора без изменений ожидаемых результатов.
- [Строгие флаги потребителя ломают проверку исходника CLI] → `tsconfig.web-mapping.json` входит в `npm run typecheck` CLI, а значит и в `prepublishOnly`.
- [Runtime-зависимости генератора (`typescript`, `tsx`, `react` 18.2.0) ставятся в плагин] → в бандл попадает только `web-mapping` без импортов; проверка — размер `dist` до и после.
- [В базе стендов и в ДС пользователей, созданных из базовой, уже лежат значения `var(--plasma-typo-header-hN-…)` и `var(--plasma-typo-display-…)`] → после изменения они перестанут разрешаться в превью (в пакете они не работают уже сейчас). Их исправляет миграция V23 (решение 8).
- [Сгенерированный импортёром код меняется для новых импортов] → это и есть исправление; повторный `import:plasma` для шести компонентов не нужен, сиды правятся заменой строки.

## Open Questions

Нет. Существующие данные исправляет Flyway-миграция (решение 8).
