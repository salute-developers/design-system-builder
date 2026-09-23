## Context

Gateway уже аутентифицирует `user` и `project_key` actors, разрешает доступ к project-scoped route и передаёт downstream trusted headers. Однако Gateway не принимает решение о конкретной бизнес-операции. Projects Service хранит каталог допустимых access-key scopes в `application.yaml` и применяет собственный `ProjectAccessPolicy`; Documentation Service отдельно интерпретирует `X-Project-Role` и сейчас разрешает загрузку bundle любому валидному project key.

Роли описаны в `openspec/architecture/Roles.md`, а более точные правила проектов и участников — в ADR-0001. Ни один из документов не является machine-readable runtime contract. Change затрагивает два Kotlin-сервиса и вводит security-sensitive общий контракт, но не меняет persistence schema, Gateway routing или публичные DTO.

## Goals / Non-Goals

**Goals:**

- Ввести единый versioned каталог permissions, project roles и допустимых project-key scopes.
- Дать Kotlin-сервисам общий fail-closed evaluator без зависимости domain/application слоёв от Ktor.
- Сохранить текущее поведение Projects Service и его ресурсные инварианты.
- Применить `documentation:read` и `documentation:write` во всех private documentation endpoints.
- Сохранить разделение permission check и resource ownership check.
- Подготовить language-neutral contract и fixtures для будущего TypeScript evaluator в отдельном `db-service` change.

**Non-Goals:**

- Авторизация `db-service`, `generator`, `documentation-generator`, `publisher` или `project-publisher`.
- Описание HTTP route patterns в центральной policy.
- Изменение Gateway trusted-header contract или перенос бизнес-авторизации в nginx/Auth Helper.
- PostgreSQL RLS, изменение ownership-модели или миграция данных.
- Dynamic reload policy без рестарта сервисов.
- Автоматическое добавление documentation scopes существующим project keys.

## Decisions

### 1. Canonical policy является language-neutral JSON artifact

В корне репозитория создаётся каталог `authorization/` с canonical `policy.json`, JSON Schema и conformance fixtures. Policy содержит `schemaVersion`, `policyVersion`, каталог permissions, роли с `inherits`/`grants`, допустимые project-key scopes и `system_admin` override.

JSON выбран вместо runtime YAML, потому что одинаково и строго разбирается Kotlin и TypeScript, не требует YAML-зависимости и позволяет валидировать один schema contract. Документация может показывать сокращённые YAML-примеры, но source of truth остаётся JSON.

Policy поставляется внутри service image как immutable release artifact. Сервис загружает её при старте, логирует `policyVersion` и hash и не обслуживает traffic, если schema, inheritance graph или ссылки на permissions некорректны.

Альтернатива — хранить grants отдельно в конфигурации каждого сервиса. Она отклонена из-за drift. Dynamic configuration service также отклонён: он добавляет сетевую зависимость и сложный rollout до появления потребности в runtime policy updates.

### 2. Общий Kotlin evaluator не зависит от HTTP и persistence

В `backend-kt` создаётся небольшой reusable authorization module/build, подключаемый Projects Service и Documentation Service. Он содержит модели policy, loader/validator и pure evaluator вида `isAllowed(principal, permission)`; Ktor headers, Exposed и service-specific repositories в модуль не входят.

Presentation каждого сервиса преобразует trusted headers в локальный `ProjectPrincipal`. Application/use-case слой получает principal и требуемый permission через абстракцию evaluator. DI связывает evaluator с file-backed policy loader.

Альтернатива — дублировать evaluator в двух сервисах. Она уменьшает Gradle wiring, но создаёт два толкования наследования и fail-closed правил. Выделение отдельного authorization microservice отклонено как лишняя network dependency на каждый запрос.

### 3. Policy отвечает за capability, сервис — за ownership и инварианты

Central policy не содержит HTTP routes и не обращается к данным сервисов. Endpoint явно выбирает permission. После успешной permission-проверки service repository/use case ограничивает данные trusted `projectId`.

Documentation Service продолжает скрывать resource другого project через `404 Not Found`. Недостаток permission возвращает `403 Forbidden`. Отсутствующий или противоречивый trusted context отклоняется до чтения body и до побочных эффектов.

Projects Service сохраняет в коде правила, зависящие от target resource и состояния: единственный Owner, запрет управления Owner через members, ограничения project key, immutable archived project. Policy заменяет только role/scope grants, но не эти инварианты.

### 4. User actor и project key используют один namespace permissions

Для user actor evaluator разворачивает inheritance effective project role и проверяет grant. Для project key evaluator проверяет точное присутствие permission в trusted scopes. `system_admin` получает override, но ownership-aware сервисы всё равно используют trusted project context для адресации запроса и audit.

Documentation использует только `documentation:read` и `documentation:write`. Отдельный `documentation:publish` не вводится, пока загрузка bundle является единственной изменяющей операцией.

### 5. Gateway остаётся authentication/context boundary

Gateway продолжает удалять client-provided trusted headers и передавать нормализованные `X-Actor-Type`, `X-Project-Id`, `X-Project-Role`, `X-Project-Key-Id`, `X-Project-Scopes` и `X-System-Admin`. Он не загружает policy и не сопоставляет HTTP paths с permissions.

Это сохраняет routing простым и оставляет authorization decision в сервисе, который понимает семантику операции и ownership.

## Risks / Trade-offs

- [Risk] Policy artifact и service image могут разойтись при частичном rollout. → Policy копируется в image на build, версия/hash логируются, а rollout выполняется в определённом порядке.
- [Risk] Ошибка policy может остановить оба сервиса. → JSON Schema, startup validation и общие conformance fixtures выполняются до упаковки image; runtime работает fail-closed.
- [Risk] Общий Kotlin build связывает release двух сервисов. → Модуль остаётся малым, pure и без service-specific dependencies; language-neutral JSON contract остаётся главным API.
- [Risk] Существующие project keys потеряют доступ к documentation. → Change считается breaking; новые scopes сначала становятся допустимыми в Projects Service, затем ключи перевыпускаются, и только после этого включается enforcement Documentation Service.
- [Risk] Permission check может ошибочно заменить ownership check. → Specs и тесты отдельно проверяют `403` для недостаточного permission и `404` для foreign-project resource.
- [Trade-off] Policy обновляется только с deployment. → Это упрощает согласованность; hot reload можно добавить отдельным change при реальной потребности.

## Migration Plan

1. Добавить и валидировать canonical policy, schema, fixtures и общий Kotlin evaluator.
2. Перевести Projects Service на каталог scopes из policy, сохранив текущие authorization tests и поведение endpoints.
3. Развернуть Projects Service, чтобы новые ключи могли получить `documentation:read` и `documentation:write`.
4. Перевыпустить используемые CLI/MCP project keys с минимально необходимыми documentation scopes; автоматический grant старым ключам не выполняется.
5. Перевести ingestion/read/search Documentation Service на общий evaluator и развернуть его после подготовки ключей.
6. Проверить user roles, `system_admin`, scoped keys, отсутствие scope, invalid context и foreign-project ownership в local contour.

Rollback: вернуть предыдущую версию Documentation Service; дополнительные scopes останутся валидными, но не будут использоваться старой версией. Projects Service и policy можно оставить развернутыми, поскольку их миграция не меняет прежние project/member/access-key разрешения.

## Open Questions

- Нужно ли предоставлять операционный отчёт или скрипт для поиска активных project keys, которые используются documentation clients и требуют перевыпуска?
- Должен ли `policyVersion` включаться только в logs/health или также передаваться внутренним response header для диагностики rollout?
