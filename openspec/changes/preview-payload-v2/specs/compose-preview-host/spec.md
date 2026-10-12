## MODIFIED Requirements

### Requirement: Client загружает Compose plugin по runtime URL

`apps/client` SHALL получать базовый URL Compose Preview Plugin из runtime-конфигурации,
загружать `preview-plugin.json` и разрешать iframe entrypoint относительно URL manifest.
Совместимый Compose plugin SHALL объявлять Preview Protocol v2 и render и
component-description bridge operations. Client MUST NOT принимать plugin с другой версией
протокола.

#### Scenario: Совместимый plugin доступен

- **WHEN** manifest объявляет Compose platform, Preview Protocol v2, обязательные
  ready/payload/result/describe/description message types и выбранный component
- **THEN** client MUST создать iframe с entrypoint из manifest.

#### Scenario: Plugin объявляет устаревший протокол

- **WHEN** manifest объявляет `protocolVersion: 1` либо любую версию кроме 2
- **THEN** client MUST считать plugin несовместимым и не создавать iframe
- **AND** существующее React preview MUST оставаться доступным.

#### Scenario: Description bridge отсутствует

- **WHEN** manifest не объявляет describe либо description operation
- **THEN** Compose story controls MUST считаться несовместимыми
- **AND** существующее React preview MUST оставаться доступным.
