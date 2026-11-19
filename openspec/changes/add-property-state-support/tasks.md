## 1. Схема и домен ds-service

- [ ] 1.1 Добавить миграцию `V21__property_state_support.sql`: enum `property_state_support` (`none`, `interaction`, `any`) и nullable-столбец `properties.state_support` без заполнения
- [ ] 1.2 Добавить доменный `PropertyStateSupport` с отображением в значение БД и правило допустимого набора `StateSupportRule` с модульными тестами
- [ ] 1.3 Добавить `state_support` в `PropertiesTable` и `stateSupport` в `ComponentPropertySummary`; заполнять его в `ExposedComponentRepository` и `ExposedComponentModelRepository`

## 2. Импорт API-меты в ds-service

- [ ] 2.1 Принять `stateSupport` в `ImportApiMetaRequest.Property`, отклонять недопустимое значение в `valid()`, передавать его в `ImportApiMeta.Property`
- [ ] 2.2 В `ExposedApiMetaRepository` записывать признак у новых свойств и обновлять у существующих при отличии (в том числе при расхождении типа), считать `stateSupportChanged`
- [ ] 2.3 Добавить `stateSupportChanged` в `ApiMetaImportReport` и `ImportApiMetaResponse`
- [ ] 2.4 Дополнить `ApiMetaImportHttpPostgresIntegrationTest`: создание с признаком, изменение, отсутствие поля, недопустимое значение, повторный импорт и dry run

## 3. Чтение и запись редактора в ds-service

- [ ] 3.1 Отдавать `stateSupport` в `ComponentPropertySummaryResponse` (всегда, в том числе `null`) и обновить `ComponentReadEnrichmentResponseTest`
- [ ] 3.2 Добавить `states` (общие состояния и состояния компонента) в `ComponentEditorBundle` и `ComponentEditorBundleResponse`; обновить `ComponentEditorBundleUseCaseTest` и `ComponentEditorBundleHttpPostgresIntegrationTest`
- [ ] 3.3 Проверять набор состояний по признаку свойства в `AppearanceEditorValueOperations` при записи значения и отвечать `422 states_not_supported`; удаление и переупорядочивание не проверять
- [ ] 3.4 Дополнить `AppearanceEditorHttpPostgresIntegrationTest` сценариями `none`, `interaction` с состоянием компонента, `any`, `null` и удалением прежнего значения
- [ ] 3.5 Обновить `openapi/documentation.yaml` (поле манифеста, счётчик отчёта, `stateSupport`, `states` бандла, ошибка `states_not_supported`) и проверить `OpenApiDocumentResourceTest`

## 4. Нормализаторы и CLI во frontend-kt

- [ ] 4.1 Добавить `ApiMetaStateSupport` и поле `stateSupport` в `ApiMetaProperty`; вынести словарь состояний взаимодействия из `WebApiMetaNormalizer` в общий объект
- [ ] 4.2 Выводить признак в `ComposeApiMetaNormalizer` (`StatefulValue`/`InteractiveColor`) с тестами на корпусе (`DropZone`, `Avatar`, `Slider`)
- [ ] 4.3 Выводить признак в `ViewApiMetaNormalizer` по непустому `stateValues`; дополнить корпус фрагментом с `stateValues` и тесты
- [ ] 4.4 Выводить признак в `SwiftUiApiMetaNormalizer` по полю `state` повторов и в `WebApiMetaNormalizer` по токенам с `state`; тесты для `interaction`, `any` и `none`
- [ ] 4.5 Передавать `stateSupport` в общем `toImportRequest` (им пользуются `HttpApiMetaRemoteSource` и `HttpPreviewPluginRemoteSource`) с тестами обоих источников, читать `stateSupportChanged` в `ApiMetaImportReport` (по умолчанию `0`) и печатать его в отчёте `:cli`; обновить `ComponentsImportApiCliCommandTest`
- [ ] 4.6 Описать вывод признака в `frontend-kt/feature-components/API_META_NORMALIZERS.md` и `frontend-kt/cli/USAGE.md`

