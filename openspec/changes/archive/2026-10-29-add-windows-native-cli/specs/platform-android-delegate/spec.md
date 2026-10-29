# Spec Delta

## ADDED Requirements

### Requirement: Android-инструмент на Windows

Android-делегат SHALL находить и запускать `gradlew.bat` в проекте Windows, сохраняя существующие имена задач и порядок аргументов.

#### Scenario: Поиск обёртки Gradle

- **WHEN** CLI запускается на Windows без `--tool`
- **THEN** делегат MUST искать `gradlew.bat` от рабочего каталога проекта вверх до корня тома
- **THEN** найденный файл MUST использоваться для `doctor` и генерации

#### Scenario: Запуск выбранной задачи

- **WHEN** пользователь запускает генерацию для `compose` или `android-view`
- **THEN** делегат MUST передать `-p <workspaceDir>` и существующие имена задач в обёртку проекта
- **THEN** CLI MUST сохранить код завершения обёртки и поток её вывода

#### Scenario: Среда Android-сборки отсутствует

- **WHEN** `gradlew.bat` найден, но проект не может запустить Gradle из-за отсутствия JDK
- **THEN** CLI MUST сообщить об ошибке внешнего инструмента
- **THEN** запуск `dsbuilder.exe --help` и `dsbuilder.exe mcp serve` MUST оставаться возможным без JDK
