## 1. Domain

- [x] 1.1 Добавить в `feature/components/domain/ComponentPackage.kt` модель `ConvertedComponentConfig` (`componentName`, `styleName`, `config: CommonConfig`) с KDoc на русском.
- [x] 1.2 Добавить доменные модели отчёта импорта `ComponentImportReport` и `ComponentImportRejection` (`feature/components/domain`), без `@Serializable`, с KDoc, сохранив смысл полей `unknownProperties`, `unknownStates` и `typeMismatches` из текущего `ImportReport`.

## 2. Application: port

- [x] 2.1 Создать `feature/components/application/ComponentConfigRemoteSource.kt` с `fun interface ComponentConfigRemoteSource { fun import(command: ImportComponentsCommand): ImportComponentsResult }`.
- [x] 2.2 Объявить там же `ImportComponentsCommand` (`apiUrl: ProjectApiUrl`, `apiKey: ProjectApiKey`, `projectId`, `designSystemId`, `packageName`, `packageOrigin`, `dryRun`, `components: List<ConvertedComponentConfig>`) и `sealed interface ImportComponentsResult` с `Imported(report)` и `Failed(message)`.

## 3. Data: HTTP-реализация порта

- [x] 3.1 Создать `feature/components/data/HttpComponentConfigRemoteSource.kt`, принимающий `AuthenticatedHttpClientFactory` и реализующий `ComponentConfigRemoteSource`.
- [x] 3.2 Перенести в него конфигурацию `Json` (`ignoreUnknownKeys`, `encodeDefaults`, `explicitNulls = false`) и `@Serializable` модели тела запроса (`ImportRequest`, `ImportMeta`, `ImportComponent`) как приватные для `data`.
- [x] 3.3 Перенести построение пути `/api/projects/${projectId}/ds/component-config/import` и вызов `post`, сохранив `designSystemId` в теле запроса.
- [x] 3.4 Добавить приватные `@Serializable ImportReportResponse` и `ImportRejectionResponse` с `toDomain()`, возвращающими `ComponentImportReport`.
- [x] 3.5 Перенести обработку успешного ответа с нечитаемым телом, сохранив текст сообщения дословно: `Error: backend returned a successful status with an unreadable import report: …`.
- [x] 3.6 Отображать `AuthenticatedHttpResult.Failure` в `ImportComponentsResult.Failed` без изменения сообщения CLI core.

## 4. Application: use case

- [x] 4.1 Заменить в конструкторе `PushComponentsUseCase` зависимость `httpClientFactory: AuthenticatedHttpClientFactory` на `remoteSource: ComponentConfigRemoteSource` и снять значение по умолчанию у параметра `codec`.
- [x] 4.2 Удалить из `PushComponentsUseCase` поле `json`, сборку тела запроса, построение пути, вызов HTTP client и `parseReport`.
- [x] 4.3 Перевести `convert()` на возврат `List<ConvertedComponentConfig>`, сохранив all-or-nothing поведение и формулировку отказа с именем компонента, стиля и файла.
- [x] 4.4 Собирать `ImportComponentsCommand` из уже разрешённых `apiUrl` (`ProjectApiUrl(apiUrl.value)`), `apiKey`, `context` и пакета и вызывать `remoteSource.import(...)` после всех барьеров.
- [x] 4.5 Отобразить `ImportComponentsResult` в `PushComponentsResult`, сохранив `PushTarget` в обоих исходах; `PushComponentsResult.Pushed.report` теперь `ComponentImportReport`.
- [x] 4.6 Удалить из файла `PushComponentsUseCase.kt` объявления `ImportRequest`, `ImportMeta`, `ImportComponent`, `ImportReport`, `ImportRejection` и неиспользуемые импорты `kotlinx.serialization`.

## 5. Presentation и DI

- [x] 5.1 Перевести `ComponentsPushCliCommand` на рендер `ComponentImportReport` из `domain`, не меняя ни одной строки вывода.
- [x] 5.2 Зарегистрировать в `ComponentsFeatureModule` `single<ComponentConfigRemoteSource> { HttpComponentConfigRemoteSource(get<AuthenticatedHttpClientFactory>()) }` и обновить сборку `PushComponentsUseCase`.

## 6. Тесты

