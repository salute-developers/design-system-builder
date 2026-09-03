## Why

Ручка импорта конфигураций компонентов живёт по пути `POST /ds/design-systems/{id}/components:import`. Двоеточие в пути — чужеродный для этого API custom method: оно вынуждает объявлять роут как `/:id/:action` и сверять действие вручную, монтировать роутер до `designSystemsRouter` из-за конфликта шаблонов и обходить общий `validateBody`. Побочный эффект обхода — путь не валидирует `{id}` как uuid, и запрос с некорректным идентификатором отвечает 500 вместо 404.

Содержательно ручка принадлежит `component-config`: `GET /ds/component-config` отдаёт конфигурацию компонента в common-формате, импорт принимает тот же формат пакетом. Это две стороны одного ресурса, разнесённые по разным путям.

## What Changes

- **BREAKING** Путь импорта меняется на `POST /ds/component-config/import`; прежний `POST /ds/design-systems/{id}/components:import` удаляется без deprecated-алиаса.
- `designSystemId` переезжает из сегмента пути в тело запроса и валидируется как uuid вместе с остальным телом — так же, как во всех остальных POST этого API.
- CLI `dsbuilder components push` отправляет запрос по новому пути и кладёт `designSystemId` в тело.
- Формат ответа, семантика `dryRun`, требование scope `components:write` и правила отчёта не меняются.

## Capabilities

### New Capabilities

Новых capability нет.

### Modified Capabilities

- `cli-components`: требование «Components push backend contract» фиксирует новый путь и состав тела запроса.

## Impact

- `dsbuilder-frontend/cli` — `PushComponentsUseCase` (путь запроса, модель `ImportRequest`), тесты `PushComponentsUseCaseTest` и `CliCoreWriteSupportTest`.
- Соседний репозиторий `design-system-builder`, сервис `db-service` — роутер импорта переезжает под `/ds/component-config`, снимаются костыли в `routes/index.ts`, обновляется `openapi/spec.ts` и регенерируются типы `apps/admin`. Правки выполняются в том репозитории по его CLAUDE.md (`/sync-spec`, `/sync-api-types`).
- `identity-gateway` не затрагивается: location `~ ^/api/projects/([^/]+)/ds(/.*)?$` покрывает новый путь, `client_max_body_size 16m` и `auth_request` остаются прежними.
- Совместимость: CLI и backend обязаны выкатываться вместе — старый путь перестаёт отвечать.
