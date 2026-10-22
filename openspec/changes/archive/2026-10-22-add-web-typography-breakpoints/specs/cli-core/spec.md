## ADDED Requirements

### Requirement: Брейкпоинты web-типографики в project config

CLI core SHALL принимать в `.sdds/config.json` необязательный JSON-массив `breakpoints` как
несекретные локальные метаданные проекта, SHALL NOT интерпретировать и проверять его содержимое
(это делает web-генератор) и SHALL сохранять его при перезаписи config.

#### Scenario: Config с брейкпоинтами читается

- **WHEN** `.sdds/config.json` содержит массив `breakpoints`
- **THEN** команды `dsbuilder`, читающие project context, MUST работать так же, как без него

#### Scenario: Брейкпоинты сохраняются при обновлении config

- **WHEN** `theme fetch` или изменение алиасов тем перезаписывает config, в котором есть `breakpoints`
- **THEN** записанный config MUST содержать то же значение `breakpoints`

#### Scenario: Брейкпоинты не добавляются сами

- **WHEN** CLI создаёт или перезаписывает config без `breakpoints`
- **THEN** записанный config MUST NOT содержать ключ `breakpoints`
