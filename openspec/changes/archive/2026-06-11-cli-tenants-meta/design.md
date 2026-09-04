## Context

`dsbuilder theme fetch` уже загружает tenants, tokens и token values через project-scoped backend API и строит локальный `.sdds` layout в `dsbuilder-frontend/cli`. Сейчас `ThemeWritePlanBuilder` создает `meta.json` как JSON array всех tokens, а `LocalThemeFileWriter` пишет tenant files напрямую в `.sdds/{tenantDirectory}` и сохраняет такой же путь в `.sdds/config.json`.

Новый формат нужен только для локальных артефактов CLI. Backend endpoints, request/response DTO и project config discovery остаются прежними. Изменение breaking для уже сгенерированных локальных `.sdds` directories.

## Goals / Non-Goals

**Goals:**

- Записывать tenant files в `.sdds/tenants/{tenantDirectory}`.
- Сохранять в `.sdds/config.json` tenant `directoryPath` с новым префиксом `.sdds/tenants/`.
- Генерировать `meta.json` как JSON object с `name`, `version = "latest"` и `tokens`.
- Добавлять каждому token в `meta.json.tokens` derived поле `tags`, полученное из `token.name.split(".")`.
- Обновить тесты CLI на новый локальный формат и cleanup старых generated files.

**Non-Goals:**

- Не менять backend API, persistence и authorization.
- Не добавлять миграционную CLI-команду для старого `.sdds/{tenantDirectory}` layout.
- Не менять формат platform/type files, кроме их нового расположения внутри `.sdds/tenants/{tenantDirectory}`.
- Не менять tenant alias commands, кроме совместимости с актуальным `directoryPath`.

## Decisions

### Новый meta object строится в domain write plan

`ThemeWritePlanBuilder` должен формировать сериализуемую domain-модель tenant meta, например `ThemeTenantMeta(name, version, tokens)`, и token projection с `tags`. Это сохраняет правило, что application/data слой получает уже валидированный write plan, а `LocalThemeFileWriter` отвечает только за filesystem и `.sdds/config.json`.

Альтернатива: собрать новый JSON прямо в `LocalThemeFileWriter`. Это проще по месту записи, но смешивает filesystem adapter с domain contract локальных theme artifacts.

### Tenant directory prefix применяется в data writer

`TenantDirectoryNormalizer` продолжает отвечать только за стабильное имя директории tenant, без знания о `.sdds`. Префикс `tenants/` применяется в `LocalThemeFileWriter` при записи файлов и при сохранении `directoryPath = ".sdds/tenants/{directoryName}"`.

Альтернатива: вернуть из normalizer полный относительный путь. Это ухудшит переиспользование normalizer и свяжет domain-логику с текущим layout `.sdds`.

### Cleanup должен учитывать старые и новые пути

Перед записью `theme fetch` должен удалять известные generated files по tenant paths из старого config и из текущего write plan. Для прежних config entries с `.sdds/{tenantDirectory}` cleanup должен продолжить удалять старые `meta.json` и platform/type files, чтобы после перехода не оставались stale generated files.

Альтернатива: чистить только новый `.sdds/tenants/{tenantDirectory}` layout. Это оставит старые generated files рядом с новым layout и усложнит локальную диагностику.

## Risks / Trade-offs

- [Risk] Старые consumers могут ожидать `meta.json` как JSON array. → Mitigation: отметить изменение как breaking в proposal и обновить CLI/spec tests на object contract.
- [Risk] Старые `.sdds/{tenantDirectory}` directories останутся пустыми или частично заполненными после cleanup. → Mitigation: удалять generated files из старых known paths, но не удалять директории целиком, чтобы не затронуть пользовательские файлы.
- [Risk] `token.name` может содержать пустые сегменты при повторяющихся точках. → Mitigation: `tags` должен быть прямым результатом разделения по точке без дополнительной нормализации, чтобы contract был предсказуемым и проверяемым.

## Migration Plan

1. Обновить domain-модели и `ThemeWritePlanBuilder` для нового `meta.json`.
2. Обновить `LocalThemeFileWriter` для `.sdds/tenants/{tenantDirectory}`, `directoryPath` и cleanup старых/новых generated paths.
3. Обновить unit/integration tests CLI на новый layout и meta contract.
4. Проверить `dsbuilder-frontend/cli` через `./gradlew test`, `./gradlew spotlessCheck`, `./gradlew detekt` и при необходимости `./gradlew build`.

Rollback: вернуть генерацию `meta.json` array и tenant prefix `.sdds/{tenantDirectory}` в CLI writer/build plan. Backend и persisted data при этом не затрагиваются.

## Open Questions

- Нет открытых вопросов для proposal-уровня; implementation может уточнить имена internal data classes по текущему стилю CLI.
