## Контекст

`ds-service` (Kotlin, Ktor, Exposed, Flyway) обслуживает `/api/ds/**` вместо db-service и работает с той
же базой. Тема — тенант дизайн-системы; тенанты создаются и удаляются в `feature-themes`, там же
читаются и сохраняются значения токенов темы (`GET` и `PUT /tenants/{id}/token-values`), сохранение
защищено `edit_revision` с блокировкой строки тенанта. Палитра есть только общая (`feature-tokens`,
таблица `palette`, `GET /palette`, запись — системный администратор).

Продуктовое правило: общая палитра — шаблон. Тема получает её копию и дальше меняет независимо; правки
темы не отражаются на шаблоне и других темах, правки шаблона не отражаются на существующих темах.

Значение токена ссылается на палитру двумя способами: внешним ключом `palette_id` со значением `null` или
`[opacity]` (начальные значения темы) и строкой `[general.red.500][0.56]` в `value` (сохранение из
клиента). Оба вида должны продолжать работать.

Клиент из `add-theme-palette-editor` уже работает с палитрой темы через порт `PaletteRepository`; это
изменение даёт адаптеру `api` сервер. Логика палитры описана там же и проверяется эталоном
`js/apps/client/src/modules/palette/fixtures/palette-golden.json`.

## Цели / Вне целей

**Цели:**

- палитра темы на сервере — независимая копия шаблона с операциями прототипа и тем же контрактом, что у
  клиента;
- явная привязка токенов к группам палитры и адресация групп по `id`;
- конкурентный доступ с той же ревизией темы, что у значений токенов;
- цвета палитры темы в CLI `theme fetch`.

**Вне целей:**

- generator: он читает legacy `theme-data` из db-service без тенанта; перевод generator на `ds-service`
  — отдельное изменение, после которого он сможет запросить `resolvePalette=true`;
- обновление палитры существующей темы до новой версии шаблона;
- изменение шаблона и его прав;
- перенос `palette_id` в строки и удаление столбца;
- отслеживание изменений палитры.

## Архитектура

Палитра темы живёт в `feature-themes`: копия шаблона создаётся в транзакции создания тенанта, операции
палитры делят транзакцию и `edit_revision` с тенантом и его значениями токенов, а feature-модули не могут
зависеть друг от друга. Шаблон читается через внутреннюю проекцию таблицы `palette`, как уже сделано в
`TenantTables.kt`.

```mermaid
flowchart LR
  Client["клиент: httpPaletteRepository"] -->|"/api/projects/{p}/ds/tenants/{t}/palette/*"| GW["gateway"]
  CLI["dsbuilder theme fetch"] -->|"token-values?resolvePalette=true"| GW
  GW --> Routes["feature-themes presentation: TenantPaletteRoutes"]
  Routes --> UC["application: *PaletteUseCase"]
  UC --> Domain["domain: группы, вычисление, перестройка"]
  UC --> Repo["data: ExposedTenantPaletteRepository"]
  Create["CreateTenantUseCase"] -->|"копия шаблона и системные группы"| Repo
  Repo --> PG[("PostgreSQL: tenant_palette_*, palette, token_values")]
```

## Модель данных и контракты

```mermaid
erDiagram
  tenants ||--o{ tenant_palette_template : "копия шаблона"
  tenants ||--o{ tenant_palette_groups : "системные и пользовательские группы"
  tenant_palette_groups ||--o{ tenant_palette_ramps : "экземпляры растяжек"
  tenant_palette_ramps ||--o{ tenant_palette_steps : "правки ступеней"
  tenant_palette_groups ||--o{ tenant_palette_token_groups : "явные привязки"
  tokens ||--o{ tenant_palette_token_groups : "токен"
  token_values }o..o{ tenant_palette_ramps : "ссылка [type.shade.step] или palette_id"
```

- `tenant_palette_template`: `tenant_id → tenants ON DELETE CASCADE`, `type palette_type`, `shade text`,
  `step integer`, `value text`; первичный ключ `(tenant_id, type, shade, step)`. Копия шаблона на момент
  создания палитры темы; после создания не меняется.
