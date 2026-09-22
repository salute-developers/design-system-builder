## Why

Агентские сценарии DS Builder должны уметь не только проверить локальный контекст проекта, но и получить предметный контекст дизайн-системы: документацию, code bindings, системные токены и конфигурации компонентов. Сейчас MCP server имеет только начальный read-only срез `design_system_get_context` и `project_get_status`, поэтому агентам приходится обращаться к CLI или угадывать структуру backend API.

## What Changes

- Добавить read-only MCP tools для поиска и чтения опубликованной документации.
- Добавить read-only MCP tools для поиска и чтения code bindings из опубликованных documentation artifacts.
- Добавить read-only MCP tools для чтения системных токенов, token values, компонентов, component config, component styles и variations.
- Сократить model-visible ответы MCP локальными presentation projections: компактными списками токенов и компонентов,
  удалением производного documentation `searchText` и уровнями детализации component code binding
  `summary` / `variations` / `full` с точными фильтрами appearance/variation names.
- Зафиксировать, что `documentation_*` и `code_binding_*` не являются source of truth для системной модели.
- Зафиксировать предметный read API для токенов и компонентов через существующий gateway route `/api/projects/{projectId}/ds/...`: доработать db-service read handlers так, чтобы они учитывали trusted project headers, поддерживали фильтрацию без backend pagination в первой версии и возвращали стабильные DTO.
- Не добавлять write tools в этом change: изменение токенов и компонентов требует отдельного архитектурного решения по validation, concurrency, audit и idempotency.

## Capabilities

### New Capabilities

- `design-system-model-api`: read-only API для получения системных токенов, token values, компонентов, component config, component styles и variations из authoritative DS Builder model.

### Modified Capabilities

- `frontend-mcp-server`: расширение локального MCP server новыми read-only tools для документации, code bindings, токенов и компонентов.

## Impact

- `frontend-kt/mcp-server-core`: новые tool definitions, input schemas, DTO маппинг и structured error mapping.
- `frontend-kt/feature-docs`: read-only application use cases/ports для documentation search/fetch/navigation/page и code bindings.
- `frontend-kt/feature-theme`: read-only application use cases/ports для токенов и token values.
- `frontend-kt/feature-components`: read-only application use cases/ports для компонентов, component config, styles и variations.
- `js/services/db-service`: стабилизация существующих design-system subresource routes и `POST /ds/component-config/export` под MCP/API read contract.
- `backend-kt/identity-gateway`: использование существующей project-scoped маршрутизации `/api/projects/{projectId}/ds/...` и trusted headers для новых MCP read scenarios.
- `openspec`: delta к `frontend-mcp-server` и новый capability spec для `design-system-model-api`.
