# Spec Delta

## ADDED Requirements

### Requirement: Обнаружение web-инструмента на Windows

Web-делегат SHALL находить `npm.cmd` в каталогах Windows `PATH` и запускать существующие команды генератора без изменения их аргументов.

#### Scenario: Поиск npm

- **WHEN** `PATH` содержит несколько каталогов, разделённых `;`, и один из них содержит `npm.cmd`
- **THEN** `toolchain doctor --platform react` MUST использовать найденный сценарий и получить версию npm

#### Scenario: Запуск генератора

- **WHEN** пользователь запускает `dsbuilder.exe ds generate --platform react` с настроенным `DSBUILDER_WEB_TOOL`
- **THEN** делегат MUST запустить нужный сценарий npm с путями Windows и сохранить выходной код
- **THEN** CLI MUST NOT требовать Node.js до вызова команды, использующей web-генератор
