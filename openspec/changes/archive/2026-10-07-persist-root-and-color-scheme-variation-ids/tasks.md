## 1. Схема и миграция

- [x] 1.1 Проверить версию PostgreSQL во всех окружениях `ds-service`: для `ON DELETE SET NULL (column)` нужна 15+; при меньшей версии записать запасной путь (снятие роли в репозитории) в design.md
- [x] 1.2 Написать `V3__persist_appearance_axis_roles.sql`: колонки `appearances.root_variation_id` и `color_scheme_variation_id`; опорой для составных ссылок служит уже существующий уникальный индекс `av_appearance_variation_unique (appearance_id, variation_id)`, новый `UNIQUE` не нужен
- [x] 1.3 В той же миграции перенести `is_color_scheme` в `color_scheme_variation_id` (при нескольких флагах взять строку с наименьшим `position`)
- [x] 1.4 В той же миграции проставить `root_variation_id` правилом фолбэка по уже перенесённой роли схемы
- [x] 1.5 Добавить составные внешние ключи на `appearance_variations (appearance_id, variation_id)` с `ON DELETE SET NULL (…)` после заполнения
- [x] 1.6 `schema-fingerprint.json` не пересчитывать: он описывает базовую схему до Flyway для adoption и остаётся прежним. Поправить `FlywayPostgresIntegrationTest`: отпечаток базовой схемы брать после `V1`, а полностью мигрированная схема от него отличается
- [x] 1.7 Прогнать миграцию на локальной БД контура и сверить: `color_scheme_variation_id` совпадает с флагом, `root_variation_id` пуст только у appearance без осей. Те же проверки на тестовой БД уже выполняет `AppearanceAxisRolesMigrationPostgresIntegrationTest`; на данных контура остаётся сделать при проверке в группе 7

## 2. Домен и репозиторий

- [x] 2.1 Описать роли в `ComponentTables.kt` колонками `root_variation_id` и `color_scheme_variation_id` в `ComponentAppearancesTable`
- [x] 2.2 Вынести правило фолбэка корня в доменную функцию (имя `size`, иначе первая по `position` кроме оси схемы, иначе `null`) и покрыть юнит-тестами
- [x] 2.3 Расширить `AppearanceRepository` и `ExposedAppearanceRepository`: чтение и запись обеих ролей, перенос роли на другую ось, 409 при пересечении ролей
- [x] 2.4 Писать `is_color_scheme` синхронно с `color_scheme_variation_id` в одной транзакции; читать роль только из новой колонки
- [x] 2.5 Пересчитывать корень при удалении оси с ролью корня

## 3. Заливка и выгрузка component-config

- [x] 3.1 `ComponentConfigImporter`: сохранять `rootVariationId` и `colorSchemeVariationId` на appearance; применять фолбэк, когда корень не указан; отклонять `rootVariationId`, не совпавший ни с одной осью
- [x] 3.2 `ComponentConfigBuilder`: отдавать сохранённые роли вместо поиска по имени `size`, в режимах `exported` (имя оси) и обычном (UUID)
- [x] 3.3 Проверить остальные места, читающие `isColorScheme`: `underivable` в импортёре, ответы `AppearanceVariationResponse` и `AppearanceVariationAxisResponse`

## 4. Ручки appearance-variations

- [x] 4.1 Добавить `isRoot` в `CreateAppearanceVariationRequest`, `UpdateAppearanceVariationRequest`, `AppearanceVariationResponse`, `AppearanceVariationAxisResponse`
- [x] 4.2 `AppearanceVariationRoutes`: назначение, снятие и перенос ролей, ответ 409 при пересечении ролей, валидация принадлежности оси appearance
- [x] 4.3 Проверить ручки `appearance-variation-values` и удаление оси: роль не остаётся висящей, корень пересчитывается
- [ ] 4.4 Не выполнена намеренно: OpenAPI `ds-service` собирается из `js/apps/admin/src/api/openapi.json` (контракт `db-service`, порождается `js/services/db-service/src/openapi/spec.ts`), а `js` вне скоупа. Поле `isRoot` присутствует в ответах `ds-service`, но не описано в схеме `AppearanceVariation`; правка сгенерированного файла вручную затёрлась бы при регенерации. Нужна, только если `isRoot` начнут читать через типизированный API или будет восстановлен дифференциальный набор (см. 8.4 (б))

## 5. Тесты

