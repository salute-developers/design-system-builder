## ADDED Requirements

### Requirement: Стиль типографии — три токена начертаний

`ds-service` SHALL считать стилем типографии три токена типа `typography` с именами
`<экран>.<группа>.<размер>.normal`, `.medium` и `.bold`, где экран — `screen-s`, `screen-m` или `screen-l`.
Операции над стилем SHALL принимать `tokenId` любого токена стиля на любом экране.

#### Scenario: Стиль по идентификатору токена

- **WHEN** операция получает `tokenId` токена `screen-m.body.m.bold`
- **THEN** API MUST работать со стилем `body.m` на экране `screen-m`

#### Scenario: Токен вне правила стиля

- **WHEN** `tokenId` принадлежит токену не типа `typography` или с именем вне правила `^screen-(s|m|l)\.[a-z]+\.[a-z0-9]+\.(normal|medium|bold)$`
- **THEN** API MUST вернуть `400 INVALID_TYPOGRAPHY_STYLE` и MUST NOT менять данные

### Requirement: Чтение стилей темы

`ds-service` SHALL предоставлять `GET /api/ds/tenants/{tenantId}/typography-styles` с необязательным `versionId`,
который возвращает стили темы по экранам в px, семейства шрифтов дизайн-системы и использование стилей в
компонентах на выбранной временной границе: в активном черновике без `versionId` и в опубликованной версии с ним.

#### Scenario: Ответ со стилями

- **WHEN** Viewer читает стили темы
- **THEN** ответ MUST содержать `canEdit`, `themeCount`, `families: [{ name, fontName }]` и `screens: [{ screen, styles }]`
- **THEN** каждый стиль MUST содержать `group`, `size`, `sizePx`, `lineHeightPx`, `letterSpacingEm`, `fontFamily`, `variants` с `tokenId`, `weight` и `valueRevisions` для `normal`, `medium`, `bold` и `components: [{ name, count }]`
- **THEN** ответ MUST NOT содержать общий счётчик темы `editRevision`

#### Scenario: Технические редакции значений

- **WHEN** у токена начертания есть значения текущей темы для платформ
- **THEN** `valueRevisions` начертания MUST содержать для каждой такой платформы `{ platform, valueId, revision }`, где `valueId` — устойчивый идентификатор значения, а `revision` — его техническая редакция на выбранной границе
- **THEN** у значения, которое ещё не менялось в активном черновике, `revision` MUST быть `0`

#### Scenario: Значения в px

- **WHEN** у токена `screen-l.body.m.normal` на вебе `fontSize: "1rem"`, `lineHeight: "1.25rem"`, `letterSpacing: "-0.02em"`
- **THEN** стиль MUST иметь `sizePx: 16`, `lineHeightPx: 20` и `letterSpacingEm: -0.02`
- **WHEN** `letterSpacing` на вебе равен `"normal"`
- **THEN** `letterSpacingEm` MUST быть `0`

#### Scenario: Состав стилей из темы

- **WHEN** в дизайн-системе нет токенов `screen-*.header.h6.*`
- **THEN** ответ MUST NOT содержать стиль `header.h6`
- **THEN** токены типографии с именем вне правила стиля MUST NOT попадать в ответ

#### Scenario: Семейства шрифтов

- **WHEN** в дизайн-системе есть токены `fontFamily` `display` и `body`, а у `body` в текущей теме на вебе `name: "SB Sans Text"`
- **THEN** `families` MUST содержать `{ name: "body", fontName: "SB Sans Text" }` и `display`
- **THEN** `fontFamily` стиля MUST быть именем токена из `fontFamilyRef` его значения на вебе

#### Scenario: Опубликованная версия

- **WHEN** клиент передаёт `versionId` опубликованной версии дизайн-системы темы, а после публикации размер Body M изменён в черновике
- **THEN** API MUST вернуть стили, семейства, число тем и использование в компонентах на границе этой версии с прежним размером
- **THEN** `canEdit` MUST быть `false` независимо от прав пользователя

#### Scenario: Недоступная версия

- **WHEN** `versionId` не является опубликованной версией дизайн-системы этого проекта
- **THEN** API MUST вернуть `404`

