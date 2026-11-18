# llm-provider-adapters Specification

## Purpose
Определяет независимый от провайдера слой модели `LlmClient`, нейтральную модель сообщений, адаптеры OpenAI-совместимого API и GigaChat и их настройку.
## Requirements
### Requirement: Независимость цикла агента от провайдера

Цикл агента SHALL работать только с нейтральными типами `ChatMessage`, `ToolCall`, `ToolResult`, `ToolSpec` и портом `LlmClient`. Типы и форматы конкретного провайдера MUST NOT выходить за пределы адаптеров слоя `data`.

#### Scenario: Смена провайдера
- **WHEN** `AI_PROVIDER` меняется с `openai-compatible` на `gigachat`
- **THEN** цикл агента, набор инструментов и HTTP-контракт чата MUST работать без изменения кода

### Requirement: OpenAI-совместимый адаптер

`OpenAiCompatibleClient` SHALL обращаться к `{AI_BASE_URL}/chat/completions` с `AI_MODEL`, `tools` и `Authorization: Bearer {AI_API_KEY}`. JSON из `AI_EXTRA_BODY` MUST добавляться в тело запроса. Ответы 429, 5xx и ответы с кодом из `AI_RETRY_ERROR_CODES` MUST повторяться до трёх раз с растущей задержкой.

#### Scenario: Настройка ZAI
- **WHEN** заданы адрес ZAI, ключ, `glm-4.5-flash` и `AI_EXTRA_BODY={"thinking":{"type":"disabled"}}`
- **THEN** тело запроса MUST содержать `thinking` и стандартные поля формата OpenAI

#### Scenario: Вызовы инструментов в ответе
- **WHEN** ответ содержит `tool_calls` с `arguments` в виде строки JSON
- **THEN** адаптер MUST вернуть `LlmResponse.ToolCalls` с разобранными аргументами
- **THEN** неразбираемые аргументы MUST давать результат инструмента с `isError: true` и `code: "invalid_arguments"`, а не падение хода

#### Scenario: Код ошибки провайдера
- **WHEN** провайдер вернул код из `AI_RETRY_ERROR_CODES` три раза подряд
- **THEN** адаптер MUST повторить запрос и после третьей неудачи вернуть `LlmFailure.RateLimited`

#### Scenario: Провайдер недоступен
- **WHEN** провайдер трижды подряд ответил 5xx или не ответил по сети
- **THEN** адаптер MUST вернуть `LlmFailure.Unavailable`

### Requirement: Адаптер GigaChat

`GigaChatClient` SHALL получать токен доступа по `AI_GIGACHAT_AUTH_KEY` и `AI_GIGACHAT_SCOPE` с адреса `AI_GIGACHAT_OAUTH_URL`, кешировать его до истечения и обновлять при 401. Инструменты MUST передаваться в формате `functions`, вызов MUST читаться из `function_call`, результат инструмента MUST передаваться сообщением с ролью `function`.

#### Scenario: Истёк токен
- **WHEN** запрос к модели вернул 401
- **THEN** адаптер MUST получить новый токен один раз и повторить запрос

#### Scenario: Перевод истории
- **WHEN** история содержит вызов инструмента и его результат
- **THEN** адаптер MUST передать их как `function_call` ассистента и сообщение `function` с именем инструмента

### Requirement: Перевод пометки о прерванном ходе

Каждый адаптер SHALL передавать сообщение с ролью `interrupted` служебной репликой пользователя с текстом «Предыдущий ход прерван, исход изменений неизвестен», так как у провайдеров нет такой роли.

#### Scenario: Пометка в истории
- **WHEN** история содержит `{ "role": "interrupted" }`
- **THEN** запрос к провайдеру MUST содержать на её месте реплику пользователя с этим текстом

### Requirement: Конфигурация провайдера

Подсистема SHALL читать настройки провайдера из env, только если `AI_ENABLED=true`: `AI_PROVIDER` (`openai-compatible` или `gigachat`) и параметры выбранного адаптера. Неполная или недопустимая конфигурация при `AI_ENABLED=true` MUST обрабатываться как ошибочная конфигурация монолита: приложение не открывает готовность и называет переменную. Значения ключей MUST NOT выводиться в журнал. Если задан `AI_CA_PATH`, корни из этого файла MUST добавляться к системным доверенным сертификатам HTTP-клиента любого провайдера, а не заменять их: на инфраструктуре GigaChat и OpenAI-совместимый API, и OAuth подписаны корнем НУЦ Минцифры.

#### Scenario: Значения по умолчанию
- **WHEN** заданы только `AI_ENABLED=true` и `AI_API_KEY`
- **THEN** подсистема MUST использовать `openai-compatible`, адрес ZAI `https://api.z.ai/api/paas/v4`, модель `glm-4.5-flash`, `AI_EXTRA_BODY={"thinking":{"type":"disabled"}}` и коды повтора `1234,1305`

#### Scenario: Не задан ключ
- **WHEN** `AI_ENABLED=true`, а `AI_API_KEY` для `openai-compatible` пуст
- **THEN** монолит MUST NOT открывать готовность и MUST сообщить об отсутствии `AI_API_KEY` без значений секретов

#### Scenario: Несовместимые лимиты
- **WHEN** `AI_HISTORY_MAX_CHARS` не вмещает системный промпт со схемами инструментов, сообщение длиной `AI_MESSAGE_MAX_CHARS` и один обмен «вызов + результат» длиной `AI_TOOL_RESULT_MAX_CHARS` с запасом на вызов
- **THEN** монолит MUST NOT открывать готовность и MUST назвать переменные лимитов

#### Scenario: Чат выключен
- **WHEN** `AI_ENABLED` не равно `true`, а другие `AI_*` заданы с ошибками
- **THEN** монолит MUST открыть готовность, а значения `AI_*` MUST NOT разбираться

#### Scenario: OpenAI-совместимый API с корнем НУЦ Минцифры
- **WHEN** `AI_PROVIDER=openai-compatible`, `AI_BASE_URL` указывает на API, подписанный корнем НУЦ Минцифры, а `AI_CA_PATH` указывает на этот корень
- **THEN** запрос к провайдеру MUST проходить проверку TLS, а адреса с сертификатами из системных корней MUST оставаться доступными

#### Scenario: Файл без сертификатов
- **WHEN** `AI_CA_PATH` указывает на файл без сертификатов
- **THEN** приложение MUST NOT открывать готовность и MUST назвать `AI_CA_PATH`
