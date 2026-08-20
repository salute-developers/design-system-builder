## Why

Разработчикам нужен короткий локальный alias для tenant, чтобы не работать постоянно с длинными backend `tenant.id` или изменяемыми backend `name` при CLI-сценариях вокруг themes. Сейчас `theme fetch` сохраняет tenants в `.sdds/config.json`, поэтому alias должен стать частью этого локального project context и переживать обновление metadata из backend.

## What Changes

- Добавить optional поле `alias` в entries `tenants[]` внутри `.sdds/config.json`.
- Добавить CLI-команды для управления aliases tenant: установка, удаление и просмотр.
- Обновить поведение `theme fetch`, чтобы оно сохраняло локальные aliases для tenants с тем же `id` при перезаписи backend metadata.
- Валидировать, что alias уникален внутри текущего `.sdds/config.json` и назначается только существующему tenant.
- Не отправлять aliases в backend и не сохранять в config raw API key, API URL или другие runtime secrets.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `cli-core`: формат `.sdds/config.json` расширяется optional tenant alias metadata и правилами сохранения non-secret локальных данных.
- `cli-themes`: CLI `theme` получает управление tenant aliases, а `theme fetch` должен сохранять aliases при обновлении tenants.

## Impact

- Затрагивает `dsbuilder-frontend/cli` в пакетах `core.config` и `feature.theme`.
- Затрагивает OpenSpec specs `cli-core` и `cli-themes`.
- Backend API, микросервисы, persistence и сетевые контракты не меняются.
- Новые dependencies не требуются.
- Проверки должны покрыть codec/config store, command parsing/output, alias validation и сохранение aliases после `theme fetch`.
