## 1. Скрефолдить структуру фичи и конфигурацию

- [x] 1.1 Создать пакеты `feature/docs/{presentation,domain,application,data,di}` в `dsbuilder-frontend/cli/src/commonMain/kotlin/com/dsbuilder/frontend/cli/feature/docs/`
- [x] 1.2 Добавить `okio` или `kotlinx-io` в зависимости `commonMain` (если ещё нет), если нужен для zip
- [x] 1.3 Проверить, что `kotlinx.serialization` уже подключён для commonMain

## 2. Domain-модели пакета

- [x] 2.1 Создать `StructureModel.kt`: `Structure`, `NavigationNode`, `MergePolicy` (enum), `SubjectResolver`
- [x] 2.2 Создать `DocsModel.kt`: `ResolvedDocs`, `ResolvedNavigationNode`, `ContentRef`, `Source` (enum)
- [x] 2.3 Создать `ManifestModel.kt`: `Manifest`, `DesignSystemInfo`, `Artifact`, `ArtifactType` (enum)
- [x] 2.4 Создать `BundleModel.kt`: `DocumentationBundle`, `ValidationError` (sealed interface), `MergeEngine`
- [x] 2.5 Написать unit-тесты на JSON serialise/deserialise моделей через `kotlinx.serialization`

## 3. Docs Init — создание структуры документации

- [x] 3.1 Создать `DocsInitCliCommand.kt`: команда `dsbuilder docs init` (без аргументов, использует ProjectConfigStore)
- [x] 3.2 Создать `InitDocsCommand` / `InitDocsResult` в `DocsCommandModels.kt`
- [x] 3.3 Создать `DocsInitUseCase.kt`: создание `docs/structure.json` и примера страницы
- [x] 3.4 Создать базовый шаблон `structure.json` в ресурсах или как константу
- [x] 3.5 Создать `InitDocsPort` (FileSystem) в `DocsPorts.kt` и использовать `CliFileSystem` в di
- [x] 3.6 Написать unit-тесты для `DocsInitUseCase`

## 4. Docs Generate — merge structure-core.json + structure-user.json

- [x] 4.1 Реализовать `MergeEngine.merge(coreStructure, userStructure): ResolvedDocs`
  - [x] 4.1.1 Парсить `structure-core.json` из директории агрегатора
  - [x] 4.1.2 Парсить `structure-user.json` из директории агрегатора
  - [x] 4.1.3 Реализовать наследование `subjects` от родительской группы
  - [x] 4.1.4 Реализовать слияние по `path` с поддержкой `merge` (append/prepend/replace)
  - [x] 4.1.5 Реализовать `hidden` — исключение страницы из итогового дерева
  - [x] 4.1.6 Реализовать объединение групп по положению в дереве и заголовкам
- [x] 4.2 Написать unit-тесты для MergeEngine (10+ сценариев: append, prepend, replace, hidden, наследование, новые страницы)

## 5. Docs Generate — генерация docs.json и manifest.json

- [x] 5.1 Создать `DocsGenerateCommand` / `DocsGenerateResult` в `DocsCommandModels.kt`
- [x] 5.2 Создать `DocsGenerateUseCase.kt`: orchestration — чтение aggregator директории → merge → validate → zip
- [x] 5.3 Считать ds id и version из `ProjectConfig` через `ProjectConfigStore`
- [x] 5.4 Определить платформу из аргумента `--platform` или env / config
- [x] 5.5 Сгенерировать `manifest.json` с `schemaVersion`, `designSystem`, `platform`, `artifacts`
- [x] 5.6 Принять aggregator директорию через `--docs-dir` (по умолчанию `.sdds/temp/docs/` от config.json)

## 6. Docs Generate — валидация пакета

- [x] 6.1 Создать `DocsValidationEngine.kt` (порт) и `FilesystemValidationEngine.kt` (реализация)
- [x] 6.2 Реализовать проверку: все content refs существуют в content-директории
- [x] 6.3 Реализовать проверку: нет duplicate paths
- [x] 6.4 Реализовать проверку: пути безопасны (нет path traversal, `..`, абсолютных путей)
- [x] 6.5 Реализовать проверку: артефакты из manifest.json существуют в архиве
- [x] 6.6 Написать unit-тесты для ValidationEngine (6 сценариев)

