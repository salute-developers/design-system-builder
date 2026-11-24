## 1. Схема и домен ds-service

- [x] 1.1 Добавить миграцию `V23__property_state_support.sql` (`V21` и `V22` занял `dev`): nullable-столбец `properties.state_combinations` и таблица `property_supported_states (property_id, state_id)` с внешними ключами и индексом по `state_id`, без заполнения
- [x] 1.2 Добавить доменный `PropertyStateSupport` и правило `StateSetRule` (`Allowed`, `ForeignState`, `NotSupported`) со сравнением по каноническим именам и модульными тестами: пустой набор, незаданный признак, состояние не из списка, сочетание при `combinations = false`, состояние чужого компонента, значение в «тени» общего состояния
- [x] 1.3 Добавить `state_combinations` в `PropertiesTable`, таблицу `PropertySupportedStatesTable` и `stateSupport` в `ComponentPropertySummary`; заполнять его в `ExposedComponentRepository` и `ExposedComponentModelRepository` одним запросом на компонент

## 2. Импорт API-меты в ds-service

- [x] 2.1 Принять `stateSupport` (`states`, `combinations`) в `ImportApiMetaRequest.Property`, отклонять некорректную форму в `valid()`, передавать его в `ImportApiMeta.Property`
- [x] 2.1a Принять `interactionStates` верхнего уровня манифеста и заводить в общем словаре отсутствующие имена (учитывать в `createdStates`, в dry run — без записи); собственные состояния компонентов заводить как раньше
- [x] 2.2 В `ExposedApiMetaRepository` разрешать имена по общему правилу (сначала общее, затем собственное состояние компонента) после создания общих и собственных состояний манифеста; записывать признак у новых свойств и обновлять у существующих при отличии флага или множества идентификаторов (в том числе при расхождении типа); считать `stateSupportChanged` и собирать `unresolvedStates`
- [x] 2.3 Добавить `stateSupportChanged` и `unresolvedStates` в `ApiMetaImportReport` и `ImportApiMetaResponse`
- [x] 2.4 Дополнить `ApiMetaImportHttpPostgresIntegrationTest`: создание общего состояния из `interactionStates`, отсутствие поля, порядок импорта двух платформ с общим и собственным `checked` (одинаковый состав), создание с признаком, изменение списка и флага, отсутствие поля, некорректная форма, неразрешимое имя, одинаковое имя состояния у двух компонентов, повторный импорт и dry run

## 3. Чтение и запись редактора в ds-service

- [x] 3.0 Вынести правило разрешения имени (сначала общее, затем собственное состояние компонента, без чужих компонентов) в одну функцию и применить в `EditorSupport.stateIds` и `ComponentConfigImporter.stateSet`; тесты на «тень» `disabled` у `TextField` и на собственное состояние другого компонента

- [x] 3.1 Отдавать `stateSupport` (`stateIds`, `combinations` или `null`) в `ComponentPropertySummaryResponse` и обновить `ComponentReadEnrichmentResponseTest`
- [x] 3.2 Добавить `states` (`id`, `name`, `componentId`: общие и собственные состояния компонента без «теней») в `ComponentEditorBundle` и `ComponentEditorBundleResponse`; обновить `ComponentEditorBundleUseCaseTest` и `ComponentEditorBundleHttpPostgresIntegrationTest`
- [x] 3.3 Добавить `PropertyStateSetGuard` и вызывать его в транзакции записи: создание и правка invariant- и variation-значений (`PATCH` проверяет набор изменяемой строки по текущему признаку) и `AppearanceEditorValueOperations`; коды `422 states_not_supported` и `422 state_not_in_component`; удаление, переупорядочивание и копирование при дублировании не проверять
- [x] 3.4 Интеграционные тесты на PostgreSQL для каждого маршрута записи (`POST` и `PATCH` обоих видов значений, `PUT property-values`): состояние не из списка, сочетание при запрете сочетаний, состояние чужого компонента при заданном и незаданном признаке, допустимый набор, удаление прежнего значения; сценарий «признак изменён импортом после чтения бандла»
- [x] 3.5 Обновить `openapi/documentation.yaml` (поле манифеста, `stateSupportChanged` и `unresolvedStates`, `stateSupport`, `states` бандла, обе ошибки на всех маршрутах записи) и проверить `OpenApiDocumentResourceTest`

