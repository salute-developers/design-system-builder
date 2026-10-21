## ADDED Requirements

### Requirement: Токены размеров и правила имён

`ds-service` SHALL считать токенами размеров радиусы — токены типа `shape` с именем
`^round\.[a-z0-9]+(-[a-z0-9]+)*$`, отступы — типа `spacing` с именем `^spacing\.[a-z0-9]+(-[a-z0-9]+)*$` и тени
— типа `shadow` с именем `^(down|up)\.(soft|hard)\.[a-z0-9]+(-[a-z0-9]+)*$`. Размером тени SHALL считаться
четыре токена `down.soft`, `down.hard`, `up.soft` и `up.hard` с общим последним сегментом имени.

#### Scenario: Токен вне правила

- **WHEN** операция получает `tokenId` токена другого типа или с именем вне правила своего типа
- **THEN** API MUST вернуть `400 INVALID_SIZE_TOKEN` и MUST NOT менять данные

#### Scenario: Размер тени

- **WHEN** операция удаления получает `tokenId` токена `up.hard.m`
- **THEN** API MUST работать с размером `m`: токенами `down.soft.m`, `down.hard.m`, `up.soft.m` и `up.hard.m`

### Requirement: Чтение токенов размеров темы

`ds-service` SHALL предоставлять `GET /api/ds/tenants/{tenantId}/size-tokens` с необязательным `versionId`,
который возвращает радиусы, отступы и тени темы в px и использование токенов в компонентах на выбранной границе:
в активном черновике без `versionId` и в опубликованной версии с ним.

#### Scenario: Ответ

- **WHEN** Viewer читает токены размеров темы
- **THEN** ответ MUST содержать `canEdit`, `radii`, `spacing` и `shadows` и MUST NOT содержать общий счётчик темы
  `editRevision`
- **THEN** радиус и отступ MUST содержать `tokenId`, `name`, `valuePx`, `platforms`, `platformsDiffer` и
  `components: [{ name, count }]`, а радиус — ещё `fullRounding` и `derived`
- **THEN** тень MUST содержать `tokenId`, `name`, `layers: [{ offsetX, offsetY, blur, spread, color }]`,
  `fallbackElevation`, `platforms`, `platformsDiffer` и `components`
- **THEN** `platforms` MUST содержать только платформы `ios` и `android` со своим значением (`overridden: true`):
  число px у радиуса и отступа, `layers` у тени
- **THEN** `native` MUST содержать текущие значения `ios` и `android` в той же форме независимо от признака
- **THEN** токены с именем вне правила своего типа MUST NOT попадать в ответ

#### Scenario: Значения в px

- **WHEN** у `round.m` на вебе `"0.75rem"`, а у `down.soft.s` на вебе
  `["0rem 0.25rem 0.875rem -0.25rem #08080814", "0rem 0.0625rem 0.25rem -0.0625rem #0000000A"]`
- **THEN** `round.m` MUST иметь `valuePx: 12`
- **THEN** `down.soft.s` MUST иметь слои `{ offsetX: 0, offsetY: 4, blur: 14, spread: -4, color: "#08080814" }` и
  `{ offsetX: 0, offsetY: 1, blur: 4, spread: -1, color: "#0000000A" }`
- **THEN** `fallbackElevation` MUST браться из первого слоя значения `android`, а без него быть `0`
- **WHEN** цвет слоя в значении — ссылка на ступень палитры темы
- **THEN** `color` слоя MUST быть раскрытым по палитре на выбранной границе `#RRGGBBAA`, а `colorRef` — исходной
  ссылкой; у HEX-цвета `colorRef` MUST отсутствовать

#### Scenario: Полное скругление

- **WHEN** токен называется `round.circle`
- **THEN** он MUST иметь `fullRounding: true` и `valuePx: null` при любом записанном значении

#### Scenario: Значения платформ расходятся без признака

- **WHEN** у `round.xxl` на вебе `"2rem"`, а на Android и iOS `cornerRadius: 40` с `overridden: false`
- **THEN** токен MUST иметь `valuePx: 32`, пустые `platforms`, `native: { ios: 40, android: 40 }` и
  `platformsDiffer: true`
