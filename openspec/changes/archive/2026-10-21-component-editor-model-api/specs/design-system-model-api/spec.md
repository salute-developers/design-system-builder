## ADDED Requirements

### Requirement: Маршруты операций редактора оформления входят в разрешённый набор

Перечень предметных маршрутов `ds-service` SHALL быть дополнен маршрутами операций редактора оформления (относительно `P = /api/projects/{projectId}/ds`): `GET /appearances/{id}/editor-model`, `POST /appearances/{id}/axes`, `DELETE /appearances/{id}/axes/{axisId}`, `POST /appearances/{id}/axis-order`, `POST /appearances/{id}/axes/{axisId}/values`, `DELETE /appearances/{id}/axis-values/{valueId}`, `PUT /appearances/{id}/axes/{axisId}/value-order`, `PUT /appearances/{id}/property-values`, `DELETE /appearances/{id}/property-values` (область в параметрах запроса `propertyId`, `styleIds`, `states`), `PUT /appearances/{id}/state-order`, `POST /appearances/new`, `POST /appearances/{id}/duplicate`. Эти маршруты MUST NOT считаться предметными маршрутами вне набора, запрещёнными требованием «Полный разрешённый набор предметных маршрутов»: их добавление выполняется этим OpenSpec-изменением.

#### Scenario: Проверка route manifest

- **WHEN** контрактный тест перечисляет маршруты `ds-service`
- **THEN** каждый маршрут операций редактора MUST существовать с указанным HTTP-методом
- **THEN** каждый такой маршрут MUST быть описан в `documentation.yaml`, манифесте маршрутов и аудите потребителей

#### Scenario: Доступ через внешний и внутренний префиксы

- **WHEN** клиент вызывает операцию редактора через `P`
- **THEN** Gateway MUST передать тот же остаток пути в `ds-service` под `/api/ds`