## 4. Нормализаторы и CLI во frontend-kt

- [x] 4.1 Добавить `ApiMetaStateSupport` (`states`, `combinations`) и nullable-поле `stateSupport` в `ApiMetaProperty` (`null` — признак не выведен, поле не уходит в манифест); читать `stateSupport` меты (`interactionStates`, `combinations`): у View — в корне, у Compose и SwiftUI — у записей компонентов; разные значения у записей — `Invalid`
- [x] 4.2 Compose: `StatefulValue` → `interactionStates` и `stateEnum`, `InteractiveColor` → `interactionStates`; тесты на корпусе с полем: `DropZone.paddingStart`, `Slider.thumbColor` без `disabled` и `readonly`, `Slider.orientation` с пустым списком
- [x] 4.3 View: для `color`, `dimension`, `float`, `typography` — `interactionStates`, `configName` из `stateSets` и состояния из `stateValues`; иные типы — пустой список; дополнить корпус полем, фрагментом `BasicButton.backgroundColor` с пустым `stateValues` и параметром с `stateValues`, тесты
- [x] 4.4 SwiftUI: `Stateful*` → `interactionStates` и `stateEnum`, только поле `state` → эти состояния без сочетаний; тест на `CheckBox.toggleIconColor`. Web: состояния токенов, `combinations: false` по формату меты, признак задаётся при любой версии меты, `interactionStates` в манифест не передаётся; тест на `Button.backgroundColor` (`pressed`, `hovered`) на текущем корпусе
- [x] 4.5 Тесты нормализаторов Compose, View и SwiftUI на мете без поля (признак не уходит) и на прежних корпусах (результат прежний, кроме признака)
- [x] 4.6 Передавать `interactionStates` меты верхним полем манифеста и `stateSupport` свойств в общем `toImportRequest` (им пользуются `HttpApiMetaRemoteSource` и `HttpPreviewPluginRemoteSource`) с тестами обоих источников, в том числе что `null` не отправляется; читать `stateSupportChanged` (по умолчанию `0`) и `unresolvedStates` (по умолчанию пусто) в `ApiMetaImportReport` и печатать их в отчёте `:cli`; обновить `ComponentsImportApiCliCommandTest`
- [x] 4.7 Описать поле меты, правило по слотам и вывод признака в `frontend-kt/feature-components/API_META_NORMALIZERS.md` и `frontend-kt/cli/USAGE.md`

## 4a. Генераторы меты

- [x] 4a.1 [внешняя проверка] plasma-android: `UikitComposeApiMetaTask` отдаёт `stateSupport` у записей компонентов из `InteractiveState` генератора Compose, `UikitApiMetaTask` — в корне из `AndroidState`; тест, что каждое имя переводится генератором в код; PR в plasma-android
- [x] 4a.2 [внешняя проверка] plasma-ios: генератор `ios-api-meta.json` отдаёт `stateSupport` у записей компонентов из `InteractiveState` `SDDSThemeCore`; тест; PR в plasma-ios

## 5. Билдер в js/apps/client

- [x] 5.1 Добавить `stateSupport` в `ComponentPropertyDto`, `states` в `ComponentEditorBundleDto`, `stateSupport` в `ComponentAPI` и пробросить их через `componentRepository`
- [x] 5.2 В `componentRepository` разрешать имя состояния по `states` бандла (`resolveStateId`: сначала общее, затем компонента), искать готовый набор по множеству идентификаторов и создавать новый из них; тесты на собственный `checked` у трёх компонентов и на общий `checked`
- [x] 5.3 Расширить `PropState` до имени состояния и добавить `bindableStates` (ровно состояния признака; запасное правило для `null`) с модульными тестами
- [x] 5.4 Перевести `StateBindingMenu` на список состояний из пропсов с порядком `focused`, `pressed`, `hovered`, затем остальные; при `combinations = false` — выбор одного состояния
- [x] 5.5 В `InspectorPropertyRow` вынести выбор контрола по типу и показывать кнопку и строки состояний у свойства любого типа по признаку; строки записанных недопустимых состояний показывать только для чтения с удалением; отказ автосохранения `422` возвращает прежнее значение с сообщением
- [x] 5.6 Дополнить `InspectorControls.test.tsx` и тесты инспектора: числовое свойство со списком, web-свойство без сочетаний, пустой список без кнопки и с строкой только для чтения, запасное правило для `null`

