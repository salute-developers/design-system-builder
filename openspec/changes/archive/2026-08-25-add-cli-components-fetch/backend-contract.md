# Схема и endpoint `component-config:export` в `db-service`

Документ описывает изменения схемы `db-service` и новый endpoint, без которых
`dsbuilder components fetch` не может вернуть конфигурацию, эквивалентную загруженной.
Обе стороны контура — CLI в `frontend-kt/cli` и сервис в `js/services/db-service` — лежат
в одном репозитории и реализуются этим же change; документ выделен из `design.md`
как подробность backend-части, а не как контракт, передаваемый наружу.

Все числа получены измерением по восьми директориям `theme-converter/components`
(670 файлов, 661 запись в `meta.json`, 27 878 значений свойств), метаинформация кода —
из фактических `uikit-compose-api-meta.json` репозитория `plasma-android`, токены —
из `theme-converter/themes/<ds>/latest.zip`.

## 1. Предусловие

Backend `components push` лежит в `js/services/db-service`: `drizzle/0004_component_import.sql`,
`src/db/import/` и `src/routes/api/component-config-import.ts`. Номера миграций и имена файлов
ниже даны от этого состояния. Оно достигнуто на линии `chore/unify-repositories`; в `dev`
объединения ещё нет, см. задачи 1.0 и 1.5 в `tasks.md`.

Изменения ложатся **после** `refactor-component-state-sets`. Тот change переписывает
`js/services/db-service/drizzle/0004_component_import.sql` и держит в её тексте 8 триггеров модели состояний.
Настоящий документ требует новой миграции `0005`, которая не трогает ни `0004`, ни триггеры.

## 2. Полнота значения свойства

Три таблицы значений — `variation_property_values`, `invariant_property_values`,
`style_combinations` — получают две колонки:

```sql
ALTER TABLE "variation_property_values"  ADD COLUMN "alpha" text;
ALTER TABLE "variation_property_values"  ADD COLUMN "adjustment" text;
ALTER TABLE "invariant_property_values"  ADD COLUMN "alpha" text;
ALTER TABLE "invariant_property_values"  ADD COLUMN "adjustment" text;
ALTER TABLE "style_combinations"         ADD COLUMN "alpha" text;
ALTER TABLE "style_combinations"         ADD COLUMN "adjustment" text;
```

`text`, а не `numeric`: значение хранится в той же форме, что и `value`, и сериализуется обратно
без нормализации. `adjustment` встречается у 671 значения в 190 конфигурациях, `alpha` — у 57
в 38. После рефакторинга состояний строка значения несёт один набор состояний, поэтому
`states[].alpha` (6 вхождений) и переопределение на уровне состояния ложатся в те же колонки
без отдельного механизма.

`componentImport.ts` начинает их писать, читая `PropertyValue.alpha` и `PropertyValue.adjustment`.

`style_combinations` получает ещё и ссылку на токен:

```sql
ALTER TABLE "style_combinations" ADD COLUMN "token_id" uuid
  REFERENCES "tokens"("id") ON DELETE set null;
```

Это единственная из трёх таблиц значений без такой ссылки: имя токена лежит в `value` текстом,
`resolveToken` для кросс-осевых значений не вызывается вовсе, и битая ссылка в сочетании
не попадает даже в `unresolvedTokens`. Переименование или удаление токена оставляет в сочетании
имя несуществующего. Колонка нужна и сама по себе, и потому, что без неё тип кросс-осевого
значения невыводим — см. раздел 5.

Колонка под тип значения **не заводится** — см. раздел 5.

## 3. Объявление осей вариаций

### 3.1 Почему на уровне appearance

Объявление оси — факт пары (компонент, стиль), а не компонента и не дизайн-системы:

- порядок осей у 18 компонентов из 70 не сводится к одной последовательности между стилями;
- состав осей различается между стилями у 31 компонента внутри одной ДС;
- `defaultValue` одной оси различается между стилями одного компонента в одной ДС в 21 случае.

