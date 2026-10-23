## 1. Схема и миграция

- [x] 1.1 Написать `V14__per_design_system_variation_axes.sql`: столбец `variations.design_system_id`, размножение осей, перенос ссылок и ревизий, `NOT NULL`, новые уникальные индексы и составные ключи
- [x] 1.1a В той же миграции: `variation_revisions` (перенос текущих имён и описаний в ревизию исходной версии), триггеры неизменяемости, разрешённый индекс уникальности имени оси, обновление проверок целостности из `V8`
- [x] 1.2 Добавить `property_variations.design_system_id` и наследование от оси
- [x] 1.3 Обновить отпечаток схемы и проверки счётчиков, затронутые миграцией

## 2. Домен и приложение

- [x] 2.1 Добавить `designSystemId` в `ComponentVariationSummary` и `VariationCreate`; расширить `ListVariationsUseCase` и `ListComponentVariationsUseCase` необязательным `designSystemId`

## 3. Данные

- [x] 3.0 Ввести `StableVariationsTable`, `VariationRevisionsTable`, разрешённое представление `VariationsTable` и обработчик `variation` в `ComponentDraftChangeHandlers`; учесть ось в проверке зависимостей отката
- [x] 3.1 Обновить `VariationsTable`, `PropertyVariationsTable` и `ComponentOwnership` (`readableVariation`/`writableVariation` по владению дизайн-системой)
- [x] 3.2 Перевести `ComponentConfigImporter` (`upsertAxes`, `ambiguousName`, `linkProperty`, `referenceStyles`) на поиск по `(designSystemId, componentId, name)`
- [x] 3.3 Перевести остальные места записи оси на систему: `ExposedComponentModelRepository`, `AppearanceEditorAxisOperations.newVariation`, `AppearanceEditorConfigurationOperations`, `GeneratedDesignSystemComponentInitializer`, загрузку сидов `base`

## 4. Презентация и контракты

- [x] 4.1 Обновить маршруты и DTO вариаций (`designSystemId` в запросе и ответе)
- [x] 4.2 Обновить `documentation.yaml` и `contracts/route-manifest.json` (`contracts/http-fixtures.json` хранит только идентификаторы и не меняется)

## 4a. Клиенты

- [x] 4a.1 `js/apps/client`: читать вариации с `designSystemId` в `componentRepository.ts` и `journalComponentMetadata.ts` через `variationReadRequest`, покрыть его тестом в `editorHttp.test.ts`, добавить тип `variation` в журнал
- [x] 4a.2 `frontend-kt/feature-components`: `HttpComponentReadRemoteSource.variations` передаёт `designSystemId`, обновить `HttpComponentReadRemoteSourceTest`

## 5. Тесты

- [x] 5.1 Интеграционный тест миграции `V14` на данных с несколькими системами, ревизиями и неиспользуемой осью
- [x] 5.1a Тесты версионирования оси: переименование в черновике и чтение опубликованной версии, откат создания оси из журнала, отклонённый откат оси, на которую ссылается стиль (удаление оси по HTTP не открыто: маршрута `DELETE /ds/variations/{id}` нет)
- [x] 5.2 Тесты изоляции: одноимённые оси двух систем, переименование и добавление оси в одной системе не меняют другую, перекрёстная ссылка отклоняется
- [x] 5.3 Тесты маршрутов: фильтр `designSystemId`, `POST` без и с чужой системой, `PATCH` участником проекта
- [x] 5.4 Обновить существующие тесты импорта и редактора под новую модель

## 6. Проверка

- [x] 6.1 `cd backend-kt && ./gradlew build`, `cd frontend-kt && ./gradlew build`, `cd js && npm run build` (detekt, spotlessCheck, тесты)
- [x] 6.2 `tools/verify fast --change per-design-system-variation-axes`
- [x] 6.3 `tools/verify full --change per-design-system-variation-axes`
- [x] 6.4 [внешняя проверка] На `origin/dev` поднять контур `./setup-local.sh`, добавить вторую дизайн-систему B с теми же компонентами и сохранить `component-config/export` обеих систем (эталон до миграции). Пересобрать `ds-service` с `V14` без `--reset` и повторить экспорт: экспорты обеих систем совпадают с эталоном, в `variations` по одной оси на тройку (система, компонент, имя)
- [x] 6.5 [внешняя проверка] В системе B на мигрированной БД изменить состав и названия осей: переименовать ось и значение, добавить новую ось, удалить существующую, поменять `PATCH /ds/variations/{id}`. Экспорт системы A после этого побайтово совпадает с эталоном 6.4 (оси, стили, оформления не тронуты), экспорт системы B отражает все изменения, при отбрасывании черновика B возвращается к эталону
