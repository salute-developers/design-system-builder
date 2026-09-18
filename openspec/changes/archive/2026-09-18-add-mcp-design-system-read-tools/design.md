## Context

ADR-0004 определяет локальный MCP server как отдельный интерфейс к общему application layer `frontend-kt`, а не как shell-обертку над CLI и не как универсальный REST proxy. Текущая реализация `:mcp-server-core` предоставляет только начальные read-only tools `design_system_get_context` и `project_get_status`.

Для агентских сценариев этого недостаточно. Агенту нужно сначала найти контекст в документации, затем прочитать точный code binding, а после этого получить authoritative состояние токена или компонента в системной модели DS Builder. Documentation artifacts полезны для объяснений и references, но не должны становиться источником истины для token/component model.

## Goals / Non-Goals

**Goals:**

- Добавить read-only MCP tools для documentation search/fetch/navigation/page.
- Добавить read-only MCP tools для code bindings.
- Добавить read-only MCP tools для authoritative token/component model.
- Зафиксировать backend/gateway read API, который MCP и будущие локальные клиенты смогут использовать через общий application layer.
- Сохранить совместимость с `js/apps/client` для существующих UI-сценариев; `frontend-kt/cli` можно адаптировать в рамках общего application layer.
- Сохранить существующую границу: MCP SDK types остаются внутри `:mcp-server-core`, а бизнес-логика живет в `feature-*` и `core-*`.

**Non-Goals:**

- Не добавлять write tools для токенов и компонентов.
- Не проектировать `dryRun`, optimistic concurrency, idempotency, audit и typed patches.
- Не добавлять удаленный MCP transport.
- Не делать MCP универсальным `call_rest_endpoint`.
- Не восстанавливать системные токены и component config из опубликованной документации.

## Decisions

### Разделить documentation, code bindings и system model

MCP tools делятся на три смысловые группы:

- `documentation_*` читает опубликованные страницы и knowledge chunks из documentation service.
- `code_binding_*` читает references из опубликованных info artifacts.
- `tokens_*` и `component_*` читают authoritative state из DS Builder model API.

Альтернатива: получать токены и component config из `theme-info.json` и `components-info.json` в publication. Она отклонена, потому что published artifacts могут отставать от системной модели, могут быть собраны для конкретной platform/version и не обязаны содержать все поля, нужные для редактирования или проверки текущего состояния.

### Добавить application-level read use cases в `frontend-kt`

Для новых MCP tools добавляются use cases/ports в существующие feature-модули:

- `feature-docs`: documentation search/fetch/navigation/page и code binding read scenarios.
- `feature-theme`: token list/get/value read scenarios. Отдельный `feature-tokens` не вводится, потому что tokens являются частью theme domain и без них theme-функциональность не имеет смысла.
- `feature-components`: component list/get/config/styles/variations read scenarios.

`mcp-server-core` выполняет только input validation, вызов use case и mapping результата в MCP DTO.

Альтернатива: реализовать HTTP calls прямо в `mcp-server-core`. Она отклонена, потому что нарушает ADR-0004 и не даст переиспользовать логику в CLI, desktop и IDE plugins.

### Зафиксировать предметный model API вместо generic endpoint

Для токенов и компонентов нужен project-scoped read API через gateway/db-service. Endpoints должны возвращать явные DTO для MCP/frontend clients и не сериализовать persistence rows напрямую.

Альтернатива: добавить один endpoint вида `GET /design-system-model?entity=...`. Она отклонена, потому что слабее типизируется, хуже документируется, сложнее авторизуется scopes и приближает систему к generic proxy.

Минимальный backend contract для этого change использует существующий gateway route `/api/projects/{projectId}/ds/...`, который переписывается в db-service `/api/ds/...` и добавляет trusted headers `X-Project-Id`, `X-Project-Scopes`, `X-System-Admin`:

