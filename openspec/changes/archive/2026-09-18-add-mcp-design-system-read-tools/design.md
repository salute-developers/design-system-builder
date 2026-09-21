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
Для больших component bindings он также локально проецирует полный backend response по запрошенному уровню
`detail`: компактный `summary` используется по умолчанию, `variations` возвращает конкретные code references без
style API metadata, а `full` сохраняет полный опубликованный payload. Точные `appearanceNames`
(`styles[].styleName`) и `variationNames` (`styles[].variations[].name`) дополнительно сужают результат; переданные
`variationNames` автоматически выбирают `variations`, если `detail` не указан. Эти значения остаются непрозрачными
пользовательскими именами: MCP не вводит фиксированные оси вроде `size` или `view`, а backend contract и сохраненный
publication payload не меняются.

Для model-visible ответов MCP также применяет компактные presentation projections без изменения backend API:

- `tokens_list` возвращает только `id`, `name`, `type`, `displayName`, `description`, а `components_list` — только
  `id`, `name`, `description`;
- optional `name` переиспользует существующий backend `query`, после чего MCP проверяет точное case-sensitive
  совпадение; `name` и substring-`query` взаимоисключающие;
- явный `limit` применяется локально, но при отсутствии `limit` MCP не вводит неявное ограничение;
- `documentation_fetch` исключает производный `searchText`, сохраняя published `markdown` и source metadata;
- `component_config_get` адресует export только через canonical `subject` или exact component `name`, потому что
  backend export фильтрует `componentName`, а не UUID `componentId`.

Альтернатива: реализовать HTTP calls прямо в `mcp-server-core`. Она отклонена, потому что нарушает ADR-0004 и не даст переиспользовать логику в CLI, desktop и IDE plugins.

### Зафиксировать предметный model API вместо generic endpoint

Для токенов и компонентов нужен project-scoped read API через gateway/db-service. Endpoints должны возвращать явные DTO для MCP/frontend clients и не сериализовать persistence rows напрямую.

Альтернатива: добавить один endpoint вида `GET /design-system-model?entity=...`. Она отклонена, потому что слабее типизируется, хуже документируется, сложнее авторизуется scopes и приближает систему к generic proxy.

Минимальный backend contract для этого change использует существующий gateway route `/api/projects/{projectId}/ds/...`, который переписывается в db-service `/api/ds/...` и добавляет trusted headers `X-Project-Id`, `X-Project-Scopes`, `X-System-Admin`:

- `GET /ds/design-systems/{designSystemId}/tokens`: существующий subresource route остается основой, но должен проверять доступность design system через trusted project context, требовать `tokens:read` для project key, поддерживать `type` и `query` без изменения array response shape.
- `GET /ds/tokens/{tokenId}`: существующий ID-based lookup получает project/scope checks и используется MCP без дублирующего design-system lookup route.
- `GET /ds/tokens/{tokenId}/values`: существующий ID-based route получает project/scope checks и фильтры `tenantId`, `mode`, `platform`.
- `GET /ds/design-systems/{designSystemId}/components`: существующий subresource route остается основой, но должен проверять доступность design system через trusted project context, требовать `components:read` для project key, поддерживать `query` без изменения array response shape.
- `GET /ds/components/{componentId}`: существующий ID-based lookup получает project/scope checks и используется MCP без дублирующего design-system lookup route.
- `POST /ds/component-config/export`: существующий endpoint остается package-level read contract для authoritative canonical common component config и расширяется optional-фильтрами `components` и `styles`, чтобы MCP мог читать один component/style без выгрузки всего пакета.
- `GET /ds/design-systems/{designSystemId}/components/{componentId}/styles`: новый агрегирующий read route для styles всех variations компонента в design system; он избегает N+1 запросов.
- `GET /ds/components/{componentId}/variations`: существующий ID-based route получает project/scope checks и используется MCP.

Gateway route добавлять не нужно, если существующий `/api/projects/{projectId}/ds/...` покрывает эти paths. db-service должен применять `designSystemScopeFilter`/`designSystemBelongsToScope` или эквивалентную проверку во всех design-system subresource handlers, чтобы одного знания `designSystemId` было недостаточно для чтения данных чужого проекта.

Существующие ID-based routes `/ds/tokens/{id}` и `/ds/components/{id}` являются MCP contract после добавления project/scope checks. Design-system subresource routes сохраняются для списков и единственного агрегирующего component styles чтения.

Для `js/apps/client` change должен быть backward-compatible: нельзя ломать существующие legacy/UI endpoints и response shapes, используемые web-клиентом. Для `frontend-kt/cli` допустима синхронная адаптация к новым DTO/use cases, потому что CLI и MCP развиваются поверх одного `frontend-kt` application layer.

Backend pagination для token/component model reads в этот change не входит. MCP tools могут принимать `limit` как локальное ограничение результата, но backend list endpoints остаются array-based в первой версии.

### Оставить write tools за пределами change

Write tools будут проектироваться отдельным change после read surface. Для них нужно отдельно решить concurrency, validation, audit, idempotency и формат patch.

Альтернатива: сразу добавить create/update/delete tools с простыми REST вызовами. Она отклонена, потому что агентские write-сценарии требуют предсказуемой безопасности и конфликтной модели, а не только защиты уникальными индексами БД.

## Risks / Trade-offs

- [Risk] Read tools могут вернуть расходящиеся данные из documentation publication и system model. → Mitigation: в MCP contract явно разделить `documentation_*`/`code_binding_*` и `tokens_*`/`component_*`, а ответы снабжать `source`, `version`, `platform` и `publicationId` там, где применимо.
- [Risk] Существующие db-service endpoints могут быть нестабильными или слишком связанными с UI. → Mitigation: зафиксировать отдельный `design-system-model-api` contract и добавить DTO mapping на API boundary.
- [Risk] Расширение MCP увеличит число backend-dependent tools и вариантов ошибок. → Mitigation: использовать общий error envelope с существующими кодами `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `BACKEND_UNAVAILABLE`, `CONTEXT_NOT_FOUND` и добавить предметные `INVALID_QUERY`, `PUBLICATION_NOT_FOUND`.
- [Risk] Локальный `limit` без backend pagination может скрыть подходящие элементы. → Mitigation: MCP не задаёт
  default limit; exact `name` и substring `query` сначала сужают backend array, а ограничение применяется только по
  явному запросу caller.
- [Risk] В `frontend-kt` появится дублирование с CLI fetch-сценариями. → Mitigation: read use cases должны возвращать model DTO без записи в `.sdds`; fetch use cases остаются отдельными сценариями локальной синхронизации.

## Migration Plan

1. Доработать существующие db-service read handlers: project/scope checks для design-system subresources, фильтрацию без backend pagination, DTO responses и optional-фильтры `components`/`styles` для `POST /ds/component-config/export`.
2. Добавить application ports/use cases в `frontend-kt` для documentation, code bindings, tokens и components.
3. Реализовать adapters к backend API в data layer.
4. Зарегистрировать новые tools в `:mcp-server-core` с typed schemas и structured results.
5. Добавить contract/unit tests для tools/list, tools/call, validation, error mapping и отсутствия secrets в output.
6. Проверить `frontend-kt` build и затронутые JS/backend checks.

Rollback не требует миграции данных: change добавляет read-only endpoints/tools. При проблемах новые MCP tools можно убрать из registry, сохранив существующие `design_system_get_context` и `project_get_status`.
