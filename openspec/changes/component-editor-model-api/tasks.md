## 1. Схема и домен (backend-kt/ds-service)

- [ ] 1.1 Сверить порядок миграций с change `select-compose-preview-plugin-by-meta-version` и добавить Flyway `V8__appearance_editor_model.sql`: `appearances.edit_revision integer not null default 0`, `appearance_variations.display_name text`, `appearance_variation_values.display_name text`; не менять `schema-fingerprint.json` без необходимости и отразить колонки в Exposed-таблицах `ComponentTables.kt`
- [ ] 1.2 Домен: `AppearanceEditorModel`, `AxisModel`, `AxisValueModel`, `PropertyValueModel`, `AppearanceEdit`, `AppearanceEditOutcome`, `StyleReferenceInput`; функция действующего имени оси и значения
- [ ] 1.3 Application: порт `AppearanceEditorRepository` и use case на чтение модели и на каждую операцию (оси, значения осей, значения свойств, порядок состояний, ссылки); проверка прав через `DsAccessPolicy`, транзакция через `TransactionRunner`

## 2. Данные (backend-kt/ds-service)

- [ ] 2.1 Реализация `AppearanceEditorRepository` в `data`: блокировка оформления, сверка и увеличение `edit_revision`, откат при отказе
- [ ] 2.2 Операции над осями и значениями осей: добавление с техническими `variations.name` и `styles.name`, переименование через `display_name`, перестановка, удаление с каскадом зависимых значений, роли и значение по умолчанию
- [ ] 2.3 Запись значений свойств для области (база, стиль, сочетание) с набором состояний через `StateRepository.resolve`, порядок состояний, проверка совместимости типа значения и слота
- [ ] 2.4 Запись ссылок на стиль вложенного компонента: проверка цели, стилей, цикла, глубины 5; запись `component_style_references`, `component_style_reference_styles`, `component_deps`; общая функция записи, которую использует и импорт
- [ ] 2.5 Пересборка `reference` и значения ссылок при переименовании значения и оси; удаление и `reference_in_use` при удалении
- [ ] 2.6 `ComponentConfigBuilder`, экспорт и превью используют действующие имена; импорт сопоставляет оси по действующему имени, сохраняет `display_name` и увеличивает `edit_revision`; импорт записывает ссылки значений с состояниями
- [ ] 2.7 Инвентаризировать читателей `variations.name` и `styles.name` (в том числе `legacy/.../component-configs` в `js/services/db-service`) и перевести на действующие имена

## 3. Презентация и контракты (backend-kt/ds-service)

- [ ] 3.1 DTO запросов и ответов операций и модели редактора; маршруты `GET /api/ds/appearances/{id}/editor-model` и операции под `/api/ds/appearances/{id}/…`; отображение исходов в `200`, `404`, `403`, `409 APPEARANCE_EDIT_CONFLICT`, `422` с кодами из спецификаций
- [ ] 3.2 Зарегистрировать use case в `di`; сверить scope операций с каталогом `projects-service`
- [ ] 3.3 Обновить `openapi/documentation.yaml`, манифест маршрутов и аудит потребителей в `contracts`

## 4. Тесты

- [ ] 4.1 Тесты use case и маппинга исходов: ревизия, права, отказы с кодами
- [ ] 4.2 Тесты репозитория на PostgreSQL: оси (добавление, переименование без влияния на другие оформления, удаление с каскадом), значения свойств (база, стиль, сочетание, состояния, порядок, ошибки области и типа), состояния (`unknown_state`)
- [ ] 4.3 Тесты ссылок на вложенные стили: успех, у значения с состоянием, у сочетания, цель не найдена, чужие стили, цикл, глубина 5, пересборка при переименовании, удаление
- [ ] 4.4 Тесты конфигурации: экспорт и превью с действующими именами; импорт сохраняет `display_name` и ссылки значений с состояниями
- [ ] 4.5 Тесты маршрутов Ktor: `409` и тело, `403`, `404`, `422`, контрактная проверка маршрутов

## 5. Проверка

- [ ] 5.1 `cd backend-kt && ./gradlew build` (detekt, spotless, тесты); при падении только spotless выполнить `spotlessApply` и повторить
- [ ] 5.2 `cd frontend-kt && ./gradlew build` для проверки, что импорт и экспорт CLI работают с действующими именами
- [ ] 5.3 `cd js && npm run build` после правок читателей `db-service`, если они затронуты
- [ ] 5.4 [внешняя проверка] Применить `V8` к копии базы с данными из `sdds_serv` и `sdds_sbcom` и сравнить экспорт конфигураций до и после миграции: различий нет (число отличающихся конфигураций равно 0), результат сохранить в state