- `GET /ds/design-systems/{designSystemId}/tokens`: существующий subresource route остается основой, но должен проверять доступность design system через trusted project context, требовать `tokens:read` для project key, поддерживать `type` и `query` без изменения array response shape.
- `GET /ds/design-systems/{designSystemId}/tokens/{tokenIdOrName}`: новый точечный lookup по ID или canonical name внутри design system с теми же project/scope checks.
- `GET /ds/design-systems/{designSystemId}/tokens/{tokenIdOrName}/values`: новый read route для token values с фильтрами `tenantId`, `themeId`, `mode`, `platform`.
- `GET /ds/design-systems/{designSystemId}/components`: существующий subresource route остается основой, но должен проверять доступность design system через trusted project context, требовать `components:read` для project key, поддерживать `query` без изменения array response shape.
- `GET /ds/design-systems/{designSystemId}/components/{componentIdOrName}`: новый точечный lookup по ID или canonical name внутри design system.
- `POST /ds/component-config/export`: существующий endpoint остается package-level read contract для authoritative canonical common component config и расширяется optional-фильтрами `components` и `styles`, чтобы MCP мог читать один component/style без выгрузки всего пакета.
- `GET /ds/design-systems/{designSystemId}/components/{componentIdOrName}/styles`: новый read route для styles компонента в design system.
- `GET /ds/design-systems/{designSystemId}/components/{componentIdOrName}/variations`: новый read route для variations компонента с model identifiers.

Gateway route добавлять не нужно, если существующий `/api/projects/{projectId}/ds/...` покрывает эти paths. db-service должен применять `designSystemScopeFilter`/`designSystemBelongsToScope` или эквивалентную проверку во всех design-system subresource handlers, чтобы одного знания `designSystemId` было недостаточно для чтения данных чужого проекта.

Существующие generic CRUD routes `/ds/tokens`, `/ds/token-values`, `/ds/components`, `/ds/styles` не считаются достаточным MCP contract сами по себе. Существующие `/ds/design-systems/{id}/tokens` и `/ds/design-systems/{id}/components` ближе к нужному контракту, но требуют project/scope checks, фильтрации и DTO boundary.

Для `js/apps/client` change должен быть backward-compatible: нельзя ломать существующие legacy/UI endpoints и response shapes, используемые web-клиентом. Для `frontend-kt/cli` допустима синхронная адаптация к новым DTO/use cases, потому что CLI и MCP развиваются поверх одного `frontend-kt` application layer.

Backend pagination для token/component model reads в этот change не входит. MCP tools могут принимать `limit` как локальное ограничение результата, но backend list endpoints остаются array-based в первой версии.

### Оставить write tools за пределами change

Write tools будут проектироваться отдельным change после read surface. Для них нужно отдельно решить concurrency, validation, audit, idempotency и формат patch.

Альтернатива: сразу добавить create/update/delete tools с простыми REST вызовами. Она отклонена, потому что агентские write-сценарии требуют предсказуемой безопасности и конфликтной модели, а не только защиты уникальными индексами БД.

## Risks / Trade-offs

- [Risk] Read tools могут вернуть расходящиеся данные из documentation publication и system model. → Mitigation: в MCP contract явно разделить `documentation_*`/`code_binding_*` и `tokens_*`/`component_*`, а ответы снабжать `source`, `version`, `platform` и `publicationId` там, где применимо.
- [Risk] Существующие db-service endpoints могут быть нестабильными или слишком связанными с UI. → Mitigation: зафиксировать отдельный `design-system-model-api` contract и добавить DTO mapping на API boundary.
- [Risk] Расширение MCP увеличит число backend-dependent tools и вариантов ошибок. → Mitigation: использовать общий error envelope с существующими кодами `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `BACKEND_UNAVAILABLE`, `CONTEXT_NOT_FOUND` и добавить предметные `INVALID_QUERY`, `PUBLICATION_NOT_FOUND`.
- [Risk] В `frontend-kt` появится дублирование с CLI fetch-сценариями. → Mitigation: read use cases должны возвращать model DTO без записи в `.sdds`; fetch use cases остаются отдельными сценариями локальной синхронизации.

## Migration Plan

1. Доработать существующие db-service read handlers: project/scope checks для design-system subresources, фильтрацию без backend pagination, DTO responses и optional-фильтры `components`/`styles` для `POST /ds/component-config/export`.
2. Добавить application ports/use cases в `frontend-kt` для documentation, code bindings, tokens и components.
3. Реализовать adapters к backend API в data layer.
4. Зарегистрировать новые tools в `:mcp-server-core` с typed schemas и structured results.
5. Добавить contract/unit tests для tools/list, tools/call, validation, error mapping и отсутствия secrets в output.
6. Проверить `frontend-kt` build и затронутые JS/backend checks.

Rollback не требует миграции данных: change добавляет read-only endpoints/tools. При проблемах новые MCP tools можно убрать из registry, сохранив существующие `design_system_get_context` и `project_get_status`.
