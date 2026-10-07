## ADDED Requirements

### Requirement: Ссылка значения токена на палитру

`ds-service` SHALL считать ссылкой на палитру цветовое значение токена в одной из двух форм: строку
`[<type>.<shade>.<step>]` с необязательным суффиксом прозрачности `[<opacity>]` в `value` (элемент
массива или скаляр) либо `palette_id` на строку библиотеки со значением `null`, `[]` или `[<opacity>]`.
Пара `(type, shade)` ссылки SHALL обозначать слот растяжки в палитровой группе токена.

#### Scenario: Обе формы ссылки

- **WHEN** у одного токена значение `["[general.amber.300][0.56]"]`, а у другого — `palette_id` на `general.amber.300` и `value = ["0.56"]`
- **THEN** оба значения MUST считаться ссылкой на ступень `300` слота `general.amber` с прозрачностью `0.56`

### Requirement: Палитровая группа токена

`ds-service` SHALL вычислять палитровую группу цветового токена по имени без префикса режима: имя,
начинающееся с `data.`, относится к `data`; имя, последний сегмент которого содержит `accent` или
`promo`, — к `accent`; содержит `positive`, `negative`, `warning` или `info` — к `status`; остальные — к
`neutral`. Первое совпадение выигрывает. Результат MUST совпадать с эталоном
`js/apps/client/src/modules/palette/fixtures/palette-golden.json`.

#### Scenario: Группы по имени токена

- **WHEN** вычисляются группы для `data.default.yellow-hover`, `surface.default.transparent-accent-hover`, `text.default.promo`, `outline.default.positive-minor`, `text.default.primary`
- **THEN** группы MUST быть соответственно `data`, `accent`, `accent`, `status`, `neutral`

### Requirement: Палитра темы

Палитра темы SHALL состоять из системных групп `neutral` («Neutral»), `accent` («Accent»), `status`
(«Статус»), `data` («Data»), `syntax` («Syntax») в этом порядке и пользовательских групп темы в порядке
создания. Состав группы SHALL быть объединением слотов, на которые ссылаются цветовые значения токенов
этой группы в теме, и слотов, добавленных или изменённых в группе. Значение ступени SHALL вычисляться так:
правка ступени в группе, иначе значение библиотеки для источника растяжки, где источник — заменённая
растяжка группы, иначе сам слот.

#### Scenario: Чтение палитры темы

- **WHEN** участник проекта отправляет `GET /api/ds/tenants/{tenantId}/palette`
- **THEN** `ds-service` MUST вернуть `200` и `ThemePalette { tenantId, editRevision, canEdit, offBrand, groups, tokenGroups }`
- **THEN** каждая группа MUST содержать `key`, `label`, `kind` (`system` или `custom`) и `ramps`
- **THEN** каждая растяжка MUST содержать `slot`, `source`, `displayName`, `origin`, `anchor`, `added`, `modified`, `linkedCount` и `steps`, а каждая ступень — `step`, `value`, `libraryValue`, `overridden` и `linkedCount`
- **THEN** `tokenGroups` MUST сопоставлять имя каждого цветового токена дизайн-системы с ключом его группы

#### Scenario: Порядок растяжек

- **WHEN** группа содержит растяжки `additional.h20`, `general.red` и `additional.h3`
- **THEN** растяжки MUST идти в порядке `general.red`, `additional.h3`, `additional.h20`

#### Scenario: Подсчёт связей

- **WHEN** токен `text.default.accent` в режимах `light` и `dark` на трёх платформах ссылается на `[general.green.500]`
- **THEN** `linkedCount` ступени `500` слота `general.green` группы `accent` MUST быть `2`: по одной связи на пару «токен, режим»

#### Scenario: Изменённая растяжка и палитра вне бренда

- **WHEN** у растяжки есть правка ступени
- **THEN** `modified` растяжки и `overridden` правленых ступеней MUST быть `true`
- **WHEN** у любой растяжки темы есть правка ступени или заменённый источник
- **THEN** `offBrand` MUST быть `true`

