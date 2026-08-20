## 1. Domain write plan

- [x] 1.1 Добавить internal модели для structured tenant meta в `feature/theme/domain`, включая `name`, `version`, `tokens` и token `tags`.
- [x] 1.2 Обновить `ThemeWritePlanBuilder`, чтобы `meta.json` создавался как JSON object с `version = "latest"` и `tags = token.name.split(".")` для каждого token.
- [x] 1.3 Сохранить текущую фильтрацию enabled tokens и validation missing values без изменения backend DTO contract.

## 2. Local filesystem writer

- [x] 2.1 Обновить `LocalThemeFileWriter`, чтобы generated files записывались в `.sdds/tenants/{tenantDirectory}`.
- [x] 2.2 Обновить запись `.sdds/config.json`, чтобы tenant `directoryPath` сохранялся как `.sdds/tenants/{tenantDirectory}`.
- [x] 2.3 Обновить cleanup generated files, чтобы он удалял known files и из старого `.sdds/{tenantDirectory}`, и из нового `.sdds/tenants/{tenantDirectory}` layout.

## 3. Tests

- [x] 3.1 Обновить существующие CLI tests, ожидающие `.sdds/{tenantDirectory}`, на `.sdds/tenants/{tenantDirectory}`.
- [x] 3.2 Добавить test для `meta.json` object с `name`, `version = "latest"` и массивом `tokens`.
- [x] 3.3 Добавить test, что каждый token в `meta.json.tokens` получает `tags` из `token.name` по разделителю `"."`.
- [x] 3.4 Добавить или обновить test cleanup, проверяющий удаление stale generated files из старого layout.

## 4. Verification

- [x] 4.1 Запустить `cd dsbuilder-frontend/cli && ./gradlew test`.
- [x] 4.2 Запустить `cd dsbuilder-frontend/cli && ./gradlew spotlessCheck`.
- [x] 4.3 Запустить `cd dsbuilder-frontend/cli && ./gradlew detekt`.
- [x] 4.4 Если `spotlessCheck` падает только из-за форматирования измененных файлов, запустить `cd dsbuilder-frontend/cli && ./gradlew spotlessApply` и повторить проверки.