### Requirement: Использование стиля в компонентах

`ds-service` SHALL считать значение свойства компонента дизайн-системы текущей темы ссылкой на стиль, если оно
равно имени начертания стиля без экрана или с экраном либо ссылается через `token_id` на токен стиля.
Значения свойств, стили компонентов и токены SHALL читаться по их последним предметным редакциям на той же
временной границе, что и стили; значения и стили, удалённые на этой границе, SHALL NOT учитываться.

#### Scenario: Ссылка текстом без экрана

- **WHEN** у компонента Button четыре значения свойств `body.l.bold`, а у Select одно значение `body.l.normal`
- **THEN** стиль `body.l` на каждом экране MUST содержать `components` с `{ name: "Button", count: 4 }` и `{ name: "Select", count: 1 }`

#### Scenario: Другие формы ссылки

- **WHEN** значение свойства равно `screen-l.body.l.medium` или ссылается через `token_id` на токен `screen-s.body.l.bold`
- **THEN** это значение MUST учитываться в `components` стиля `body.l`

#### Scenario: Компоненты другой дизайн-системы

- **WHEN** ссылка на `body.l.bold` есть только у компонента другой дизайн-системы
- **THEN** `components` стиля MUST NOT содержать этот компонент

#### Scenario: Значение свойства изменено в черновике

- **WHEN** после публикации значение свойства со ссылкой на `body.l.bold` изменено в черновике на `body.m.bold`
- **THEN** чтение черновика MUST учитывать это значение в `components` стиля `body.m`, а не `body.l`
- **THEN** чтение опубликованной версии MUST учитывать его в `components` стиля `body.l`

### Requirement: Изменение стиля

`ds-service` SHALL предоставлять `PATCH /api/ds/tenants/{tenantId}/typography-styles/{tokenId}` с телом
`{ size?, lineHeight?, letterSpacing?, weights?, fontFamily?, baseRevisions? }`, который в одной транзакции
записывает предметные редакции значений токенов стиля только в текущей теме активного черновика.

#### Scenario: Размеры на выбранном экране

- **WHEN** Editor отправляет `size: 18` для `tokenId` токена `screen-l.body.m.normal`
- **THEN** API MUST записать размер 18 px в токены `screen-l.body.m.normal`, `.medium` и `.bold`
- **THEN** значения токенов `screen-m.body.m.*` и `screen-s.body.m.*` MUST NOT измениться

#### Scenario: Вес начертания на всех экранах

- **WHEN** Editor отправляет `weights: { bold: 700 }`
- **THEN** API MUST записать вес 700 в токены `screen-s.body.m.bold`, `screen-m.body.m.bold` и `screen-l.body.m.bold`
- **THEN** веса других начертаний MUST NOT измениться

#### Scenario: Семейство на всех экранах

- **WHEN** Editor отправляет `fontFamily: "display"`
- **THEN** API MUST записать `fontFamilyRef: "fontFamily.display"` во все девять токенов стиля

#### Scenario: Другие темы не меняются

- **WHEN** стиль изменён в теме A дизайн-системы с темами A и B
- **THEN** значения токенов и их технические редакции в теме B MUST NOT измениться

#### Scenario: Записываются только изменённые значения

- **WHEN** после перевода в формат платформы значение токена не изменилось
- **THEN** API MUST NOT создавать для него предметную редакцию

#### Scenario: Изменение попадает в журнал

- **WHEN** изменение стиля сохранено в активном черновике
- **THEN** журнал черновика дизайн-системы MUST содержать записи `token-value` изменённых значений
- **THEN** откат такой записи существующей ручкой отката MUST восстанавливать значение предыдущей опубликованной границы

#### Scenario: Ответ изменения

- **WHEN** изменение выполнено
- **THEN** API MUST вернуть `200` со стилем на экране токена из пути в формате чтения и записанными значениями токенов `[{ tokenId, name, values: [{ platform, value }] }]`
- **THEN** технические редакции записанных значений MUST быть в заголовке `X-DS-Mutation-Metadata`, а при обрезке заголовка MUST быть заголовок `X-DS-Mutation-Metadata-Truncated: true`
- **THEN** тело ответа MUST NOT содержать `editRevision`
- **THEN** `components` стиля в ответе MUST быть пустым: использование от правки не меняется, клиент берёт его из чтения