- **WHEN** у этих значений `overridden: true`
- **THEN** токен MUST иметь `platforms: { ios: 40, android: 40 }` и `platformsDiffer: false`

#### Scenario: Опубликованная версия

- **WHEN** Editor читает токены размеров с `versionId` опубликованной версии дизайн-системы темы
- **THEN** ответ MUST содержать токены, значения, признаки своих значений платформ, использование и вычисляемые
  радиусы, действовавшие на границе этой версии
- **THEN** `canEdit` MUST быть `false`
- **WHEN** `versionId` не относится к опубликованной версии этой дизайн-системы
- **THEN** API MUST вернуть `404`

#### Scenario: Удалённый в черновике токен

- **WHEN** токен удалён в активном черновике, но есть в опубликованной версии
- **THEN** чтение без `versionId` MUST NOT возвращать токен, а чтение с `versionId` этой версии MUST его вернуть

### Requirement: Вычисляемые радиусы из конфигураций компонентов

`ds-service` SHALL возвращать у радиуса `derived: [{ offsetPx, valuePx, usages: [{ component, platform,
parameter }] }]` — значения свойств компонентов дизайн-системы текущей темы на выбранной границе, которые
ссылаются на радиус со смещением в `adjustment` строки значения или в числовой поправке платформенного
параметра. `valuePx` SHALL
быть веб-значением радиуса плюс смещение и SHALL NOT быть меньше 0.

#### Scenario: Смещение в поправке параметра

- **WHEN** у Button веб-параметр `buttonRadius` ссылается на `round.l` (16 px) с поправкой `-2`, а у IconButton
  так же — параметр `iconButtonRadius`
- **THEN** `derived` токена `round.l` MUST содержать `{ offsetPx: -2, valuePx: 14 }` с использованиями
  `{ component: "Button", platform: "web", parameter: "buttonRadius" }` и
  `{ component: "IconButton", platform: "web", parameter: "iconButtonRadius" }`

#### Scenario: Смещение в значении

- **WHEN** у строки значения свойства со ссылкой на `round.m` (12 px) `adjustment` равен `-2`, а поправок
  параметров нет
- **THEN** `derived` токена `round.m` MUST содержать `{ offsetPx: -2, valuePx: 10 }`

#### Scenario: Без смещений

- **WHEN** на радиус ссылаются только значения без смещения
- **THEN** `derived` MUST быть пустым

### Requirement: Использование токена в компонентах

`ds-service` SHALL считать значение свойства компонента дизайн-системы текущей темы на выбранной границе
ссылкой на токен размеров, если оно ссылается на токен через `token_id` или равно его имени. Значения свойств
SHALL читаться из редакций конфигураций компонентов, действующих на этой границе.

#### Scenario: Ссылки на радиус

- **WHEN** у компонента EmptyState три значения свойств ссылаются на `round.m` через `token_id`, а у Slider
  два значения равны `round.m`
- **THEN** `components` токена `round.m` MUST содержать `{ name: "EmptyState", count: 3 }` и
  `{ name: "Slider", count: 2 }`

#### Scenario: Компоненты другой дизайн-системы

- **WHEN** на `round.m` ссылается только компонент другой дизайн-системы
- **THEN** `components` токена MUST NOT содержать этот компонент

#### Scenario: Ссылка удалена в черновике

- **WHEN** значение свойства компонента со ссылкой на `round.m` удалено в активном черновике
- **THEN** `components` без `versionId` MUST NOT учитывать это значение, а чтение опубликованной версии MUST его
  учитывать

### Requirement: Изменение значения токена

