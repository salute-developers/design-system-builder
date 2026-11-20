## MODIFIED Requirements

### Requirement: CLI application entrypoint

Модуль `:cli` SHALL предоставлять исполняемые точки входа JVM, macOS arm64/x64, Windows x64 и Kotlin/JS Node.js для команды `dsbuilder`, использующие общий путь выполнения команд.

#### Scenario: CLI entrypoint is configured
- **WHEN** Gradle настраивает модуль `:cli`
- **THEN** модуль MUST предоставлять JVM main class для запуска CLI с именем `dsbuilder`
- **THEN** существующие native executable для macOS arm64/x64 и Windows x64 MUST сохраняться
- **THEN** JS-таргет MUST предоставлять Node.js executable с тем же именем команды

#### Scenario: CLI can print baseline output
- **WHEN** разработчик запускает CLI без прикладного контекста для проверки базового поведения
- **THEN** CLI MUST возвращать детерминированный вывод, пригодный для проверки запуска
- **THEN** CLI MUST NOT требовать backend, Docker, credentials или приватные URL для help/version

#### Scenario: Сохранение существующих дистрибутивов
- **WHEN** добавляется Node.js-таргет и меняется общий путь выполнения
- **THEN** JVM/native сборки MUST продолжать работать без установленного Node.js для команд, которым он ранее не требовался
- **THEN** требования самостоятельных платформенных генераторов MUST сохраняться
