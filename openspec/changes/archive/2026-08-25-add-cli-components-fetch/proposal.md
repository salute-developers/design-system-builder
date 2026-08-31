## Why

`dsbuilder components push` перенёс 500 конфигураций компонентов из `theme-converter` в DS Builder,
но контур разомкнут: обратной дороги нет. Дизайнер правит компонент в web-клиенте, и результат
остаётся в базе — забрать его в репозиторий, где живёт Gradle-плагин `plugin_theme_builder`,
нечем. Ради этого DS Builder и строится: модель должна быть источником, а не копией.

`components fetch` замыкает контур. Но выгружать сегодня нечего: измерение показало, что база
теряет часть конфигурации при загрузке. Часть потерь — отсутствующие колонки, часть — уровень,
на котором хранится объявление осей вариаций. Пока это не исправлено, fetch вернул бы конфигурации,
которые собираются в другую тему, чем исходные.

## What Changes

- Новая команда `dsbuilder components fetch` выгружает конфигурации компонентов дизайн-системы
  в локальную директорию `.sdds/components` и собирает `meta.json` в формате `theme-converter`.
- Новый endpoint `POST /ds/component-config/export` в `db-service` — зеркало `/import`:
  весь пакет одним запросом, адресация по `designSystemId` в теле.
- Существующий `GET /ds/component-config` приводится к той же семантике типа: сегодня он отдаёт
  слот вместо фактического типа значения и всегда кладёт значение в `value`, то есть градиент
  уходит потребителю сплошным цветом. Заодно снимается фантомная ось у appearance, её не
  использующего. Ручку в репозитории не вызывает никто: `js/apps/client` читает legacy-маршрут
  `GET /ds/legacy/design-systems/{name}/component-configs`.
- **BREAKING** для схемы `db-service`: объявление осей вариаций поднимается на уровень appearance.
  Появляются `appearance_variations` и `appearance_variation_values`; `styles.is_default`
  с его партиальным индексом снимается.
- Три таблицы значений (`variation_property_values`, `invariant_property_values`,
  `style_combinations`) получают колонки `alpha` и `adjustment`. Сегодня оба поля отбрасываются
  импортом: `adjustment` встречается в 190 конфигурациях из 670.
- Семантика `properties.type` фиксируется: это тип **слота API** компонента, приходящий из кода,
  где `color` означает семейство paint. `gradient` — дискриминатор конкретного значения, а не слота.
  Отсюда три правки: `sameTypeFamily` признаёт `color` и `gradient` одной семьёй; тип выводится
  отдельно для каждой строки значения; импорт не переписывает `properties.type` ни при какой
  дизайн-системе, appearance, оси или состоянии.
- **BREAKING** для схемы `db-service`: `propertyTypeEnum` сужается до словаря типов API компонента —
  11 значений, ровно `ApiType` из `plasma-android`. `gradient` и `blur` снимаются: замер по 40 файлам
  api-meta не даёт ни одного из них, а `blur` не встречается и в 670 конфигурациях. `validate()`
  получает собственный словарь типов значения — слоты плюс `gradient`. Следствие: `POST /properties`
  и `PATCH /properties/:id` перестают принимать `gradient`, и требование «paint-слот хранится
  как `color`» становится структурным.
- `style_combinations` получает `token_id`: единственная из трёх таблиц значений без ссылки
  на токен. Без неё тип кросс-осевого значения невыводим, а битая ссылка в сочетании не попадает
  даже в `unresolvedTokens`.
- Codec перестаёт зависеть от совпадения `id` и `name` оси: `encode` пишет в native имя оси,
  сопоставление ведёт по идентификатору. Без этого выгруженный конфиг получил бы uuid вместо `size`.
- Codec начинает переносить объявленные значения оси, которым не сопоставлено ни одного
  переопределения, и выводить `bindings[].type`. Меняются оба направления: `decode` кладёт такие
  значения в common, `encode` возвращает их в `bindings[].values`, не порождая вариацию.
- `components.name` объявляется принадлежащим коду компонента: единственный писатель —
  `backend-kt/scripts/import-uikit-api-meta.sh`. Два имени в prod-сиде приводятся к написанию `uikit-api-meta.json`.

## Capabilities

### New Capabilities

