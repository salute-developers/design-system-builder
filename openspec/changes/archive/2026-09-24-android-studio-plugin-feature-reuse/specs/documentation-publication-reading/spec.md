## MODIFIED Requirements

### Requirement: Чтение active publication
Service SHALL предоставлять active publication по `designSystemId` и canonical `platform` с необязательным `version` и MUST возвращать только успешно опубликованный active pointer. Без `version` service MUST вернуть последнюю по времени публикации active publication для пары (`designSystemId`, `platform`).

#### Scenario: Active publication найдена
- **WHEN** authorized client запрашивает опубликованный ключ
- **THEN** response SHALL содержать `publicationId`, design system, version, platform, status и publication timestamp

#### Scenario: Version не указан
- **WHEN** authorized client запрашивает active publication без `version`
- **THEN** response SHALL описывать последнюю по времени публикации active publication для `designSystemId` и `platform`
- **THEN** поле `version` в response SHALL содержать версию найденной publication

#### Scenario: Есть только candidate
- **WHEN** для ключа существует candidate, но active publication отсутствует
- **THEN** endpoint MUST вернуть `404 Not Found`
