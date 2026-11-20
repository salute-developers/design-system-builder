## 1. Схема и домен ds-service

- [ ] 1.1 Добавить миграцию `V21__property_state_support.sql` (перед реализацией перенумеровать на следующий свободный номер с учётом `dev` и открытого PR #167, который после перенумерации своих `V19`/`V20` займёт `V21`–`V22`): nullable-столбец `properties.state_combinations` и таблица `property_supported_states (property_id, state_id)` с внешними ключами и индексом по `state_id`, без заполнения
- [ ] 1.2 Добавить доменный `PropertyStateSupport` и правило `StateSetRule` (`Allowed`, `ForeignState`, `NotSupported`) со сравнением по каноническим именам и модульными тестами: пустой набор, незаданный признак, состояние не из списка, сочетание при `combinations = false`, состояние чужого компонента, значение в «тени» общего состояния
- [ ] 1.3 Добавить `state_combinations` в `PropertiesTable`, таблицу `PropertySupportedStatesTable` и `stateSupport` в `ComponentPropertySummary`; заполнять его в `ExposedComponentRepository` и `ExposedComponentModelRepository` одним запросом на компонент

## 2. Импорт API-меты в ds-service

- [ ] 2.1 Принять `stateSupport` (`states`, `combinations`) в `ImportApiMetaRequest.Property`, отклонять некорректную форму в `valid()`, передавать его в `ImportApiMeta.Property`
- [ ] 2.1a Принять `interactionStates` верхнего уровня манифеста и заводить в общем словаре отсутствующие имена (учитывать в `createdStates`, в dry run — без записи); собственные состояния компонентов заводить как раньше
- [ ] 2.2 В `ExposedApiMetaRepository` разрешать имена по общему правилу (сначала общее, затем собственное состояние компонента) после создания общих и собственных состояний манифеста; записывать признак у новых свойств и обновлять у существующих при отличии флага или множества идентификаторов (в том числе при расхождении типа); считать `stateSupportChanged` и собирать `unresolvedStates`
- [ ] 2.3 Добавить `stateSupportChanged` и `unresolvedStates` в `ApiMetaImportReport` и `ImportApiMetaResponse`
- [ ] 2.4 Дополнить `ApiMetaImportHttpPostgresIntegrationTest`: создание общего состояния из `interactionStates`, отсутствие поля, порядок импорта двух платформ с общим и собственным `checked` (одинаковый состав), создание с признаком, изменение списка и флага, отсутствие поля, некорректная форма, неразрешимое имя, одинаковое имя состояния у двух компонентов, повторный импорт и dry run

## 3. Чтение и запись редактора в ds-service

- [ ] 3.0 Вынести правило разрешения имени (сначала общее, затем собственное состояние компонента, без чужих компонентов) в одну функцию и применить в `EditorSupport.stateIds` и `ComponentConfigImporter.stateSet`; тесты на «тень» `disabled` у `TextField` и на собственное состояние другого компонента

- [ ] 3.1 Отдавать `stateSupport` (`stateIds`, `combinations` или `null`) в `ComponentPropertySummaryResponse` и обновить `ComponentReadEnrichmentResponseTest`
- [ ] 3.2 Добавить `states` (`id`, `name`, `componentId`: общие и собственные состояния компонента без «теней») в `ComponentEditorBundle` и `ComponentEditorBundleResponse`; обновить `ComponentEditorBundleUseCaseTest` и `ComponentEditorBundleHttpPostgresIntegrationTest`
- [ ] 3.3 Добавить `PropertyStateSetGuard` и вызывать его в транзакции записи: создание и правка invariant- и variation-значений (`PATCH` проверяет набор изменяемой строки по текущему признаку) и `AppearanceEditorValueOperations`; коды `422 states_not_supported` и `422 state_not_in_component`; удаление, переупорядочивание и копирование при дублировании не проверять
- [ ] 3.4 Интеграционные тесты на PostgreSQL для каждого маршрута записи (`POST` и `PATCH` обоих видов значений, `PUT property-values`): состояние не из списка, сочетание при запрете сочетаний, состояние чужого компонента при заданном и незаданном признаке, допустимый набор, удаление прежнего значения; сценарий «признак изменён импортом после чтения бандла»
- [ ] 3.5 Обновить `openapi/documentation.yaml` (поле манифеста, `stateSupportChanged` и `unresolvedStates`, `stateSupport`, `states` бандла, обе ошибки на всех маршрутах записи) и проверить `OpenApiDocumentResourceTest`

## 4. Нормализаторы и CLI во frontend-kt

- [ ] 4.1 Добавить `ApiMetaStateSupport` (`states`, `combinations`) и nullable-поле `stateSupport` в `ApiMetaProperty` (`null` — признак не выведен, поле не уходит в манифест); читать `stateSupport` меты (`interactionStates`, `combinations`): у View — в корне, у Compose, SwiftUI и web — у записей компонентов; разные значения у записей — `Invalid`
- [ ] 4.2 Compose: `StatefulValue` → `interactionStates` и `stateEnum`, `InteractiveColor` → `interactionStates`; тесты на корпусе с полем: `DropZone.paddingStart`, `Slider.thumbColor` без `disabled` и `readonly`, `Slider.orientation` с пустым списком
- [ ] 4.3 View: для `color`, `dimension`, `float`, `typography` — `interactionStates`, `configName` из `stateSets` и состояния из `stateValues`; иные типы — пустой список; дополнить корпус полем, фрагментом `BasicButton.backgroundColor` с пустым `stateValues` и параметром с `stateValues`, тесты
- [ ] 4.4 SwiftUI: `Stateful*` → `interactionStates` и `stateEnum`, только поле `state` → эти состояния без сочетаний; тест на `CheckBox.toggleIconColor`. Web: состояния токенов, `combinations` из меты; тест на `Button.backgroundColor` (`pressed`, `hovered`)
- [ ] 4.5 Тесты всех нормализаторов на мете без поля (признак не уходит) и на прежних корпусах (результат прежний, кроме признака)
- [ ] 4.6 Передавать `interactionStates` меты верхним полем манифеста и `stateSupport` свойств в общем `toImportRequest` (им пользуются `HttpApiMetaRemoteSource` и `HttpPreviewPluginRemoteSource`) с тестами обоих источников, в том числе что `null` не отправляется; читать `stateSupportChanged` (по умолчанию `0`) и `unresolvedStates` (по умолчанию пусто) в `ApiMetaImportReport` и печатать их в отчёте `:cli`; обновить `ComponentsImportApiCliCommandTest`
- [ ] 4.7 Описать поле меты, правило по слотам и вывод признака в `frontend-kt/feature-components/API_META_NORMALIZERS.md` и `frontend-kt/cli/USAGE.md`

## 4a. Генераторы меты

- [ ] 4a.1 `js/cli/src/generate-api-meta.ts`: отдавать `stateSupport` (`interactionStates` — общие состояния, которые выражает превью web, `combinations: false`) у каждой записи компонента; тест; перегенерировать `js/cli/.sdds/web/web-api-meta.json`; поднять версию `js/cli` (`npm version patch --no-git-tag-version`)
- [ ] 4a.2 [внешняя проверка] plasma-android: `UikitComposeApiMetaTask` отдаёт `stateSupport` у записей компонентов из `InteractiveState` генератора Compose, `UikitApiMetaTask` — в корне из `AndroidState`; тест, что каждое имя переводится генератором в код; PR в plasma-android
- [ ] 4a.3 [внешняя проверка] plasma-ios: генератор `ios-api-meta.json` отдаёт `stateSupport` у записей компонентов из `InteractiveState` `SDDSThemeCore`; тест; PR в plasma-ios

## 5. Билдер в js/apps/client

- [ ] 5.1 Добавить `stateSupport` в `ComponentPropertyDto`, `states` в `ComponentEditorBundleDto`, `stateSupport` в `ComponentAPI` и пробросить их через `componentRepository`
- [ ] 5.2 В `componentRepository` разрешать имя состояния по `states` бандла (`resolveStateId`: сначала общее, затем компонента), искать готовый набор по множеству идентификаторов и создавать новый из них; тесты на собственный `checked` у трёх компонентов и на общий `checked`
- [ ] 5.3 Расширить `PropState` до имени состояния и добавить `bindableStates` (ровно состояния признака; запасное правило для `null`) с модульными тестами
- [ ] 5.4 Перевести `StateBindingMenu` на список состояний из пропсов с порядком `focused`, `pressed`, `hovered`, затем остальные; при `combinations = false` — выбор одного состояния
- [ ] 5.5 В `InspectorPropertyRow` вынести выбор контрола по типу и показывать кнопку и строки состояний у свойства любого типа по признаку; строки записанных недопустимых состояний показывать только для чтения с удалением; отказ автосохранения `422` возвращает прежнее значение с сообщением
- [ ] 5.6 Дополнить `InspectorControls.test.tsx` и тесты инспектора: числовое свойство со списком, web-свойство без сочетаний, пустой список без кнопки и с строкой только для чтения, запасное правило для `null`

## 6. Локальные автоматические проверки

- [ ] 6.1 `tools/verify fast --change add-property-state-support` проходит до ревью; после ревью — `tools/verify full --change add-property-state-support` (интеграционные тесты ds-service на PostgreSQL обязательны, отсутствие Docker — провал)
- [ ] 6.2 Тесты клиента `cd js/apps/client && npm test` и сборка `cd js && npm run build`

## 7. Локальный контур: обновление с состояния dev

- [ ] 7.1 [внешняя проверка] Поднять контур на `origin/dev` (`./setup-local.sh --reset` с `--components-package`), добавить в редакторе состояния цветовым свойствам и сохранить снимок: export конфигураций всех компонентов `compose` и `web`, `editor-bundle` трёх компонентов, сгенерированный web-пакет
- [ ] 7.2 [внешняя проверка] Пересобрать контур на ветке без `--reset`: миграция применена, `/health` готов с `flyway: true`, у всех свойств `state_combinations IS NULL`, `property_supported_states` пуста
- [ ] 7.3 [внешняя проверка] До переимпорта export и генерация побайтно совпадают со снимком 7.1, а `npm run test:e2e` проходит на контуре
- [ ] 7.4 [внешняя проверка] Сначала импортировать прежнюю мету Compose и web (без поля): `stateSupportChanged = 0`. Затем собрать мету Compose генератором из ветки plasma-android (4a.2) и web из `js/cli` ветки и переопубликовать плагины через `publish-preview-plugin.sh` с JVM CLI ветки: `stateSupportChanged > 0`; созданные общие состояния записаны; каждое имя `unresolvedStates` объяснено; подсчитаны «тени» и значения в них; выборочные списки верны (`DropZone.paddingStart` содержит `dragging-over`, `Slider.thumbColor` без `disabled`, web `Button.backgroundColor` — `pressed`, `hovered` без сочетаний); по платформам записано, сколько записанных значений в состояниях стали недопустимыми (свойство с пустым списком, состояние не из списка, сочетание при запрете) и у скольких свойств; повторная публикация даёт `stateSupportChanged = 0`
- [ ] 7.5 [внешняя проверка] Выполнить `dsbuilder components import-api` для web файлом `js/cli/.sdds/web/web-api-meta.json` и убедиться, что отчёт совпадает с публикацией плагина web (`stateSupportChanged = 0`)
- [ ] 7.6 [внешняя проверка] После переимпорта export и генерация побайтно совпадают со снимком 7.1
- [ ] 7.7 [внешняя проверка] Во встроенном браузере: состояние `dragging-over` числовому свойству `DropZone` сохраняется после перезагрузки и видно в превью Compose; меню web `Button.backgroundColor` предлагает только `pressed` и `hovered` и не даёт выбрать оба; у свойства с пустым списком нет кнопки, а прежняя строка состояния только для чтения и удаляется; `disabled` в `TextField` записывается с общим идентификатором, прежнее значение в «тени» редактируется
- [ ] 7.8 [внешняя проверка] Через API недопустимый набор даёт `422 states_not_supported` на `POST` и `PATCH` значений и на `PUT property-values`, набор с состоянием чужого компонента — `422 state_not_in_component`; устаревшая вкладка после переимпорта с убранным состоянием получает `422` при автосохранении и возвращает прежнее значение

## 8. Совместимость и откат на контуре

- [ ] 8.1 [внешняя проверка] Прежний `dsbuilder` из `PATH` выполняет `import-api` с новым backend без ошибок и не меняет признаки (`stateSupportChanged = 0`)
- [ ] 8.2 [внешняя проверка] Новый CLI выполняет `import-api --dry-run` с backend `origin/dev` без ошибок
- [ ] 8.3 [внешняя проверка] Клиент `origin/dev` с новым backend и новый клиент с backend `origin/dev` открывают редактор компонента и добавляют состояние цвету
- [ ] 8.4 [внешняя проверка] ds-service из `origin/dev` стартует на базе с применённой миграцией (`/health` готов, `flyway: true`), редактор работает; затем ds-service ветки снова стартует на той же базе