`ds-service` SHALL предоставлять `PUT /api/ds/tenants/{tenantId}/size-tokens/{tokenId}/value` с телом
`{ valuePx, platforms?, baseRevisions? }` для радиуса и отступа и `{ layers, fallbackElevation, platforms?,
baseRevisions? }` для тени, который в одной транзакции записывает предметные редакции значений токена только в
текущей теме активного черновика. `platforms` SHALL содержать свои значения `ios` и `android` в той же форме, что
веб-значение. Базовая редакция значения SHALL браться из `baseRevisions` по платформе, а без неё — из заголовка
`X-DS-Base-Revision`.

#### Scenario: Правка радиуса

- **WHEN** Editor отправляет `valuePx: 14` для `round.m`
- **THEN** API MUST записать 14 px в значения `round.m` на всех платформах текущей темы
- **THEN** значения других токенов и других тем MUST NOT измениться

#### Scenario: Правка тени

- **WHEN** Editor отправляет для `down.hard.m` один слой и `fallbackElevation: 4`
- **THEN** API MUST заменить слои `down.hard.m` на всех платформах текущей темы
- **THEN** значения `down.soft.m`, `up.hard.m` и `up.soft.m` MUST NOT измениться

#### Scenario: Своё значение платформы

- **WHEN** Editor отправляет для `round.l` `valuePx: 20` и `platforms: { android: 18 }`
- **THEN** API MUST записать 20 px на веб и iOS с `overridden: false`, а 18 px на Android с `overridden: true`
- **WHEN** следующий запрос для `round.l` содержит `valuePx: 24` без `platforms`
- **THEN** API MUST записать 24 px на все платформы с `overridden: false` и изменёнными путями `/value` и
  `/overridden` у тех значений, где они поменялись

#### Scenario: Свои слои платформы у тени

- **WHEN** Editor отправляет для `down.hard.m` слои веба и `platforms: { ios: { layers } }`
- **THEN** API MUST записать на iOS переданные слои с `overridden: true`, а на Android — слои веба с
  `overridden: false`

#### Scenario: Полное скругление не правится

- **WHEN** Editor отправляет `valuePx` для `round.circle`
- **THEN** API MUST вернуть `400 INVALID_SIZE_TOKEN` и MUST NOT менять данные

#### Scenario: Тело не того вида

- **WHEN** для радиуса или отступа приходят `layers`, а для тени — `valuePx`
- **THEN** API MUST вернуть `400 INVALID_SIZE_VALUE`

#### Scenario: Ответ изменения

- **WHEN** изменение выполнено
- **THEN** API MUST вернуть `200` с `kind`, токеном в формате чтения и записанными значениями
  `[{ platform, value, overridden }]`
- **THEN** технические редакции записанных значений MUST передаваться в заголовке `X-DS-Mutation-Metadata`, как у
  других мутаций дизайн-системы

#### Scenario: Значение снова равно опубликованному

- **WHEN** правка вернула все значения токена к состоянию предыдущей опубликованной границы
- **THEN** черновые редакции этих значений MUST быть удалены, а журнал MUST NOT содержать их изменения

### Requirement: Значения пишутся в формате платформ

`ds-service` SHALL переводить целые px в формат каждой платформы по таблице `design.md` и SHALL писать `rem`
без лишних нулей.

#### Scenario: Радиус и отступ на вебе и Android

- **WHEN** записывается радиус 12 px
- **THEN** значение `web` MUST быть `["0.75rem"]`, а `android` — `[{ "kind": "round", "cornerRadius": 12 }]`
- **WHEN** записывается отступ 0 px
- **THEN** значение `web` MUST быть `["0rem"]`, а `android` — `[{ "value": 0 }]`

#### Scenario: Тень на вебе и Android

- **WHEN** записывается тень со слоями `{ 0, 4, 14, -4, "#08080814" }` и `{ 0, 1, 4, -1, "#0000000A" }` и
  `fallbackElevation: 2`
- **THEN** значение `web` MUST быть `["0rem 0.25rem 0.875rem -0.25rem #08080814",
  "0rem 0.0625rem 0.25rem -0.0625rem #0000000A"]`
- **THEN** значение `android` MUST содержать в первом слое `fallbackElevation: 2`, во втором — `0`, и
  `offsetX`, `offsetY`, `blurRadius`, `spreadRadius`, `color` каждого слоя

