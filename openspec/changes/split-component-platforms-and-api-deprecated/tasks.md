## 1. Подготовка и разведка

- [ ] 1.1 Запустить `audit.sql` на локальной, stage- и prod-базах, сохранить результат в `audit-results.md` рядом с change; **подтвердить предпосылку «в проде только веб»** (нет appearances без платформы, нет привязок к компонентам без веб-признака); при нарушении зафиксировать решение до миграции
- [ ] 1.2 Снять `pg_dump` целевых баз перед проверкой миграции; завести копию рабочей базы для прогона миграции
- [ ] 1.3 Инвентаризация потребителей: найти все места, выбирающие компонент по одному имени (`components.name`, `eq(components.name`), в `db-service`, generator, client, admin, `frontend-kt`; список записать в `design.md` (раздел «Потребители»)

## 2. Схема и миграция

- [ ] 2.1 `db/schema.ts`: добавить `xml` в `componentPlatformEnum`, `components.platform` (`NOT NULL`), уникальность `components_name_platform_unique(name, platform)` вместо `components_name_unique`, убрать `properties.platform` и `appearances.platform`, уникальность appearance `(design_system_id, component_id, name)`
- [ ] 2.2 `property_platform_params`: колонки `deprecated` (boolean, `NOT NULL`, по умолчанию `false`) и `deprecated_message` (text), `CHECK (deprecated OR deprecated_message IS NULL)`; перевести `platform` алиаса на `component_platform`
- [ ] 2.3 Миграция `0007` (`drizzle-kit generate` плюс ручные блоки данных): проверки-ограничители (`RAISE EXCEPTION`: appearances без платформы; значения и appearances у компонентов без веб-признака; привязки дизайн-систем к ним), удаление производного нативного слоя (нативные алиасы, нативные свойства, состояния и компоненты без веб-признака), присвоение `web` оставшимся компонентам, смена уникальности, удаление `properties.platform` и `appearances.platform`, триггер равенства платформы алиаса и компонента, финальные проверки с откатом; триггеры из `0004_component_import.sql` сохранить
- [ ] 2.4 Тесты миграции на фикстурах (`vitest`, реальный Postgres): веб-компонент с нативными алиасами (алиасы удалены, свойство цело), нативный компонент без веб-признака (удалён), свойство без алиасов, appearance без платформы и привязка к нативному компоненту (миграция останавливается с ошибкой и не меняет данные), сохранение идентификаторов и числа строк контента, повторный импорт мет после миграции создаёт нативные компоненты
- [ ] 2.5 Применить миграцию на копии рабочей базы (предварительно убрав тестовую дизайн-систему `plasma_sd_service` с нативными привязками) и сверить контрольные числа до и после: appearances 66, значения 5764 + 78, variations 168, styles 581, привязки `base` 63; поправки к веб-алиасам 615 (поправки к нативным алиасам, 90 штук, удалены осознанно); все компоненты `web`; нет нативных алиасов; legacy-выдача отдаёт пустые `xml`, `compose`, `ios` у Button, Checkbox, IconButton, Link, Radiobox
- [ ] 2.6 Обновить `docs/db-schema.dbml` и описание таблиц в `nl-query/schema-context.ts`

## 3. db-service: импорт API-меты

- [ ] 3.1 `db/import/apiMetaManifest.ts`: принять элементы `platformNames` строкой или объектом `{name, deprecated?: {message}}`, сохранить `platformName`; `platformNamesOf` отдаёт имя и признак «сведений нет»
- [ ] 3.2 `db/import/apiMetaImport.ts`: идентичность компонента `(name, platform запроса)`, создание компонента платформы, поиск свойств внутри него; убрать работу с `properties.platform`
- [ ] 3.3 Обновление `deprecated` по таблице из `design.md` (поставить, сменить сообщение, снять, строка не трогает) и счётчики `deprecatedMarked`, `deprecatedMessageChanged`, `deprecatedCleared`; для dry run те же числа
- [ ] 3.4 Список `absent`: компоненты платформы и свойства импортируемых компонентов, которых нет в мете; справочный
- [ ] 3.5 Ручка `routes/misc/component-config-import-api-meta.ts` и журнал: новые счётчики в `data` записи `components:import-api-meta`; схема ответа в `openapi/spec.ts`
- [ ] 3.6 Тесты `apiMetaImport.test.ts` и `component-config-import-api-meta.test.ts`: идентичность по платформе, нет конфликта типов между платформами, `deprecated` во всех строках таблицы (включая пустое сообщение, строку, независимость алиасов View, отсутствие алиаса в мете), повтор даёт нули, dry run совпадает с apply, `absent` для свойства и компонента, компонент другой платформы не попадает в `absent`

