# documentation-info-artifact-packaging Specification
## Purpose
TBD - created by archiving change add-documentation-ingestion-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Канонические platform identifiers документационного bundle
CLI MUST записывать в manifest canonical platform `compose`, `android-view`, `swiftui`, `uikit`, `react` или `design` и MUST отклонять неизвестное значение при генерации bundle.

#### Scenario: SwiftUI и UIKit остаются разными платформами
- **WHEN** CLI генерирует bundle с platform `swiftui` или `uikit`
- **THEN** manifest SHALL сохранить выбранное значение без сведения к общему `ios`

### Requirement: Канонические имена опциональных info-artifacts
CLI SHALL обнаруживать только `.sdds/temp/docs/meta/components-info.json` и `.sdds/temp/docs/meta/theme-info.json` относительно default docs directory и SHALL NOT угадывать исторические platform-specific filenames.

#### Scenario: Generator подготовил оба канонических файла
- **WHEN** docs directory содержит `meta/components-info.json` и `meta/theme-info.json`
- **THEN** CLI SHALL включить оба файла в archive под теми же paths
- **AND** manifest SHALL объявить artifacts `COMPONENTS_INFO` и `THEME_INFO`

#### Scenario: Info-artifacts отсутствуют
- **WHEN** docs directory не содержит канонических info-файлов
- **THEN** CLI SHALL создать допустимый markdown-only bundle без соответствующих artifact declarations

#### Scenario: Присутствует историческое имя
- **WHEN** docs directory содержит `meta/config-info-compose.json`, но не содержит `meta/components-info.json`
- **THEN** CLI SHALL NOT объявлять этот файл как `COMPONENTS_INFO`

### Requirement: Versioned format info-artifacts
Для каждого обнаруженного info-artifact CLI MUST записать поддерживаемый versioned `format`, определённый canonical platform и artifact type.

#### Scenario: Compose formats
- **WHEN** CLI обнаруживает component/theme artifacts для platform `compose`
- **THEN** manifest SHALL использовать `sdds-compose-components-info-v1` и `sdds-compose-theme-info-v1`

#### Scenario: Android View formats
- **WHEN** CLI обнаруживает component/theme artifacts для platform `android-view`
- **THEN** manifest SHALL использовать `sdds-view-components-info-v1` и `sdds-view-theme-info-v1`

#### Scenario: SwiftUI использует общую iOS theme schema
- **WHEN** CLI обнаруживает оба artifacts для platform `swiftui`
- **THEN** components format SHALL быть `sdds-swiftui-components-info-v1`
- **AND** theme format SHALL быть `sdds-ios-theme-info-v1`

#### Scenario: UIKit использует общую iOS theme schema
- **WHEN** CLI обнаруживает оба artifacts для platform `uikit`
- **THEN** components format SHALL быть `sdds-uikit-components-info-v1`
- **AND** theme format SHALL быть `sdds-ios-theme-info-v1`

#### Scenario: Для platform нет adapter format
- **WHEN** canonical platform `react` или `design` содержит info-artifact, для которого CLI не знает versioned format
- **THEN** generation MUST завершиться ошибкой
- **AND** CLI MUST NOT создать bundle с artifact без `format`
