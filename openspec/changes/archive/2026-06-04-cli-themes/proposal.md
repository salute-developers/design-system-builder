## Why

CLI `dsbuilder` уже умеет работать в project-scoped context, но пока не может загрузить темы дизайн-системы и связанные token values в локальную `.sdds` структуру. Это нужно, чтобы разработчики и CI могли синхронизировать themes из backend DS Builder перед генерацией артефактов дизайн-системы.

## What Changes

- Добавить новую CLI feature `theme` с подкомандой `fetch`.
- Зарезервировать command surface для будущей подкоманды `theme generate`, не реализуя ее поведение в этой change.
- Реализовать `dsbuilder theme fetch` как project-scoped команду, которая использует existing CLI core для `.sdds/config.json`, credential resolution, API URL resolution и `Authorization: ProjectKey <api_key>`.
- Загружать tenants через `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/tenants`.
- Загружать token meta через `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/tokens`.
- Загружать token values для каждого tenant через `GET /api/projects/{projectId}/ds/tenants/{tenantId}/token-values`.
- Сохранять tenants в `.sdds/config.json` в поле `tenants`, не добавляя raw secrets или API URL.
- Для каждого tenant создавать локальную директорию внутри `.sdds` по нормализованному `tenant.name`.
- Сохранять token meta в `.sdds/{tenantDirectory}/meta.json`.
- Группировать token values по `platform` и token `type` в файлы `.sdds/{tenantDirectory}/{platform}/{platform}_{type}.json`.
- Нормализовать `tokenValue.value` по типу token: `color` как строка, `typography`, `shape` и `fontFamily` как объект, `gradient` и `shadow` как массив там, где contract требует массив.
- Завершать `theme fetch` ошибкой, если для token из meta отсутствует required token value.
- Игнорировать token values, у которых нет соответствующего token в meta.

## Capabilities

### New Capabilities

- `cli-themes`: Описывает загрузку tenants, token meta и token values из backend DS Builder в локальную `.sdds` структуру командой `dsbuilder theme fetch`.

### Modified Capabilities

- `frontend-cli`: Root command должен показывать новую command group `theme`, а baseline help/version behavior должно оставаться независимым от config, backend и credentials.
- `cli-core`: `.sdds/config.json` должен поддерживать optional поле `tenants` как non-secret project metadata и сохранять обратную совместимость с config без этого поля.

## Impact

- Affected build/module: `dsbuilder-frontend/cli`.
- Affected packages: новый `com.dsbuilder.frontend.cli.feature.theme`, расширение root command wiring и точечное расширение `core.config`.
- Affected CLI config: `.sdds/config.json` получает optional поле `tenants`.
- Affected local files: `.sdds/{tenantDirectory}/meta.json` и platform/type JSON files внутри tenant-директорий.
- Affected backend API contracts: read-only project-scoped requests к tenants, tokens и token-values endpoints.
- Affected dependencies: новых production dependencies не ожидается; feature должна использовать существующие Clikt, Koin, Ktor client и kotlinx.serialization JSON.
- Backend services, gateway authorization, project access key lifecycle, Docker runtime и persistence не меняются.