- `tenant_palette_groups`: `id uuid`, `tenant_id → CASCADE`, `kind` (`palette_group_kind`:
  `system | custom`), `system_key text null` (`neutral | accent | status | data | syntax`), `label text`,
  `position integer`, `created_at`, `updated_at`; уникальность `(tenant_id, system_key)` при непустом
  ключе и `(tenant_id, lower(label))`; проверка: `system_key` задан тогда и только тогда, когда
  `kind = 'system'`.
- `tenant_palette_ramps`: `id uuid`, `group_id → tenant_palette_groups ON DELETE CASCADE`, `slot_type
  palette_type`, `slot_shade text`, `source_type palette_type`, `source_shade text`, `added boolean`,
  `origin` (`palette_ramp_origin`: `template | rebuild`), `anchor_step integer null`, `anchor_value text
  null`, `created_at`, `updated_at`; уникальность `(group_id, slot_type, slot_shade)`. Строка появляется,
  только когда растяжку добавили или изменили; растяжки, известные по ссылкам токенов, вычисляются.
- `tenant_palette_steps`: `ramp_id → tenant_palette_ramps ON DELETE CASCADE`, `step integer`,
  `value text`; первичный ключ `(ramp_id, step)`.
- `tenant_palette_token_groups`: `tenant_id → CASCADE`, `token_id → tokens ON DELETE CASCADE`,
  `group_id → tenant_palette_groups ON DELETE CASCADE`; первичный ключ `(tenant_id, token_id)`. Только
  явные привязки; при удалении группы привязки её токенов удаляются каскадом.

Миграция `V3` создаёт копию шаблона и пять системных групп для каждого существующего тенанта; для новых
тенантов это делает `CreateTenantUseCase` в своей транзакции.

DTO совпадают с `add-theme-palette-editor` (`ThemePalette` с полем `template` — растяжками копии шаблона темы, `PaletteGroup` с `id`, `kind`, `systemKey`,
`PaletteTokenAssignment`, `PaletteRamp`, `PaletteStep` с `templateValue`, `PaletteLink` с `groupId`).
Операции изменения отвечают `{ editRevision, value }`. Ошибки — `ErrorResponse` с кодами
`PALETTE_GROUP_EXISTS`, `PALETTE_GROUP_SYSTEM`, `PALETTE_RAMP_EXISTS`, `PALETTE_RAMP_LINKED`,
`PALETTE_STEP_MISSING`, `TENANT_EDIT_CONFLICT` (с текущим `editRevision`).

| Метод и путь под `/api/ds/tenants/{tenantId}/palette` | Тело | Право |
|---|---|---|
| `GET` | — | `tenants:read` |
| `GET /links?type&shade&groupId&step` | — | `tenants:read` |
| `POST /groups` | `{ label, editRevision }` | `tenants:write` |
| `DELETE /groups/{groupId}` | `{ editRevision }` | `tenants:write` |
| `PUT /token-groups/{tokenId}` | `{ groupId \| null, editRevision }` | `tenants:write` |
| `POST /groups/{groupId}/ramps` | `{ type, shade, editRevision }` | `tenants:write` |
| `PUT /groups/{groupId}/ramps/{type}/{shade}/source` | `{ type, shade, editRevision }` | `tenants:write` |
| `POST /groups/{groupId}/ramps/{type}/{shade}/rebuild` | `{ anchorStep, value, preview, editRevision }`; при `preview: true` ответ `{ steps: [{ step, value }] }` | `tenants:write` |
| `PATCH /groups/{groupId}/ramps/{type}/{shade}/steps/{step}` | `{ value, editRevision }` | `tenants:write` |
| `DELETE /groups/{groupId}/ramps/{type}/{shade}` | `{ strategy?, replacement?, editRevision }` | `tenants:write` |

Растяжка внутри группы адресуется слотом `(type, shade)`: это неизменяемый естественный ключ, совпадающий
со ссылкой токена.

## Программное проектирование