Последнее означает, что `styles.is_default` выражает факт неверного уровня. Партиальный индекс
`styles_variation_id_ds_id_is_default_unique` допускает один дефолт на (ДС, ось), а `applyDefaults`
снимает и переставляет флаг на каждой конфигурации пакета — то есть текущий импорт затирает дефолт
предыдущего стиля. Флаг и индекс снимаются.

### 3.2 Таблицы

```sql
CREATE TABLE "appearance_variations" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "appearance_id"    uuid NOT NULL REFERENCES "appearances"("id") ON DELETE cascade,
  "variation_id"     uuid NOT NULL REFERENCES "variations"("id")  ON DELETE cascade,
  "position"         integer NOT NULL,
  "default_style_id" uuid REFERENCES "styles"("id") ON DELETE set null,
  "created_at"       timestamp DEFAULT now() NOT NULL,
  "updated_at"       timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "av_appearance_variation_unique" UNIQUE ("appearance_id","variation_id"),
  CONSTRAINT "av_appearance_position_unique"  UNIQUE ("appearance_id","position")
);

CREATE TABLE "appearance_variation_values" (
  "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "appearance_variation_id" uuid NOT NULL REFERENCES "appearance_variations"("id") ON DELETE cascade,
  "style_id"                uuid NOT NULL REFERENCES "styles"("id") ON DELETE cascade,
  "position"                integer NOT NULL,
  "created_at"              timestamp DEFAULT now() NOT NULL,
  "updated_at"              timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "avv_variation_style_unique"    UNIQUE ("appearance_variation_id","style_id"),
  CONSTRAINT "avv_variation_position_unique" UNIQUE ("appearance_variation_id","position")
);
```

`default_style_id` допускает `NULL`: в корпусе есть одна ось без `defaultValue`.
`ON DELETE set null` у него, а не `cascade`: снятый дефолт не должен уносить объявление оси.

`appearance_variation_values` хранит **объявленные** значения, а не использованные. 81 ось из 821
объявляет значения, которых нет ни в одной вариации, ещё 21 ось не использует ни одного своего
значения. Пример: `plasma_b2c/badge-clear` объявляет `shape: [default, pilled]`, а переопределения
несёт только `pilled` — форма для `default` задана внутри вариаций `size`. Без второй таблицы
ось выродилась бы в `[pilled]`, а `shape=default` исчез бы из API компонента.

### 3.3 Что импорт пишет в них

`componentImport.ts` при обработке конфигурации:

- заводит строку `appearance_variations` на каждую ось `config.variations`, в порядке их следования,
  `position` — индекс в этом порядке;
- заводит `appearance_variation_values` на каждое значение оси, включая значения, встречающиеся
  только в `targets`;
- ставит `default_style_id` по `config.defaults` этой конфигурации, не трогая другие appearance;
- удаляет объявления, которых больше нет в конфигурации, тем же порядком, что и
  `clearAppearanceValues`.

### 3.4 Миграция данных

`styles.is_default` уникален по (ДС, ось), а дефолт принадлежит паре (appearance, ось). Перенос
копирует единственный уцелевший флаг всем appearance компонента.

Для дизайн-системы, которую вёл клиент, это точно: два разных дефолта на ось индекс не допускал,
поэтому размножать нечего. Неверным перенос оказывается только там, где гоняли `components push` —
прежний `applyDefaults` оставлял в базе последнего записавшего. На `sdds_serv` спорят 7 осей из 133,
неверных дефолтов 11 из 260 (4.2%). Push не выпущен, поэтому на проде таких баз нет; локальные
и приёмочную достаточно перезалить. Миграция переносит то, что есть, и не притворяется, что
восстанавливает исходное; это записано в риски `design.md`.

## 4. Endpoint

```
POST /api/projects/{projectId}/ds/component-config/export
Authorization: ProjectKey <api-key>
Content-Type: application/json
```

Тело:

```json
{ "designSystemId": "0f2a…" }
```

Ответ:

```json
{
  "meta": { "name": "sdds_serv", "version": "0.6.0-rc" },
  "components": [
    {
      "componentName": "badge",
      "styleName": "badge-solid",
      "config": { "...common-формат..." }
    }
  ],
  "underivedTypes": ["avatar.background"]
}
```