## 6. Локальные автоматические проверки

- [x] 6.1 `tools/verify fast --change add-property-state-support` проходит до ревью; после ревью — `tools/verify full --change add-property-state-support` (интеграционные тесты ds-service на PostgreSQL обязательны, отсутствие Docker — провал)
- [x] 6.2 Тесты клиента `cd js/apps/client && npm test` и сборка `cd js && npm run build`

## 7. Локальный контур: обновление с состояния dev

- [x] 7.1 [внешняя проверка] Поднять контур на `origin/dev` (`./setup-local.sh --reset` с `--components-package`), добавить в редакторе состояния цветовым свойствам и сохранить снимок: export конфигураций всех компонентов `compose` и `web`, `editor-bundle` трёх компонентов, сгенерированный web-пакет
- [x] 7.2 [внешняя проверка] Пересобрать контур на ветке без `--reset`: миграция применена, `/health` готов с `flyway: true`, у всех свойств `state_combinations IS NULL`, `property_supported_states` пуста
- [x] 7.3 [внешняя проверка] До переимпорта export и генерация побайтно совпадают со снимком 7.1, а `npm run test:e2e` проходит на контуре
- [x] 7.4 [внешняя проверка] Сначала опубликовать плагин Compose с прежней метой (без поля): `stateSupportChanged = 0`. Затем собрать мету Compose генератором из ветки plasma-android (4a.1) и переопубликовать плагины через `publish-preview-plugin.sh` с JVM CLI ветки: `stateSupportChanged > 0`; созданные общие состояния записаны; каждое имя `unresolvedStates` объяснено; подсчитаны «тени» и значения в них; выборочные списки верны (`DropZone.paddingStart` содержит `dragging-over`, `Slider.thumbColor` без `disabled`, web `Button.backgroundColor` — `pressed`, `hovered` без сочетаний); по платформам записано, сколько записанных значений в состояниях стали недопустимыми (свойство с пустым списком, состояние не из списка, сочетание при запрете) и у скольких свойств; повторная публикация даёт `stateSupportChanged = 0`
- [x] 7.5 [внешняя проверка] Выполнить `dsbuilder components import-api` для web файлом `js/cli/.sdds/web/web-api-meta.json` и убедиться, что отчёт совпадает с публикацией плагина web (`stateSupportChanged = 0`)
- [x] 7.6 [внешняя проверка] После переимпорта export и генерация побайтно совпадают со снимком 7.1
- [x] 7.7 [внешняя проверка] Во встроенном браузере: состояние `dragging-over` числовому свойству `DropZone` сохраняется после перезагрузки и видно в превью Compose; меню web `Button.backgroundColor` предлагает только `pressed` и `hovered` и не даёт выбрать оба; у свойства с пустым списком нет кнопки, а прежняя строка состояния только для чтения и удаляется; `disabled` в `TextField` записывается с общим идентификатором, прежнее значение в «тени» редактируется
- [x] 7.8 [внешняя проверка] Через API недопустимый набор даёт `422 states_not_supported` на `POST` и `PATCH` значений и на `PUT property-values`, набор с состоянием чужого компонента — `422 state_not_in_component`; устаревшая вкладка после переимпорта с убранным состоянием получает `422` при автосохранении и возвращает прежнее значение

## 8. Совместимость и откат на контуре

- [x] 8.1 [внешняя проверка] Прежний `dsbuilder` из `PATH` выполняет `import-api` с новым backend без ошибок и не меняет признаки (`stateSupportChanged = 0`)
- [x] 8.2 [внешняя проверка] Новый CLI выполняет `import-api --dry-run` с backend `origin/dev` без ошибок
- [x] 8.3 [внешняя проверка] Клиент `origin/dev` с новым backend и новый клиент с backend `origin/dev` открывают редактор компонента и добавляют состояние цвету
- [x] 8.4 [внешняя проверка] ds-service из `origin/dev` стартует на базе с применённой миграцией (`/health` готов, `flyway: true`), редактор работает; затем ds-service ветки снова стартует на той же базе

## Текущий результат проверки 2026-11-23

