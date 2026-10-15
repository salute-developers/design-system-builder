## ADDED Requirements

### Requirement: Группы и подгруппы токенов хранятся у дизайн-системы

`ds-service` SHALL хранить для дизайн-системы дерево групп токенов не глубже двух уровней: группы и их подгруппы. У каждого узла есть вид `kind`, название `label` и позиция среди соседей. У группы верхнего уровня есть код `code` — первый сегмент имени её токенов. Каждое определение токена SHALL ссылаться не более чем на одну группу или подгруппу и иметь позицию в ней. В этом изменении поддерживается вид `color`: цветовые и градиентные токены.

#### Scenario: Список групп

- **WHEN** пользователь с правом `tokens:read` запрашивает `GET /api/ds/design-systems/{designSystemId}/token-groups?kind=color`
- **THEN** API MUST вернуть `200` и массив `{ id, parentId, code, label, position, kind }` всех групп и подгрупп вида `color`, упорядоченный по уровню, родителю и позиции
- **THEN** пустые группы и подгруппы MUST входить в ответ

#### Scenario: Токены с группой и позицией

- **WHEN** клиент запрашивает `GET /api/ds/design-systems/{designSystemId}/tokens`
- **THEN** каждый токен MUST содержать `groupId` (группа, подгруппа или `null`) и `position`

### Requirement: Существующие цветовые токены разложены по группам миграцией

Миграция `ds-service` SHALL создать для каждой дизайн-системы с цветовыми или градиентными токенами группы и подгруппы, совпадающие с разделами и категориями экрана «Цвета» до изменения, и разложить по ним все семейства токенов.

#### Scenario: Разделы становятся группами

- **WHEN** миграция обрабатывает дизайн-систему с токенами `text.*`, `surface.*`, `outline.*`, `background.*`, `overlay.*`, `data.*` и `surface.*.read-only`
- **THEN** у дизайн-системы MUST появиться группы Text & Icons (`text`), Surfaces (`surface`), Outlines (`outline`), BG (`background`), Overlays (`overlay`), Data (`data`) и Technical (`surface`) в этом порядке, а `surface.*.read-only` MUST лежать в Technical

#### Scenario: Категории становятся подгруппами

- **WHEN** миграция раскладывает токены групп Text & Icons, Surfaces и Outlines
- **THEN** токены с `accent` или `promo` в последнем сегменте MUST попасть в подгруппу Accent, с `positive`, `negative`, `warning` или `info` — в Status, остальные — в General
- **THEN** в Surfaces и Outlines к названию MUST добавляться «/ Solid» или «/ Transparent» по префиксу `transparent-` или имени `clear`
- **THEN** токены групп BG, Overlays, Data и Technical MUST попасть в единственную подгруппу Default своей группы

#### Scenario: Все члены семейства в одной подгруппе

- **WHEN** миграция раскладывает семейство `text.*.accent*`
- **THEN** все его определения MUST ссылаться на одну подгруппу и иметь одну позицию

### Requirement: Операции над группами атомарны и сверяют ревизию тем

`ds-service` SHALL предоставлять создание `POST /api/ds/tenants/{tenantId}/token-groups`, изменение `PATCH /api/ds/tenants/{tenantId}/token-groups/{groupId}` и удаление `DELETE /api/ds/tenants/{tenantId}/token-groups/{groupId}`. Каждая операция SHALL в одной транзакции блокировать все темы дизайн-системы текущей темы, сверять `editRevision` текущей темы и увеличивать ревизии всех тем дизайн-системы.

#### Scenario: Создание группы

- **WHEN** Editor отправляет `{ editRevision, kind: "color", parentId: null, label: "Brand" }`
- **THEN** API MUST создать группу с кодом `brand` в конце списка групп и вернуть `201` с `{ editRevision, value: { id, parentId, code, label, position, kind } }`
- **THEN** `editRevision` всех тем дизайн-системы MUST увеличиться

#### Scenario: Создание подгруппы

- **WHEN** запрос содержит `parentId` группы верхнего уровня
- **THEN** API MUST создать подгруппу без кода в конце подгрупп этой группы

#### Scenario: Третий уровень

- **WHEN** `parentId` указывает на подгруппу
- **THEN** API MUST вернуть `400 INVALID_TOKEN_GROUP` и MUST NOT создавать узел

#### Scenario: Недопустимое название группы

- **WHEN** название пустое или из названия группы верхнего уровня не получается код из латиницы, цифр и дефиса
- **THEN** API MUST вернуть `400 INVALID_TOKEN_GROUP`

#### Scenario: Название занято

- **WHEN** у соседей с тем же родителем уже есть узел с таким названием без учёта регистра
- **THEN** API MUST вернуть `409 TOKEN_GROUP_CONFLICT`

#### Scenario: Переименование и перестановка

- **WHEN** Editor отправляет `PATCH` с `label` и/или `position`
- **THEN** API MUST изменить название и/или поставить узел на позицию среди соседей, пересчитав позиции соседей подряд с нуля
- **THEN** код группы и имена её токенов MUST NOT измениться

#### Scenario: Перенос подгруппы в другую группу

- **WHEN** `PATCH` подгруппы содержит `parentId` другой группы верхнего уровня того же вида
- **THEN** API MUST перенести подгруппу на указанную позицию в новой группе
- **THEN** первый сегмент имени каждого определения её токенов MUST стать кодом новой группы, идентификаторы определений MUST NOT измениться
- **THEN** при конфликте нового имени с существующим определением API MUST вернуть `409 TOKEN_NAME_CONFLICT` и MUST NOT менять данные

#### Scenario: Удаление группы с токенами

- **WHEN** Maintainer удаляет группу с подгруппами и токенами
- **THEN** API MUST удалить группу, её подгруппы и все семейства их токенов вместе со значениями во всех темах и привязками к группам палитры
- **THEN** ссылки значений компонентов на удалённые определения MUST стать `null`

#### Scenario: Editor удаляет группу

- **WHEN** пользователь с ролью Editor удаляет группу или подгруппу
- **THEN** API MUST вернуть `403` и MUST NOT удалять данные

#### Scenario: Устаревшая ревизия

- **WHEN** `editRevision` запроса не совпадает с ревизией текущей темы
- **THEN** API MUST вернуть `409 TENANT_EDIT_CONFLICT` с актуальной ревизией и MUST NOT менять данные

#### Scenario: Группа другой дизайн-системы

- **WHEN** `groupId` или `parentId` не принадлежит дизайн-системе текущей темы
- **THEN** API MUST вернуть `404`

### Requirement: Операции групп опубликованы в контракте ds-service

Операции групп SHALL быть описаны в группе `contracts/route-manifest.json` с `origin: ds-service` и в `openapi/documentation.yaml` с `x-permission`, схемами и кодами ошибок.

#### Scenario: Документ OpenAPI

- **WHEN** `ds-service` отдаёт OpenAPI
- **THEN** документ MUST содержать список, создание, изменение и удаление групп токенов, а операции манифеста и документа MUST совпадать