- `meta.name` — `design_systems.name`.
- `meta.version` — `design_system_versions.version` последней опубликованной версии.
  Дизайн-система без версий отклоняется статусом `422`: поле обязательно в модели плагина.
- `components[]` — весь пакет. Порядок детерминированный: по `componentName`, затем `styleName`.
- `underivedTypes` — значения, для которых тип не выведен: ссылка на токен не разрешилась,
  и отдан фолбэк на `properties.type`. Для градиента с битой ссылкой это означает, что в ответ
  ушёл `color`, и предъявить это обязательно: молчаливая подмена вида заливки собирается
  в другую тему. 18 значений на корпусе. Поле информационное, выгрузку не отклоняет.

**Чего в ответе нет.** Свойства вне глобального слоя (42 пары на корпусе) здесь не перечисляются.
Их значения импорт не записывает и нигде не сохраняет, поэтому из базы их не восстановить: строк
с такими свойствами нет по построению, `property_id` защищён внешним ключом. Факт принадлежит
загрузке, а не выгрузке, и `push` уже возвращает его в `unknownProperties` своего отчёта. Заводить
хранение ради того, чтобы позже вернуть его эхом, — заведомо худший размен, чем прочитать отчёт
той операции, которая этот факт обнаружила.

Зеркальность `/import`: `POST`, адресация телом, весь пакет одним запросом, тот же путь
`/ds/component-config`. Существующий `GET /ds/component-config` сохраняет свой контракт, но
приводится к той же семантике типа значения — см. раздел 5. Потребителей в репозитории у него нет:
`js/apps/client` читает legacy-маршрут `GET /ds/legacy/design-systems/{name}/component-configs`.

**Scope.** Ручка требует `components:read` в заголовке `x-project-scopes` по той же схеме,
что `/import` требует `components:write`. Системный администратор и запросы без project-контекста
проверке не подлежат.

**Цена ответа.** Замер на `sdds_serv` в контуре приёмки `ds_verify` (143 конфигурации, глобальный
слой из настоящего api-meta, 3562 токена): тело **647 653 байта** (633 KiB), время ответа
**48–64 мс**, медиана 51 мс на пяти прогонах после прогрева. Весь пакет уходит одним запросом,
и это осознанно: `fetch` пишет состав директории целиком, а частичная выгрузка потребовала бы
согласовывать удаление файлов между страницами.

Сжатие на ответе **не включено**: с `accept-encoding: gzip` тело приходит тем же размером —
в `db-service` нет compression-middleware. JSON такого рода жмётся в разы, так что при выносе
ручки наружу это первое, что стоит включить; внутри контура 633 KiB за 51 мс того не требуют.

## 5. Диалект common-формата в ответе

Ответ обязан использовать **имена**, а не идентификаторы:

```json
{ "rootVariationId": "size", "colorSchemeVariationId": "view",
  "variations": [ { "id": "size", "name": "size", "values": [ … ] } ],
  "defaults":   [ { "id": "size", "value": "l" } ] }
```

Существующий `GET /ds/component-config` кладёт в эти поля uuid. Codec CLI собирает
`bindings[].name` из `variation.id`, поэтому uuid уехал бы в native-конфигурацию именем оси.
Codec правится независимо (см. спеку `component-config-codec`), но контракт ручки — имена:
common-формат описывает конфигурацию компонента, а не строки базы.

**Примитивы значений осей сохраняются.** `styles.name` — text, поэтому значение boolean-оси
лежит строкой. Тип оси выводится из набора её объявленных значений: все 87 boolean-осей корпуса
имеют ровно `{true, false}`, и ни одна enum-ось не содержит `true`/`false` — 0 пересечений.
Ось, объявленные значения которой суть `{"true","false"}`, отдаётся с примитивами `true`/`false`.

**Тип значения выводится, а не хранится — отдельно для каждой строки значения:**

```
  type = "gradient", если tokens.type по token_id = gradient
         иначе properties.type
```

