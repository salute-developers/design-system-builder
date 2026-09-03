## Context

`dsbuilder-frontend/cli` уже содержит project-scoped foundation: nearest-parent lookup `.sdds/config.json`, env-based credential reference, runtime API URL resolution и Ktor-backed authenticated HTTP client с `Authorization: ProjectKey <api_key>`. Команды `init` и `status` показывают текущий паттерн: presentation отвечает за Clikt command surface, application оркестрирует use case через port-интерфейсы, data содержит HTTP и local storage adapters, DI живет отдельно.

`theme fetch` должен стать первой CLI-командой, которая не только проверяет backend access, но и синхронизирует локальные файлы дизайн-системы. Поэтому change затрагивает command tree, config model и local file layout внутри `.sdds`, но не требует backend-изменений или новых runtime dependencies.

## Goals / Non-Goals

**Goals:**

- Добавить command group `theme` и подкоманду `fetch`.
- Сохранить текущие CLI границы `presentation -> application -> domain <- data`.
- Использовать существующий CLI core для project context, credentials, API URL и authenticated HTTP.
- Расширить `.sdds/config.json` optional полем `tenants` без хранения secrets и без breaking change для существующих config.
- Загрузить tenants, token meta и tenant-specific token values через read-only backend API.
- Сформировать стабильную локальную структуру `.sdds/{tenantDirectory}/meta.json` и `.sdds/{tenantDirectory}/{platform}/{platform}_{type}.json`.
- Сделать token value normalization детерминированной и покрываемой unit-тестами.
- Сохранять help/version behavior независимым от `.sdds`, backend, credentials и private URLs.

**Non-Goals:**

- Не реализовывать `theme generate`.
- Не менять backend routes, gateway authorization, Auth Helper или Projects Service.
- Не добавлять user login, access key management, OS keychain или сохранение raw API key.
- Не добавлять новые Gradle modules или production dependencies.
- Не удалять устаревшие tenant-директории и файлы, которые не были созданы текущим `fetch`.
- Не моделировать `mode` как отдельное измерение локальной файловой структуры.

## Decisions

### 1. `theme` остается feature package внутри `:cli`

Новая capability живет в `com.dsbuilder.frontend.cli.feature.theme`:

```text
feature/theme/
  domain/
  application/
  data/
  presentation/
  di/
```

`presentation` содержит `ThemeCliCommand` и `ThemeFetchCliCommand`, `application` содержит `FetchThemesUseCase` и port-интерфейсы, `domain` содержит модели tenants/tokens/token values и нормализацию, `data` содержит backend API client и local writers, `di` регистрирует зависимости и Clikt-команды.

Альтернатива: выделить отдельный Gradle module `:feature-theme`. Отклонено, потому что текущий frontend build имеет один активный module `:cli`, а существующий AGENTS.md явно рекомендует feature packages вместо дополнительных modules до появления реального переиспользования.

### 2. `theme fetch` использует общий project-scoped runtime

Команда принимает runtime overrides по аналогии со `status`:

```text
dsbuilder theme fetch [--api-key <value>] [--api-url <url>]
```

Use case сначала читает nearest `.sdds/config.json`, затем резолвит API key и API URL через существующие core adapters. Backend requests идут через `AuthenticatedHttpClientFactory`, чтобы сохранить единое поведение base URL, `ProjectKey` header и mapping HTTP `401`/`403`/`404`.

Альтернатива: создать отдельный Ktor client внутри feature-theme. Отклонено, потому что это дублирует security-sensitive request decoration и повышает риск расхождения auth/error behavior между project-scoped командами.

### 3. Backend contract остается read-only и design-system scoped

`theme fetch` выполняет requests в таком порядке:

```text
GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/tenants
GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/tokens
GET /api/projects/{projectId}/ds/tenants/{tenantId}/token-values
```

Tokens endpoint должен быть scoped by `designSystemId`. Это убирает необходимость client-side filtering по `designSystemId` и делает локальный `meta.json` однозначным для configured design system.

Альтернатива: использовать `/api/projects/{projectId}/ds/tokens` и фильтровать по `designSystemId` в CLI. Отклонено, потому что endpoint без `designSystemId` был уточнен как ошибочный contract.

### 4. `.sdds/config.json` получает optional `tenants`

Config model расширяется non-secret metadata:

```json
{
  "projectId": "project-a",
  "designSystemId": "design-system-a",
  "credential": {
    "type": "env",
    "name": "DSBUILDER_PROJECT_A_API_KEY"
  },
  "tenants": [
    {
      "id": "9095ed0f-4d34-4868-8b5c-400b4f23f598",
      "designSystemId": "f27d9439-3188-4077-9993-bf22293623b0",
      "name": "sdds_cs",
      "description": "SDDS для потребительских устройств (смартфоны, планшеты)",
      "createdAt": "2026-06-04T07:37:55.526Z",
      "updatedAt": "2026-06-04T07:37:55.526Z"
    }
  ]
}
```