```kotlin
// domain
data class PaletteReference(val type: ThemePaletteType, val shade: String, val step: Int, val opacity: Double?)
object PaletteReferenceParser { fun parse(value: JsonElement?, paletteId: PaletteEntryRef?): PaletteReference? }
object DefaultPaletteGroups { fun groupFor(tokenName: String): SystemPaletteGroup }
object PaletteRampRebuilder { fun rebuild(source: TemplateRamp, anchorStep: Int, anchorHex: String): Map<Int, String> }
object PaletteDisplayNames { fun of(source: PaletteRampRef, anchor: PaletteAnchor?): String }
class ThemePaletteResolver(private val state: TenantPaletteState) {
    fun groupOf(tokenId: UUID, tokenName: String): PaletteGroupAssignment
    fun palette(links: List<ColorTokenLink>, canEdit: Boolean): ThemePalette
    fun resolveColor(tokenId: UUID, tokenName: String, value: JsonElement?, paletteId: PaletteEntryRef?): String?
}

// application: один *UseCase на операцию, единственный execute
class GetTenantPaletteUseCase(...) { suspend fun execute(ctx: DsRequestContext, tenantId: UUID): DsResult<ThemePalette> }
class ListTenantPaletteLinksUseCase(...)
class CreateTenantPaletteGroupUseCase(...)
class DeleteTenantPaletteGroupUseCase(...)
class AssignTenantPaletteTokenGroupUseCase(...)
class AddTenantPaletteRampUseCase(...)
class ReplaceTenantPaletteRampSourceUseCase(...)
class RebuildTenantPaletteRampUseCase(...)
class UpdateTenantPaletteStepUseCase(...)
class RemoveTenantPaletteRampUseCase(...)

interface TenantPaletteRepository {
    fun initialize(tenantId: UUID)                       // копия шаблона и системные группы
    fun lockTenant(projectId: ProjectId, tenantId: UUID, editRevision: Int): TenantLockOutcome
    fun state(projectId: ProjectId, tenantId: UUID): TenantPaletteState?
    fun colorLinks(projectId: ProjectId, tenantId: UUID): List<ColorTokenLink>
    fun saveGroup(...); fun deleteGroup(...); fun saveTokenGroup(...); fun saveRamp(...); fun deleteRamp(...)
    fun rewriteTokenReferences(changes: List<TokenReferenceChange>): Int
    fun bumpEditRevision(tenantId: UUID): Int
}
```

Каждая операция изменения выполняется в `TransactionRunner.required`: проверка права, блокировка тенанта
`forUpdate()` и сравнение `editRevision`, изменение, увеличение `edit_revision`. Переписанные ссылки при
удалении растяжки записываются в той же форме, что пишет `PUT /tenants/{id}/token-values`.
`CreateTenantUseCase` вызывает `TenantPaletteRepository.initialize` в транзакции создания тенанта.

## Решения

### Палитра темы — копия шаблона

Тема хранит полную копию шаблона (`tenant_palette_template`, около 790 строк) и правки поверх этой копии.
Все вычисления — значения ступеней, источники замены, перестройка, `templateValue`, `offBrand` — опираются
на копию темы. Изменение общей палитры администратором не меняет существующие темы.

Отвергнуто:

- хранить только отличия поверх живой общей палитры — правка общей палитры меняла бы цвета всех тем, где
  растяжку не трогали;
- копировать только растяжки, на которые ссылаются токены, — добавление растяжки из шаблона позже брало бы
  уже изменённый шаблон, и копия перестала бы быть снимком.

### Палитра принадлежит теме

У дизайн-системы несколько тем, у каждой своя палитра. Связи считаются по значениям токенов этой темы.

### Явная привязка токена к группе

Группа токена определяет, из какого экземпляра растяжки берётся его цвет, а имя токена задаёт пользователь
и не обязано содержать `accent`, `status` или `data`. Поэтому принадлежность хранится явно в
`tenant_palette_token_groups` и меняется операцией `PUT /token-groups/{tokenId}`. Правило по имени — только
группа по умолчанию для токенов без привязки; оно выбирает лишь системные группы и возвращается в ответе
как `assignment: "default"`. В пользовательскую группу токен попадает только явной привязкой.

Отвергнуто: заполнять привязки всех токенов при создании палитры. Токены дизайн-системы добавляются и
после создания темы, и для них всё равно нужно правило по умолчанию; явная таблица хранит только решения
пользователя.