## 4. db-service: остальные маршруты и данные

- [ ] 4.1 `routes/api/component-config.ts`, `db/import/componentImport.ts`, `db/export/componentExport.ts`: платформа обязательна в запросе push, export и чтения компонента (`400` без неё), поиск по `(name, platform)`, убрать фильтры по `appearances.platform` (`isNull`, `'web'`)
- [ ] 4.2 `routes/api/design-systems.ts`, `routes/api/legacy.ts`, `queries/catalog.ts` и остальные места из инвентаризации 1.3: выбор компонента с платформой; привязки дизайн-системы к компонентам платформы
- [ ] 4.3 Сиды `db/seeds/**` и `seed-generate-prod.ts`: компоненты создаются с платформой `web`, конфликт по `(name, platform)`; обновить фикстуры тестов
- [ ] 4.4 `validation/schema.ts`, `openapi/spec.ts`, `/sync-all`; убедиться, что `apps/admin/src/api/types.gen.ts` регенерирован
- [ ] 4.5 Тесты: запрос без платформы получает `400`, push и fetch двух платформ одного имени не затирают друг друга, appearance веба и нативной платформы разных компонентов сосуществуют; весь набор `db-service` проходит

## 5. Потребители вне db-service

- [ ] 5.1 Generator, client и admin: передавать платформу при выборе компонента (по результатам инвентаризации 1.3), поправить типы и запросы
- [ ] 5.2 Сборки: `cd js && npm run build` для затронутых приложений и сервисов

## 6. frontend-kt и CLI

- [ ] 6.1 `feature-components`: модель имени платформы с `deprecated` в манифесте и сериализации (`platformNames` объектами), модель отчёта с `deprecatedMarked`, `deprecatedMessageChanged`, `deprecatedCleared` и `absent`, разбор ответа
- [ ] 6.2 Нормализатор Compose: чтение `deprecated`, правило «хотя бы одна запись с `id`», сообщение первой помеченной; нормализатор View: статус по `attrName`, слияние записей компонента; корпуса тестов с помеченными свойствами, пустым сообщением и без поля
- [ ] 6.3 Печать отчёта `import-api`: строки счётчиков `deprecated*` (если не нули) и раздел `Absent from meta`; `--strict` не реагирует на них
- [ ] 6.4 `components push` и `fetch`: платформа из `.sdds/config.json` (одна платформа) или `--platform` (несколько, переопределение), маппинг `compose/xml/ios/web`, передача в теле запроса, ошибка использования при неоднозначности; тесты `ComponentsCliCommandTest` и сквозные
- [ ] 6.5 `cli/USAGE.md`: раздел импорта (поведение `deprecated`, автоматическое снятие, риск меты старой библиотеки, `Absent from meta`) и разделы push и fetch (платформа и `--platform`)

## 7. Проверка

- [ ] 7.1 `cd js/services/db-service && npm test`, `cd frontend-kt && ./gradlew build --continue`, `cd js && npm run build` по затронутым частям
- [ ] 7.2 Сквозная проверка на локальном контуре с копией базы после миграции: импорт мет Compose, View и iOS (`--apply`) создаёт нативные компоненты с независимыми типами; `typeMismatches` только внутри платформы; пометки `deprecated` создаются, обновляются и снимаются; `absent` корректен; push и fetch двух платформ одной дизайн-системы
- [ ] 7.3 Независимая сверка своим скриптом: веб-контент до и после миграции совпадает построчно по идентификаторам; нативные компоненты полностью соответствуют метам после импорта
- [ ] 7.4 Описать порядок выката в `design.md`: `audit.sql`, дамп, выкат backend и CLI вместе, повторный импорт мет всех платформ, контрольные запросы
