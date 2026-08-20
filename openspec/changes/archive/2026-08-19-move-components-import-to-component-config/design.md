## Context

Импорт конфигураций компонентов появился в change `add-cli-components-push` как custom method: `POST /api/projects/{projectId}/ds/design-systems/{designSystemId}/components:import`. Двоеточие в пути обошлось `db-service` в три обходных решения:

- роут объявлен как `router.post("/:id/:action")` с ручной сверкой `req.params.action === "components:import"`, потому что в шаблоне Express двоеточие начинает имя параметра;
- роутер импорта монтируется в `routes/index.ts` **до** `designSystemsRouter`, иначе шаблоны конфликтуют;
- тело парсится вручную через `ImportRequestSchema.safeParse` в обход общего `validateBody`, а `{id}` не проходит через `validateParams(UuidParamSchema)` — некорректный uuid уходит в `eq(designSystems.id, …)` и Postgres отвечает `22P02`, то есть клиент получает 500 вместо 404.

Соглашения `db-service` при этом однозначны: идентификатор дизайн-системы либо стоит сегментом пути `by-design-system/:designSystemId` (`design-system-changes`, `design-system-versions`, `documentation-pages`, `styles`, `invariant-property-values`), либо приезжает полем тела в POST-ручках создания. Query используется ровно в одном месте — `GET /ds/component-config`, и там это **имена** (`ds`, `appearance`, `component`), а не uuid.

Содержательно импорт и `GET /ds/component-config` — одна и та же сущность в двух направлениях: GET отдаёт `{rootVariationId, colorSchemeVariationId, invariants, defaults, variations}`, то есть ровно тот `config`, который лежит в каждом элементе `components[]` тела импорта.

## Goals / Non-Goals

**Goals:**

- Перенести импорт под `POST /ds/component-config/import` и снять все три обходных решения в `db-service`.
- Привести адресацию дизайн-системы к общему для POST-ручек виду: `designSystemId` полем тела, валидируется как uuid.
- Согласованно обновить CLI, его тесты и спеку `cli-components`.

**Non-Goals:**

- Формат тела импорта (`meta`, `dryRun`, `components[]`), формат отчёта, семантика `dryRun` и требование scope `components:write` не меняются.
- `GET /ds/component-config` не трогается: ни контракт, ни адресация по именам.
- Обратная совместимость старого пути не поддерживается.
- Логика `importComponents` и миграции `db-service` не затрагиваются.

## Decisions

### Путь: `POST /ds/component-config/import`

Полный путь с точки зрения CLI — `POST /api/projects/{projectId}/ds/component-config/import`.

Рассмотренные альтернативы:

- `POST /ds/component-config/{designSystemId}` — короче, но ресурс `component-config` в GET адресуется параметрами, а не сегментом, и голый uuid после `component-config` читается как «конфиг с таким id», а не «дизайн-система».
- `POST /ds/component-config` — полная симметрия с GET по URL, но метод перестаёт называть операцию, а импорт — не «создание конфига», а транзакционная загрузка пакета.
- Сохранить путь под `design-systems` и заменить двоеточие слэшем — оставляет импорт в чужом ресурсе и не решает исходную проблему принадлежности.

### `designSystemId` — поле тела, не query и не сегмент пути

Все POST-ручки `db-service` принимают `designSystemId` телом. Query с uuid не встречается в API ни разу. Сегмент пути противоречит выбранной форме `/import`.

Практический выигрыш: тело целиком проходит через один `validateBody`, uuid проверяется Zod до запроса в базу, и текущий 500 на кривом идентификаторе превращается в 400. Проигрыш: uuid дизайн-системы больше не виден в access-логах nginx — диагностика опирается на `console.error` в `db-service`, который печатает `designSystemId` при отказе импорта.

Тело после изменения:

```
POST /api/projects/{projectId}/ds/component-config/import
{
  "designSystemId": "<uuid>",
  "meta": { "name": "<package>", "source": "<origin>" },
  "dryRun": true,
  "components": [ { "componentName": "…", "styleName": "…", "config": { … } } ]
}
```

### Старый путь удаляется без алиаса

`dsbuilder` ещё не роздан наружу, единственный потребитель ручки — CLI из этого репозитория. Алиас пришлось бы держать вместе с обоими обходными решениями в `db-service` и со второй веткой валидации, поскольку идентификатор в старом и новом контракте живёт в разных местах.

### Разделение работ по репозиториям

Спека, CLI и его тесты — здесь. Роутер, OpenAPI и регенерация типов `apps/admin` — в `design-system-builder`, отдельной сессией из корня того репозитория, где доступны его скиллы `/sync-spec` и `/sync-api-types`; хендэдит генерируемых файлов там запрещён его CLAUDE.md.

Контракт для соседнего репозитория:

- `routes/api/components-import.ts` монтируется в `routes/index.ts` под `/ds/component-config` (либо содержимое переносится в `component-config.ts`), путь роута — `/import`, `Router({ mergeParams: true })` больше не нужен;
- `ImportRequestSchema` в `db/import/commonConfig.ts` получает поле `designSystemId: z.string().uuid()`, разбор тела переходит на `validateBody`;
- удаляются `IMPORT_ACTION`, ветка `req.params.action !== IMPORT_ACTION`, а также предваряющее монтирование `router.use("/ds/design-systems", componentsImportRouter)` вместе с комментарием про двоеточие;
- в `openapi/spec.ts` путь становится `${DS_PREFIX}/component-config/import`, `params` уходят, тег меняется с `Design Systems` на существующий `Component Config`;
- `entityType: "components:import"` в `design_system_changes` **не переименовывается**: это метка журнала изменений, у неё есть исторические строки, и с URL она не связана.

### Gateway не меняется

Location `~ ^/api/projects/([^/]+)/ds(/.*)?$` покрывает новый путь целиком, `client_max_body_size 16m` и `auth_request` навешаны на весь префикс `/ds`. Правок в `identity-gateway/gateway/nginx.local.conf` не требуется.

## Risks / Trade-offs

- **Ломающее изменение пути: CLI старой сборки получит 404** → CLI и `db-service` выкатываются вместе; сначала backend, затем CLI, потому что новый backend отвергает старый путь, а старый CLI до обновления backend продолжает работать.
- **Расхождение между репозиториями: спека здесь описывает контракт, реализация — там** → задачи на бэкенд вынесены в `tasks.md` явным блоком; change не архивируется, пока обе стороны не сойдутся на живом стенде.
- **uuid дизайн-системы исчезает из URL и, значит, из access-логов** → `db-service` уже логирует `designSystemId`, `meta` и число компонентов при отказе импорта; этого достаточно для разбора инцидентов.
- **`ImportRequestSchema` меняется на обеих сторонах одновременно** → поле обязательное, без значения по умолчанию: рассинхрон даёт детерминированный 400 с указанием поля, а не молчаливый импорт не в ту дизайн-систему.
- **Тестов на роуты в `db-service` нет** → проверка выполняется живым прогоном `dsbuilder components push --dry-run` против локального стенда, плюс негативные проверки на несуществующий и некорректный `designSystemId`.
