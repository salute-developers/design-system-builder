## Why

Код дизайн-системы на платформах генерируют разные инструменты: Swift CLI в plasma-ios,
Gradle-плагин DS Builder в plasma-android. Сегодня разработчик запускает их руками и вручную же
связывает с тем, что `dsbuilder theme fetch` положил в `.sdds`. DS Builder CLI должен стать единой
точкой входа: `theme generate`, `components generate` и `docs generate` обязаны сами вызвать
инструмент платформы. Для этого CLI нужна архитектурная возможность делегировать вызов платформе,
не зная ни про Swift, ни про Gradle.

Изменение закладывает эту возможность целиком: контракт делегата, запуск процессов, выбор платформы,
команды генерации и осмотр toolchain'ов. Адаптеры конкретных платформ (`platform-android`,
`platform-ios`) приезжают отдельными изменениями и разрабатываются параллельно, потому что
опираются на зафиксированный здесь контракт.

## What Changes

- Новая capability `cli-platform-delegates`: порт `PlatformDelegate`, реестр
  `PlatformDelegateRegistry`, выбор платформы `PlatformResolver`, общий сценарий запуска
  `PlatformCapabilityRunner` и модели `ToolchainId`, `Capability`, `WorkspacePaths`,
  `DelegateInvocation`, `DelegateResult`, `ToolchainStatus` — модуль `core-platform`.
- Новый порт `ProcessRunner` (модуль `core-process`) с реализациями для JVM (`ProcessBuilder`) и
  macOS (`NSTask`); `ClientRuntime` получает `processRunner`.
- Новый доменный тип `TargetPlatform` (`compose`, `android-view`, `swiftui`, `react`) и его
  отображение в платформу документации. `uikit` и `design` остаются платформами документации без
  собственного инструмента: целевыми они не становятся и задаются только явным `--platform`.
- `dsbuilder init --platform` записывает целевые платформы в `.sdds/config.json`
  (новое необязательное поле `platforms`); команды берут платформу оттуда.
- Новые команды `dsbuilder theme generate` и `dsbuilder components generate` делегируют генерацию
  инструменту платформы, печатая перед запуском, что и чем запускается.
- Новая группа команд `dsbuilder toolchain` (`list`, `doctor`) — модуль `feature-toolchain`.
- `dsbuilder docs generate` перед сборкой пакета запускает платформенный шаг документации, если для
  платформы есть делегат с такой capability; `--docs-dir` и `--no-aggregate` оставляют прежнее
  поведение с готовым деревом.
- `docs generate --platform` остаётся необязательным и обратно совместимым: без опции платформа
  берётся из `.sdds/config.json`, а проект, не объявивший платформу, получает прежнее умолчание
  `compose`. Дерево, собранное для другой платформы, по-прежнему отсекается сверкой
  `meta/platform-context.json`.

Затронуто: только `frontend-kt`. `backend-kt` и `js` не затронуты.
