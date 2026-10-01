## MODIFIED Requirements

### Requirement: iOS platform delegate

CLI SHALL ship a platform delegate that serves `swiftui` through the `dsbuilder-ios` tool from
the plasma-ios repository.

#### Scenario: Делегат обслуживает SwiftUI

- **WHEN** CLI builds its platform delegate registry
- **THEN** the registry MUST resolve `swiftui` to the `ios` toolchain
- **THEN** the `ios` toolchain MUST declare the capabilities `THEME`, `COMPONENTS` and `DOCS_AGGREGATE`
- **THEN** `toolchain list` MUST show it without any additional configuration

#### Scenario: Генерация компонентов

- **WHEN** the delegate runs the `COMPONENTS` capability
- **THEN** it MUST invoke the tool as `components generate --sdds <sddsDir>`
- **THEN** the tool MUST receive the same output and passthrough handling as the theme capability
