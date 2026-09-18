## Context

`PlatformDelegate` (`core-platform`) уже покрывает и внешний бинарь (iOS: `IosCliDelegate` зовёт `dsbuilder-ios`
процессом), и должен покрыть Gradle внутри проекта пользователя (Android). Композиционный корень `:cli`
(`PlatformDelegatesModule.kt`) уже содержит заглушку-комментарий, ожидающую `get<AndroidGradleDelegate>()`.

Инструмент для Android — Gradle-плагин `dsBuilder` (`sdds-core/plugin_theme_builder`) в отдельном репозитории
`plasma-android`. В отличие от `dsbuilder-ios`, это не самостоятельный процесс: он живёт внутри Gradle-проекта
пользователя, конфигурируется DSL-блоком в build.gradle.kts модуля и сам резолвит `.sdds` конвенцией (текущий
проект или его непосредственный Gradle-родитель).

Изменение `dsbuilder-cli-integration` в `plasma-android` уже закрыло два пробела, без которых делегат был
невозможен: (а) `generateTheme`/`generateComponents` раньше не принимали платформу как параметр вызова — теперь
`generateComposeTheme`/`generateViewTheme`/`generateComposeComponents`/`generateViewComponents` регистрируются как
отдельные таски, и регистрируются только когда модуль реально конфигурирует эту платформу; (б) `components`
capability раньше умела только remote source — теперь `.sdds/components` работает как локальный fallback,
аналогично уже существовавшему для темы. Оба пункта подтверждены смоук-тестом на реальных token-модулях: таска
запрошенной платформы существует, встречная — Gradle честно отвечает `Task 'generateViewTheme' not found in
project ...`.

## Goals / Non-Goals

**Goals:**

- Детерминированно запускать одну запрошенную платформу для `THEME`/`COMPONENTS` и получать осмысленную ошибку,
  если модуль пользователя эту платформу не сконфигурировал.
- `doctor` должен проверять готовность без предположения о наличии отдельного бинаря или версии инструмента.
- Не требовать от пользователя ничего, кроме уже применённого `dsBuilder`-плагина в модуле, где лежит `.sdds`.

**Non-Goals:**

- `DOCS_AGGREGATE` для Android — `documentationAggregate` в plasma-android остаётся одной таской без
  пер-платформенного разделения; в capabilities `AndroidGradleDelegate` в этом изменении не входит.
- `ToolchainInstaller` для Android — ставить нечего, `gradlew` уже часть проверенного пользователем репозитория
  (как и решено в design.md `cli-platform-delegates`: установка нужна только внешним бинарям).
- Project-property/`-D` overrides для `--output` — Android output location остаётся DSL-настройкой модуля;
  `--output` для Android capability не поддерживается (см. Decisions/4).

## Decisions

### 1. Поиск `gradlew`: подъём от `workspaceDir`, запуск с `-p`

`WorkspacePaths.workspaceDir` — родитель `.sdds`, обычно Android-модуль внутри более крупной composite-сборки;
`gradlew` лежит в корне этой сборки, а не в каждом модуле. `AndroidGradleLocator` поднимается от `workspaceDir`
вверх по файловой системе до первого найденного `gradlew`, затем зовёт его с флагом `-p <workspaceDir>`:
`<gradlew> -p <workspaceDir> generateComposeTheme`. Это снимает необходимость вычислять Gradle project path
(`:theme:compose:generateComposeTheme` и т.п.) — Gradle сам резолвит таску нужного проекта по директории; так и
были устроены смоук-тесты в `plasma-android` (`./gradlew -p tokens/sdds.serv.compose help --task
generateComposeTheme`).

`--tool` override для Android означает явный путь к `gradlew` (а не к бинарю платформенного инструмента, как у
iOS) — семантика поля не меняется («абсолютный путь инструмента из `--tool`»), просто для Android этот инструмент
и есть Gradle wrapper.

