## ADDED Requirements

### Requirement: Токен fontFamily может содержать имя семейства

Токен `fontFamily` SHALL допускать необязательное непустое строковое поле `family` с настоящим именем семейства.
Ассемблер SHALL заполнять его из `name` web-значения токена, если имя задано.

#### Scenario: Токен с именем

- **WHEN** токен `fontFamily` содержит `family: "SB Sans Text"`
- **THEN** payload MUST проходить валидацию схемы

#### Scenario: Токен без имени

- **WHEN** токен `fontFamily` не содержит `family`
- **THEN** payload MUST проходить валидацию схемы

#### Scenario: Сборка web-значения

- **WHEN** web-значение токена содержит `name: "SB Sans Text"`
- **THEN** токен в payload MUST содержать `family: "SB Sans Text"`