`properties.type` — тип слота API компонента, приходящий из кода; `color` там означает семейство
paint, покрывающее и сплошную заливку, и градиент (KSP `plasma-android` относит к нему `Color`,
`Brush` и `InteractiveColor`). `gradient` — дискриминатор значения, а не слота, поэтому правило
применяется к каждой строке отдельно: инвариант, значение вариации, кросс-осевое сочетание,
переопределение состояния. Переопределение состояния имеет собственный `token_id` и выводит тип
по своему токену, а не по токену базового значения.

Корпус требует именно этого: семь пар «компонент + свойство» принимают оба типа
(`avatar.textColor`, `circular-progress-bar.indicatorColor`, `overlay.backgroundColor`,
`progress-bar.indicatorColor`, `rect-skeleton.gradient`, `slider.indicatorColor`,
`text-skeleton.gradient`), у пяти из них оба типа встречаются внутри одной ДС и переключаются
значением оси, а у `slider.thumbStrokeColor` — значением состояния.

Обратное тоже фиксируется контрактом: **импорт не пишет `properties.type`**. Ни дизайн-система,
ни appearance, ни значение оси, ни состояние не могут переписать слот API. Сегодня это так
фактически — `findProperties` только читает колонку, — но становится требованием.

В поле `type` ответа пишется выведенный тип значения, а не `properties.type` безусловно.

**Тип переопределения состояния отдаётся только при расхождении с базой.** `plugin_theme_builder`
читает `states[].type` и выбирает по нему группу токенов (`Theme.gradients` против `Theme.colors`),
оператор альфы (`asLayered` против `multiplyAlpha`) и представление базового значения:
`hasGradientStates` заворачивает базу в `listOf(singleColor(ref)).asLayered()`. При отсутствии поля
плагин берёт тип базового значения (`state.type ?: "color"` в solid-ветвях, `?: "gradient"`
в градиентной). Поэтому совпадающий тип не пишется — фолбэк даёт тот же результат, а корпус
`theme-converter` пишет `type` только у расходящихся.

Проверка на корпусе: 4389 из 4407 значений типа color/gradient выводятся верно, 0 неоднозначных,
0 несовпадений. Неоднозначность невозможна по построению —
`tokens_design_system_id_name_unique` не даёт имени быть в одной ДС и цветом, и градиентом.
18 несходящихся — битые ссылки на несуществующие токены, у них `token_id` пуст и применяется фолбэк.

Правило целиком висит на `token_id`. `resolveToken` в импорте ищет токен точным именем в пределах
ДС; не нашёл — пишет имя в `unresolvedTokens`, оставляет значение текстом и `token_id` пустым.
Такое значение export выводит по `properties.type`, то есть градиент возвращается сплошным цветом.
Поэтому фолбэк отдаётся не молча, а списком `underivedTypes`.

**Размещение значения по типу:** `default` для `color` и `gradient`, `value` для остальных.
Правило покрывает корпус без исключений: 4362 + 54 = 4416, ровно столько `default` в корпусе.

## 6. Правка `sameTypeFamily`

```ts
const NUMERIC_TYPES = new Set(["integer", "float", "dimension", "value"]);
const PAINT_TYPES   = new Set(["color", "gradient"]);

const sameTypeFamily = (left: string, right: string): boolean =>
  left === right ||
  (NUMERIC_TYPES.has(left) && NUMERIC_TYPES.has(right)) ||
  (PAINT_TYPES.has(left) && PAINT_TYPES.has(right));
```

Обоснование то же, что и у вывода типа: `gradient` — не тип свойства. В `uikit-compose-api-meta.json`
его нет ни разу, свойства объявлены `color`, Kotlin-тип у них `Brush`. Модель плагина —
sealed interface `Color` с реализациями `SolidColor` и `Gradient`, различаемыми дискриминатором `type`.

Без правки четыре свойства, у которых конфигурация говорит только `gradient` —
`avatar/background` (8 конфигураций), `avatar/textColor` (7), `rect-skeleton/gradient` (5),
`text-skeleton/gradient` (5) — попадают в `typeMismatches` ложно, 25 вхождений на корпус.

