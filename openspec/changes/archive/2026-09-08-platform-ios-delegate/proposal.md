## Why

Контракт делегата платформы есть, но реестр пуст: `theme generate --platform swiftui` отказывает
«для платформы не зарегистрирован toolchain». iOS-инструмент к этому моменту готов — Swift CLI
`dsbuilder-ios` в plasma-ios принимает путь к `.sdds` и сам выводит из него имя темы, корень
чекаута и расположение сэмплов.

Остаётся адаптер: перевести capability в argv этого инструмента и найти его на машине.

## What Changes

- Новый модуль `platform-ios` с `IosCliDelegate`: toolchain `ios`, платформа `swiftui`,
  capability `THEME` и `DOCS_AGGREGATE`.
- `IosToolchainLocator` ищет инструмент в фиксированном порядке: `--tool` → `DSBUILDER_IOS_TOOL` →
  `~/.dsbuilder/toolchains/ios/current/dsbuilder-ios` → `PATH`.
- `doctor` спрашивает у инструмента `--version` и сообщает путь и версию, ничего не генерируя.
- Делегат зарегистрирован в composition root `:cli`; `toolchain list` и `toolchain doctor`
  показывают его без дополнительной настройки.
- `COMPONENTS` осознанно не поддержан: на iOS вариации компонентов генерируются вместе с темой,
  и команда отказывает с указанием на `theme generate`.

Затронуто: только `frontend-kt`. `backend-kt` и `js` не затронуты.
