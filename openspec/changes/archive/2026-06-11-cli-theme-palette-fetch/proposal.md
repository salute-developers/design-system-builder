## Why

`dsbuilder theme fetch` уже собирает локальные theme artifacts, но не загружает базовую палитру дизайн-системы. Из-за этого consumers `.sdds` не получают единый источник shade/saturation values рядом с tenants, tokens и token values.

## What Changes

- `theme fetch` будет дополнительно запрашивать project-scoped palette endpoint `GET /api/projects/{projectId}/ds/palette`.
- CLI будет парсить backend response как JSON array объектов `PaletteItem` с полями `id`, `type`, `shade`, `saturation`, `value`, `createdAt`, `updatedAt`.
- CLI будет преобразовывать массив `PaletteItem` в локальный object format:
  ```json
  {
    "$shade": {
      "$saturation": "$value"
    }
  }
  ```
- CLI будет сохранять результат в `.sdds/tenants/palette.json`.
- `.sdds/config.json` будет хранить non-secret путь до локальной палитры.
- При ошибке загрузки или парсинга palette `theme fetch` будет завершаться детерминированной ошибкой без записи partial theme files.

## Capabilities

### New Capabilities

- Нет.

### Modified Capabilities

- `cli-themes`: `theme fetch` загружает palette, преобразует ее в локальный object format и пишет `.sdds/tenants/palette.json`.
- `cli-core`: project config поддерживает optional путь до локального `palette.json` без сохранения secrets или runtime API URL.

## Impact

- Код CLI в `dsbuilder-frontend/cli`: backend client/DTO, theme fetch use case или write plan, local file writer, config model/serialization.
- Локальный `.sdds` layout: появляется `.sdds/tenants/palette.json`, а `.sdds/config.json` получает путь к этому файлу.
- Backend API contract используется без изменения endpoint path: `GET /api/projects/{projectId}/ds/palette`.
- Нужно обновить CLI tests для success, parse failure и atomic write behavior, а также config serialization tests.