### Отчёт `gradientOnlyProperties`

Расширение семьи гасит вместе с ложными и настоящий сигнал: paint-слот, которому дизайн
не даёт ни одного сплошного цвета, — это расхождение оформления и кода, просто безвредное
для сборки. Сигнал переносится в отдельное поле `ImportReport`, рядом с `unknownProperties`.

Гранулярность — пакет, а не конфигурация. Замер на корпусе показывает, почему: по отдельным
конфигурациям срабатываний 25 на четырёх парах, но три из четырёх пар получают сплошной цвет
в других стилях того же компонента. Пакетная агрегация оставляет одну пару — `avatar.background`,
единственную, которой ни один стиль ни одной ДС не дал `color`. Конфигурационная гранулярность
дала бы 24 строки о том, что этот стиль использует градиент, а соседний — цвет; это факт стиля,
а не расхождение с кодом.

Поле информационное: конфигурацию не отклоняет, статус ответа не меняет.

## 7. Сужение `propertyTypeEnum`

Перечисление обслуживает две роли сразу: тип слота и словарь допустимых типов значения. Роли
разводятся.

```sql
ALTER TYPE "property_type" RENAME TO "property_type_old";
CREATE TYPE "property_type" AS ENUM (
  'color','typography','shape','shadow','dimension',
  'float','integer','boolean','icon','component_style','value'
);
ALTER TABLE "properties" ALTER COLUMN "type" TYPE "property_type"
  USING "type"::text::"property_type";
DROP TYPE "property_type_old";
```

Набор — ровно `ApiType` и `ParameterType` из `plasma-android`. Замер по 40 файлам api-meta
(~52 тыс. параметров) не даёт ни одного `gradient` и ни одного `blur`; замер по 670 конфигурациям
не даёт ни одного `blur` и ни одного `integer`. `blur` пришёл в перечисление из иллюстративного
enum `common_config_scheme.json`, который сам неполон — в нём нет `icon`, `float`, `shadow`
и `boolean`.

Приведение упадёт, если в `properties` есть строки со снимаемыми значениями, поэтому аудит живой
базы — предусловие миграции.

`validate()` перестаёт выводить допустимые типы значения из перечисления и получает собственное
множество: словарь слотов плюс `gradient`. `blur` в него не входит — слота с таким типом больше
не бывает, и значение такого типа некуда положить.

Побочный эффект: `PropertyTypeSchema` генерируется из перечисления, поэтому `POST /properties`
и `PATCH /properties/:id` перестают принимать `gradient`.

## 8. Происхождение `components.name`

`components.name` принадлежит коду компонента. Единственный писатель —
`backend-kt/scripts/import-uikit-api-meta.sh`, который берёт `.componentName` из `uikit-api-meta.json`.

Prod-сид приводится к тому же написанию: `js/services/db-service/src/db/seeds/prod/components/checkbox.ts` — `Checkbox` -> `CheckBox`,
`js/services/db-service/src/db/seeds/prod/components/radiobox.ts` — `Radiobox` -> `RadioBox`. Два имени из 21.

Основание: export выводит `componentName` для `meta.json` правилом `camelToKebab`. Сверка 78 имён
корпуса с 78 именами api-meta даёт биекцию (0 не находящих мету, 0 лишних), обратный ход точен
для 77 из 78. Из `Checkbox` дефис не достать, из `CheckBox` — достаётся.

Export проверяет обратимость перед выдачей: `techToCamelCase(camelToKebab(name)) == name`.
Не сходится — отказ `422` с именем компонента, а не неверное имя в `meta.json`.

## 9. Что не входит

- `GET /ds/design-systems/{id}/appearances` и `/components` не проверяют project scope,
  в отличие от `/:id`. Export их не использует. Починка — отдельная задача.
- Расширение глобального слоя свойствами вне `uikit-api-meta.json`.
- Снапшоты версий: `design_system_versions.snapshot` export не читает и не пишет.