- Миграция перенесена на `V23` после слияния с `dev`; обновлены число миграций и итоговый fingerprint в тестах Flyway.
- Исправлено добавление и редактирование состояний ссылки на вложенный Compose-стиль. Регрессионный тест проверяет отдельное значение состояния, блокировку после смены меты и удаление.
- Исправлена проверка найденной по имени старой строки: `PUT property-values` проверяет также её фактический набор состояний, чтобы отклонять состояние чужого компонента.
- Клиент — 171 тестовый файл, 1574 теста прошли; `cd js && npm run build` прошла.
- Изменённые серверный файл и интеграционный тест скомпилированы Kotlin 2.2.0 с зависимостями проекта. Strictacode для backend и клиента прошёл после правок; Prettier и проверка diff прошли.
- Существующий отчёт полного прогона до последних правок содержит 286 успешных интеграционных тестов ds-service без пропусков. Последние серверные правки требуют повторного PostgreSQL-прогона.
- Повторная проверка Gradle в текущей сессии блокируется `Operation not permitted` при создании lock/socket. Docker API возвращает `permission denied`. Пункт 6.1 остаётся открытым.
- Пункты 4a, 7 и 8 остаются открытыми: необходимы генераторы меты платформ и работающий локальный контур.

## Повторная проверка окружения 2026-11-23

- Работа продолжена в существующем worktree `feature-property-states-meta`; исходные незакоммиченные изменения сохранены.
- `tools/verify fast --change add-property-state-support` и `tools/verify full --change add-property-state-support` запущены. В обоих прошли protected-path policy, shell-проверки, тесты порядка verify, строгая валидация OpenSpec и Strictacode backend. Оба прогона остановлены вручную на Strictacode frontend, который не выдавал результат (fast — несколько минут); общий PASS не получен.
- Независимый Strictacode `javascript-client` и `javascript-cli` прошёл. Baseline и правила проверок не менялись.
- Прямые backend `./gradlew verifyFast`, `./gradlew verifyFull`, ds-service `./gradlew :runtime:integrationTest` и frontend `./gradlew verifyFull` завершаются до запуска задач: создание `~/.gradle/wrapper/dists/gradle-9.1.0-bin/…/gradle-9.1.0-bin.zip.lck` запрещено (`Operation not permitted`). Нового результата PostgreSQL-тестов нет.
- `docker info` возвращает `permission denied` для `unix:///Users/sergeyvelesko/.docker/run/docker.sock`. HTTP-проверки `localhost:8080/health` и `localhost:5173/` не установили соединение; состояние сервисов через Docker проверить невозможно.
- JS `npm run verify:full`: production-сборка клиента и typecheck CLI прошли; тесты CLI остановились на `tsx` IPC-сокете с `listen EPERM`. До проверки Figma-плагина команда не дошла.
- `npm run test:e2e:check` прошёл: типизация и обнаружение 20 тестов в 14 файлах. Это не выполнение браузерных сценариев на контуре.
- Повторно прошли все 5 тестов `InspectorPropertyRow.styleReference.test.tsx`; `git diff --check` прошёл. Установленный `dsbuilder --version` отвечает `0.1.0`; совместимость импорта с сервером не проверена.
- Пункт 6.1 и пункты 4a, 7–8 остаются открытыми. `setup-local.sh`, сброс и удаление данных не запускались. Для продолжения нужны доступ к Docker API, запуску Gradle и локальным сокетам; сброс данных по-прежнему требует согласования.

## Дополнительный прогон в новой сессии 2026-11-23

- Исходные незакоммиченные изменения и staged-перенос миграции сохранены; изучены обычный и staged diff. Сброс данных, `setup-local.sh` и публикация плагинов не запускались.
- Docker API по-прежнему недоступен: `permission denied` для `~/.docker/run/docker.sock`. Gradle wrapper не может открыть lock-файл в `~/.gradle`. Прямой запуск установленного Gradle 9.1.0 с отдельным `--gradle-user-home /tmp/property-states-gradle --no-daemon verifyFast` также не запускает задачи: `FileLockContentionHandler`, `java.net.SocketException: Operation not permitted`. Перенос рабочего каталога Gradle не устраняет ограничение сокетов. Прямой `ds-service :runtime:integrationTest` остановился на wrapper lock; PostgreSQL-тесты не выполнены.
- Повторно прошли все 171 файл и 1574 теста клиента. `npm run verify:full` в `js` подтвердил production-сборку клиента и typecheck CLI, затем остановился на `tsx` IPC (`listen EPERM`). Отдельный запуск тех же CLI-тестов через `node --import tsx --test src/*.test.ts`: 90 прошли, 5 упали при дочернем запуске `tsx` с той же ошибкой IPC; успешным прогоном CLI это не считается. `figma-plugin core:build` также блокируется Gradle wrapper lock.
- Повторно прошли Strictacode `backend`, `javascript-client`, `javascript-cli`, shell-проверки, тесты порядка verify, строгая валидация OpenSpec, `git diff --check` и `test:e2e:check` (20 сценариев в 14 файлах). Браузерные сценарии не выполнялись.
- HTTP-проверки `localhost:8080/health` и `localhost:5173/` не установили соединение. Пункты 7–8 не подтверждены; для проверки обновления и отката необходим доступный контур с исходным снимком `origin/dev`, для пункта 7.4 — также новая мета генератора из 4a.1.