#### Scenario: Отображаемое имя растяжки

- **WHEN** вычисляется `displayName`
- **THEN** результат MUST совпадать с эталоном `palette-golden.json`: имя источника для неперестроенной растяжки и ближайшее к тону опорного цвета название для перестроенной

#### Scenario: Палитры тем независимы

- **WHEN** в теме A заменён источник слота `general.green` в группе `accent`
- **THEN** палитра темы B той же дизайн-системы MUST NOT измениться

#### Scenario: Тема чужого проекта

- **WHEN** тенант `{tenantId}` принадлежит дизайн-системе другого проекта
- **THEN** `ds-service` MUST вернуть `404` на любой запрос палитры этой темы

### Requirement: Связанные токены растяжки

`ds-service` SHALL возвращать связи токенов темы со слотом через
`GET /api/ds/tenants/{tenantId}/palette/links` с параметрами `type`, `shade`, необязательными `group` и
`step`.

#### Scenario: Связи в группе

- **WHEN** запрос содержит `type=general&shade=green&group=accent`
- **THEN** ответ MUST содержать `PaletteLink { tokenId, tokenName, displayName, group, mode, step, opacity, platforms }` только для токенов группы `accent`, ссылающихся на слот, уникальные по паре `(tokenId, mode)`

#### Scenario: Связи по ступени во всех группах

- **WHEN** запрос не содержит `group`, но содержит `step=500`
- **THEN** ответ MUST содержать связи всех групп со ступенью `500` слота

### Requirement: Ревизия темы в операциях палитры

Каждая операция изменения палитры темы SHALL принимать `editRevision` темы, выполняться в одной
транзакции с блокировкой тенанта, увеличивать `edit_revision` на единицу и возвращать
`{ editRevision, value }`.

#### Scenario: Устаревшая ревизия

- **WHEN** `editRevision` запроса не равен текущему
- **THEN** `ds-service` MUST вернуть `409` с кодом `TENANT_EDIT_CONFLICT` и текущим `editRevision` и MUST NOT изменить данные

#### Scenario: Сохранение токенов после операции палитры

- **WHEN** после операции палитры клиент сохраняет значения токенов с ревизией, полученной до операции
- **THEN** `PUT /api/ds/tenants/{tenantId}/token-values` MUST вернуть `409 TENANT_EDIT_CONFLICT`

### Requirement: Пользовательские группы

Пользовательская группа SHALL иметь ключ вида `custom-<id>` и непустое название длиной не более 64
символов, уникальное в теме без учёта регистра вместе с названиями системных групп.

#### Scenario: Создание группы

- **WHEN** редактор отправляет `POST /api/ds/tenants/{tenantId}/palette/groups` с `{ "label": "Avatars", "editRevision": 4 }`
- **THEN** `ds-service` MUST вернуть `201` с `{ editRevision: 5, value: { key, label: "Avatars", kind: "custom", ramps: [] } }`

#### Scenario: Некорректное или повторное название

- **WHEN** `label` пуст после обрезки пробелов или длиннее 64 символов
- **THEN** `ds-service` MUST вернуть `400`
- **WHEN** название совпадает с существующим без учёта регистра
- **THEN** `ds-service` MUST вернуть `409` с кодом `PALETTE_GROUP_EXISTS`

#### Scenario: Удаление группы

- **WHEN** редактор удаляет пользовательскую группу с растяжками
- **THEN** растяжки группы с источником и правками ступеней MUST перейти в `neutral`; при совпадении слота MUST остаться растяжка `neutral`
- **WHEN** запрос удаляет системную группу
- **THEN** `ds-service` MUST вернуть `409` с кодом `PALETTE_GROUP_SYSTEM`

### Requirement: Добавление растяжки в группу