#### Scenario: Остальные платформы

- **WHEN** записывается радиус, отступ или тень без своего значения платформы
- **THEN** значения остальных платформ MUST получить те же числа в формате платформы по таблице `design.md`
- **THEN** у значения `web` признак `overridden` MUST быть `false`
- **THEN** `fallbackElevation` MUST NOT записываться на платформах, кроме `android`

### Requirement: Проверка значений

`ds-service` SHALL отклонять создание и изменение с неверным значением ответом `400 INVALID_SIZE_VALUE` с
`message` и путём поля в `details.field` по таблице проверок `design.md` и SHALL NOT сохранять ни одну редакцию
запроса.

#### Scenario: Дробное значение

- **WHEN** `valuePx` равно 12.5
- **THEN** `message` MUST быть «Размер должен быть целым числом.»

#### Scenario: Вне диапазона

- **WHEN** `valuePx` радиуса равно 1200 или `valuePx` отступа равно 140
- **THEN** `message` MUST быть «Значение должно быть в диапазоне 0–1000 px.» или «Значение должно быть в
  диапазоне 0–128 px.»

#### Scenario: Слои тени

- **WHEN** у тени нет слоёв, слоёв больше четырёх или цвет слоя не `#RRGGBB`, не `#RRGGBBAA` и не ссылка на
  ступень палитры темы
- **THEN** API MUST вернуть `400 INVALID_SIZE_VALUE` с `details.field` слоя и текстом из таблицы `design.md`

#### Scenario: Свои значения платформ

- **WHEN** в `platforms` есть ключ, кроме `ios` и `android`, или значение платформы неверно
- **THEN** API MUST вернуть `400 INVALID_SIZE_VALUE` с `details.field` платформы, например `platforms.android`

### Requirement: Цвет слоя тени ссылается на ступень палитры

Цвет слоя тени SHALL быть HEX-цветом или ссылкой на ступень палитры темы `[type.shade.step]` с необязательной
прозрачностью `[type.shade.step][opacity]`, как стопы градиента в `add-color-token-gradients`. Ссылка SHALL
храниться в значении на месте цвета на всех платформах и SHALL раскрываться в HEX при чтении, чтобы
потребители (`theme fetch`, генерация пакета, плагин) получали HEX без доработок.

#### Scenario: Запись ссылки

- **WHEN** Editor отправляет для `down.hard.m` слой с `color: "[general.gray.900][0.16]"`
- **THEN** API MUST проверить, что ступень есть в палитре темы активного черновика, и записать ссылку в цвет слоя
  значений `web`, `ios` и `android`
- **WHEN** ступени нет в палитре темы
- **THEN** API MUST вернуть `400 INVALID_SIZE_VALUE` с `details.field` цвета слоя и MUST NOT менять данные

#### Scenario: Чтение значений темы

- **WHEN** клиент или `theme fetch` читает `GET /tenants/{id}/token-values` с тенью, у слоя которой цвет —
  ссылка
- **THEN** значение MUST содержать раскрытый `#RRGGBBAA` на месте ссылки, а исходное значение — в `sourceValue`

#### Scenario: Ступень палитры изменилась

- **WHEN** в палитре темы изменили ступень Gray 900
- **THEN** чтение тени MUST вернуть новый раскрытый цвет без новой редакции значения тени

#### Scenario: Связи и удаление растяжки

- **WHEN** на растяжку Gray ссылается слой тени
- **THEN** связи растяжки MUST учитывать эту тень, а удаление растяжки MUST переписать ссылку слоя так же, как
  ссылки цветов и стопов градиента
- **WHEN** в журнале отменяют правку тени, восстанавливающую ссылку на растяжку, удалённую в черновике
- **THEN** API MUST вернуть `409 REVERT_DEPENDENCY_CONFLICT`

### Requirement: Создание токена размеров