### Requirement: Значения пишутся в формате платформ

`ds-service` SHALL переводить размер и высоту строки в px, трекинг в em и вес числом в формат каждой платформы и
SHALL сохранять остальные поля значения токена без изменений.

#### Scenario: Веб

- **WHEN** записываются размер 18, высота строки 22, трекинг −0.02 и вес 600
- **THEN** значение `web` MUST содержать `fontSize: "1.125rem"`, `lineHeight: "1.375rem"`, `letterSpacing: "-0.02em"` и `fontWeight: "600"`
- **WHEN** трекинг равен 0
- **THEN** `letterSpacing` на вебе MUST быть `"normal"`

#### Scenario: Android

- **WHEN** записываются размер 18, высота строки 22, трекинг −0.02 и вес 600
- **THEN** значение `android` MUST содержать `textSize: 18`, `lineHeight: 22`, `letterSpacing: -0.02` и `fontWeight: 600`

#### Scenario: Остальные платформы и поля

- **WHEN** записываются размер, высота строки, трекинг и вес
- **THEN** значения остальных платформ MUST получить те же числа в своих полях, а вес — в формате платформы по таблице `design.md`
- **THEN** `fontStyle` и другие поля, которые операция не меняет, MUST остаться прежними
- **THEN** API MUST писать только платформы, у которых у токена уже есть значение

#### Scenario: Нет значений стиля в теме

- **WHEN** у токена стиля, которого касается изменение, в текущей теме нет ни одного значения
- **THEN** API MUST вернуть `409 TYPOGRAPHY_VALUES_MISSING` и MUST NOT сохранять ни одно значение запроса

### Requirement: Свои значения платформ

`ds-service` SHALL считать поле значения iOS или Android своим, если оно отличается от значения веба, SHALL отдавать
такие поля в `overrides` стиля и SHALL принимать в изменении стиля `platform: "ios" | "android"`.

#### Scenario: Своё значение пишется только в платформу

- **WHEN** Editor отправляет `{ platform: "ios", size: 17 }` для Body M на экране `screen-l`
- **THEN** API MUST записать размер 17 только в значения iOS трёх токенов стиля экрана
- **THEN** значения веба и Android MUST NOT измениться, а стиль ответа MUST содержать `overrides.ios.sizePx: 17`

#### Scenario: Правка веба не перезаписывает своё значение

- **WHEN** у iOS своё значение размера 17 и Editor отправляет `{ size: 18 }`
- **THEN** API MUST записать 18 в веб и Android, а значение iOS MUST остаться 17

#### Scenario: Значение, равное вебу, снимает своё

- **WHEN** Editor отправляет `{ platform: "ios", size: <размер веба> }`
- **THEN** стиль ответа MUST NOT содержать своего размера iOS

#### Scenario: Семейство и веб как платформа

- **WHEN** запрос содержит `platform: "web"` или `platform` вместе с `fontFamily`
- **THEN** API MUST вернуть `400 invalid_body` и MUST NOT сохранять ни одно значение

### Requirement: Проверка значений стиля

`ds-service` SHALL отклонять изменение стиля с неверным значением ответом
`400 INVALID_TYPOGRAPHY_VALUE` с текстом в `message` и полем запроса в `details.field` и SHALL NOT сохранять
ни одно значение запроса.

#### Scenario: Размер или высота строки

- **WHEN** `size` или `lineHeight` не больше 0
- **THEN** `message` MUST быть «Размер и межстрочный интервал должны быть положительными числами.»

#### Scenario: Трекинг

- **WHEN** `letterSpacing` меньше −0.2 или больше 1
- **THEN** `message` MUST быть «Letter spacing должен быть в диапазоне от -0.2em до 1em.»

#### Scenario: Вес

- **WHEN** вес начертания не одно из значений 100, 200, 300, 400, 500, 600, 700, 800, 900
- **THEN** `message` MUST быть «Вес шрифта должен быть числом от 100 до 900 с шагом 100.»

