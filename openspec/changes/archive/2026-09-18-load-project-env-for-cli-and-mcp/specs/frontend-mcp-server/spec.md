## ADDED Requirements

### Requirement: MCP использует env локального проекта

Оба MCP launcher SHALL использовать общий project-scoped env источник для локального context. Они SHALL сохранять тот же приоритет аргумента, env процесса и `.env` проекта, что и CLI, и SHALL разрешать credential отдельно для каждого вызова tool.

#### Scenario: Ключ найден в `.env` workspace

- **WHEN** MCP запущен с `--workspace /repo` и `/repo/.sdds/config.json` задаёт `credential.name = "DSB_DEV_API_KEY"`
- **WHEN** env процесса не содержит `DSB_DEV_API_KEY`, а `/repo/.env` содержит его
- **THEN** backend request MUST использовать `Authorization: ProjectKey <key>`
- **THEN** MCP result MUST NOT содержать значение key

#### Scenario: Env процесса перекрывает `.env`

- **WHEN** env процесса и проектный `.env` содержат `DSB_DEV_API_KEY`
- **THEN** MCP MUST использовать значение env процесса

#### Scenario: Явный designSystem не наследует локальный secret

- **WHEN** MCP tool получает явный `designSystem` URI
- **THEN** MCP MUST NOT читать project key или API URL из локального `.env` сервера
- **THEN** MCP MUST разрешить credential согласно существующей headless policy

#### Scenario: Нет ключа при auto policy

- **WHEN** env процесса и проектный `.env` не содержат project key
- **WHEN** context выбирает auto credential policy
- **THEN** MCP MUST сохранить существующий fallback на user session

#### Scenario: Один server обслуживает повторные вызовы

- **WHEN** содержимое проектного `.env` изменилось между двумя вызовами MCP tool
- **THEN** следующий вызов MUST разрешить новый снимок env проекта
- **THEN** предыдущий вызов MUST использовать один согласованный снимок значений
