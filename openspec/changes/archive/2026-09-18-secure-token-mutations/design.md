## Context

Gateway уже маршрутизирует `/api/projects/{projectId}/ds/...` в `db-service` и передаёт доверенные `X-Project-Id`, `X-Project-Role`, `X-Project-Scopes` и `X-System-Admin`. В базе `dev` маршруты `/ds/tokens` и `/ds/token-values` выполняют generic CRUD без project authorization. `tokens.designSystemId`, `token_values.tokenId`, `tenantId` и `platform` допускают NULL; `palette` является общим каталогом без `designSystemId`.

## Goals / Non-Goals

**Goals:**

- Предотвратить запись в чужую дизайн-систему и смешение token/tenant из разных дизайн-систем.
- Разрешать изменения только доверенному actor с нужной project role либо scope проектного ключа.
- Сохранить существующие Gateway paths и модель хранения; дать однозначные ошибки для клиента.

**Non-Goals:**

- Не подключать Portal UI/BFF, `frontend-kt` или старый React-клиент к записи.
- Не моделировать alias, наследование, палитры прототипа, Draft, Changes и Publish.
- Не менять глобальный каталог `palette` и не приписывать ему несуществующий project scope.
- Не менять правила для архивных проектов: их жизненный цикл рассматривается отдельно.

## Decisions

### Аудит callers generic CRUD

В репозитории не найдено HTTP caller, который пишет через `/ds/tokens` или `/ds/token-values`. `db-service` seeds и legacy import записывают таблицы напрямую через Drizzle и не зависят от generic CRUD routes. Поэтому для этих маршрутов допустимы только Gateway `user` или `project_key` с непустым доверенным `X-Project-Id`; `system_admin` проходит как user actor с project context и platform override. Отдельный internal actor для этих маршрутов пока не вводится; отсутствие actor context означает отказ.

### Доверенная граница и права

Публичная запись проходит через существующий project-scoped Gateway route. `db-service` использует только переданный Gateway actor context, а не `projectId` из тела или query. Для user actor записи `POST`/`PATCH` разрешены `owner`, `maintainer`, `editor`; `DELETE` — `owner`, `maintainer`. `viewer` и неизвестная роль получают `403`. Для project key `POST`/`PATCH` требуют `tokens:write`, `DELETE` — `tokens:delete`; наличие scope не заменяет проверку ресурса. `system_admin` использует существующий platform override. Запрос без достоверного project context или явного доверенного internal/admin actor не должен становиться обходом проверок.

Альтернатива — проверять только UI или BFF — отклонена: CLI и другие клиенты обращаются к тому же Gateway. Альтернатива — считать отсутствие `X-Project-Scopes` разрешением для любого actor — применима к существующему `requireScope`, но недостаточна без явной проверки user role и actor type на mutation routes.

### Целостность token definition

Создание токена требует `designSystemId` доступной для записи дизайн-системы выбранного проекта. Изменение и удаление ищут token вместе с его design-system ownership; чужой и отсутствующий ID отвечают `404`. `designSystemId = NULL` допускается в legacy данных для чтения, но не служит основанием для project-scoped записи. Нельзя переносить token между дизайн-системами через `PATCH`.

### Целостность token value

Создание значения требует существующих `tokenId`, `tenantId` и `platform`. Token и tenant должны относиться к одной доступной для записи дизайн-системе. `mode` остаётся опциональным, поскольку текущий schema contract различает значение без mode и значения `light`/`dark`. `PATCH` и `DELETE` сначала разрешают существующий value через его token и tenant; проверка охватывает оба FK и выбранный проект. Существующий `PATCH` не меняет `tokenId`/`tenantId`; если меняется `paletteId`, ID должен существовать в общем каталоге. Поскольку `palette` глобальная, проверку «та же дизайн-система» для неё вводить нельзя до отдельного изменения модели. Уникальность `(token, tenant, platform, mode)` остаётся на уровне БД; конфликт должен возвращать клиентскую ошибку без частичной записи.

Альтернатива — использовать только FK — отклонена: FK не запрещают token и tenant из разных дизайн-систем. Альтернатива — копировать палитру в каждый проект в этом change — расширяет предметную модель и отложена в отдельный черновик.

### Границы реализации

В `js/services/db-service` presentation слой Express валидирует request и выдаёт стабильные DTO/ошибки; application logic разрешает actor и ownership до mutation; data слой выполняет проверки и запись с защитой от гонок там, где требуется. Доменные правила — принадлежность token/tenant и матрица прав — не должны зависеть от Portal. Новые Kotlin application/domain/data/di слои не создаются: Gateway и Projects Service уже предоставляют доверенный context и scopes. OpenAPI описывает ограничения существующих CRUD routes. Новых endpoint и конфигурационных параметров не требуется.

## Risks / Trade-offs

- [Legacy `NULL designSystemId` и старые прямые вызовы CRUD] → до rollout инвентаризировать callers; project-scoped запись таких строк запрещить, миграцию legacy данных планировать отдельно.
- [Разнесённые проверки и запись] → использовать согласованную транзакцию/условную запись для предотвращения TOCTOU; повторно проверить cross-project доступ тестами.
- [Глобальная palette] → проверять существование `paletteId`, но не обещать проектную изоляцию палитры до отдельной модели.
- [Изменения ролей] → Gateway остаётся источником доверенного role/scope context для каждого запроса.

## Migration Plan

1. Уточнить фактических callers generic CRUD и допустимый internal actor.
2. Выпустить защиту `db-service` и обновлённый OpenAPI без миграции БД; Portal editor остаётся отключённым.
3. Проверить user/key/admin, чужие ID, mismatched token/tenant, `NULL` legacy строки и запросы через Gateway.
4. При откате вернуть прежнюю версию `db-service`; структура БД остаётся прежней. Откат временно возвращает прежний риск и не должен сопровождаться включением редактора Portal.

## Open Questions

- Нет для текущего среза. Новому internal HTTP caller потребуется отдельный контракт доверенной авторизации.