Альтернатива — требовать явный Gradle project path в `.sdds/config.json`. Отклонена: `-p` работает без
дополнительной конфигурации; ограничение (не сработает, если один `workspaceDir` соответствует нескольким
Gradle-подпроектам одновременно) не встречается в реальных модулях `plasma-android` — модуль темы это один
каталог с одним build.gradle.kts.

### 2. `doctor` проверяет присутствие таски, а не версию

У Android нет отдельного бинаря — нет и осмысленного `--version` (версия Gradle — не версия `dsBuilder`-плагина).
`doctor` вместо этого запускает `<gradlew> -p <workspaceDir> help --task generateComposeTheme` (`THEME`/`compose`
как индикатор общей готовности инструмента — контракт `doctor(workspace, toolOverride)` не получает
capability/platform) и по exit code решает: `0` → `ToolchainStatus.Ready(executable = <gradlew>, version = "")`,
ненулевой → `ToolchainStatus.Missing` с подсказкой, что модуль не применяет `dsBuilder` или не конфигурирует
Compose. Более точная проверка — «а есть ли таска именно для запрошенных `(capability, platform)`» — происходит
на `run`: если нужной таски нет, Gradle вернёт ненулевой exit code, `run` вернёт `DelegateResult.Failed`.
Расширение самого контракта `doctor` capability/платформой ради одного делегата — вне scope.

### 3. Выбор Gradle-таски по `(capability, platform)`

```
                    THEME                       COMPONENTS
compose      generateComposeTheme        generateComposeComponents
android-view generateViewTheme           generateViewComponents
```

`run()` матчит `invocation.capability` и `invocation.platform` на конкретное имя таски и зовёт `<gradlew> -p
<workspaceDir> <task> <passthrough...>`. `passthrough` (аргументы после `--`) добавляются к Gradle-вызову без
изменений — так же, как у iOS-делегата.

### 4. `--output` не поддерживается для Android

В отличие от iOS (`--output <dir>` буквально прокидывается инструменту), Android output location — DSL-настройка
модуля (`outputLocation(OutputLocation.BUILD/SRC)`), project-property overrides в плагине не существуют. Если
`invocation.output != null`, `AndroidGradleDelegate.run()` возвращает `DelegateResult.Unsupported` с объяснением,
что output для Android настраивается в build.gradle.kts модуля. Альтернатива — молча игнорировать `--output` —
отклонена: тихое несовпадение ожидания и результата хуже явного отказа, паттерн уже есть у iOS-делегата для
`COMPONENTS`.

## Risks / Trade-offs

- **`doctor` слабее, чем у iOS.** Проверка таски подтверждает, что Gradle её видит, но не проверяет версию
  `dsBuilder`-плагина и не гарантирует, что генерация реально пройдёт (например, битый `.sdds` даст ошибку только
  при `run`). Приемлемо: `run` в любом случае обязан обработать ошибку инструмента, `doctor` — дешёвая проверка
  перед стартом, не гарантия успеха.
- **`-p` требует, чтобы у `workspaceDir` был ровно один применяющий `dsBuilder` Gradle-проект.** Если появится
  структура, где один `.sdds`-каталог используют несколько sibling-модулей, `-p <workspaceDir>` перестанет
  однозначно резолвить проект. Не наблюдается в текущих token-модулях `plasma-android`.
- **Минимальная версия `dsBuilder`-плагина не проверяется явно.** Если модуль применяет более старую версию
  плагина без пер-платформенных тасок, `doctor`/`run` вернут «task not found» — что технически корректно (таски
  нет), но сообщение не укажет на устаревшую версию плагина как причину. Приемлемо на первом шаге: сообщение всё
  равно указывает разработчику, что проверить.

## Migration Plan

Аддитивно. `theme generate --platform compose`/`android-view` и `components generate --platform ...` сегодня
падают с «toolchain не зарегистрирован» — после этого изменения они начинают работать для модулей, где
применённая версия `dsBuilder`-плагина уже содержит пер-платформенные таски (выпущена вместе с
`dsbuilder-cli-integration`). Модули на более старой версии плагина продолжат получать «task not found» при `run`
(до обновления зависимости) — не хуже сегодняшнего состояния.
