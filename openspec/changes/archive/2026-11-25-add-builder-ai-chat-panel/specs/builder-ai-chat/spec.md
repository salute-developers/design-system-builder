## MODIFIED Requirements

### Requirement: Состояние подсистемы

Монолит SHALL предоставлять `GET /api/projects/{projectId}/ai/status` с полями `enabled`, `provider`, `model`, `messageMaxChars` и `historyMaxChars`. `historyMaxChars` MUST равняться `AI_HISTORY_MAX_CHARS`: по нему клиент заранее предупреждает о длинном разговоре. Ответ MUST NOT содержать ключи, адреса и прочие секреты провайдера.

#### Scenario: Подсистема выключена
- **WHEN** `AI_ENABLED` не равно `true`
- **THEN** `status` MUST вернуть `{ "enabled": false }`
- **AND** маршруты хода MUST возвращать `503 ai_unavailable`

#### Scenario: Подсистема включена
- **WHEN** `AI_ENABLED=true` и `AI_HISTORY_MAX_CHARS=200000`
- **THEN** `status` MUST содержать `"historyMaxChars": 200000` рядом с `messageMaxChars`