`ds-service` SHALL предоставлять `POST /api/ds/tenants/{tenantId}/size-tokens` с необязательным заголовком
`Idempotency-Key`, который в одной транзакции создаёт в активном черновике радиус, отступ или размер тени и
записывает переданные значения во все темы дизайн-системы текущей темы.

#### Scenario: Радиус или отступ

- **WHEN** Maintainer отправляет `{ kind: "radius", name: "xxxl", valuePx: 40 }`
- **THEN** API MUST создать токен `round.xxxl` типа `shape` и записать 40 px во все темы дизайн-системы
- **THEN** API MUST вернуть `201` с `kind` и созданным токеном в формате чтения, а технические редакции — в
  `X-DS-Mutation-Metadata`

#### Scenario: Размер тени

- **WHEN** Maintainer отправляет `{ kind: "shadow", name: "xl", variants }` со слоями и
  `fallbackElevation` для `down.soft`, `down.hard`, `up.soft` и `up.hard`
- **THEN** API MUST создать токены `down.soft.xl`, `down.hard.xl`, `up.soft.xl` и `up.hard.xl` со значениями
  во всех темах дизайн-системы
- **WHEN** в `variants` нет одного из четырёх вариантов
- **THEN** API MUST вернуть `400 INVALID_SIZE_VALUE` и MUST NOT создавать токены

#### Scenario: Повтор запроса

- **WHEN** клиент повторяет создание с тем же `Idempotency-Key` и тем же телом
- **THEN** API MUST вернуть сохранённые статус и тело без повторного создания
- **WHEN** тот же ключ приходит с другим телом
- **THEN** API MUST вернуть `409 IDEMPOTENCY_KEY_REUSED` и MUST NOT создавать токены

#### Scenario: Имя занято или недопустимо

- **WHEN** токен с любым из создаваемых имён действует в активном черновике дизайн-системы
- **THEN** API MUST вернуть `409 TOKEN_NAME_CONFLICT` и MUST NOT создавать токены
- **WHEN** два запроса параллельно создают одно имя
- **THEN** API MUST обработать их последовательно под блокировкой имени, и только один MUST завершиться созданием
- **WHEN** токен с этим именем удалён в активном черновике
- **THEN** имя MUST считаться свободным, а новый токен MUST получить отдельную логическую идентичность
- **WHEN** имя пустое или содержит символы вне `a-z`, `0-9` и `-`
- **THEN** API MUST вернуть `400 INVALID_TOKEN_NAME`

### Requirement: Удаление токена размеров

`ds-service` SHALL предоставлять `DELETE /api/ds/tenants/{tenantId}/size-tokens/{tokenId}`, который в одной
транзакции логически удаляет из активного черновика токен, а для тени — все четыре варианта размера, с их
значениями во всех темах. Удаление SHALL выражаться редакциями с `deleted = true` и SHALL NOT уничтожать данные
опубликованных версий.

#### Scenario: Успешное удаление

- **WHEN** Maintainer удаляет `round.m`, на который ссылаются свойства компонентов
- **THEN** токен и его значения во всех темах MUST исчезнуть из чтения активного черновика, а ссылки свойств
  компонентов на него MUST стать пустыми в активном черновике
- **THEN** API MUST вернуть `200` с `deletedTokenIds`, а технические редакции — в `X-DS-Mutation-Metadata`
- **THEN** опубликованные версии MUST сохранять токен, значения и ссылки компонентов

#### Scenario: Удаление токена, созданного в черновике

- **WHEN** удаляется токен, созданный в том же активном черновике и не имеющий опубликованной истории
- **THEN** его черновые редакции и устойчивые строки MUST быть удалены, а журнал MUST NOT содержать ни создания,
  ни удаления

#### Scenario: Полное скругление удаляется

- **WHEN** Maintainer удаляет `round.circle`
- **THEN** API MUST удалить токен так же, как другие радиусы

### Requirement: Предметные редакции в операциях токена размеров

Операции изменения, создания и удаления SHALL записывать предметные редакции определений и значений токенов по
механизму многопользовательского редактирования дизайн-системы (`multi-user-design-system-editing`) и SHALL NOT
использовать общий счётчик темы `editRevision` или `409 TENANT_EDIT_CONFLICT`.