- [x] 5.1 Репозиторий: роли сохраняются, переносятся, обнуляются при удалении оси, чужая ось отклоняется
- [x] 5.2 Заливка: корень `shape` переживает круг «заливка → выгрузка» при наличии оси `size`; фолбэк `size`, фолбэк первой оси, ось схемы не становится корнем; неизвестный `rootVariationId` отклоняется
- [x] 5.3 Ручки осей: `isRoot` и `isColorScheme` в ответах согласованы со ссылками на appearance, 409 на пересечение ролей
- [x] 5.4 Миграция: тест на данных с флагом схемы, с несколькими флагами, без осей, без оси `size`
- [x] 5.5 Равенство `is_color_scheme` и `color_scheme_variation_id` после каждой операции

## 6. Клиент frontend-kt

- [x] 6.1 `ConfigCodec.decode`: выбирать `rootVariationId` как ось `size`, иначе первую ось, не являющуюся осью цветовой схемы; единственная ось цветовой схемы даёт отсутствие корня
- [x] 6.2 Тесты `ConfigCodecTest`: `size` не первой, нет `size`, первая ось — цветовая схема, единственная ось — цветовая схема; существующие тесты на корпусе остаются зелёными
- [x] 6.3 `cd frontend-kt && ./gradlew :feature-components:jvmTest :feature-components:spotlessApply :feature-components:detekt`
- [x] 6.4 `cd frontend-kt && ./gradlew build` целиком (все цели, включая macOS)

## 7. Проверка на локальном контуре: components push и fetch

- [x] 7.1 До изменений снять эталон «как было» на локальном контуре (`ds-service` на `:8085`, контейнеры уже подняты): `dsbuilder components push --from ~/data/code/TestCli/test/.sdds/components` (144 native-конфига, платформа `android-view`, `.sdds/config.json` рядом) в план и затем с `--apply`, после чего `dsbuilder components fetch` в чистый каталог; результат сохранить. Проект и design system из `config.json` взяты из чужой БД, поэтому на контуре сначала создать тестовую design system и подставить её `designSystemId` в копию `config.json`, не в исходный файл
- [x] 7.2 Применить `V3` и новый `ds-service` на тех же данных (контур пересобрать с миграцией, без пересоздания БД), убедиться, что Flyway adoption проходит и сервис стартует
- [x] 7.3 Повторить `components fetch` и сравнить с эталоном из 7.1: файлы конфигов совпадают побайтно, кроме `rootVariationId` у appearance, где корень раньше терялся и выгрузка отдавала `size` или ничего; каждое такое расхождение объяснить
- [x] 7.4 Повторить `components push` теми же файлами и сразу `components fetch`: круг «push → fetch» воспроизводит исходные конфиги, повторный push без правок не создаёт diff
- [x] 7.5 Проверить push конфига, где корнем объявлена ось не `size`, и конфига без `rootVariationId`: корень сохраняется или выводится по правилу фолбэка, `fetch` отдаёт его же
- [x] 7.6 Проверить конфиг с осью цветовой схемы под именем не `view` (например `state`): значения возвращаются блоком `view`, как раньше
- [x] 7.7 Повторить 6.1 для второй платформы: native-конфиги `~/data/code/plasma-android/tokens/sdds.serv.compose/.sdds/components` (платформа `compose`); убедиться, что платформенные параметры и состав компонентов не изменились
- [x] 7.8 Проверить откат: остановить `ds-service`, поднять прежнюю версию или `db-service` и выполнить `components fetch`; роль цветовой схемы отдаётся, `is_color_scheme` синхронен
- [x] 7.9 Записать результат прогона (команды, проект, число компонентов, найденные расхождения) в `verification.md`; при расхождениях без объяснения задачу не закрывать

## 8. Проверка и документация

- [x] 8.1 `cd backend-kt && ./gradlew build` (успешно); `cd backend-kt/ds-service && ./gradlew test spotlessCheck` (81 тест, успешно); detekt в `:core` и `:feature-design-systems` падает и без этого изменения, в изменённых файлах замечаний нет;, включая detekt, spotlessCheck и тесты; при падении spotless только на изменённых файлах выполнить `spotlessApply` и повторить
- [x] 8.2 Прогнать выгрузку на реальном корпусе и сравнить `rootVariationId` и `colorSchemeVariationId` с исходными конфигами
- [x] 8.3 Обновить README `ds-service`, если описание схемы или фингерпринта изменилось
- [ ] 8.4 Последующие изменения: (а) после вывода `db-service` из эксплуатации удалить из БД колонку `appearance_variations.is_color_scheme` и код её синхронизации в `ds-service` (из кода `db-service` ничего не удаляется: он сам выводится из эксплуатации); (б) решить, остаётся ли контракт `ds-service` производным от OpenAPI `db-service`, и тогда же описать `isRoot` (см. 4.4)
