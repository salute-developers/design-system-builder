## Why

Текущий `theme fetch` сохраняет `meta.json` как голый массив tokens и кладет tenant directories прямо в `.sdds`, из-за чего локальный формат сложнее расширять и отделять от служебных файлов CLI. DS Builder нужен более явный tenant-scoped layout: metadata tenant должна содержать имя, версию и структурированный список tokens с derived tags для дальнейшей генерации артефактов дизайн-системы.

## What Changes

- **BREAKING**: tenant directories после `theme fetch` должны создаваться в `.sdds/tenants/{tenantDirectory}` вместо `.sdds/{tenantDirectory}`.
- **BREAKING**: `meta.json` должен стать JSON object с полями `name`, `version` и `tokens` вместо JSON array.
- `meta.json.name` должен хранить название tenant.
- `meta.json.version` должен всегда записываться строкой `"latest"`.
- Каждый token в `meta.json.tokens` должен содержать поле `tags`, полученное из `token.name` разбиением по точке.
- `.sdds/config.json` должен сохранять актуальные `directoryPath` для tenants с учетом нового префикса `.sdds/tenants/`.

## Capabilities

### New Capabilities

- Нет.

### Modified Capabilities

- `cli-themes`: меняется контракт локального tenant layout, содержимого `meta.json` и tenant `directoryPath` в `.sdds/config.json`.

## Impact

- Затронут `dsbuilder-frontend/cli`, прежде всего логика `theme fetch`, модели/кодеки локального theme metadata, writer локальных файлов и тесты CLI.
- API backend и persistence не меняются: CLI продолжает читать существующие tenants, tokens и token values endpoints.
- Формат локальных файлов становится несовместимым с предыдущим layout `.sdds/{tenantDirectory}` и `meta.json` array, поэтому тесты и документация должны отражать новый контракт.
