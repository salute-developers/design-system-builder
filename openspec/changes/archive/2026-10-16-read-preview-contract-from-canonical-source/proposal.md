## Why

Схема payload Preview Protocol v1 и общие фикстуры лежат в трёх местах: канонически в `backend-kt/preview/contract`, копией в
клиенте (`js/apps/client/src/composePreview/schema`) и копией в `plasma-android`. Копия клиента нужна только тесту
`schema.test.ts` (в рантайме и в сборке она не участвует) и поддерживается скриптом `sync:preview-schema`, а проверка
`check:preview-schema` запускается вручную. В CI клиент только собирается (`validate-js.yml`), его тесты не идут, так что расхождение
не обнаруживается автоматически. При добавлении раздела `defaults` схему пришлось копировать руками.

## What Changes

- Клиент читает схему и общие фикстуры прямо из `backend-kt/preview/contract`; копия в клиенте, скрипт синхронизации и скрипт
  проверки удаляются.
- CI запускает тесты клиента (`npm test`) в `validate-js.yml`; изменения в `backend-kt/preview/contract/**` тоже запускают этот
  workflow.
- Копия в `plasma-android` остаётся; её сверка с каноническим файлом по отпечаткам (SHA-256) в CI вынесена в отдельный change.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `preview-payload-contract`: клиент не хранит копию схемы и фикстур, а читает канонические файлы; проверка выполняется в CI.

## Impact

- `js/apps/client`: `src/composePreview/schema.test.ts`, удаляются `src/composePreview/schema/`, `scripts/sync-preview-payload-schema.mjs`,
  скрипты `sync:preview-schema` и `check:preview-schema` в `package.json`, раздел «Preview Protocol schema» в `README.md`.
- `.github/workflows/validate-js.yml`: новое задание с тестами клиента и новый путь запуска.
- `backend-kt/preview/contract/README.md`: клиент перечислен как читающий потребитель, а не владелец копии.
- Схема, фикстуры, плагин и версия протокола не меняются.