## 5. Билдер в js/apps/client

- [ ] 5.1 Добавить `stateSupport` в `ComponentPropertyDto`, `states` в `ComponentEditorBundleDto`, `stateSupport` в `ComponentAPI` и пробросить их через `componentRepository`
- [ ] 5.2 Расширить `PropState` до имени состояния и добавить функцию выбора предлагаемых состояний по признаку (с запасным правилом для `null`) с модульными тестами
- [ ] 5.3 Перевести `StateBindingMenu` на список состояний из пропсов с порядком `focused`, `pressed`, `hovered`, затем остальные
- [ ] 5.4 В `InspectorPropertyRow` вынести выбор контрола по типу и показывать кнопку и строки состояний у свойства любого типа по признаку; строки записанных состояний показывать и у `none`
- [ ] 5.5 Дополнить `InspectorControls.test.tsx` и тесты инспектора: числовое свойство с `any`, меню `interaction` без состояний компонента, `none` без кнопки, запасное правило для `null`

## 6. Локальные автоматические проверки

- [ ] 6.1 `tools/verify fast --change add-property-state-support` проходит до ревью; после ревью — `tools/verify full --change add-property-state-support` (интеграционные тесты ds-service на PostgreSQL обязательны, отсутствие Docker — провал)
- [ ] 6.2 Тесты клиента `cd js/apps/client && npm test` и сборка `cd js && npm run build`

## 7. Локальный контур: обновление с состояния dev

- [ ] 7.1 [внешняя проверка] Поднять контур на `origin/dev` (`./setup-local.sh --reset` с `--components-package`), добавить в редакторе состояния цветовым свойствам и сохранить снимок: export конфигураций всех компонентов `compose` и `web`, `editor-bundle` трёх компонентов, сгенерированный web-пакет
- [ ] 7.2 [внешняя проверка] Пересобрать контур на ветке без `--reset`: `V21` применена, `/health` готов с `flyway: true`, у всех свойств `state_support IS NULL`
- [ ] 7.3 [внешняя проверка] До переимпорта export и генерация побайтно совпадают со снимком 7.1, а `npm run test:e2e` проходит на контуре
- [ ] 7.4 [внешняя проверка] Переопубликовать плагины Compose и web через `publish-preview-plugin.sh` с JVM CLI ветки: `stateSupportChanged > 0`, выборочные признаки (`DropZone.paddingStart = any`, свойство только с `InteractiveColor` — `interaction`, `Slider.orientation = none`) совпадают, распределение по платформам записано; повторная публикация даёт `stateSupportChanged = 0`
- [ ] 7.5 [внешняя проверка] Выполнить `dsbuilder components import-api` для web файлом `js/cli/.sdds/web/web-api-meta.json` и убедиться, что отчёт совпадает с публикацией плагина web (`stateSupportChanged = 0`)
- [ ] 7.6 [внешняя проверка] После переимпорта export и генерация побайтно совпадают со снимком 7.1
- [ ] 7.7 [внешняя проверка] Во встроенном браузере: состояние `dragging-over` числовому свойству `DropZone` сохраняется после перезагрузки и видно в превью Compose; меню `interaction` без состояний компонента; у свойства `none` нет кнопки, а прежняя строка состояния удаляется; через API недопустимый набор даёт `422 states_not_supported`

## 8. Совместимость и откат на контуре

- [ ] 8.1 [внешняя проверка] Прежний `dsbuilder` из `PATH` выполняет `import-api` с новым backend без ошибок и не меняет признаки (`stateSupportChanged = 0`)
- [ ] 8.2 [внешняя проверка] Новый CLI выполняет `import-api --dry-run` с backend `origin/dev` без ошибок
- [ ] 8.3 [внешняя проверка] Клиент `origin/dev` с новым backend и новый клиент с backend `origin/dev` открывают редактор компонента и добавляют состояние цвету
- [ ] 8.4 [внешняя проверка] ds-service из `origin/dev` стартует на базе с применённой `V21` (`/health` готов, `flyway: true`), редактор работает; затем ds-service ветки снова стартует на той же базе
