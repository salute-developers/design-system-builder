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

`ds-service` SHALL предоставлять `GET /api/ds/tenants/{tenantId}/typography-styles`, который возвращает стили
темы по экранам в px, семейства шрифтов дизайн-системы и использование стилей в компонентах.

#### Scenario: Ответ со стилями

- **WHEN** Viewer читает стили темы
- **THEN** ответ MUST содержать `editRevision`, `canEdit`, `families: [{ name, fontName }]` и `screens: [{ screen, styles }]`
- **THEN** каждый стиль MUST содержать `group`, `size`, `sizePx`, `lineHeightPx`, `letterSpacingEm`, `fontFamily`, `variants` с `tokenId` и `weight` для `normal`, `medium`, `bold` и `components: [{ name, count }]`

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

### Requirement: Использование стиля в компонентах

`ds-service` SHALL считать значение свойства компонента дизайн-системы текущей темы ссылкой на стиль, если оно
равно имени начертания стиля без экрана или с экраном либо ссылается через `token_id` на токен стиля.

#### Scenario: Ссылка текстом без экрана

- **WHEN** у компонента Button четыре значения свойств `body.l.bold`, а у Select одно значение `body.l.normal`
- **THEN** стиль `body.l` на каждом экране MUST содержать `components` с `{ name: "Button", count: 4 }` и `{ name: "Select", count: 1 }`

#### Scenario: Другие формы ссылки

- **WHEN** значение свойства равно `screen-l.body.l.medium` или ссылается через `token_id` на токен `screen-s.body.l.bold`
- **THEN** это значение MUST учитываться в `components` стиля `body.l`

#### Scenario: Компоненты другой дизайн-системы

- **WHEN** ссылка на `body.l.bold` есть только у компонента другой дизайн-системы
- **THEN** `components` стиля MUST NOT содержать этот компонент

### Requirement: Изменение стиля

`ds-service` SHALL предоставлять `PATCH /api/ds/tenants/{tenantId}/typography-styles/{tokenId}` с телом
`{ editRevision, size?, lineHeight?, letterSpacing?, weights?, fontFamily? }`, который в одной транзакции
меняет значения токенов стиля только в текущей теме.

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
- **THEN** значения токенов в теме B MUST NOT измениться

#### Scenario: Ответ изменения

- **WHEN** изменение выполнено
- **THEN** API MUST вернуть `200` с новым `editRevision`, стилем в формате чтения и записанными значениями токенов `[{ tokenId, name, values: [{ platform, value }] }]`

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

### Requirement: Проверка значений стиля

`ds-service` SHALL отклонять изменение стиля с неверным значением ответом
`400 INVALID_TYPOGRAPHY_VALUE` с полями `field` и `message` и SHALL NOT сохранять ни одно значение запроса.

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

- **WHEN** `fontFamily` не совпадает с именем токена `fontFamily` дизайн-системы
- **THEN** API MUST вернуть `400 INVALID_TYPOGRAPHY_VALUE` с `field: "fontFamily"`

### Requirement: Общая ревизия темы в изменении стиля

Изменение стиля SHALL сверять `editRevision` текущей темы и увеличивать его в той же транзакции.

#### Scenario: Устаревшая ревизия

- **WHEN** `editRevision` запроса не совпадает с ревизией темы
- **THEN** API MUST вернуть `409 TENANT_EDIT_CONFLICT` с актуальным `editRevision` и MUST NOT менять данные

#### Scenario: Ошибка внутри операции

- **WHEN** любая проверка или запись завершилась ошибкой
- **THEN** значения токенов и `editRevision` MUST остаться прежними

### Requirement: Права операций над стилями

Чтение стилей SHALL требовать `tenants:read`, изменение — `tenants:write`.

#### Scenario: Viewer меняет стиль

- **WHEN** Viewer отправляет изменение стиля
- **THEN** API MUST вернуть `403`

#### Scenario: Тема другого проекта или токен другой дизайн-системы

- **WHEN** тема не принадлежит проекту или `tokenId` не принадлежит дизайн-системе темы
- **THEN** API MUST вернуть `404`

### Requirement: Операции опубликованы в контракте ds-service

Операции стилей типографии SHALL быть описаны в `contracts/route-manifest.json` с `origin: ds-service` и в
`openapi/documentation.yaml` со схемами запросов, ответов и кодами ошибок.

#### Scenario: Документ OpenAPI

- **WHEN** `ds-service` отдаёт OpenAPI
- **THEN** документ MUST содержать чтение и изменение стилей типографии с их схемами
- **THEN** операции манифеста и документа MUST совпадать
