## Why

ADR-0003 описывает, что DS Builder CLI отвечает за локальную сборку документации и публикацию готового пакета в сервис документации. Сервис документации (ADR-0002) принимает только самодостаточный zip-архив с `manifest.json`, `docs.json`, `content/`, `assets/`, `api/` и `meta/`. Платформенные инструменты (Android Docs Gradle Plugin, Dokka, TypeDoc) насыщают markdown и генерируют API/info-артефакты отдельно. На данный момент CLI не умеет ни собирать пакет, ни инициализировать структуру документации, ни отправлять его в сервис. Это блокирует весь пайплайн публикации документации.

## What Changes

- Добавить в `dsbuilder-frontend/cli` новую фичу `feature-docs` с тремя командами: `init`, `generate`, `publish`.
- Реализовать domain-модели для `structure-core.json`, `structure-user.json`, `docs.json` и `manifest.json` строго по контракту ADR-0003.
- Реализовать логику слияния Core и пользовательской документации по относительному `path` страницы с поддержкой `merge` (append/prepend/replace) и наследования `subjects`. MergeEngine принимает два дерева навигации от агрегатора и генерирует `docs.json`.
- CLI принимает готовую агрегатором директорию (`.sdds/temp/docs/`) с `structure-core.json`, `structure-user.json`, `content/`, `meta/`, `assets/`. CLI не запускает агрегатор и не генерирует content.
- Собрать итоговый zip-архив через `okio`/`kotlinx-io` в `commonMain` по умолчанию в `./sdds/temp/docs-bundle.zip`.
- Реализовать публикацию пакета в сервис документации через заглушку: `POST /documentation/bundles` (multipart/form-data), получение `{jobId, status}`.
- `docs init` создаёт стартовую структуру `docs/structure.json` и пример страницы, используя `ProjectConfigStore` для определения директории проекта.
- `docs generate` читает `docs/` рядом с `.sdds/config.json`, ds id и версию — из `.sdds/config.json`.

## Capabilities

### New Capabilities
- `docs-cli-bundle`: CLI-команды для инициализации, сборки и публикации пакета документации в `dsbuilder-frontend/cli`.
- `docs-bundle-validation`: локальная валидация инвариантов пакета документации (content refs, path traversal, duplicate paths).

### Modified Capabilities
- Нет.

## Impact

- Затронут модуль `dsbuilder-frontend/cli`: новая фича `feature/docs/` (presentation, domain, application, data, di), регистрация в `cliModule()`, подключение в `DsBuilderCli.execute()`.
- Зависимости: `okio` или `kotlinx-io` (для zip в commonMain), `kotlinx.serialization` (уже есть).
- API backend-сервисов: добавляется consumer к `POST /documentation/bundles` (заглушка).
- Persistence, Docker runtime, остальные микросервисы не меняются.
- Проверка должна включать `cd dsbuilder-frontend/cli && ./gradlew build`, `./gradlew detekt`, `./gradlew spotlessCheck` и `./gradlew test`.
