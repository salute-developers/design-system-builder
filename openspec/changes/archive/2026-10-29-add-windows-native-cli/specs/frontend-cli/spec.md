# Spec Delta

## ADDED Requirements

### Requirement: Нативный выпуск CLI для Windows x64

`:cli` SHALL предоставлять исполняемый файл `dsbuilder.exe` для Windows x64, запускаемый без установленной Java, Node.js или Gradle.

#### Scenario: Базовые команды на чистой Windows

- **WHEN** пользователь распаковывает выпуск Windows x64 и запускает `dsbuilder.exe --help` или `dsbuilder.exe --version`
- **THEN** команда MUST завершиться с ожидаемым кодом и детерминированным выводом
- **THEN** для запуска MUST NOT требоваться Java, Node.js, Gradle, Docker, учётные данные или сервер DS Builder

#### Scenario: Установка из выпуска

- **WHEN** пользователь выполняет приложенный сценарий установки Windows
- **THEN** `dsbuilder.exe` MUST копироваться в каталог пользователя без административных прав
- **THEN** инструкция MUST объяснять, как добавить этот каталог в `PATH` и как вызвать `dsbuilder.exe mcp serve` из MCP-клиента

#### Scenario: Существующие команды не теряются

- **WHEN** пользователь запускает `dsbuilder.exe --help`
- **THEN** набор команд MUST включать те же группы, что и нативный выпуск macOS, включая `auth` и `mcp`
- **THEN** команды, которым нужен внешний платформенный инструмент, MUST сообщать о его отсутствии или недоступности без требования Java для запуска самого CLI
