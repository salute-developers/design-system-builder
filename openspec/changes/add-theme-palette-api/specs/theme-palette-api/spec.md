## ADDED Requirements

### Requirement: Палитра темы — копия шаблона

Общая палитра (`palette`) SHALL служить шаблоном. Палитра темы SHALL быть независимой копией шаблона:
при создании темы `ds-service` MUST скопировать все ступени общей палитры в копию шаблона темы и создать
системные группы. Значения ступеней, источники замены, перестройка, `templateValue` и `offBrand` SHALL
вычисляться только по копии шаблона темы.

#### Scenario: Копия при создании темы

- **WHEN** редактор создаёт тему `POST /api/ds/tenants`
- **THEN** в той же транзакции `ds-service` MUST сохранить копию всех ступеней общей палитры и системные группы `neutral`, `accent`, `status`, `data`, `syntax` этой темы

#### Scenario: Существующие темы

- **WHEN** применяется миграция `V3`
- **THEN** каждая существующая тема MUST получить копию общей палитры на момент миграции и системные группы

#### Scenario: Изменение шаблона не меняет темы

- **WHEN** системный администратор меняет значение `general.green.500` в общей палитре
- **THEN** палитра и вычисленные цвета токенов уже созданных тем MUST остаться прежними
- **THEN** тема, созданная после изменения, MUST получить новое значение

#### Scenario: Палитры тем независимы

- **WHEN** в теме A заменён источник слота `general.green` в группе Accent
- **THEN** палитра темы B той же дизайн-системы и общая палитра MUST NOT измениться

### Requirement: Ссылка значения токена на палитру

`ds-service` SHALL считать ссылкой на палитру цветовое значение токена в одной из двух форм: строку
`[<type>.<shade>.<step>]` с необязательным суффиксом прозрачности `[<opacity>]` в `value` (элемент
массива или скаляр) либо `palette_id` на строку общей палитры со значением `null`, `[]` или
`[<opacity>]`. Пара `(type, shade)` ссылки SHALL обозначать слот растяжки в группе токена; значение SHALL
разрешаться по палитре темы.

#### Scenario: Обе формы ссылки

- **WHEN** у одного токена значение `["[general.amber.300][0.56]"]`, а у другого — `palette_id` на `general.amber.300` и `value = ["0.56"]`
- **THEN** оба значения MUST считаться ссылкой на ступень `300` слота `general.amber` с прозрачностью `0.56`

### Requirement: Группы палитры темы

Каждая группа палитры темы SHALL храниться строкой с UUID `id`, признаком `kind` (`system` или `custom`) и
`systemKey`, который задан только у системных групп. Системные группы `neutral` («Neutral»), `accent`
(«Accent»), `status` («Статус»), `data` («Data»), `syntax` («Syntax») SHALL идти в этом порядке, за ними —
пользовательские в порядке создания. API, растяжки, привязки токенов и связи SHALL ссылаться на группу
только по `id`.

#### Scenario: Создание пользовательской группы

- **WHEN** редактор отправляет `POST /api/ds/tenants/{tenantId}/palette/groups` с `{ "label": "Avatars", "editRevision": 4 }`
- **THEN** `ds-service` MUST вернуть `201` с `{ editRevision: 5, value: { id, kind: "custom", systemKey: null, label: "Avatars", ramps: [] } }`, где `id` — новый UUID

#### Scenario: Некорректное или повторное название

- **WHEN** `label` пуст после обрезки пробелов или длиннее 64 символов
- **THEN** `ds-service` MUST вернуть `400`
- **WHEN** название совпадает с существующим в теме без учёта регистра, включая названия системных групп
- **THEN** `ds-service` MUST вернуть `409` с кодом `PALETTE_GROUP_EXISTS`

#### Scenario: Удаление пользовательской группы

- **WHEN** редактор отправляет `DELETE /api/ds/tenants/{tenantId}/palette/groups/{groupId}` для пользовательской группы
- **THEN** растяжки группы с источником и правками ступеней MUST перейти в группу `neutral`; при совпадении слота MUST остаться растяжка `neutral`
- **THEN** явные привязки токенов к группе MUST быть удалены, и эти токены MUST вернуться к группе по умолчанию

#### Scenario: Системная группа

- **WHEN** запрос удаляет группу с `kind = "system"`
- **THEN** `ds-service` MUST вернуть `409` с кодом `PALETTE_GROUP_SYSTEM`

#### Scenario: Группа другой темы

- **WHEN** `{groupId}` принадлежит другой теме
- **THEN** `ds-service` MUST вернуть `404`