## 7. Docs Generate — tar.gz-архивация

- [x] 7.1 Создать `GzipDocsFileSystem.kt` в data/ (реальная USTAR-tar + gzip)
- [x] 7.2 Реализовать запись resolved content-файлов в `content/core/` и `content/user/`
- [x] 7.3 Реализовать копирование assets и api/meta (если есть) в архив
- [x] 7.4 Реализовать создание tar.gz-архива через okio (POSIX ustar + GZIP, multi-entry)
- [x] 7.5 Сохранить архив по умолчанию в `./sdds/temp/docs-bundle.tar.gz` (или путь из `--output`)
- [x] 7.6 Написать тесты на tar.gz-архивацию (4 сценария, поддержка длинных имён >100 байт)

## 8. Docs Publish — HTTP upload

- [x] 8.1 Создать `DocsPublishCliCommand.kt`: команда `dsbuilder docs publish`
  - [x] 8.1.1 Аргумент `--bundle <path>` (по умолчанию `./sdds/temp/docs-bundle.zip`)
- [x] 8.2 Создать `DocsPublishCommand` / `DocsPublishResult` в `DocsCommandModels.kt`
- [x] 8.3 Создать `HttpDocsPublisher.kt` в data/
  - [x] 8.3.1 Реализовать `POST /documentation/bundles` через `AuthenticatedHttpClient`
  - [x] 8.3.2 multipart/form-data: файл zip + metadata
  - [x] 8.3.3 Парсить ответ `{jobId, status}`
- [x] 8.4 Создать `DocsPublishUseCase.kt`: orchestrate upload и показать статус пользователю
- [x] 8.5 Написать тесты с Ktor Mock Engine для HTTP upload и ошибок

## 9. DI и Wiring

- [x] 9.1 Создать `DocsFeatureModule.kt`:
  - [x] 9.1.1 `single<DocsFileSystem> { ZipDocsFileSystem(...) }`
  - [x] 9.1.2 `single<DocsHttpClient> { HttpDocsPublisher(...) }`
  - [x] 9.1.3 `single { DocsInitUseCase(...) }`
  - [x] 9.1.4 `single { DocsGenerateUseCase(...) }`
  - [x] 9.1.5 `single { DocsPublishUseCase(...) }`
  - [x] 9.1.6 `single { DocsInitCliCommand(...) }`
  - [x] 9.1.7 `single { DocsGenerateCliCommand(...) }`
  - [x] 9.1.8 `single { DocsPublishCliCommand(...) }`
  - [x] 9.1.9 `single<CliktCommand> { get<DocsInitCliCommand>() }`
  - [x] 9.1.10 `single<CliktCommand> { get<DocsGenerateCliCommand>() }`
  - [x] 9.1.11 `single<CliktCommand> { get<DocsPublishCliCommand>() }`
- [x] 9.2 Обновить `cliModule()`: добавить все три docs-команды в `cliktSubcommands`
- [x] 9.3 Обновить `DsBuilderCli.execute()`: добавить `docsFeatureModule()` в список modules

## 10. Финальная проверка

- [x] 10.1 `./gradlew :dsbuilder-frontend:cli:compileKotlinJvm` — PASSED
- [x] 10.2 `./gradlew :dsbuilder-frontend:cli:detekt` — PASSED
- [x] 10.3 `./gradlew :dsbuilder-frontend:cli:spotlessCheck` — PASSED
- [x] 10.4 `./gradlew :dsbuilder-frontend:cli:jvmTest` — 22/22 docs-тестов PASSED
- [x] 10.5 `./gradlew :dsbuilder-frontend:cli:linkReleaseExecutableMacosArm64` — PASSED
- [x] 10.6 `dsbuilder docs generate` на реальном проекте — manifest.json содержит 6 артефактов, content refs правильные