Редактор SHALL добавлять растяжку библиотеки в группу через
`POST /api/ds/tenants/{tenantId}/palette/groups/{key}/ramps` с телом `{ type, shade, editRevision }`.

#### Scenario: Добавление и повтор

- **WHEN** растяжки нет в группе
- **THEN** `ds-service` MUST вернуть `201` и растяжку с `added = true` и источником, равным слоту
- **WHEN** слот уже входит в группу
- **THEN** `ds-service` MUST вернуть `409` с кодом `PALETTE_RAMP_EXISTS`
- **WHEN** пары `(type, shade)` нет в библиотеке
- **THEN** `ds-service` MUST вернуть `404`

### Requirement: Замена растяжки в группе

Редактор SHALL заменять источник растяжки только внутри одной группы через
`PUT /api/ds/tenants/{tenantId}/palette/groups/{key}/ramps/{type}/{shade}/source`. Слот и ссылки токенов
SHALL сохраняться, правки ступеней и данные перестройки растяжки в группе SHALL сбрасываться.

#### Scenario: Замена сохраняет связи

- **WHEN** источник слота `general.green` в группе `accent` заменён на `additional.h190`
- **THEN** ссылки `[general.green.<step>]` токенов MUST остаться без изменений
- **THEN** значения ступеней слота в группе `accent` MUST вычисляться по `additional.h190`, а в других группах MUST NOT измениться

#### Scenario: Нет используемой ступени

- **WHEN** токены группы ссылаются на ступень, которой нет у нового источника
- **THEN** `ds-service` MUST вернуть `409` с кодом `PALETTE_STEP_MISSING` и списком ступеней и MUST NOT изменить данные

### Requirement: Перестройка растяжки от опорного цвета

Редактор SHALL перестраивать растяжку в группе через
`POST /api/ds/tenants/{tenantId}/palette/groups/{key}/ramps/{type}/{shade}/rebuild` с телом
`{ anchorStep, value, preview, editRevision }`. Перестройка SHALL работать в HSL от источника растяжки:
опорная ступень получает тон и насыщенность опорного цвета, остальные — тон, сдвинутый на разницу тонов,
и насыщенность, умноженную на отношение насыщенностей (при насыщенности исходной опорной ступени меньше 3
берётся насыщенность опорного цвета); светлота остаётся из источника. Результат MUST совпадать с эталоном
`palette-golden.json`.

#### Scenario: Предварительный просмотр

- **WHEN** тело содержит `preview: true`
- **THEN** `ds-service` MUST вернуть `200` с вычисленными значениями ступеней и MUST NOT изменить данные и ревизию

#### Scenario: Применение

- **WHEN** тело содержит `anchorStep: 500`, `value: "#1F8A70"` и `preview: false`
- **THEN** растяжка MUST получить правки всех ступеней, `origin = "rebuild"` и `anchor = { step: 500, value: "#1F8A70" }`, ссылки токенов MUST остаться без изменений

#### Scenario: Некорректный опорный цвет

- **WHEN** `value` не соответствует `^#?[0-9A-Fa-f]{6}$` или `anchorStep` нет у источника
- **THEN** `ds-service` MUST вернуть `400`

### Requirement: Правка ступени

Редактор SHALL менять одну ступень растяжки в группе через
`PATCH /api/ds/tenants/{tenantId}/palette/groups/{key}/ramps/{type}/{shade}/steps/{step}` с телом
`{ value, editRevision }`.

#### Scenario: Правка ступени

- **WHEN** ступени `300` задано `#a3d9c5`
- **THEN** правка MUST сохраниться как `#A3D9C5` только для этой группы, а ступень MUST вернуться с `overridden = true`
- **WHEN** правится опорная ступень перестроенной растяжки
- **THEN** `anchor.value` и `displayName` MUST пересчитаться
- **WHEN** ступени нет у источника
- **THEN** `ds-service` MUST вернуть `404`

### Requirement: Удаление растяжки из группы