## Проверка с доступным Docker и Gradle, 2026-11-23

- Незакоммиченные изменения сохранены, staged-перенос V22 → V23 не изменён. Коммиты и публикация в Git не выполнялись.
- `tools/verify fast --change add-property-state-support` — PASS. Независимый read-only reviewer не нашёл блокирующих замечаний. Повторный `tools/verify full --change add-property-state-support` — PASS, включая PostgreSQL, frontend native/Node/package/installer tests и полный JS-контур.
- Отдельный `ds-service :runtime:integrationTest`: 287 тестов в 57 наборах, 0 ошибок, 0 пропусков; новый сценарий старой строки с чужим состоянием прошёл. Первый FULL упал в `InProcessChatToolsIntegrationTest` (`CONFLICT/draft_changed` ожидался, `NOT_FOUND` получен); отдельные прогоны на ветке и `origin/dev` прошли, повторный общий FULL тоже прошёл. Причина первого отказа не установлена, код теста не менялся.
- Задержка Strictacode frontend связана с обходом generated-каталогов. Для успешных FAST/FULL `frontend-kt/build` временно переносился целиком за пределы обхода и возвращался до запуска Gradle. Все артефакты сохранены и возвращены; исходники, настройки анализа и baseline не менялись. Созданные тестами Python caches сохранены вне worktree.
- **7.1:** вместо удаления существующих данных поднят новый изолированный Compose-проект `property-states-verification` из снимка `origin/dev` (`2ae2bd39`), с новыми томами и отдельными портами. `setup-local.sh --reset` не выполнялся. Исходные контейнеры другого worktree не менялись. Загружены прежние плагины, demo-компоненты и тема; seed отклонил один `bottom-sheet`, отсутствующий в старой глобальной Compose-мете. В старом UI добавлен `focused` к web `Button.backgroundColor`; серверный export подтвердил запись. Сохранены export всех Compose/web-конфигураций, editor-bundle DropZone/Slider/TextField, выгрузка 104 web-конфигураций старым CLI и сгенерированный components-only web-пакет. `ViewContainer` штатно пропущен генератором без темы.
- **7.2:** backend ветки запущен на этих же томах без сброса. Применена V23, `/ready` возвращает `ready: true`, `ds.flyway: true`. До переимпорта у всех 4679 свойств `state_combinations IS NULL`, `property_supported_states` пуста. `/health` в монолите возвращает `ok`; подробные проверки доступны через `/ready`.
- **7.3 (частично):** Compose/web export и сгенерированный web-пакет до переимпорта побайтно совпали со снимком. `npm run test:e2e` с обычным Owner `user@example.com` дал 3 passed / 17 failed и на `origin/dev`, и на backend ветки: тестовые helpers обращаются к устаревшему `/api/projects/{id}/ds/design-systems` и получают 404 (актуальный путь — `/api/projects/{id}/design-systems`). Первый пробный запуск с admin остановился на предусловии Owner без system_admin. Пункт не закрыт; тестовые helpers не менялись.
- **7.4 (частично):** прежняя Compose-мета через JVM CLI ветки не меняет поддержку состояний. Web-плагин обновил 3398 свойств (`stateSupportChanged = 3398`), `unresolvedStates` пуст. Повторная публикация и импорт неизменны (нулевой счётчик не печатается CLI). В БД у web `Button.backgroundColor` только `hovered,pressed`, `combinations = false`. После переимпорта: 3398 web-свойств с признаком, 1281 Compose-свойство без признака, 234 связи поддерживаемых состояний. Найдено 8 собственных состояний-«теней». На снимке после проверок UI среди текущих web-значений в состояниях: 8 значений у 4 свойств с пустым списком, 2 значения у 2 свойств с состоянием вне списка, запрещённых сочетаний нет; это не полный замер Compose после новой меты. Новые генераторы меты 4a не подготовлены, поэтому Compose-часть 7.4 остаётся открытой.
- **7.5:** `components import-api --platform react --from js/cli/.sdds/web/web-api-meta.json --apply` JVM CLI ветки прошёл после публикации web; повторный импорт не меняет признаки.
- **7.6 (частично):** после доступного переимпорта прежней Compose-меты и новой web-нормализации оба export и сгенерированный web-пакет побайтно совпали со снимком. Сценарий с новой Compose-метой из 4a.1 ещё не выполнен.
- **7.7 (частично):** Playwright с настоящим браузером подтвердил меню web Button только `pressed,hovered`, запрет одновременного выбора, readonly прежнего `focused` и его удаление с сохранением после перезагрузки. Для web Switch.descriptionColor с пустым списком подтверждены отсутствие кнопки добавления, readonly прежнего hovered и его удаление после перезагрузки. Встроенный CUA недоступен (`Module not found: @oai/cua/tinyskyAlt`), использован Playwright. Проверки нового Compose-признака/preview и «теней» в UI остаются открытыми.
- **7.8:** на изолированном контуре POST invariant/variation, PATCH invariant/variation и PUT property-values отклоняют недопустимое состояние с `422 states_not_supported`; POST с идентификатором набора чужого компонента даёт `422 state_not_in_component`. PUT с чужим именем, которого нет у компонента, отклонён как `unknown_state`; проверка прежней строки с чужим ID подтверждена PostgreSQL-тестом. Реальная устаревшая вкладка после импорта web-меты без `hovered` получила 422 при отвязке цвета и после перечитывания восстановила прежнюю ссылку на токен. Первое наблюдение через 600 мс оказалось преждевременным: при ожидании завершения перечитывания сценарий проходит без правок кода. Исходная web-мета возвращена; созданная только для проверки временная invariant-строка удалена.
- **8.1–8.4:** установленный `dsbuilder 0.1.0` импортирует мету в новый backend и сохраняет уже заданные признаки; новый JVM CLI делает dry-run на `origin/dev`; старый клиент с новым backend сохраняет `Label color pressed`, новый клиент со старым backend — `Spinner color pressed` (оба значения проверены после перезагрузки). Backend `origin/dev` успешно стартовал на базе с V23 (`/ready`, `ds.flyway: true`), затем на той же базе вновь поднят backend ветки.
- Локальные логи, снимки и скриншоты сохранены в `.agent-workflow/add-property-state-support/evidence/`. Изолированный backend оставлен на `http://localhost:18080`, клиент ветки — `http://localhost:14174`. Данные исходного локального контура не удалялись. Открыты 4a.1, 4a.2, 7.3, 7.4, 7.6, 7.7; Change не архивирован.


