## Context

`dsbuilder-frontend` является отдельным Gradle build, но сейчас он ориентирован на Compose Desktop: `settings.gradle.kts` включает `desktopApp` и `shared`, а root `build.gradle.kts` держит Compose-related plugins. Для текущей итерации нужен не desktop UI, а CLI приложение `dsbuilder`, которое станет entrypoint для будущих операций над дизайн-системами: validate/build/publish workflow, работа с токенами, темами и артефактами.

Общий `build-system` уже содержит precompiled convention plugins для JVM/Ktor модулей, root tasks, Detekt и Spotless. Kotlin Multiplatform convention отсутствует, поэтому frontend build не может переиспользовать общий подход без ручного копирования plugin setup.

## Goals / Non-Goals

**Goals:**
- Перевести `dsbuilder-frontend` на минимальную структуру с одним модулем `cli`.
- Сделать `cli` Kotlin Multiplatform модулем с JVM target для запуска CLI приложения и базовым `commonMain`/`commonTest` кодом.
- Убрать `desktopApp` и `shared` из активного frontend build до отдельного возврата desktop UI.
- Добавить reusable convention plugin в `build-system` для Kotlin Multiplatform модулей.
- Подключить frontend build к `build-system` conventions и общим quality tasks.

**Non-Goals:**
- Не реализовывать полноценные команды для build/publish pipeline, интеграции с registry или backend API.
- Не добавлять Docker runtime: CLI модуль не является production microservice и не открывает порт/healthcheck.
- Не возвращать Compose Desktop UI и не переносить текущую UI-логику в новый модуль.
- Не менять backend-сервисы, persistence model или публичные HTTP/WebSocket API.

## Decisions

1. `dsbuilder-frontend` остаётся отдельным included build-кандидатом, а не становится обычным subproject root build.

   Такой подход сохраняет текущую изоляцию frontend Gradle wrapper/settings и не смешивает frontend lifecycle с backend сервисами. Альтернатива - включить `dsbuilder-frontend` в root `settings.gradle.kts` через `includeBuild("dsbuilder-frontend")`; это можно сделать позднее, если root build должен запускать frontend проверки. В рамках change достаточно настроить сам frontend build на conventions из `build-system`.

2. Новый модуль называется `:cli`, а исполняемое приложение - `dsbuilder`.

   Имя модуля отражает техническую роль, а имя приложения совпадает с пользовательским CLI entrypoint. Альтернатива - назвать модуль `:dsbuilder-cli`, но в отдельном frontend build это избыточно и ухудшает читаемость Gradle paths.

3. CLI строится как Kotlin Multiplatform с обязательным JVM target.

   JVM target даёт простой запуск через Gradle `run`/application tasks и совместим с текущим Kotlin/Gradle стеком репозитория. Kotlin Multiplatform оставляет возможность добавить native targets позже, не меняя contract модуля. Альтернатива - Kotlin/JVM-only модуль; она проще, но не выполняет требование мультиплатформенного CLI и создаёт миграцию в будущем.

4. `desktopApp` и `shared` удаляются из active build, а не оставляются отключенными.

   Это убирает Compose dependencies и tasks из текущей итерации, снижая шум в build и статическом анализе. Альтернатива - оставить модули в репозитории без include; она сохраняет файлы, но создаёт двусмысленность вокруг поддерживаемого frontend состояния. При реализации нужно удалить или архивировать только явно устаревшие модульные build scripts/source trees, не затрагивая unrelated IDE files.

5. Новый convention plugin `convention.kotlin-multiplatform-module` живёт в `build-system/conventions`.

   Plugin должен применять `org.jetbrains.kotlin.multiplatform`, `convention.detekt` и `convention.spotless`, задавать общий JVM target/source-set baseline и подключать `kotlin.test` для `commonTest` через version catalog. Альтернатива - прописать это напрямую в `dsbuilder-frontend/cli/build.gradle.kts`; это быстрее, но нарушает требование использовать conventions и не масштабируется на будущие frontend/shared модули.

6. CLI логика разделяется на минимальный application surface и entrypoint.

   `commonMain` должен содержать небольшую публичную модель/функцию для разбора базового вызова и формирования результата, а `jvmMain` - `main` entrypoint. Это сохраняет тестируемость в `commonTest` и не протаскивает platform-specific детали в common код. Полные слои `presentation -> application -> domain -> data -> di` пока не нужны, потому что business behavior минимален; при появлении реальных команд их нужно вводить по этим границам.

## Risks / Trade-offs

- [Risk] Удаление `desktopApp` и `shared` ломает существующие Compose Desktop tasks → Mitigation: явно отметить это как breaking в proposal/tasks и оставить scope только на текущий CLI bootstrap.
- [Risk] Kotlin version в `dsbuilder-frontend/gradle/libs.versions.toml` отличается от root catalog → Mitigation: при реализации синхронизировать frontend catalog с совместимой версией или перевести plugin versions на общий catalog pattern, затем проверить `build-system` и frontend build.
- [Risk] Convention plugin может не скомпилироваться из-за отсутствия Kotlin Multiplatform Gradle plugin dependency в `build-system` → Mitigation: добавить нужную Gradle plugin dependency в `build-system/conventions/build.gradle.kts` через version catalog и проверить `cd build-system && ./gradlew build`.
- [Risk] CLI bootstrap окажется слишком пустым для тестирования → Mitigation: добавить минимальное поведение `--version`/help или результат по умолчанию, покрытый `commonTest`.
- [Risk] Root aggregate tasks не увидят frontend build, если он не включён в root settings → Mitigation: считать это осознанным ограничением change; при необходимости оформить отдельное изменение на root integration.
