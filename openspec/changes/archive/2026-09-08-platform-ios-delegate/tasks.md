## 1. Адаптер

- [x] 1.1 Завести модуль `platform-ios` и подключить его в `settings.gradle.kts`.
- [x] 1.2 Реализовать `IosToolchainLocator`: `--tool` → env → управляемая установка → `PATH`.
- [x] 1.3 Реализовать `IosCliDelegate`: argv для `THEME` и `DOCS_AGGREGATE`, `doctor` через `--version`, отказ для `COMPONENTS`.
- [x] 1.4 Зарегистрировать делегат в composition root `:cli`.

## 2. Тесты

- [x] 2.1 argv, коды возврата, отсутствие инструмента и `doctor` — фейковым `ProcessRunner`.
- [x] 2.2 Порядок поиска инструмента — фейковой файловой системой.
- [x] 2.3 Composition root: реестр отдаёт `ios` для `swiftui` и ничего для остальных платформ.

## 3. Верификация

- [x] 3.1 `cd frontend-kt && ./gradlew build` — тесты, detekt и spotlessCheck зелёные.
- [x] 3.2 E2E: `dsbuilder theme generate --platform swiftui --tool <dsbuilder-ios>` на чекауте plasma-ios.
