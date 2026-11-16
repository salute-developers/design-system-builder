## ADDED Requirements

### Requirement: Ход чата через публичный маршрут

Монолит SHALL предоставлять `POST /api/projects/{projectId}/ai/chat`. Тело запроса MUST содержать `designSystemId` и `messages` и MAY содержать `confirmations`. Ответ SHALL быть потоком `text/event-stream` с событиями `tool_started`, `tool_result`, `confirmation_required`, `message`, `state`, `error`, `done`. Сервер MUST NOT хранить разговор между запросами.

#### Scenario: Ответ без инструментов
- **WHEN** участник проекта отправляет вопрос, на который модель отвечает текстом
- **THEN** поток MUST содержать `message` с текстом, затем `state` с историей, дополненной ответом, затем `done`

#### Scenario: Цепочка вызовов инструментов
- **WHEN** модель последовательно запрашивает чтение и запись
- **THEN** для каждого вызова поток MUST содержать `tool_started` и затем `tool_result` с тем же `callId`
- **THEN** `tool_result` записи MUST содержать `mutation` из результата инструмента
- **THEN** `state` MUST содержать все выполненные вызовы и их результаты в порядке выполнения

#### Scenario: Неверный запрос
- **WHEN** тело не разбирается, `messages` пусто или последняя реплика не от пользователя и нет `confirmations`
- **THEN** сервер MUST вернуть `400 invalid_request` обычным JSON без открытия потока

### Requirement: Подтверждение удаляющих операций

Вызов инструмента, требующего подтверждения, SHALL выполняться только после явного решения пользователя. Без решения ход MUST завершаться событием `confirmation_required`, затем `state` и `done`.

#### Scenario: Пауза на подтверждение
- **WHEN** модель запрашивает `component_property_reset`
- **THEN** сервер MUST NOT вызывать инструмент
- **THEN** поток MUST содержать `confirmation_required` с `callId`, `tool` и аргументами без служебных полей

#### Scenario: Пользователь подтвердил
- **WHEN** следующий запрос содержит ту же историю и `confirmations: [{callId, approved: true}]`
- **THEN** сервер MUST выполнить ожидающий вызов и продолжить ход

#### Scenario: Пользователь отказал
- **WHEN** решение `approved: false`
- **THEN** сервер MUST NOT выполнять вызов и MUST передать модели результат с `isError: true` и пояснением «пользователь отклонил операцию»

#### Scenario: Подтверждение без ожидающего вызова
- **WHEN** `callId` из `confirmations` не совпадает с последним вызовом в истории, у которого ещё нет результата
- **THEN** сервер MUST вернуть `400 invalid_request`

### Requirement: Права пользователя и область дизайн-системы

Каждый вызов инструмента SHALL выполняться с учётными данными пользователя из исходного запроса и только в DS из тела запроса в проекте маршрута.

#### Scenario: Пользователь без права записи
- **WHEN** у участника нет скоупов `tokens:write` и `components:write`
- **THEN** модели MUST передаваться только инструменты чтения

#### Scenario: Отказ ds-service
- **WHEN** ds-service отклонил вызов по правам или ревизии
- **THEN** `tool_result` MUST содержать `isError: true` и безопасные детали, а ход MUST продолжиться

#### Scenario: Дизайн-система другого проекта
- **WHEN** `designSystemId` не принадлежит проекту маршрута
- **THEN** вызовы инструментов MUST завершаться отказом ds-service, а изменений в чужой DS MUST NOT происходить

#### Scenario: Учётные данные не утекают
- **WHEN** выполняется любой ход
- **THEN** заголовок `Authorization` пользователя MUST NOT появляться в событиях, истории, журналах и запросах к провайдеру модели

### Requirement: Ограничения хода

Ход SHALL ограничиваться `AI_MAX_STEPS` обращениями к модели и `AI_TURN_TIMEOUT_SECONDS`. Событие `state` MUST отправляться перед `done` при любом завершении хода.

#### Scenario: Превышен лимит шагов
- **WHEN** модель продолжает запрашивать инструменты после `AI_MAX_STEPS` обращений
- **THEN** поток MUST содержать `error` с `step_limit_reached`, затем `state` с выполненными шагами и `done`

#### Scenario: Отключение клиента
- **WHEN** клиент закрыл соединение во время хода
- **THEN** сервер MUST отменить ход и MUST NOT начинать новые вызовы модели и инструментов

#### Scenario: Провайдер недоступен
- **WHEN** провайдер не ответил после всех повторов
- **THEN** поток MUST содержать `error` с `llm_unavailable` либо `llm_rate_limited`, затем `state` и `done`

### Requirement: Состояние подсистемы

Монолит SHALL предоставлять `GET /api/projects/{projectId}/ai/status` с полями `enabled`, `provider`, `model`. Ответ MUST NOT содержать ключи, адреса и прочие секреты провайдера.

#### Scenario: Подсистема выключена
- **WHEN** `AI_ENABLED` не равно `true` либо конфигурация провайдера неполна
- **THEN** `status` MUST вернуть `{ "enabled": false }`
- **THEN** `POST /ai/chat` MUST вернуть `503 ai_unavailable`
