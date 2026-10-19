# compose-payload-debug-panel Specification

## Purpose
TBD - created by archiving change add-compose-payload-debug-panel. Update Purpose after archive.
## Requirements
### Requirement: Payload Compose-превью можно посмотреть и скопировать в debug-режиме

Клиент SHALL показывать под превью Compose-компонента сворачиваемый блок «Payload» с JSON последнего собранного payload и кнопкой «Копировать» только в debug-режиме и только когда компонент рисуется Compose-renderer. Вне debug-режима блок MUST NOT показываться.

#### Scenario: Debug-режим выключен

- **WHEN** debug-режим не включён
- **THEN** блок «Payload» MUST NOT показываться ни для одного компонента.

#### Scenario: Debug-режим включён, Compose-компонент

- **WHEN** debug-режим включён и компонент рисуется Compose-renderer
- **THEN** под превью MUST показываться блок «Payload», свёрнутый по умолчанию
- **AND** после разворачивания MUST показываться отформатированный JSON payload.

#### Scenario: Web-компонент

- **WHEN** debug-режим включён, а компонент рисуется React-renderer
- **THEN** блок «Payload» MUST NOT показываться.

### Requirement: Копирование payload

Кнопка «Копировать» SHALL помещать в буфер обмена отформатированный JSON текущего payload, в том числе при свёрнутом блоке, и MUST сообщать пользователю о результате.

#### Scenario: Успешное копирование

- **WHEN** пользователь нажимает «Копировать»
- **THEN** в буфер MUST попасть JSON payload
- **AND** рядом с кнопкой MUST показаться подтверждение.

#### Scenario: Буфер обмена недоступен

- **WHEN** копирование не удалось
- **THEN** рядом с кнопкой MUST показаться сообщение об ошибке, а редактор MUST продолжать работать.

