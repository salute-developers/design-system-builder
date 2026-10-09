# Tasks

## 0. Решения

- [x] 0.1 Склейка темы и компонентов — в инструменте платформы (`js/cli` `generate:ds`), `ds generate` — один вызов делегата.
- [x] 0.2 `--package` в `ds generate` для web собирает один полный пакет.
- [x] 0.3 `ds fetch`: при отказе загрузки темы — остановка, код 1, компоненты не загружаются.
- [x] 0.4 `DESIGN_SYSTEM` поддерживают все платформы: iOS — то же, что `THEME`; Android — обе Gradle-таски одним вызовом.

## 1. js/cli

- [x] 1.1 `generate:ds`: тема и компоненты в `src` с общим индексом; `--package` — один полный пакет `<scope>-<name>-<version>.tgz`; `--out`, `--sdds`, `--components`, `--web`, `--tenant`, `--ds-name`, `--ds-version`, `--core-version`.

## 2. Платформы

- [x] 2.1 `Capability.DESIGN_SYSTEM` в `core-platform`.
- [x] 2.2 `platform-web`: `DESIGN_SYSTEM` → `npm run generate:ds`; тесты.
- [x] 2.3 iOS: `DESIGN_SYSTEM` → те же аргументы, что `THEME`. Android: `DESIGN_SYSTEM` → `generate<Platform>Theme generate<Platform>Components` одним запуском `gradlew`. Тесты.

## 3. Команды

- [x] 3.1 Модуль `feature-ds`: `GenerateDesignSystemUseCase` через `PlatformCapabilityRunner`, Koin-модуль; регистрация в `settings.gradle.kts` и `:cli`.
- [x] 3.2 `DsCliCommand` (`ds`) с подкомандами `fetch` и `generate`, `dsCliPresentationModule`, регистрация в `DsBuilderCli`.
- [x] 3.3 `ds generate`: `--platform`, `--output`, `--tool`, аргументы после `--`; вывод как у `theme generate`.
- [x] 3.4 `ds fetch`: опции объединения, вызов `FetchThemesUseCase` и `FetchComponentsUseCase`, вывод обоих результатов, код возврата по решению 0.3.

## 4. Проверка

- [x] 4.1 Тесты: `ds generate` — один вызов `DESIGN_SYSTEM`, отказ для платформы без него, передача `--output` и аргументов после `--`; `ds fetch` — порядок, общий контекст и ключ, отказ первой загрузки.
- [x] 4.2 `./gradlew build`; `dsbuilder ds generate --platform react` и `-- --package` (один полный `.tgz`) на копии проекта. `ds fetch` вживую не прогнан: ключ в окружении истёк; порядок, общий контекст и остановка при отказе темы покрыты тестами.
- [x] 4.3 `USAGE.md`, `AGENTS.md`, README `js/cli`, спецификации.

## 5. Имя пакета web

- [x] 5.1 `--ds-name` → `--name` у `generate:theme`, `generate:components`, `generate:ds`; обязателен только с `--package`, проверка до сборки.
- [x] 5.2 `generate:components` не читает тему и не принимает `--tenant`.
- [x] 5.3 Проверка: без `--name` исходники совпадают с прежними; `--package` без `--name` отказывает у всех трёх команд, `output` не тронут; `--package --name base` → `@sddsjs/base`, `sddsjs-base-0.1.0-components.tgz`.
