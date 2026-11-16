## ADDED Requirements

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
- **THEN** неразбираемые аргументы MUST давать результат инструмента с ошибкой разбора, а не падение хода

#### Scenario: Код ошибки провайдера
- **WHEN** провайдер вернул код из `AI_RETRY_ERROR_CODES`
- **THEN** адаптер MUST повторить запрос, а после третьей неудачи вернуть `LlmFailure.RateLimited` либо `LlmFailure.Unavailable`

### Requirement: Адаптер GigaChat

`GigaChatClient` SHALL получать access-токен по `AI_GIGACHAT_AUTH_KEY` и `AI_GIGACHAT_SCOPE`, кешировать его до истечения и обновлять при 401. Инструменты MUST передаваться в формате `functions`, вызов MUST читаться из `function_call`, результат инструмента MUST передаваться сообщением с ролью `function`. Корень из `AI_GIGACHAT_CA_PATH` MUST добавляться к системным доверенным сертификатам.

#### Scenario: Истёк токен
- **WHEN** запрос к модели вернул 401
- **THEN** адаптер MUST получить новый токен один раз и повторить запрос

#### Scenario: Перевод истории
- **WHEN** история содержит вызов инструмента и его результат
- **THEN** адаптер MUST передать их как `function_call` ассистента и сообщение `function` с именем инструмента

### Requirement: Конфигурация провайдера

Подсистема SHALL читать настройки провайдера из env: `AI_PROVIDER` (`openai-compatible` или `gigachat`) и параметры выбранного адаптера. Неполная конфигурация MUST выключать чат, а не останавливать монолит. Значения ключей MUST NOT выводиться в журнал.

#### Scenario: Значения по умолчанию
- **WHEN** заданы только `AI_ENABLED=true` и `AI_API_KEY`
- **THEN** подсистема MUST использовать `openai-compatible`, адрес ZAI `https://api.z.ai/api/paas/v4`, модель `glm-4.5-flash`, `AI_EXTRA_BODY={"thinking":{"type":"disabled"}}` и коды повтора `1234,1305`

#### Scenario: Не задан ключ
- **WHEN** `AI_ENABLED=true`, а `AI_API_KEY` для `openai-compatible` пуст
- **THEN** монолит MUST запуститься, `ai/status` MUST вернуть `enabled: false`, а в журнале MUST появиться предупреждение с именем недостающей переменной
