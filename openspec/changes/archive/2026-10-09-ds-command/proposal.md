# Proposal

## Why

Чтобы получить дизайн-систему целиком, сейчас нужно четыре команды: `theme fetch`, `components fetch`,
`theme generate`, `components generate`, — с одинаковыми опциями. Нужна одна точка входа для частого
сценария «скачать всё» и «сгенерировать всё».

## What Changes

- Новая группа команд `dsbuilder ds`:
  - `dsbuilder ds fetch` — `theme fetch`, затем `components fetch` с тем же контекстом, API URL и ключом;
  - `dsbuilder ds generate` — **один** вызов делегата платформы с новым действием `DESIGN_SYSTEM`.
- `DESIGN_SYSTEM` в `core-platform` — сгенерировать тему и компоненты вместе. Склейку делает инструмент
  платформы, а не CLI: `ds generate` устроен так же, как `theme generate` и `components generate`.
- `js/cli`: новый npm-скрипт `generate:ds` — тема и компоненты вместе. Без `--package` — обе части в `src`
  с общим индексом; с `--package` — один полный пакет `<scope>-<name>-<version>.tgz` без суффикса части,
  как собирает сервис генерации.
- Web-делегат объявляет `DESIGN_SYSTEM` → `npm run generate:ds`; `--output` → `--out`, аргументы после
  `--` — как есть.
- `ds generate`: use case в новом модуле `feature-ds` (по образцу `GenerateThemeUseCase` в `feature-theme`),
  зависит только от `core-*`; вызывает `PlatformCapabilityRunner` с `DESIGN_SYSTEM`. Платформа, делегат
  которой `DESIGN_SYSTEM` не объявил, получает понятный отказ.
- `ds fetch`: `:cli`, пакет `feature/ds/presentation`, вызывает `FetchThemesUseCase` и
  `FetchComponentsUseCase` без своей логики (`feature-*` не зависят друг от друга, поэтому отдельного
  use case нет). Опции — объединение: `--api-url`, `--api-key`, `--design-system`, `--project-key-env`,
  `--platform`, `--destination` (новая `.sdds` для ссылки без локального конфига), `--to` (каталог
  пакета компонентов). Вывод — результаты обеих загрузок по очереди.
- Существующие команды `theme` и `components` не меняются.

## Open Questions

1. ~~`ds fetch`: отказ первой загрузки~~ — решено: остановка, код 1, компоненты не загружаются.
2. ~~`DESIGN_SYSTEM` у iOS и Android~~ — решено: поддерживают все платформы. iOS генерирует компоненты
   вместе с темой, его `DESIGN_SYSTEM` запускает то же, что `THEME`; Android запускает обе Gradle-таски
   платформы одним вызовом `gradlew`.

## Имя пакета web

`--ds-name` в `js/cli` заменяется на `--name` и обязательно только с `--package`: на исходники `src` имя не
влияет, а имя тенанта (прежнее значение по умолчанию) не годится для публикуемого пакета. Без `--package`
`generate:components` больше не читает тему, и `--tenant` у него убран.

## Out of Scope

- MCP-инструменты для `ds`.
- Изменение существующих команд `theme` и `components`.

## Impact

- `frontend-kt/core-platform`: `Capability.DESIGN_SYSTEM`.
- `frontend-kt/feature-ds`: `GenerateDesignSystemUseCase`, Koin-модуль.
- `frontend-kt/platform-web`: `DESIGN_SYSTEM` → `npm run generate:ds`; тесты.
- `frontend-kt/platform-ios`, `platform-android`: `DESIGN_SYSTEM`; тесты.
- `frontend-kt/cli`: `feature/ds/presentation` (`DsCliCommand`, `DsFetchCliCommand`, `DsGenerateCliCommand`),
  `feature/ds/di`, регистрация в composition root, тесты, `USAGE.md`, `AGENTS.md` (модуль `feature-ds`).
- `js/cli`: скрипт `generate:ds`, README.
- Спецификации: новая `cli-ds`; дельты `cli-platform-delegates` (`DESIGN_SYSTEM`), `platform-web-delegate`,
  `local-web-generation`.
