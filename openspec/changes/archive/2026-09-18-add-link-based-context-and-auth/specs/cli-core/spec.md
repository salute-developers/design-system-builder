## ADDED Requirements

### Requirement: Credential policy в локальном project config

CLI core SHALL поддерживать `credential.type = "auto"`, `"user-session"` и `"project-key-env"` в `.sdds/config.json` без raw secrets и SHALL читать существующий `"env"` как совместимый `auto` с указанным именем env-переменной.

#### Scenario: Существующий env config

- **WHEN** config содержит `credential.type = "env"` и `credential.name = "PROJECT_KEY"`
- **THEN** CLI MUST продолжить читать этот config без миграции файла
- **THEN** CLI MUST использовать доступный key из разрешённых runtime sources, а при его отсутствии — user session

#### Scenario: Принудительная user session

- **WHEN** config содержит `credential.type = "user-session"`
- **THEN** CLI MUST использовать только session для resolved API URL
- **THEN** CLI MUST NOT читать project key из env или `--api-key`

#### Scenario: Принудительный project key

- **WHEN** config содержит `credential.type = "project-key-env"` и имя env-переменной
- **THEN** CLI MUST использовать только project key из выбранных key sources
- **THEN** отсутствие key MUST вернуть credential error без fallback на user session

### Requirement: Headless credential selection

CLI core SHALL отделять явный `--design-system` от локальной credential policy. Без локального контекста пользовательская session SHALL быть интерактивным умолчанием; project key SHALL выбираться явным указанием имени env-переменной для конкретного вызова.

#### Scenario: Явная ссылка из чужой рабочей директории

- **WHEN** `--design-system` выбирает дизайн-систему A, а текущая `.sdds` относится к B
- **THEN** CLI MUST NOT применять credential policy B к A
- **THEN** CLI MUST использовать явную headless policy или user session

#### Scenario: CI выбирает project key

- **WHEN** headless-команда явно указывает env-переменную с project key
- **THEN** CLI MUST прочитать значение из env, не из URI
- **THEN** CLI MUST NOT сохранять key в `.sdds` или выводить его в diagnostics

## MODIFIED Requirements

### Requirement: API key credential resolution

CLI core SHALL разрешать project API key из runtime sources в детерминированном порядке только тогда, когда выбранная credential policy допускает project key; forced `user-session` SHALL обходить key sources.

#### Scenario: CLI argument имеет высший приоритет

- **WHEN** выбран key mode и команда получает `--api-key <value>`
- **THEN** CLI MUST использовать это значение как API key
- **THEN** CLI MUST NOT читать env-переменные для API key

#### Scenario: Project-specific env variable используется из config

- **WHEN** `--api-key` отсутствует
- **WHEN** `.sdds/config.json` содержит `credential.name = "DSBUILDER_PROJECT_A_API_KEY"` и policy допускает key
- **WHEN** environment содержит `DSBUILDER_PROJECT_A_API_KEY`
- **THEN** CLI MUST использовать это env-значение как API key

#### Scenario: Fallback env используется последним

- **WHEN** `--api-key` и project-specific env отсутствуют в допускающем key mode
- **WHEN** environment содержит `DSBUILDER_API_KEY`
- **THEN** CLI MUST использовать `DSBUILDER_API_KEY` как API key

#### Scenario: API key отсутствует

- **WHEN** выбран forced key mode и ни один поддерживаемый runtime source не содержит API key
- **THEN** CLI MUST вернуть детерминированную credential error с именем configured env, если оно известно
- **THEN** CLI MUST NOT выполнять backend request или переключаться на user session
