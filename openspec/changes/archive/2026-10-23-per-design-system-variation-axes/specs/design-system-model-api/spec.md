## ADDED Requirements

### Requirement: Вариации ограничены дизайн-системой

`GET /api/ds/variations` и `GET /api/ds/components/{id}/variations` SHALL принимать необязательный `designSystemId`, а каждая вариация в ответе SHALL нести `designSystemId`. `POST /api/ds/variations` SHALL требовать `designSystemId` в теле запроса.

#### Scenario: Чтение с фильтром

- **WHEN** клиент вызывает `GET /api/ds/components/{id}/variations?designSystemId=A`
- **THEN** ответ MUST содержать только оси дизайн-системы A

#### Scenario: Чтение без фильтра

- **WHEN** клиент вызывает `GET /api/ds/components/{id}/variations` без `designSystemId`
- **THEN** ответ MUST содержать оси всех дизайн-систем, доступных вызывающему
- **THEN** форма ответа MUST оставаться массивом

#### Scenario: Создание оси без системы

- **WHEN** клиент вызывает `POST /api/ds/variations` без `designSystemId`
- **THEN** `ds-service` MUST ответить `400`

#### Scenario: Создание оси в чужой системе

- **WHEN** клиент вызывает `POST /api/ds/variations` с `designSystemId`, недоступной проекту на запись
- **THEN** `ds-service` MUST отклонить запрос и MUST NOT создавать ось