Редактор SHALL убирать растяжку из группы через
`DELETE /api/ds/tenants/{tenantId}/palette/groups/{key}/ramps/{type}/{shade}` с телом
`{ strategy?, replacement?, editRevision }`. Удаление MUST NOT оставлять ссылки токенов группы на
убранный слот и MUST выполняться атомарно.

#### Scenario: Удаление с заменой

- **WHEN** тело содержит `{ "strategy": "replace", "replacement": { "type": "additional", "shade": "h190" } }`
- **THEN** каждая ссылка токенов группы на слот MUST стать ссылкой на ту же ступень `additional.h190` с прежней прозрачностью, слот замены MUST входить в группу, ответ MUST содержать число переназначенных связей

#### Scenario: Удаление с сохранением как Custom

- **WHEN** тело содержит `{ "strategy": "detach" }`
- **THEN** каждая ссылка токенов группы на слот MUST стать текущим вычисленным HEX с учётом прозрачности

#### Scenario: Ошибки удаления

- **WHEN** у токенов группы есть ссылки на слот, а `strategy` не передан
- **THEN** `ds-service` MUST вернуть `409` с кодом `PALETTE_RAMP_LINKED`
- **WHEN** у замены нет используемой ступени
- **THEN** `ds-service` MUST вернуть `409` с кодом `PALETTE_STEP_MISSING`
- **WHEN** запись любой ссылки завершилась ошибкой
- **THEN** все изменения операции MUST быть откатаны

### Requirement: Права на палитру темы

Чтение палитры темы SHALL требовать `tenants:read`, изменение — `tenants:write`. Поле `canEdit` ответа
чтения SHALL отражать право `tenants:write` текущего участника.

#### Scenario: Изменение без права

- **WHEN** запрос изменения выполняет участник с ролью `viewer` или ключ без `tenants:write`
- **THEN** `ds-service` MUST вернуть `403` и MUST NOT изменить данные

#### Scenario: Признак canEdit

- **WHEN** палитру читает `viewer`
- **THEN** `canEdit` MUST быть `false`
- **WHEN** палитру читает `editor`
- **THEN** `canEdit` MUST быть `true`

### Requirement: Цвета палитры темы для потребителей

`GET /api/ds/tenants/{tenantId}/token-values` SHALL по параметру `resolvePalette=true` заменять ссылки на
палитру в цветовых значениях на HEX, вычисленный по палитре темы с учётом группы токена, и добавлять поле
`paletteRef` с исходной ссылкой. Прозрачность SHALL записываться альфа-каналом `#RRGGBBAA`, где
`AA = round(opacity * 255)`. Без параметра ответ SHALL оставаться прежним.

#### Scenario: Значение по палитре темы

- **WHEN** в группе `accent` слот `general.green` заменён на `additional.h190`, а токен группы `accent` имеет значение `[general.green.500][0.8]`
- **THEN** при `resolvePalette=true` `value` MUST быть `["#RRGGBBCC"]` по ступени `500` растяжки `additional.h190`, а `paletteRef` — `"[general.green.500][0.8]"`
- **THEN** у токена группы `neutral` с той же ссылкой значение MUST браться из библиотеки `general.green.500`

#### Scenario: Ссылка на отсутствующую ступень

- **WHEN** ссылка указывает на слот или ступень, которых нет в библиотеке
- **THEN** значение MUST вернуться без изменений и без поля `paletteRef`

### Requirement: Маршруты палитры в контракте ds-service

Маршруты палитры темы SHALL быть описаны в `contracts/route-manifest.json` с правами из этого требования
и признаком `"origin": "ds-service"`. `/openapi.json` SHALL описывать их по DTO `ds-service`.

#### Scenario: Документ OpenAPI

- **WHEN** клиент запрашивает `/openapi.json`
- **THEN** документ MUST содержать все операции палитры темы
- **THEN** операции без признака `"origin": "ds-service"` MUST по-прежнему совпадать с OpenAPI db-service
