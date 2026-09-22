## MODIFIED Requirements

### Requirement: API key credential resolution

CLI core SHALL разрешать project API key из runtime sources в детерминированном порядке только тогда, когда выбранная credential policy допускает project key; forced `user-session` SHALL обходить key sources. Для имени из `credential.name` и fallback имени `DSBUILDER_API_KEY` CLI core SHALL сначала проверять env процесса, затем `.env` найденного локального проекта. Приоритет имени из `credential.name` над fallback именем сохраняется.

#### Scenario: CLI argument имеет высший приоритет

- **WHEN** выбран key mode и команда получает `--api-key <value>`
- **THEN** CLI MUST использовать это значение как API key
- **THEN** CLI MUST NOT читать env-переменные для API key

#### Scenario: Project-specific env variable используется из config

- **WHEN** `--api-key` отсутствует
- **WHEN** `.sdds/config.json` содержит `credential.name = "DSBUILDER_PROJECT_A_API_KEY"` и policy допускает key
- **WHEN** env процесса или проектный `.env` содержит `DSBUILDER_PROJECT_A_API_KEY`
- **THEN** CLI MUST использовать значение этого имени как API key с приоритетом env процесса

#### Scenario: Fallback env используется последним

- **WHEN** `--api-key` и project-specific env отсутствуют в допускающем key mode
- **WHEN** env процесса или проектный `.env` содержит `DSBUILDER_API_KEY`
- **THEN** CLI MUST использовать `DSBUILDER_API_KEY` как API key с приоритетом env процесса

#### Scenario: API key отсутствует

- **WHEN** выбран forced key mode и ни один поддерживаемый runtime source не содержит API key
- **THEN** CLI MUST вернуть детерминированную credential error с именем configured env, если оно известно
- **THEN** CLI MUST NOT выполнять backend request или переключаться на user session

### Requirement: API URL resolution

CLI core SHALL resolve backend API URL from runtime sources and code defaults without reading it from `.sdds/config.json`, and SHALL report which source produced the value so that writing commands can reject the code default. Для локального проекта `.env` SHALL предоставлять fallback для `DSBUILDER_API_URL` после env процесса.

#### Scenario: CLI argument имеет высший приоритет

- **WHEN** command receives `--api-url <value>`
- **THEN** CLI MUST use that value as the backend API URL
- **THEN** CLI MUST NOT read env variables for the API URL

#### Scenario: Env API URL используется после CLI argument

- **WHEN** `--api-url` is absent
- **WHEN** env процесса contains `DSBUILDER_API_URL`
- **THEN** CLI MUST use that value as the backend API URL даже при наличии другого значения в проектном `.env`

#### Scenario: Проектный API URL используется после env процесса

- **WHEN** `--api-url` и `DSBUILDER_API_URL` в env процесса отсутствуют
- **WHEN** `.env` найденного локального проекта содержит `DSBUILDER_API_URL`
- **THEN** CLI MUST использовать значение `.env` как явно настроенный backend API URL
- **THEN** writing command MUST NOT считать его code default

#### Scenario: Default API URL используется последним

- **WHEN** `--api-url` is absent
- **WHEN** env процесса и проектный `.env` не содержат `DSBUILDER_API_URL`
- **THEN** CLI MUST use the default API URL defined in code

#### Scenario: Project config не задает API URL

- **WHEN** `.sdds/config.json` is generated or parsed
- **THEN** CLI MUST NOT require or persist `apiUrl` in project config

#### Scenario: Resolution сообщает источник значения

- **WHEN** CLI core resolves the backend API URL
- **THEN** the result MUST expose which runtime source produced the value
- **THEN** the result MUST distinguish the code default from an explicitly provided value
