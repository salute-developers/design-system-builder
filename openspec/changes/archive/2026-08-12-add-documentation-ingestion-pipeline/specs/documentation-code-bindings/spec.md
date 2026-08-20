## ADDED Requirements

### Requirement: Строгий adapter selection для info-artifacts
Service MUST выбирать structured artifact adapter по canonical `platform`, artifact type и versioned `format`; присутствующий info-artifact без поддерживаемого adapter MUST блокировать publication.

#### Scenario: Опциональный artifact отсутствует
- **WHEN** bundle не объявляет `COMPONENTS_INFO` или `THEME_INFO`
- **THEN** pipeline SHALL продолжить обработку без bindings соответствующего типа

#### Scenario: Format отсутствует
- **WHEN** manifest объявляет info-artifact без `format`
- **THEN** job MUST завершиться с error `MISSING_ARTIFACT_FORMAT`

#### Scenario: Format неизвестен
- **WHEN** manifest объявляет неизвестный tuple platform/type/format
- **THEN** job MUST завершиться с error `UNSUPPORTED_ARTIFACT_FORMAT`

### Requirement: Поддерживаемые platform adapters
Service MUST поддержать Compose, Android View, SwiftUI и UIKit component formats и Compose, Android View и общую SwiftUI/UIKit iOS theme schema v1.

#### Scenario: SwiftUI и UIKit используют общий theme adapter
- **WHEN** platform `swiftui` или `uikit` объявляет `THEME_INFO` с `sdds-ios-theme-info-v1`
- **THEN** service SHALL разобрать artifact общей iOS theme schema
- **AND** созданные bindings SHALL сохранить исходную platform publication

#### Scenario: Некорректный JSON одного элемента
- **WHEN** хотя бы один component или token не соответствует выбранной schema
- **THEN** весь artifact MUST считаться invalid
- **AND** service MUST NOT публиковать частичный набор bindings

### Requirement: Component CodeBinding
Service MUST создавать одну `component-style` binding на каждый component с subject `components.<key>` и сохранять props, `styleApi` и variations в platform payload.

#### Scenario: Compose component преобразован
- **WHEN** Compose component содержит key, style API и variations с `composeReference`
- **THEN** service SHALL создать одну binding компонента
- **AND** все variation references SHALL находиться в payload этой binding

#### Scenario: Variation не является отдельной binding
- **WHEN** component содержит несколько variations
- **THEN** service MUST NOT создавать отдельный `codeBindingId` для каждой variation

### Requirement: Token CodeBinding
Service MUST создавать одну `token` binding на каждый theme token с subject `tokens.<name>` и сохранять type, display name, description, value, reference и theme reference.

#### Scenario: Android View token преобразован
- **WHEN** View theme token содержит resource `reference` и attribute `themeReference`
- **THEN** оба значения SHALL сохраняться в platform payload token binding

### Requirement: Детерминированные StructuredLookupTerm
Service MUST строить lookup terms для subject, name, component key, class/qualified names, params, variation names/references и token/theme references и MUST связывать их с соответствующей binding.

#### Scenario: Поиск variation ведёт к component binding
- **WHEN** variation имеет reference `Avatar.Xxl`
- **THEN** service SHALL создать term `Avatar.Xxl`, указывающий на binding `components.avatar`

#### Scenario: Технические символы сохраняются
- **WHEN** term содержит `.`, `_`, `-`, `@` или `?`
- **THEN** original term SHALL сохраняться без потери символов
- **AND** normalized projection SHALL поддерживать case-insensitive exact/prefix lookup

### Requirement: Хранение source artifact и bindings
Service MUST сохранить immutable source JSON в publication storage, metadata/checksum в `StructuredArtifact` и queryable columns/payload `CodeBinding` в PostgreSQL без обязательного дублирования полного parsed source JSON.

#### Scenario: Binding воспроизводима
- **WHEN** клиент или оператор сопоставляет binding с исходными данными
- **THEN** binding SHALL содержать source artifact reference
- **AND** artifact metadata SHALL содержать checksum опубликованного source file
