# Proposal

## Why

Пользователи Windows не могут запускать основной `dsbuilder` и встроенный `dsbuilder mcp serve` без JVM: нативный выпуск существует только для macOS. Нужен исполняемый файл Windows x64, который работает без установленной Java и использует те же команды и MCP-инструменты.

## What Changes

- Добавить нативную цель `mingwX64` во все модули графа CLI и выпускать `dsbuilder.exe` для Windows x64 вместе с инструкцией установки.
- Добавить платформенные реализации файловой системы, HTTP, авторизации, хранения сессии, запуска процессов и транспорта MCP stdio; сохранить общие прикладные сценарии и контракты инструментов.
- Поддержать абсолютные пути Windows, поиск `npm.cmd` и `gradlew.bat`, не меняя поведение Unix-платформ. Для iOS-инструмента на Windows возвращать явную диагностику недоступности.
- Проверять разрешение зависимостей, компиляцию и связывание на macOS. Проверку поведения готового выпуска на Windows x64 передать тестировщику после реализации.
- Существующие `install-*.sh` и `setup-local.sh` оставить для macOS/Linux. Добавить PowerShell-сценарии локальной установки CLI и запуска Docker-контура на Windows; Linux-скрипты bootstrap и seed выполнять внутри вспомогательного контейнера без переписывания. Серверные API, база данных и отдельный пакет `dsbuilder-mcp` не меняются.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `frontend-cli`: нативный Windows x64 executable, установка и базовое поведение без Java.
- `frontend-mcp-server`: встроенный MCP launcher и stdio на Windows с тем же набором инструментов.
- `frontend-client-authentication`: PKCE, безопасное файловое хранение и ротация сессии на Windows.
- `cli-platform-delegates`: абсолютные пути Windows и запуск внешних процессов.
- `platform-android-delegate`: обнаружение и запуск `gradlew.bat` на Windows.
- `platform-web-delegate`: обнаружение и запуск `npm.cmd` на Windows.
- `kotlin-multiplatform-conventions`: согласованная цель `mingwX64` и проверки графа зависимостей.
- `local-base-bootstrap`: запуск существующего локального контура из PowerShell на Windows через Docker Desktop.

## Impact

- `frontend-kt`: сборка модулей `core-*`, `feature-*`, `platform-*`, `mcp-server-core`, `cli`; Windows-адаптеры и упаковка; документация установки.
- Зависимости: существующие версии MCP SDK, Ktor, Koin, Clikt, coroutines, serialization и Okio имеют опубликованные варианты `mingwX64`; для Windows HTTP добавляется Ktor WinHttp той же версии. Полную совместимость графа подтвердит сборка.
- `.github/workflows`: сборка и публикация Windows-архива на macOS. JDK нужен сборщику Gradle, но не пользователю `dsbuilder.exe`.
- `backend-kt` и `js`: API, схема данных и код продукта не меняются. Добавляется Docker Compose override для сборки backend jars внутри Linux-контейнеров; отдельный Node.js launcher остаётся совместимым с общим форматом сессии.
