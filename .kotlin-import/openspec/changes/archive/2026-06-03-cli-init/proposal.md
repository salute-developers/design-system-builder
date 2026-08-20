## Why

`dsbuilder-frontend` сейчас собран вокруг Compose Desktop модулей `desktopApp` и `shared`, но ближайшая потребность продукта - CLI entrypoint для автоматизации сборки, валидации и публикации артефактов дизайн-систем. Нужен минимальный мультиплатформенный CLI-модуль `dsbuilder`, который использует общие Gradle conventions репозитория и готовит frontend build к дальнейшим pipeline/integration сценариям.

## What Changes

- Добавить в `dsbuilder-frontend` новый Kotlin Multiplatform модуль `cli` для CLI приложения `dsbuilder`.
- **BREAKING**: временно убрать модули `desktopApp` и `shared` из `dsbuilder-frontend`, включая их подключение в `settings.gradle.kts` и зависимые build scripts.
- Подключить `dsbuilder-frontend` к conventions из `build-system`, чтобы frontend build использовал общий подход к Detekt, Spotless и root tasks.
- Добавить в `build-system` Gradle convention для Kotlin Multiplatform модулей, пригодный для CLI и будущих frontend/shared модулей.
- Настроить CLI entrypoint, source sets и базовые тесты так, чтобы модуль можно было собирать и проверять через Gradle без Compose Desktop.

## Capabilities

### New Capabilities
- `frontend-cli`: CLI приложение `dsbuilder` в `dsbuilder-frontend`, собранное как Kotlin Multiplatform модуль.
- `kotlin-multiplatform-conventions`: общий Gradle convention plugin для Kotlin Multiplatform модулей.

### Modified Capabilities
- Нет.

## Impact

- Затронуты `dsbuilder-frontend/settings.gradle.kts`, `dsbuilder-frontend/build.gradle.kts`, version catalog frontend build и структура модулей внутри `dsbuilder-frontend`.
- Затронут `build-system/conventions`: появится новый convention plugin для Kotlin Multiplatform и, при необходимости, зависимости Gradle plugin classpath.
- Удаление `desktopApp` и `shared` меняет локальные Gradle tasks frontend build; Compose Desktop packaging больше не будет доступен до отдельного возврата desktop UI.
- API backend-сервисов, persistence, Docker runtime и существующие микросервисы не меняются.
- Проверка должна включать `cd build-system && ./gradlew build` и релевантные команды для `dsbuilder-frontend`, включая `./gradlew build`, `./gradlew detekt`, `./gradlew spotlessCheck` и `./gradlew test`.
