# Tasks

Реализация выполнена на ветке `PLASMABLDR-1` до оформления изменения; отмечено сделанное,
проверки остаются открытыми до прогона.

## 1. Формат сидов db-service

- [x] 1.1 Типы `ComponentSeed`, `PropertySeed`, `VariationSeed`, `AppearanceSeed`, `ValueSeed`, `CombinationSeed` и сидер `seedComponents` в `seeds/prod/component-seed.ts`; папки находятся сканированием `loadComponentSeeds()`; ссылки по именам разрешаются в id с ошибкой на неизвестное имя.
- [x] 1.2 Writer `seeds/prod/component-seed-writer.ts` пишет папку `<имя>/index.ts`, `properties.ts`, `variations.ts`, `values[.<appearance>].ts`.
- [x] 1.3 `seed-prod.ts` переведён на папки: `--component=<X>` чистит и пересевает один компонент базовой ДС, неизвестное имя завершает сид ошибкой со списком; удалены сиды по таблицам и `seeds/prod/components/<имя>.ts`.
- [x] 1.4 `seed-generate-prod.ts` выгружает компонент из базы через тот же writer (`--component`, `--ds`).
- [x] 1.5 `seeds/prod/component_deps.ts`: связи по именам, пропуск пар с отсутствующим компонентом, `onConflictDoNothing`.
- [x] 1.6 Сочетания стилей `combinations` сидятся в `style_combinations` по именам без дубликатов.
- [x] 1.7 Legacy-роут `component-configs` берёт состав, порядок и дефолты вариаций из `appearance_variations`; appearance без объявлений получает все вариации.
- [x] 1.8 Терминология: «ось» заменена на «вариация» в `seeds/appearance_variations.ts`.
- [x] 1.9 Проверка: `docker exec db-service-dev sh -c "cd /home/node/app && npx tsc --noEmit -p ."` без ошибок.
- [x] 1.10 Проверка кругового прогона: `db:seed-generate:prod` из локальной базы против `seeds/prod/components/` — 63 папки, по содержимому строк расхождений нет; в 23 файлах отличается только порядок стилей и свойств (см. 1.11).
- [ ] 1.11 Выгрузка пишет стили вариации и свойства в порядке базы, а не в порядке сида (`button/values.ts`: `s` после `m`; `select/properties.ts`): сделать порядок выгрузки детерминированным по позиции стиля и порядку объявления свойства, чтобы `diff` кругового прогона был пуст.

## 2. Инструмент импорта из plasma

- [x] 2.1 `src/db/import-plasma-component.ts` и скрипт `component:import`: чтение `<X>.tokens.ts` и `<X>.config.ts`, сухой прогон по умолчанию, `--apply`, `--remove`, `--alias`, `--default`, `--skip-style`, `--manifest`, `--plasma`.
- [x] 2.2 Правила приведения: web-параметр = ключ токена ядра, шрифтовые группы в `typography`, радиус через `round.*` с порогом «капсулы», шаблон многозначного значения, `value` для строк и смешанных значений, `disabled`/`readOnly` в инварианты, флаг одним стилем `true`, дефолты из темы затем из ядра, deprecated-стили пропускаются, `intersections` в «пропущено».
- [x] 2.3 Составные компоненты через `--dir`, `--tokens`, `--root`, `--dir-name`, `--config`: подпапки как appearance, объединение свойств, родитель и дочерние `compose`, `appearances` в манифест.
- [x] 2.4 Манифест генератора пишется инструментом: `coreTokensExport`, `coreConfigExport`, `castToProps`, `reexports`, `generic`, `siblings`.
- [x] 2.5 Импортированы папки сидов для 60 компонентов первой партии (`accordion` … `tooltip`) и связи в `component_deps.ts`.
- [x] 2.6 Проверка: `npm run component:import -- --component=TextArea` на актуальном клоне plasma печатает отчёт и не меняет файлы (`git status` чистый).

## 3. Генератор