### Requirement: Группа токена

Цветовой токен SHALL принадлежать ровно одной группе палитры темы. Принадлежность SHALL задаваться явной
привязкой; для токена без привязки SHALL применяться группа по умолчанию по правилу имени без префикса
режима: начинается с `data.` — `data`; последний сегмент содержит `accent` или `promo` — `accent`;
содержит `positive`, `negative`, `warning` или `info` — `status`; иначе — `neutral`. Правило по умолчанию
SHALL NOT выбирать пользовательскую группу. Результат правила MUST совпадать с эталоном
`js/apps/client/src/modules/palette/fixtures/palette-golden.json`.

#### Scenario: Группа по умолчанию

- **WHEN** у токенов `data.default.yellow-hover`, `surface.default.transparent-accent-hover`, `text.default.promo`, `outline.default.positive-minor`, `text.default.primary` нет привязки
- **THEN** их группы MUST быть соответственно системные `data`, `accent`, `accent`, `status`, `neutral` с `assignment = "default"`

#### Scenario: Явная привязка

- **WHEN** редактор отправляет `PUT /api/ds/tenants/{tenantId}/palette/token-groups/{tokenId}` с `{ "groupId": "<id группы Avatars>", "editRevision": 5 }`
- **THEN** `ds-service` MUST вернуть `{ editRevision: 6, value: { tokenId, tokenName, groupId, assignment: "explicit" } }`
- **THEN** связи токена MUST учитываться в группе «Avatars», а его цвет MUST вычисляться по её экземплярам растяжек

#### Scenario: Сброс привязки

- **WHEN** тело содержит `{ "groupId": null }`
- **THEN** явная привязка MUST быть удалена, а токен MUST вернуться к группе по умолчанию

#### Scenario: Некорректная привязка

- **WHEN** токен не является цветовым токеном дизайн-системы темы или группа принадлежит другой теме
- **THEN** `ds-service` MUST вернуть `404`

### Requirement: Состав и значения растяжек

Состав группы SHALL быть объединением слотов, на которые ссылаются цветовые значения токенов этой группы в
теме, и слотов, добавленных или изменённых в группе. Значение ступени SHALL вычисляться так: правка
ступени в группе, иначе значение копии шаблона темы для источника растяжки, где источник — заменённая
растяжка группы, иначе сам слот.

#### Scenario: Чтение палитры темы

- **WHEN** участник проекта отправляет `GET /api/ds/tenants/{tenantId}/palette`
- **THEN** `ds-service` MUST вернуть `200` и `ThemePalette { tenantId, editRevision, canEdit, offBrand, groups, tokens }`
- **THEN** каждая группа MUST содержать `id`, `kind`, `systemKey`, `label` и `ramps`
- **THEN** каждая растяжка MUST содержать `slot`, `source`, `displayName`, `origin` (`template` или `rebuild`), `anchor`, `added`, `modified`, `linkedCount` и `steps`, а каждая ступень — `step`, `value`, `templateValue`, `overridden` и `linkedCount`
- **THEN** `tokens` MUST содержать для каждого цветового токена дизайн-системы `tokenId`, `tokenName`, `groupId` и `assignment` (`explicit` или `default`)

#### Scenario: Порядок растяжек

- **WHEN** группа содержит растяжки `additional.h20`, `general.red` и `additional.h3`
- **THEN** растяжки MUST идти в порядке `general.red`, `additional.h3`, `additional.h20`

#### Scenario: Подсчёт связей

- **WHEN** токен группы `accent` в режимах `light` и `dark` на трёх платформах ссылается на `[general.green.500]`
- **THEN** `linkedCount` ступени `500` слота `general.green` группы `accent` MUST быть `2`: по одной связи на пару «токен, режим»

#### Scenario: Изменённая растяжка и палитра вне бренда

- **WHEN** у растяжки есть правка ступени
- **THEN** `modified` растяжки и `overridden` правленых ступеней MUST быть `true`
- **WHEN** у любой растяжки темы есть правка ступени или заменённый источник
- **THEN** `offBrand` MUST быть `true`

#### Scenario: Отображаемое имя растяжки

- **WHEN** вычисляется `displayName`
- **THEN** результат MUST совпадать с эталоном `palette-golden.json`: имя источника для неперестроенной растяжки и ближайшее к тону опорного цвета название для перестроенной

#### Scenario: Тема чужого проекта

- **WHEN** тенант `{tenantId}` принадлежит дизайн-системе другого проекта
- **THEN** `ds-service` MUST вернуть `404` на любой запрос палитры этой темы