- [x] 6.1 Создать `commonTest/.../feature/components/HttpComponentConfigRemoteSourceTest.kt` с fake `AuthenticatedHttpClientFactory` (переиспользовать текущую реализацию из `PushComponentsUseCaseTest`).
- [x] 6.2 Перенести туда проверки wire-контракта: единственный запрос, полный путь `/api/projects/project-a/ds/component-config/import`, `designSystemId` и `meta` в теле, состав `components`, ключ `properties` вместо `props`, `dryRun` в теле для обоих режимов.
- [x] 6.3 Перенести туда проверки ответа: разбор отчёта в `ComponentImportReport` (включая `rejected`, `unknownProperties`, `unknownStates`, `typeMismatches`), нечитаемое тело при успешном статусе, отказ backend.
- [x] 6.4 Переписать `PushComponentsUseCaseTest` на fake `ComponentConfigRemoteSource`, фиксирующий полученную `ImportComponentsCommand`.
- [x] 6.5 Сохранить в нём проверки барьеров: отказ по code default API URL, отсутствие project context, отсутствие API key, ошибка чтения пакета, отказ преобразования — каждый со своим сообщением и без вызова порта.
- [x] 6.6 Сохранить проверки `PushTarget` (API URL и его источник, project, design system, имя пакета, origin, число конфигураций), проброс `dryRun` и отсутствие сверки имени пакета.
- [x] 6.7 Правка не потребовалась: `ComponentsCliCommandTest` подменяет HTTP на уровне `CliRuntime` (composition root), а не в конструкторе use case, поэтому fake `AuthenticatedHttpClientFactory` теперь доезжает до `HttpComponentConfigRemoteSource` через Koin. Тест зелёный без изменений; предположение задачи о fake в use case было ошибочным.
- [x] 6.8 Покрытие выросло: было 14 тестов в `PushComponentsUseCaseTest`, стало 14 + 9 в `HttpComponentConfigRemoteSourceTest` = 23. Добавлены отсутствовавшие барьеры (нет project context, нет API key) и разбор разделов расхождений отчёта.

## 7. Верификация

- [x] 7.1 Проверить границы слоёв: `grep -rn "AuthenticatedHttpClientFactory\|kotlinx.serialization" dsbuilder-frontend/cli/src/commonMain/kotlin/com/dsbuilder/frontend/cli/feature/components/application` не даёт совпадений.
- [x] 7.2 Проверить, что presentation не импортирует wire-модели: `grep -rn "ImportReport\|ImportRequest" dsbuilder-frontend/cli/src/commonMain/kotlin/com/dsbuilder/frontend/cli/feature/components/presentation` не даёт совпадений.
- [x] 7.3 `cd dsbuilder-frontend && ./gradlew :cli:jvmTest` — 112 из 113 зелёных, все тесты фичи `components` проходят. Единственное падение `DsBuilderCliTest.themeFetchWritesLocalFilesAndConfigTenants` воспроизводится на чистом дереве без правок этого change (проверено через `git stash`) и относится к незавершённой работе `theme fetch`, отмеченной ещё в change `move-components-import-to-component-config`.
- [x] 7.4 `cd dsbuilder-frontend && ./gradlew :cli:detekt :cli:spotlessCheck`; при падении Spotless только на затронутых файлах выполнить `:cli:spotlessApply` и повторить проверки.
- [ ] 7.5 `cd dsbuilder-frontend && ./gradlew build` — падает только на `DsBuilderCliTest.themeFetchWritesLocalFilesAndConfigTenants` (jvm и macosArm64, по 112 из 113 зелёных). Зачесть после починки `theme fetch`.
- [x] 7.6 Прогнан живьём против локального стенда пакетом `sdds_serv` (144 конфигурации, проект `base-test`, дизайн-система `258d44a9-…`): `--dry-run`, затем `--apply`. Вывод совпал с прежним по форме и содержанию — `Unchanged: 143`, единственное отклонение `bottom-sheet (modal-bottom-sheet)`, те же разделы «Properties absent from the global layer» (21), «States absent from the global layer» (2) и «Property type mismatches» (3), `Status: components pushed`. Рефакторинг на `ComponentConfigRemoteSource` вывод не изменил.
