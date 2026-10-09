## ADDED Requirements

### Requirement: Backend denial reason in CLI errors

CLI core SHALL дописывать к сообщению об ответе `401` и `403` причину отказа из тела ответа backend, если тело содержит текстовое поле `error` или `message`, и MUST NOT менять сообщение, если такого поля нет.

#### Scenario: Причина из поля error

- **WHEN** backend отвечает `403` с телом `{"error":"System administrator role is required"}`
- **THEN** сообщение CLI MUST содержать статус отказа и текст `System administrator role is required`

#### Scenario: Причина из поля message

- **WHEN** backend отвечает `401` с телом `{"message":"Invalid bearer token"}`
- **THEN** сообщение CLI MUST содержать статус отказа и текст `Invalid bearer token`

#### Scenario: Тело без причины

- **WHEN** backend отвечает `403` с пустым телом или телом без полей `error` и `message`
- **THEN** сообщение CLI MUST совпадать с сообщением без причины

#### Scenario: Причина усечена

- **WHEN** текст причины длиннее лимита вывода
- **THEN** CLI MUST усечь его до лимита и MUST NOT выводить многострочное тело целиком