#### Scenario: Семейство вне дизайн-системы

- **WHEN** `fontFamily` не совпадает с именем действующего в черновике токена `fontFamily` дизайн-системы
- **THEN** API MUST вернуть `400 INVALID_TYPOGRAPHY_VALUE` с `details.field: "fontFamily"`

### Requirement: Предметные редакции в изменении стиля

Изменение стиля SHALL использовать предметные редакции механизма многопользовательского редактирования ДС: каждое
значение токена темы на платформе — отдельная логическая сущность `token-value` с изменяемым путём `/value`.
Базовая редакция значения SHALL браться из элемента `baseRevisions: [{ tokenId, platform, baseRevision }]` тела, а
при его отсутствии — из необязательного заголовка `X-DS-Base-Revision`. Операция SHALL NOT принимать или
возвращать общий счётчик темы `editRevision` и SHALL NOT отвечать `409 TENANT_EDIT_CONFLICT`.

#### Scenario: Пользователи меняют разные стили

- **WHEN** два пользователя параллельно меняют Body M и Body L одной темы с базовыми редакциями из своего чтения
- **THEN** оба изменения MUST сохраниться без `409` и без предупреждений в `warnings`

#### Scenario: Пользователи меняют разные поля одного значения

- **WHEN** первый пользователь меняет размер Body M, а второй с устаревшей базовой редакцией меняет вес Bold того же стиля
- **THEN** API MUST применить вес к актуальному значению токена, сохранив размер первого пользователя
- **THEN** `X-DS-Mutation-Metadata` MUST содержать путь `/value` в `warnings` этих значений, и API MUST NOT отвечать `409`

#### Scenario: Пользователи меняют одно поле

- **WHEN** второй пользователь с устаревшей базовой редакцией меняет размер, уже изменённый первым
- **THEN** API MUST сохранить последнюю записанную величину
- **THEN** `X-DS-Mutation-Metadata` MUST содержать путь `/value` в `warnings` изменённых значений

#### Scenario: Неверная базовая редакция

- **WHEN** `baseRevision` элемента тела меньше 0
- **THEN** API MUST вернуть `400 invalid_base_revision` и MUST NOT менять данные

#### Scenario: Ошибка внутри операции

- **WHEN** любая проверка или запись операции завершилась ошибкой
- **THEN** API MUST NOT сохранять ни одну предметную редакцию значения и техническую редакцию запроса

### Requirement: Права операций над стилями

Чтение стилей SHALL требовать `tenants:read`, изменение — `tenants:write`. Изменение SHALL быть доступно только в
активном черновике.

#### Scenario: Viewer меняет стиль

- **WHEN** Viewer отправляет изменение стиля
- **THEN** API MUST вернуть `403`

#### Scenario: Изменение опубликованной версии

- **WHEN** изменение стиля отправлено с `versionId`
- **THEN** API MUST вернуть `400 historical_version_read_only` и MUST NOT менять данные

#### Scenario: Тема другого проекта или токен другой дизайн-системы

- **WHEN** тема не принадлежит проекту или `tokenId` не принадлежит дизайн-системе темы
- **THEN** API MUST вернуть `404`

### Requirement: Операции опубликованы в контракте ds-service

Операции стилей типографии SHALL быть описаны в `contracts/route-manifest.json` с `origin: ds-service` и в
`openapi/documentation.yaml` со схемами запросов, ответов и кодами ошибок. Параметры и заголовки предметных
редакций SHALL ссылаться на общие компоненты `#/components/parameters` и `#/components/headers`.

#### Scenario: Документ OpenAPI

- **WHEN** `ds-service` отдаёт OpenAPI
- **THEN** документ MUST содержать чтение и изменение стилей типографии с их схемами
- **THEN** чтение MUST ссылаться на `VersionId`, изменение — на `OptionalBaseRevision`, а ответ `200` изменения — на заголовки `MutationMetadata` и `MutationMetadataTruncated`
- **THEN** операции манифеста и документа MUST совпадать, а число операций в контрактных тестах MUST учитывать две новые операции