#### Scenario: Пользователи правят разные токены

- **WHEN** два пользователя параллельно меняют `round.m` и `round.l` одной темы с устаревшими базовыми редакциями
- **THEN** обе операции MUST завершиться успешно без конфликта

#### Scenario: Пользователи правят одно значение

- **WHEN** запрос меняет значение `round.m` на вебе, изменённое другим пользователем после его базовой редакции
- **THEN** API MUST применить последнюю успешно зафиксированную запись
- **THEN** `X-DS-Mutation-Metadata` MUST содержать предупреждение с путём и актуальной редакцией значения

#### Scenario: Правка опубликованной версии

- **WHEN** запрос изменения, создания или удаления содержит `versionId`
- **THEN** API MUST вернуть `400 historical_version_read_only` и MUST NOT менять данные

#### Scenario: Ошибка внутри операции

- **WHEN** любая проверка или запись завершилась ошибкой
- **THEN** API MUST NOT фиксировать ни одну предметную редакцию и ключ повторяемости запроса

### Requirement: Признак своего значения платформы хранится в редакции значения

`ds-service` SHALL хранить признак `overridden` значения токена размеров в редакции значения
(`token_value_revisions.overridden`, вводится `add-color-token-gradients`) и SHALL включать его в изменённые пути,
журнал и откат.

#### Scenario: Журнал показывает своё значение платформы

- **WHEN** Editor задал `round.l` своё значение Android 18 px
- **THEN** журнал активного черновика MUST содержать изменение значения Android с путями `/value` и `/overridden`

#### Scenario: Откат своего значения платформы

- **WHEN** пользователь откатывает в журнале изменение значения Android токена `round.l`
- **THEN** значение и признак `overridden` MUST вернуться к состоянию предыдущей опубликованной границы

#### Scenario: Публикация сохраняет признак

- **WHEN** версия с своим значением Android опубликована
- **THEN** чтение этой версии с `versionId` MUST вернуть `platforms: { android: 18 }`

### Requirement: Права операций над токенами размеров

Чтение SHALL требовать `tenants:read`, изменение значения — `tenants:write`, создание — дополнительно
`tokens:write`, удаление — дополнительно `tokens:delete`.

#### Scenario: Viewer читает опубликованную версию

- **WHEN** Viewer читает токены размеров с `versionId` опубликованной версии своего проекта
- **THEN** API MUST вернуть данные версии с `canEdit: false`

#### Scenario: Viewer меняет значение

- **WHEN** Viewer отправляет изменение значения
- **THEN** API MUST вернуть `403`

#### Scenario: Editor удаляет токен

- **WHEN** пользователь с ролью Editor удаляет токен
- **THEN** API MUST вернуть `403` и MUST NOT удалять данные

#### Scenario: Тема другого проекта или токен другой дизайн-системы

- **WHEN** тема не принадлежит проекту или `tokenId` не принадлежит дизайн-системе темы
- **THEN** API MUST вернуть `404`

### Requirement: Операции опубликованы в контракте ds-service

Операции токенов размеров SHALL быть описаны в `contracts/route-manifest.json` с `origin: ds-service` и в
`openapi/documentation.yaml` со схемами запросов, ответов, кодами ошибок и общими параметрами и заголовками
многопользовательского редактирования.

#### Scenario: Документ OpenAPI

- **WHEN** `ds-service` отдаёт OpenAPI
- **THEN** документ MUST содержать чтение, изменение значения, создание и удаление токенов размеров с их
  схемами
- **THEN** чтение MUST ссылаться на параметр `VersionId`, изменение и удаление — на `OptionalBaseRevision`,
  создание — на `OptionalBaseRevision` и `OptionalIdempotencyKey`
- **THEN** успешные ответы мутаций MUST описывать заголовки `X-DS-Mutation-Metadata` и
  `X-DS-Mutation-Metadata-Truncated`
- **THEN** операции манифеста и документа MUST совпадать
