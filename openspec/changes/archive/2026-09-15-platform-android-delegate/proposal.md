## Why

`theme generate --platform swiftui` и `components generate --platform swiftui` уже делегируют генерацию инструменту
платформы (`platform-ios-delegate`). Для Android такого делегата нет: реестр `PlatformDelegateRegistry` пуст для
`compose` и `android-view`, и обе команды отказывают «для платформы не зарегистрирован toolchain». Инструмент для
Android — Gradle-плагин `dsBuilder` (`sdds-core/plugin_theme_builder`) в репозитории `plasma-android` — уже готов
быть таким инструментом: изменение `dsbuilder-cli-integration` в том репозитории добавило пер-платформенные
generation-таски (`generateComposeTheme`, `generateViewTheme`, `generateComposeComponents`,
`generateViewComponents`) и локальный `.sdds/components` fallback для компонентов. Остаётся адаптер: перевести
capability в имя Gradle-таски и найти `gradlew` рабочей копии.

## What Changes

- Новый модуль `platform-android` с `AndroidGradleDelegate`: toolchain `android`, платформы `compose` и
  `android-view`, capability `THEME` и `COMPONENTS` (`DOCS_AGGREGATE` вне scope — см. Impact).
- `AndroidGradleLocator` ищет `gradlew`, поднимаясь от `workspace.workspaceDir` вверх по дереву каталогов до
  первого найденного; `--tool` override используется как явный путь к `gradlew` без поиска.
- Выбор Gradle-таски по паре `(capability, platform)`: `THEME`+`compose` → `generateComposeTheme`,
  `THEME`+`android-view` → `generateViewTheme`, `COMPONENTS`+`compose` → `generateComposeComponents`,
  `COMPONENTS`+`android-view` → `generateViewComponents`. Инструмент запускается как `<gradlew> -p <workspaceDir>
  <task> <passthrough>`.
- `doctor` проверяет `<gradlew> -p <workspaceDir> help --task <task>` вместо `--version` — у Android нет отдельного
  бинаря и, соответственно, нет осмысленной версии инструмента; готовность — это то, что Gradle видит нужную
  таску в этом модуле.
- `--output` не поддержан для `android`: output location — DSL-настройка модуля
  (`dsBuilder.theme.outputLocation`/`components.outputLocation`), а не CLI-флаг. При непустом `--output` делегат
  возвращает `Unsupported` с объяснением, не запуская процесс.
- Делегат зарегистрирован в composition root `:cli` (`PlatformDelegatesModule.platformDelegates()`), заменяя
  плейсхолдер-комментарий, который уже ждал `get<AndroidGradleDelegate>()`.

## Capabilities

### New Capabilities
- `platform-android-delegate`: контракт делегата платформы Android — какие Gradle-таски запускаются для каждой
  capability/платформы, как ищется `gradlew`, что проверяет `doctor`, как обрабатывается отсутствие таски и
  неподдержанный `--output`.

### Modified Capabilities
- (нет) — `cli-platform-delegates` уже описывает общий контракт `PlatformDelegate`/реестра/раннера и не меняется;
  этот делегат — новая реализация существующего порта, как и `platform-ios-delegate`.

## Impact

- Новый модуль `frontend-kt/platform-android`, регистрация в
  `frontend-kt/cli/src/commonMain/kotlin/com/dsbuilder/frontend/cli/di/PlatformDelegatesModule.kt`,
  `frontend-kt/settings.gradle.kts`.
- Внешняя зависимость уже закрыта: `plasma-android` получил пер-платформенные generation-таски и локальный
  `.sdds/components` в изменении `dsbuilder-cli-integration` (см. этот репозиторий, `openspec/changes/archive/`
  после архивации) — минимальная требуемая версия плагина фиксируется в README/тестах модуля `platform-android`.
- `DOCS_AGGREGATE` для Android сознательно не входит в это изменение: `documentationAggregate` в plasma-android
  остаётся одной таской на модуль без пер-платформенного разделения — `docs generate` для Android продолжит
  работать без платформенного шага агрегации, как для любой платформы без делегата этой capability.
- Не затрагивает `backend-kt` и `js`.