- `component-appearance-model`: модель оформления компонента в `db-service` — объявление осей
  вариаций на уровне appearance, полнота значения свойства, вывод типа значения из токена,
  происхождение имени компонента.

### Modified Capabilities

- `cli-components`: команда `components fetch`, сборка `meta.json`, политика записи в рабочую копию.
- `component-config-codec`: `encode` становится независимым от диалекта common-формата.
- `frontend-cli`: дерево команд пополняется `components fetch`.

## Impact

**CLI (`frontend-kt/cli`)**

- `frontend-kt/cli` — feature `components` пополняется по слоям: модель выгруженного пакета
  и построитель плана записи в `domain`, порты чтения директории и записи в `application`,
  их реализации поверх `CliFileSystem` в `data`, команда `fetch` в `presentation`.
- **BREAKING** для feature `components`: port `ComponentConfigRemoteSource` перестаёт быть
  `fun interface` — к `import` добавляется `export`.
- `frontend-kt/cli/.../feature/components/domain/codec/ConfigCodec.kt` — `NativeAccumulator`
  переходит с `variation.id` на `variation.name`.
- `backend-kt/scripts/import-uikit-api-meta.sh` — без изменений, но его роль единственного писателя
  `components.name` фиксируется спекой.

**Сервис `db-service` (`js/services/db-service`)**

- `js/services/db-service/src/db/schema.ts` — `appearance_variations`, `appearance_variation_values`, колонки `alpha`
  и `adjustment` на трёх таблицах значений, `token_id` на `style_combinations`, снятие `styles.is_default`.
- `js/services/db-service/drizzle/0005_*.sql` — новая миграция, после переписанной `0004` из `refactor-component-state-sets`.
- `js/services/db-service/src/routes/api/component-config-export.ts` — новый router.
- `js/services/db-service/src/db/import/componentImport.ts` — запись `alpha`/`adjustment`, объявления осей, дефолта
  на уровне appearance; `sameTypeFamily` признаёт `color`/`gradient` семьёй; `resolveToken` вызывается
  и для кросс-осевых значений; токен переопределения состояния резолвится по типу самого состояния.
- `js/services/db-service/src/db/seeds/prod/components/{checkbox,radiobox}.ts` — `Checkbox` -> `CheckBox`,
  `Radiobox` -> `RadioBox`.
- `js/docs/db-schema.dbml`, `js/services/db-service/src/openapi/spec.ts`, `js/apps/admin/src/api/*` — через `/sync-all`.
- `js/services/db-service/package.json` — тестовый runner и скрипт `test`. Сегодня в сервисе нет
  ни одного теста и ни одного runner'а; тесты импорта и export-ручки требуют поднять харнесс
  этим же change.

**Безопасность**

- Первая читающая операция CLI над компонентной моделью. Используется существующий scope
  `components:read`: он уже перечислен в каталоге `backend-kt/projects-service/app/src/main/resources/application.yaml`,
  правок `projects-service` не требуется.
- `GET /ds/design-systems/{id}/appearances` и `/components` не проверяют project scope,
  в отличие от `/:id`. Export их не использует и брешь не расширяет; починка вынесена за объём.

**Предусловия**

- `refactor-component-state-sets` должен быть завершён: он переписывает `0004`, и схему до этого
  трогать нельзя.
- Его предусловие «дубль компонентов по регистру устранён» становится и предусловием этого change,
  по новой причине: от написания `components.name` зависит вывод `componentName` в `meta.json`.
- `chore/unify-repositories` должна быть влита в `dev`: change написан от объединённого дерева,
  а `dev` пока несёт старый JS-репозиторий без `backend-kt/`, `frontend-kt/` и `openspec/`.

**Не входит в объём**

- Частичная выгрузка одного компонента или стиля. Первая версия выгружает пакет целиком.
- Расширение глобального слоя свойствами, которых нет в `uikit-api-meta.json`. 381 значение
  (1.4%) остаётся невыгружаемым, см. `design.md`.
- Починка project scope на подресурсах `/ds/design-systems/{id}`.
- Запрет на правку `components.name` через `POST /components` и `PATCH /components/:id`. Требование
  «имя принадлежит коду компонента» остаётся конвенцией; страховкой служит проверка обратимости
  имени на границе export, которая отклоняет несходящееся имя вместо того, чтобы выгрузить неверное.