`tenants` должен иметь default `emptyList`, чтобы существующие config без этого поля продолжали читаться. Codec не должен начать принимать `apiKey`, `apiUrl` или другие secret/environment-specific поля.

Альтернатива: хранить tenants в отдельном `.sdds/tenants.json`. Отклонено для MVP, потому что пользовательский contract явно просит поле `tenants` в config, а tenants являются project metadata, не secret.

### 5. Tenant directory name нормализуется детерминированно

Директория tenant строится из `tenant.name`:

```text
1. trim
2. lowercase
3. заменить символы вне [a-z0-9._-] на "_"
4. схлопнуть несколько "_" подряд
5. убрать "_" в начале и конце
6. если результат пустой, использовать tenant.id
7. если имя конфликтует с другим tenant после нормализации, добавить suffix из первых 8 символов tenant.id
```

Пример:

```text
"SDDS CS / Consumer" -> "sdds_cs_consumer"
"sdds/cs" + collision -> "sdds_cs_9095ed0f"
```

Альтернатива: использовать raw `tenant.name`. Отклонено, потому что name может содержать slash, пробелы, path traversal fragments или символы, неудобные для файловой системы.

### 6. Local writers перезаписывают known generated files, но не чистят неизвестные

Для каждого tenant команда создает:

```text
.sdds/{tenantDirectory}/meta.json
.sdds/{tenantDirectory}/android/android_{type}.json
.sdds/{tenantDirectory}/ios/ios_{type}.json
.sdds/{tenantDirectory}/web/web_{type}.json
```

Файлы текущих platform/type групп перезаписываются полностью. Удаление старых файлов и tenant-директорий не входит в MVP, потому что текущий `CliFileSystem` не имеет listing/delete operations, а добавление destructive cleanup требует отдельного contract.

Альтернатива: чистить всю `.sdds/{tenantDirectory}` перед записью. Отклонено, потому что это потенциально destructive behavior и потребует расширения filesystem port.

### 7. Token value grouping опирается на meta token type

`token-values` связываются с meta через `tokenValue.tokenId`. Если token value не имеет token в meta, он игнорируется. Если token из meta не имеет required value для tenant, команда завершается ошибкой без silent partial success.

Grouping key:

```text
tenant -> platform -> token.type -> token.name
```

`mode` не участвует в grouping и не создает отдельные файлы или nested objects. Dark/light варианты считаются разными tokens, потому что различаются через `token.name`.

Альтернатива: группировать по `mode` или формировать `{ tokenName: { light, dark } }`. Отклонено, потому что текущий token naming contract уже несет dark/light различие.

### 8. `tokenValue.value` нормализуется по token type

Backend contract представляет `value` как JSON array, но local output зависит от token type:

```text
color:
  value должен содержать одну строку; в файл пишется строка

gradient:
  android/ios: JSON objects сохраняются массивом
  web: string values сохраняются массивом

typography:
  JSON object пишется как object, не array

shadow:
  JSON objects сохраняются массивом

shape:
  JSON object пишется как object, не array

fontFamily:
  JSON object пишется как object, не array
```

Если type требует object, CLI берет первый элемент массива и проверяет, что он является JSON object. Если type требует single string, CLI проверяет, что массив содержит одну JSON string. Ошибки normalization должны быть user-facing и не содержать raw API key.

Альтернатива: сохранять raw backend `value` всегда массивом. Отклонено, потому что локальный format должен соответствовать ожидаемой структуре генераторов дизайн-токенов.

## Risks / Trade-offs

- [Risk] Backend вернет пустой или некорректный `value` для token type. → Mitigation: fail fast с deterministic message, покрыть normalization tests.
- [Risk] Расширение `ProjectConfig` сломает существующие `.sdds/config.json`. → Mitigation: `tenants` сделать optional/default `emptyList`, оставить запрет на unknown keys кроме явно добавленных полей.
- [Risk] Нормализация tenant names приведет к collision. → Mitigation: suffix из первых 8 символов `tenant.id` для конфликтующих имен.
- [Risk] Старые generated files останутся после изменения backend token types или tenant list. → Mitigation: MVP перезаписывает known files и явно не обещает cleanup; destructive sync можно добавить отдельной change.
- [Risk] `theme fetch` частично запишет файлы при ошибке на позднем tenant. → Mitigation: use case должен сначала загрузить и провалидировать все remote data и normalization, затем выполнять local writes.
- [Risk] Root help начнет требовать runtime context из-за вложенной command group. → Mitigation: `ThemeCliCommand` не должен читать config в `run` для help/version paths; config используется только в `fetch`.