## Генераторы и завершение локальных проверок, 2026-11-23

- Выполнен `git fetch origin` в обоих соседних репозиториях. Из чистых checkout созданы ветки `feature/property-state-support-meta`: plasma-android от `origin/develop` (`b3ec398eb`), plasma-ios от `origin/develop` (`bf2ac095`). Изменения опубликованы в [Android PR #982](https://github.com/salute-developers/plasma-android/pull/982) и [iOS PR #529](https://github.com/salute-developers/plasma-ios/pull/529).
- **4a.1, реализация готова:** Android экспортирует `stateSupport` из общего с Compose-mapper словаря и из `AndroidState` для View. Preview ZIP теперь использует этот экспортёр вместо копирования сырой меты. Проверены преобразования всех объявленных состояний, сочетания, чтение прежней меты. 602 теста прошли, 9 существующих тестов пропущены; Spotless, Detekt, сборка и `verifyPreviewPluginArtifact` прошли. ZIP содержит 79 записей с одинаковым `stateSupport`. Независимый reviewer не нашёл блокирующих замечаний. Создан PR #982 в plasma-android.
- **4a.2, реализация готова:** iOS сканирует исходники `InteractiveState` и сверяет имена с `ComponentState`; экспортирует 12 состояний без копии списка. Исправлена генерация `InteractiveState.textInlined` вместо некорректного `InteractiveState.text-inlined`. 3 теста сканера и 83 теста основного генератора прошли; release-скрипт создал мету 66 компонентов. Первый общий прогон до генерации локальной меты упал на отсутствующем файле; после его генерации полный прогон прошёл. Реальная мета прошла CLI `swiftui --dry-run`: 844 свойства, 0 отклонений, 48 свойств без платформенного кода штатно пропущены. Независимый review прошёл. Создан PR #529 в plasma-ios.
- **7.3:** исправлены устаревшие DS-scoped маршруты E2E helpers, тело создания темы/версии и ожидания текущего UI/пакетного отката. Найдено и исправлено подавление применения кешированного снимка токенов после перехода из журнала/версий: дедупликация `ThemeEditorSession` теперь учитывает область применения снимка. Регрессионный тест прошёл. Полный `npm run test:e2e` — 20/20; все unit-тесты клиента — 1575/1575. Финальный E2E выполнялся уже после переимпорта; сравнение до переимпорта подтверждено предыдущими снимками.
- **7.4:** настоящий новый Compose ZIP импортирован JVM CLI: `stateSupportChanged = 1281`, отклонений и `unresolvedStates` нет. Повторная публикация неизменна. После импорта 862 Compose-свойства разрешают сочетания, 419 имеют пустую поддержку; web — 3398 свойств без сочетаний. `DropZone.paddingStart` включает `dragging-over`, `Slider.thumbColor` содержит только пять интерактивных состояний без `disabled`/`readonly`. Аудит до новых UI-фикстур: 8 собственных состояний-теней, записанных значений в них нет; все 806 Compose-значений у 94 свойств допустимы. Для web: 8 значений у 5 свойств с пустой поддержкой, 2 значения у 2 свойств с неподдерживаемым состоянием; запрещённых сочетаний нет.
- **7.6:** непосредственно до и после нового Compose-импорта оба export побайтно совпали. Web-пакет повторно сгенерирован: из 299 файлов относительно прежнего снимка отличается только `Button.config.ts`, ровно на намеренные UI-проверки предыдущего этапа (удалён focused, добавлены pressed для label/spinner). Изменений от импорта меты нет; ранее сохранённое сравнение до этих UI-правок было побайтно одинаковым.
- **7.7:** Playwright подтвердил сохранение `DropZone.paddingStart dragging-over = 96` после reload и реальный эффект в Compose preview: ширина увеличилась на 72 px относительно padding 24. Payload содержит состояние с числовым литералом. Сначала проверена строка выбранного стиля; для визуальной проверки состояние добавлено инварианту, который штатно имеет приоритет в preview. Для TextField создана отдельная тестовая строка со старым собственным ID disabled: UI изменил 44 → 52 и сохранил ID `3a0c7ba5-83b7-4526-9122-546987e4f8ed`; новая строка disabled = 88 использует общий ID `00000000-0000-4000-8000-000000000007`. Оба значения проверены после reload и SQL. Прежние web-проверки этого пункта остаются подтверждены.
- **8.1, дополнительно:** старый CLI 0.1.0 успешно импортировал уже новую Compose-мету: 1281 свойство без изменений, поддержка состояний в БД сохранена.
- Финальный FAST после всех исправлений прошёл; свежий независимый reviewer DS Builder не нашёл блокирующих замечаний. Финальный `tools/verify full --change add-property-state-support` также прошёл, включая PostgreSQL-gate, frontend native/Node/package/installer checks и JS-сборки.
- Сброс исходного контура не выполнялся. Все проверки использовали изолированный `property-states-verification`; логи и скриншоты сохранены в `.agent-workflow/add-property-state-support/evidence`. Пункты 4a.1/4a.2 завершены публикацией PR. Все пункты tasks.md выполнены; Change пока активен для пользовательской проверки в браузере.


## 9. Состояния на пересечениях вариаций

- [x] 9.1 Сохранить состояния пересечений в клиентской модели, загрузке, экспорте и preview, включая запись без собственного базового значения
- [x] 9.2 Передавать `states` при записи/удалении значения пересечения; не менять другие наборы состояний и исходные стили
- [x] 9.3 Разрешить меню и редактирование состояний пересечения по `stateSupport`, переопределение унаследованного значения и сброс к наследованию
- [x] 9.4 Добавить регрессионные тесты независимости базовой записи/состояний, удаления, наследования и отказа записи
- [x] 9.5 Выполнить FAST, независимое review, FULL и строгую валидацию OpenSpec
- [x] 9.6 [внешняя проверка] В браузере проверить TextField с Size + Label-placement + Required-placement: добавление, изменение, reload, preview, удаление состояния и неизменность исходных стилей

Проверки пересечений: клиент 1580/1580; PostgreSQL-операции редактора 39/39. В браузере проверены
TextField Size=m + Label-placement=inner + Required-placement=start, hovered=40 после reload,
отказ 422 с возвратом 40 и сообщением, сброс disabled=77 к унаследованному 88 без изменения стиля.
Payload Compose preview содержит базовое 16 и состояния hovered=40, disabled=88.
FAST/FULL и финальное независимое ревью ещё выполняются.

Финальные точечные результаты после ревью: клиент 1583/1583; feature-components JVM 307/307,
включая неизменённые проверки точного преобразования корпуса native-конфигураций. Сохраняются
тип/alpha/adjustment базы и состояния меньших пересечений, в том числе при собственной базе;
для прежнего полного переопределения без состояний сохранена совместимость. Прозрачность состояния
сохраняется при чтении из бандла, переопределении и в PUT. Повторный FAST прошёл.

Завершение: финальный FAST и повторный FULL прошли, включая 288 PostgreSQL-тестов runtime без
пропусков и 166 нативных тестов CLI macOS. Первый FULL остановился на неизменённом
`MacosAnalyticsIdentityTest` с `Cannot prepare credential lock: 17` (EEXIST); точечный повтор и
повторный FULL прошли без правок этого кода и без исключения тестов. Третье независимое ревью
не подтвердило blocking findings; отдельно зафиксировано ограничение его покрытия: взаимодействие
invariant states с уже выбранным стилем независимо не проверялось, новый дефект не доказан.
Change оставлен активным для пользовательской проверки в браузере.


Уточнение iOS по ревью #529: общих interaction states пять; семь компонентных состояний
не экспортируются общими. Добавлено объявление readonly у Editable. Приоритет сочетаний
исправлен в runtime и DTO; имена Swift-case выводятся независимо от raw value. Проверки
сканера, инвариантов меты и runtime покрывают эти правила.


## 10. Исправления ревью пересечений PR #188

- [x] 10.1 Сохранить отсутствие собственной базы пересечения после экспорта и повторного импорта; проверить PostgreSQL roundtrip
- [x] 10.2 Сохранить состояния инварианта при собственной базе пересечения и прежнее полное переопределение без состояний
- [x] 10.3 Разрешить выбор вложенного Compose-стиля в состоянии пересечения, включая переопределение и удаление
- [x] 10.4 Показать источник каждого унаследованного набора состояний независимо от источника базы
- [x] 10.5 Выполнить FAST, независимое ревью, FULL и проверки затронутых сценариев


Проверки исправлений ревью: FAST и FULL прошли, Strictacode без изменения baseline. Клиент:
1589 тестов; PostgreSQL runtime: 289 тестов без ошибок и пропусков. Новый roundtrip-тест
дважды импортирует разреженное пересечение и сравнивает экспорт и редакторские значения,
включая ID, позиции и ревизии. Отдельно проверены изменение и удаление ссылки вложенного
стиля в состоянии пересечения без изменения базы. Свежее независимое ревью не нашло
блокирующих замечаний. В браузере у TextField на тройном пересечении подтверждены
унаследованное `disabled = 88` и подсказка источника `size: m`; данные не менялись.


Обновление 2026-11-24: ветка перебазирована на свежий `origin/dev` (`5a28f386`, Node.js CLI).
Все 12 патчей сохранены; тест вывода поддержки состояний адаптирован к `runTest` нового
асинхронного CLI. Сохранён актуальный клиентский baseline из `dev`; повторения выбора
конструктора свойства, базового переопределения и порядка состояний устранены без изменения
поведения. FAST и FULL прошли, клиент — 1589 тестов; CLI — 157 Node.js и 171 macOS-тест,
`runtime-node` — 19 тестов, без ошибок. Независимое ревью подтвердило перенос патчей
и эквивалентность упрощения. Строгая валидация OpenSpec пройдена.
