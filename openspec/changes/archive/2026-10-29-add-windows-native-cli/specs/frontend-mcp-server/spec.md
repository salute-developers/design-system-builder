# Spec Delta

## ADDED Requirements

### Requirement: Встроенный MCP-сервер на Windows x64

`dsbuilder.exe mcp serve` SHALL запускать общий MCP-сервер внутри нативного процесса Windows и SHALL предоставлять тот же реестр инструментов и схемы аргументов, что и CLI на macOS.

#### Scenario: Запуск без дополнительных сред выполнения

- **WHEN** MCP-клиент запускает `dsbuilder.exe mcp serve` на Windows x64
- **THEN** сервер MUST ответить на `initialize` и `tools/list` через stdio
- **THEN** сервер MUST NOT запускать Node.js либо JVM-процесс

#### Scenario: Протокольный поток не искажается

- **WHEN** MCP-клиент передаёт несколько сообщений JSON-RPC через stdin
- **THEN** stdout MUST содержать только корректные сообщения протокола без преобразования окончаний строк или повреждения UTF-8
- **THEN** диагностика MUST направляться в stderr без секретов

#### Scenario: Завершение по закрытию входа

- **WHEN** MCP-клиент закрывает stdin после обмена сообщениями
- **THEN** сервер MUST закрыть сессию и HTTP-клиент и завершиться с кодом `0`