### Группы адресуются по `id`

Системные группы хранятся строками у каждой темы с `kind = system` и `system_key`, пользовательские — с
`kind = custom`. API, растяжки, привязки и связи ссылаются на группу только по UUID; производного
текстового ключа нет, поэтому нет и вопросов о его неизменяемости и коллизиях. Различие системных и
пользовательских групп выражено полем `kind` и проверкой в схеме; системную группу нельзя удалить или
переименовать.

### Ревизия темы вместо отдельной ревизии палитры

Палитра определяет цвета токенов темы, а удаление растяжки переписывает значения токенов. Общая
`edit_revision` защищает от потери правок в обоих направлениях. Цена — клиент обновляет ревизию после
каждой операции палитры перед сохранением токенов; это уже заложено в `add-theme-palette-editor`.

### Ссылки не переносятся

Сервер понимает обе формы ссылки (`palette_id` и строку). Перенос `palette_id` в строки затронул бы
начальные значения тем и CLI без пользы для палитры. Ссылка через `palette_id` разрешается по
`(type, shade, saturation)` строки общей палитры и затем по копии шаблона темы.

### Вычисление цветов для CLI на сервере

CLI получает HEX и исходную ссылку через `resolvePalette=true` и не повторяет правила групп и копии
шаблона. CLI пишет значение токена как есть и игнорирует `palette.json` для таких значений.

### Операции, которых нет в db-service

`OpenApiDocumentFactory` сейчас требует, чтобы каждая операция манифеста была в OpenAPI db-service.
Маршруты палитры темы помечаются в манифесте признаком `"origin": "ds-service"`, и фабрика описывает их
по DTO `ds-service`; тест фабрики проверяет, что признак есть только у новых маршрутов.

## Риски / Компромиссы

- [Миграция `V3` меняет схему и данные, а `FlywayPostgresIntegrationTest` ожидает две миграции и
  отпечаток после `V1`] → тест перестраивается: отпечаток принятой базы сравнивается на цели `1`, число
  миграций — `3`.
- [Копия шаблона — около 790 строк на тему] → объём мал, вставка одним `INSERT … SELECT`; чтение палитры
  берёт копию одним запросом.
- [Тема не получает исправлений общей палитры] → так задумано; обновление темы до новой версии шаблона —
  отдельная операция в будущем.
- [db-service работает на той же базе как путь отката] → новые таблицы ему не видны; при откате палитра
  темы перестаёт влиять на CLI, ссылки токенов остаются валидными.
- [Логика палитры на двух языках] → тесты `ds-service` читают эталон `palette-golden.json` клиента.
- [Удаление растяжки переписывает значения токенов, пока у пользователя есть черновик] → клиент
  перезагружает значения темы; черновик выигрывает при следующем сохранении.

## Миграция и совместимость

1. `V3__tenant_palette.sql` создаёт enum `palette_ramp_origin`, `palette_group_kind` и пять таблиц, затем
   для каждого существующего тенанта копирует общую палитру в `tenant_palette_template` и создаёт пять
   системных групп.
2. Ответы без `resolvePalette` не меняются.
3. Порядок развёртывания: `ds-service`, затем CLI и клиент с `VITE_PALETTE_SOURCE = api`. Палитры,
   созданные в режиме `local`, на сервер не переносятся.
4. Откат: прежний образ `ds-service` и клиент с `VITE_PALETTE_SOURCE = local`; таблицы `V3` можно
   оставить.

## План проверки и развёртывания

- Автоматические: `cd backend-kt/ds-service && ./gradlew test detekt spotlessCheck build` (нужен Docker
  для Testcontainers), `cd backend-kt && ./gradlew verifyFast`, тесты `frontend-kt` CLI, сборка и тесты
  клиента, `tools/verify fast|full --change add-theme-palette-api`.
- Внешние до архивирования: сценарий раздела в режиме `api` на локальном контуре, независимость палитры
  темы от правки общей палитры, два пользователя для конфликта ревизии, `dsbuilder theme fetch` против
  локального gateway.