### Requirement: Связанные токены растяжки

`ds-service` SHALL возвращать связи токенов темы со слотом через
`GET /api/ds/tenants/{tenantId}/palette/links` с параметрами `type`, `shade`, необязательными `groupId` и
`step`.

#### Scenario: Связи в группе

- **WHEN** запрос содержит `type=general&shade=green&groupId=<id группы Accent>`
- **THEN** ответ MUST содержать `PaletteLink { tokenId, tokenName, displayName, groupId, mode, step, opacity, platforms }` только для токенов этой группы, ссылающихся на слот, уникальные по паре `(tokenId, mode)`

#### Scenario: Связи по ступени во всех группах

- **WHEN** запрос не содержит `groupId`, но содержит `step=500`
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

### Requirement: Добавление растяжки в группу

Редактор SHALL добавлять растяжку копии шаблона темы в группу через
`POST /api/ds/tenants/{tenantId}/palette/groups/{groupId}/ramps` с телом `{ type, shade, editRevision }`.

#### Scenario: Добавление и повтор

- **WHEN** растяжки нет в группе
- **THEN** `ds-service` MUST вернуть `201` и растяжку с `added = true` и источником, равным слоту
- **WHEN** слот уже входит в группу
- **THEN** `ds-service` MUST вернуть `409` с кодом `PALETTE_RAMP_EXISTS`
- **WHEN** пары `(type, shade)` нет в копии шаблона темы
- **THEN** `ds-service` MUST вернуть `404`

### Requirement: Замена растяжки в группе

Редактор SHALL заменять источник растяжки только внутри одной группы через
`PUT /api/ds/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}/source`. Источником SHALL быть
растяжка копии шаблона темы. Слот и ссылки токенов SHALL сохраняться, правки ступеней и данные перестройки
растяжки в группе SHALL сбрасываться.

#### Scenario: Замена сохраняет связи

- **WHEN** источник слота `general.green` в группе Accent заменён на `additional.h190`
- **THEN** ссылки `[general.green.<step>]` токенов MUST остаться без изменений
- **THEN** значения ступеней слота в группе Accent MUST вычисляться по `additional.h190` из копии шаблона темы, а в других группах MUST NOT измениться

#### Scenario: Нет используемой ступени

- **WHEN** токены группы ссылаются на ступень, которой нет у нового источника
- **THEN** `ds-service` MUST вернуть `409` с кодом `PALETTE_STEP_MISSING` и списком ступеней и MUST NOT изменить данные

### Requirement: Перестройка растяжки от опорного цвета

Редактор SHALL перестраивать растяжку в группе через
`POST /api/ds/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}/rebuild` с телом
`{ anchorStep, value, preview, editRevision }`. Перестройка SHALL работать в HSL от источника растяжки в
копии шаблона темы: опорная ступень получает тон и насыщенность опорного цвета, остальные — тон, сдвинутый
на разницу тонов, и насыщенность, умноженную на отношение насыщенностей (при насыщенности исходной опорной
ступени меньше 3 берётся насыщенность опорного цвета); светлота остаётся из источника. Результат MUST
совпадать с эталоном `palette-golden.json`.

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
`PATCH /api/ds/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}/steps/{step}` с телом
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
`DELETE /api/ds/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}` с телом
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

- **WHEN** в группе Accent слот `general.green` заменён на `additional.h190`, а токен группы Accent имеет значение `[general.green.500][0.8]`
- **THEN** при `resolvePalette=true` `value` MUST быть `["#RRGGBBCC"]` по ступени `500` растяжки `additional.h190` копии шаблона темы, а `paletteRef` — `"[general.green.500][0.8]"`
- **THEN** у токена группы Neutral с той же ссылкой значение MUST браться из копии шаблона темы для `general.green.500`

#### Scenario: Ссылка на отсутствующую ступень

- **WHEN** ссылка указывает на слот или ступень, которых нет в копии шаблона темы
- **THEN** значение MUST вернуться без изменений и без поля `paletteRef`

### Requirement: Маршруты палитры в контракте ds-service

Маршруты палитры темы SHALL быть описаны в `contracts/route-manifest.json` с правами из этого изменения и
признаком `"origin": "ds-service"`. `/openapi.json` SHALL описывать их по DTO `ds-service`.

#### Scenario: Документ OpenAPI

- **WHEN** клиент запрашивает `/openapi.json`
- **THEN** документ MUST содержать все операции палитры темы
- **THEN** операции без признака `"origin": "ds-service"` MUST по-прежнему совпадать с OpenAPI db-service
