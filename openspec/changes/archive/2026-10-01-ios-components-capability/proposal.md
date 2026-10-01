## Why

`dsbuilder-ios` разделил генерацию на `theme generate` и `components generate` — токены темы
и вариации компонентов больше не делаются одним проходом. Делегат iOS об этом не знает:
он объявляет только `THEME` и `DOCS_AGGREGATE`, а `components generate --platform swiftui`
отказывает со ссылкой на `theme generate`.

Android-делегат уже отображает все три capability в свои пер-платформенные таски; iOS
отставал только из-за устройства платформенного инструмента.

## What Changes

- `IosCliDelegate` объявляет `COMPONENTS` и переводит capability в `components generate --sdds`.
- Ветка `Unsupported` удалена: делегат поддерживает все объявленные capability, и аргументы
  для них строятся одинаково.
- Спека `platform-ios-delegate` и тесты делегата обновлены.

Затронуто: только `frontend-kt/platform-ios`. Общий контракт делегатов не менялся.
