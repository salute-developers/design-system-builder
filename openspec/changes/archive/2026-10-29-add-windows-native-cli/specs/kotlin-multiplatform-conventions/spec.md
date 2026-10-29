# Spec Delta

## ADDED Requirements

### Requirement: Нативная цель Windows для графа CLI

Все Kotlin Multiplatform модули, необходимые `:cli` и встроенному `:mcp-server-core`, SHALL предоставлять совместимые варианты `mingwX64` без удаления существующих JVM, macOS и Node.js вариантов.

#### Scenario: Разрешение графа и связывание на macOS

- **WHEN** разработчик выполняет задачу связывания Windows x64 executable на macOS
- **THEN** Gradle MUST разрешить совместимые варианты всех прямых и транзитивных зависимостей
- **THEN** сборка MUST создать `dsbuilder.exe`

#### Scenario: Существующие цели остаются доступными

- **WHEN** `mingwX64` добавлена в граф CLI
- **THEN** существующие проверки JVM, macOS и Node.js MUST оставаться доступными на поддерживаемых для них машинах
