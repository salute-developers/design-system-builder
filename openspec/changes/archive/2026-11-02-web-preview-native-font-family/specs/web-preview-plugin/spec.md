## ADDED Requirements

### Requirement: Web-плагин использует настоящее имя шрифта

Плагин SHALL называть семейство в `@font-face` значением `family` токена, а без него — идентификатором токена.
Значения свойства `font-family` SHALL содержать запасное семейство `sans-serif`.
Токены с разными файлами шрифтов SHALL отображаться разными семействами, даже если их `family` совпадает.

#### Scenario: Имя задано

- **WHEN** токен `fontFamily.body` содержит `family: "SB Sans Text"`
- **THEN** `@font-face` MUST объявлять семейство `"SB Sans Text"`, а шрифт области превью MUST быть `"SB Sans Text", sans-serif`

#### Scenario: Имя не задано

- **WHEN** токен `fontFamily.body` не содержит `family`
- **THEN** `@font-face` MUST объявлять семейство `"fontFamily.body"`, а шрифт области превью MUST быть `"fontFamily.body", sans-serif`

#### Scenario: Одно имя, одинаковые файлы

- **WHEN** два токена содержат одно `family` и одинаковые файлы, веса и стили
- **THEN** оба MUST использовать это имя, а правила `@font-face` MUST NOT повторяться

#### Scenario: Одно имя, разные файлы

- **WHEN** два токена содержат одно `family` и разные файлы
- **THEN** первый токен MUST использовать это имя, а второй MUST использовать своё имя токена со своими файлами