- [x] 3.1 Тип `ComponentManifest` в `app/types`, чтение `app/templates/<X>/component.json`, шаблоны копируются в `dist` (`package.json build`), исключены из `tsc` (`tsconfig exclude`).
- [x] 3.2 `Prop.createWebToken` и состояния отдают значения по ключу токена ядра; `ValueProp`; удалены `componentBuilder/utils.ts` и `PLASMA_CONFIG_NAME_OVERRIDES`.
- [x] 3.3 `Config(meta, configID?)` выбирает appearance, пустой конфиг даёт вариации без стилей, `removeDefault`, `setDefault` создаёт дефолт; `Meta` расширен `deps` и `combinations`.
- [x] 3.4 Стратегии обёрток в `generate.ts`: multi-appearance (`createCompositeComponent.ts`: обёртка по пропу, конфиги в подпапках, ref), пустой компонент, шаблонная обёртка, дженерик, обычная с `castToProps` и `localTypes`; `siblings` как пустые обёртки.
- [x] 3.5 `compose`-дети в папке родителя, `createCompositeIndex`, корневой `index.ts` только с родителями; реэкспорты из манифеста в `createComponentIndex`.
- [x] 3.6 Манифесты и шаблоны для первой партии (`Tabs/TabsController.tsx`, `Steps/Steps.tsx`, `Text/TextSizes.tsx` и др.).
- [x] 3.7 Ошибка сборки пакета (`pacote.tarball`) выводится в лог со stderr.
- [x] 3.8 Проверка: `cd js/services/generator && npm run build` без ошибок и `dist/templates` на месте.
- [x] 3.9 Проверка: `POST http://localhost:3005/generate-download` для `base` (`tgz`) отдаёт архив, в нём `styled-components/es/Tabs/horizontal/HorizontalTabs.config.js`, `Select/Select.js`, `Image/Image.js`; в логе генератора нет `SyntaxError` и `Package build failed`.

## 4. Клиент

- [x] 4.1 `controllers/componentBuilder` синхронизирован с генератором: `Prop` по ключу токена, `ValueProp`, `Config(meta, configID?)`, `removeDefault`, `Variation.isFlag()`.
- [x] 4.2 Контроллер `controllers/componentPreview`: `getCSSVariableName` через объект токенов ядра и карту `coreTokensByComponent`, `toCSSVariables`, `getCoreConfig`, `createThemeConfig`.
- [x] 4.3 `ComponentEditor.utils.ts`: `createRelatedComponentVars` для `compose` с синхронизацией одноимённых вариаций, `createRelatedComponents` с `<Имя>` и `<Имя>Config` для всех связей; стори получает `relatedComponents`.
- [x] 4.4 Флаг переключателем в панели, меню стиля `getStyleMenuList(isDefault)` с «Снять по умолчанию»; дефолты конфига побеждают одноимённые аргументы стори; `StyledStoryScope` с основным шрифтом ДС.
- [x] 4.5 Удалён `utils/importComponentConfig.ts`; в `menuItems.ts` включены компоненты первой партии, `Typography` разбита на `Body`, `Dspl`, `Heading`, `Text`, `Segment` на `SegmentGroup`, `SegmentItem`.
- [x] 4.6 Стори для каждого включённого компонента в `stories/*.story.tsx`, регистрация в `stories/index.ts` и `hooks/useStory.ts`, фикстуры `stories/fixtures/regions.ts`.
- [x] 4.7 Проверка: `cd js/apps/client && npx tsc -b` и `npm run build` без ошибок.
- [x] 4.8 Проверка: `diff -r` между `js/services/generator/app/componentBuilder` и `js/apps/client/src/controllers/componentBuilder` пуст.
- [ ] 4.9 Проверка вручную: на странице Toolbar кнопка с `view="clear"` прозрачная; на странице Tabs при `size=l` элементы TabItem увеличиваются; флаг `pilled` переключается и снимается с дефолта.

## 5. Документация и процесс

- [x] 5.1 `js/docs/component-creation.md`: раздел «Импорт из plasma (быстрый путь)».
- [x] 5.2 Скилл `.claude/skills/add-component/SKILL.md`: сценарий, правила модели, прецеденты первой партии; пути и утверждения сверены с кодом.
- [x] 5.3 OpenSpec: proposal, design, спеки `component-seed-format`, `plasma-component-import`, `generator-component-manifest`, `component-preview-composition`, дельта `component-appearance-model`.
- [x] 5.4 Проверка: `npx -y @fission-ai/openspec@latest validate refactor-component-seeds-and-generator-manifest --strict` без ошибок.
- [x] 5.5 Проверка сборок затронутых пакетов: `generator`, `db-service`, `apps/client`, `apps/admin` собираются без ошибок (корневой `npm run build` на хосте не запускается: в `js/` нет `node_modules` с `concurrently`, у `documentation-generator` нет `nest`; оба пакета изменением не затронуты).
