## Why

Текущий backend разворачивается как набор Kotlin- и Node.js-сервисов с отдельными образами, конфигурациями и lifecycle, хотя основные Kotlin capabilities изменяются и эксплуатируются как единое приложение. DS Builder нужен единый deployment unit, который уменьшит стоимость сборки, настройки, запуска и поддержки без изменения публичных API и без преждевременного переноса проверенной gateway-логики из nginx.

## What Changes

- Добавляется `backend-kt/monolith/app` — единый Ktor application с одним engine, общей конфигурацией, DI, health/readiness и lifecycle для Identity, Projects и Documentation capabilities.
- Kotlin feature-модули получают переиспользуемые route, DI и runtime entrypoints; старые самостоятельные `app`-модули и скрипты сохраняются на время параллельного перехода.
- Внутреннее взаимодействие Kotlin capabilities переводится на типизированные application contracts без HTTP и повторной аутентификации; nginx остаётся только внешней trust boundary.
- Kotlin monolith обращается к `js/services/db-service` напрямую по loopback HTTP, передавая уже проверенный trusted actor context и не направляя internal traffic через nginx.
- Добавляется корневой multi-stage Dockerfile, упаковывающий nginx, Kotlin monolith и Node.js `db-service` в один контейнер с fail-fast supervision: завершение любого обязательного процесса завершает весь контейнер.
- Добавляются новый docker-compose contour и отдельный root-скрипт запуска для монолита и локальных внешних интеграций Keycloak, PostgreSQL и S3-compatible storage; существующие compose-файлы и скрипты не удаляются.
- Production image delivery расширяется новым единым backend image; deprecated `project-publisher`, `generator`, `publisher` и `documentation-generator` не входят в новый runtime.

## Capabilities

### New Capabilities

- `backend-monolith-runtime`: Единый Ktor runtime, in-process взаимодействие Kotlin capabilities, direct loopback integration с `db-service`, агрегированный lifecycle и локальный monolith deployment contour.

### Modified Capabilities

- `container-image-delivery`: Добавляется сборка и публикация единого backend monolith image параллельно существующему набору образов на период миграции.

## Impact

- `backend-kt/settings.gradle.kts` и новый `backend-kt/monolith/app` для Gradle composite dependencies, Ktor composition root, Koin graph, configuration, health и lifecycle.
- `backend-kt/identity-gateway/feature-auth`, `backend-kt/projects-service/feature-projects` и `backend-kt/documentation-service/feature-*` для публичных application/route/runtime contracts, пригодных для композиции в одном engine.
- `js/services/db-service` для loopback-only runtime binding и доверенного internal caller contract без изменения source-of-truth схемы данных.
- `backend-kt/identity-gateway/gateway` для upstream-маршрутизации к одному Kotlin monolith port и локальному `db-service` при сохранении существующих публичных paths и authorization semantics.
- Корень репозитория для нового Dockerfile, docker-compose и start script; старые deployment paths остаются доступными.
- GitHub Actions image delivery и deployment configuration для нового monolith image.
- Публичные REST contracts, project authorization rules, persistence schemas и frontend deployment этим изменением не меняются.
