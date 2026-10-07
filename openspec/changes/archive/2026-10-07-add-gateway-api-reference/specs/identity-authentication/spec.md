## ADDED Requirements

### Requirement: Документирование публичного token endpoint
Система MUST иметь OpenAPI-описание публичного `/auth/token` gateway для локального API Reference. Контракт MUST описывать `application/x-www-form-urlencoded` request и JSON response с access token без фиксации секретов или конкретных учётных данных.

#### Scenario: Безопасный OpenAPI контракт токена
- **WHEN** API Reference загружает Authentication source
- **THEN** документ содержит `/auth/token` и не содержит client secret, пароль или внутренний `/internal/auth/**` endpoint
