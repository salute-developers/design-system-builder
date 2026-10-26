# Как написать нормализатор API-меты для новой платформы

Инструкция для разработчиков новых платформ. Нужна, чтобы команда `dsbuilder components import-api` начала
принимать мету вашей платформы. Backend менять не нужно, всё делается в `frontend-kt`.

## 1. Как это работает

```
файл меты платформы          нормализатор в CLI             один запрос
(свой формат у каждой)  →   (ваш код, по платформе)   →   POST /api/admin/component-config/import-api-meta
                                       │
                               единый манифест
```

Backend ничего не знает о форматах мет. Он получает **манифест**: компоненты, их свойства, состояния и
платформенные имена свойств. Ваша задача — научить CLI превращать файл меты вашей платформы в этот манифест.

Сейчас есть три готовых образца, на которые стоит опираться:

| Платформа | Нормализатор | Тесты | Корпус |
|---|---|---|---|
| `compose` | `ComposeApiMetaNormalizer` | `ComposeApiMetaNormalizerTest` | `ComposeApiMetaCorpus.kt` |
| `android-view` | `ViewApiMetaNormalizer` | `ViewApiMetaNormalizerTest` | `ViewApiMetaCorpus.kt` |
| `swiftui` | `SwiftUiApiMetaNormalizer` | `SwiftUiApiMetaNormalizerTest` | `SwiftUiApiMetaCorpus.kt` |
| `react` | `WebApiMetaNormalizer` | `WebApiMetaNormalizerTest` | `WebApiMetaCorpus.kt` |

Все пути ниже относительно `frontend-kt/feature-components/src/`:
`commonMain/kotlin/com/dsbuilder/frontend/feature/components/domain/apimeta/` (код) и
`commonTest/kotlin/com/dsbuilder/frontend/feature/components/` (тесты).

## 2. Что нужно сделать (чеклист)

1. **Change в OpenSpec.** Заведите worktree и change (`tools/task create feat/<имя> --worktree`, затем
   `/opsx:propose add-cli-import-api-<платформа>`). Решения из раздела 7 или 8 запишите в `design.md`, а
   требования — в дельту `cli-components`.
2. **Нормализатор** `<Платформа>ApiMetaNormalizer : ApiMetaNormalizer` в `domain/apimeta/` (раздел 3 и 4).
3. **Регистрация** в `ComponentsApplicationModule.kt`: `single { ... }` и строка в карте
   `normalizers = mapOf(TargetPlatform.X to get<...>())`. Пока платформы в карте нет, команда отвечает
   `does not support platform 'x' yet`.
4. **Корпус и тесты** (раздел 5).
5. **Документация:** раздел «Импорт API компонентов» в `frontend-kt/cli/USAGE.md` (какой файл брать,
   что пропускается).
6. **Проверка на живой базе** (раздел 6).

Маппинг платформы CLI на платформу backend уже есть: `TargetPlatform.toApiMetaPlatform()` в
`ApiMetaManifest.kt` (`swiftui → ios`, `react → web`). Новую платформу backend тоже уже знает (словарь
`web`, `compose`, `xml`, `ios`), ничего добавлять не надо.

## 3. Контракт нормализатора

```kotlin
internal interface ApiMetaNormalizer {
    fun normalize(text: String, typeMap: Map<String, String> = emptyMap()): ApiMetaNormalizationResult
}
```

Результат — один из трёх:

| Результат | Когда |
|---|---|
| `Normalized(manifest, conflicts, skipped)` | мета разобрана, есть хотя бы один компонент со свойствами |
| `Empty` | валидный JSON, но компонентов нет (или ни у одного нет свойств) |
| `Invalid(message)` | файл не той формы: не JSON, другая платформа, неверный корень |

Исключения наружу не выбрасывать: ловить `SerializationException` и `IllegalArgumentException` и возвращать
`Invalid` (см. образцы). Нормализатор — чистая функция: без файловой системы, сети и состояния.

### Манифест

Это три вложенных класса из `ApiMetaManifest.kt`. Устаревание описывается **на уровне свойства**, а не
компонента: в `ApiMetaProperty` лежит словарь `deprecations`, где ключ — платформенное имя из `platformNames`.

```kotlin
ApiMetaManifest(components: List<ApiMetaComponent>)

ApiMetaComponent(
    name: String,                 // имя компонента
    properties: List<ApiMetaProperty>,
    states: List<String>,         // см. правила про состояния
)

ApiMetaProperty(
    name: String,                 // имя свойства; вместе с компонентом даёт ключ
    type: String,                 // см. список типов ниже
    platformNames: List<String>,  // имена на вашей платформе, минимум одно
    description: String?,         // справочно
    deprecations: Map<String, ApiMetaDeprecation> = emptyMap(),
        // ключ — имя из platformNames; нет записи значит «не устарело»
)

ApiMetaDeprecation(message: String)   // пустая строка допустима
```

Пример для View: у свойства `textColor` два имени, устарело только одно:

```kotlin
ApiMetaProperty(
    name = "textColor",
    type = "color",
    platformNames = listOf("sd_textColor", "android:textColor"),
    description = "attr: sd_textColor/android:textColor",
    deprecations = mapOf("sd_textColor" to ApiMetaDeprecation("Use android:textColor")),
)
```

Для Compose имя одно (`id`), поэтому у устаревшего свойства в `deprecations` одна запись:
`deprecations = mapOf("contentColor" to ApiMetaDeprecation("Use InteractiveColor"))`.

Класс `ApiMetaProperty` — доменная модель. На сеть её преобразует `HttpApiMetaRemoteSource`: каждое имя из
`platformNames` становится объектом `{ "name": ... }`, и если у имени есть запись в `deprecations`, к нему
добавляется `"deprecated": { "message": ... }`. Результат — как в примере ниже. Нормализатор формат сети
знать не должен, он только заполняет `platformNames` и `deprecations`.

Допустимые `type` определены в БД (`property_type`): `color`, `typography`, `shape`, `shadow`,
`dimension`, `float`, `component_style`, `value`, `icon`, `boolean`, `integer`. Неизвестный тип backend не
роняет: свойство попадёт в `rejected` отчёта. Но лучше сразу приводить типы к этому словарю в
нормализаторе (либо пропускать с учётом в `skipped`, как View делает с `unknown`).

На сеть манифест уходит в таком виде (собирает `HttpApiMetaRemoteSource`, трогать не надо). Имя без
`deprecated` значит «не устарело»; имя с `deprecated` значит «устарело, сообщение такое-то»:

```json
{ "platform": "ios", "meta": { "source": "ios-api-meta.json" }, "dryRun": true,
  "components": [ { "name": "Avatar",
    "properties": [ { "name": "size", "type": "dimension",
        "platformNames": [ { "name": "size" } ] } ],
    "states": ["active"] } ] }
```

Имя в `platformNames` — объект. Если у имени есть `deprecated`, оно уйдёт с `{"message": "..."}`, иначе
как `{"name": "..."}` (это значит «не устарело» и снимет прежнюю пометку).

## 4. Правила нормализации

Они одинаковы для всех платформ, чтобы результаты были сопоставимы.

1. **Ключ свойства — пара `(компонент, id)`.** Повторы сводятся: побеждает первое вхождение. Если у повтора
   другой тип, он не попадает в манифест, а записывается в `conflicts` строкой
   `Box.size: kept dimension, ignored float`. Повтор с тем же типом дополняет имена платформы и описание.
2. **Компонент без свойств в манифест не попадает** (Compose, View: пустая запись там значит, что артефакт не найден).
   Если не осталось ни одного компонента — `Empty`. Исключение — web: компонент без токенов уходит без свойств.
3. **`typeMap`** (`--map-type from:to`) применяется к типу до сравнения повторов.
4. **Состояния** берутся в той форме, в какой они встречаются в конфигурациях оформления: kebab-case
   в нижнем регистре (`DraggingOver` → `dragging-over`; есть готовый `String.toKebabCase()`), либо готовое
   имя из меты, если генератор его отдаёт (`configName`). Пустые отбрасываются, повторы убираются.
5. **Что сознательно не включено — в `skipped`:** `ApiMetaSkipped("категория", число)`. Число считается по
   уникальным парам `(компонент, id)`. CLI напечатает `Skipped: N <категория>` после отчёта.
6. **Устаревание (`deprecated`).** Поле в мете: объект `{ "message": "..." }`, у остальных его нет.
   Пустое сообщение допустимо и всё равно означает «устарело». Статус кладётся в `deprecations` по
   платформенному имени. Как он распространяется, решает платформа:
   у Compose устаревает свойство целиком (достаточно одной помеченной перегрузки), у View — конкретный
   атрибут. Напишите, как у вас, в KDoc нормализатора.
7. **Имя на платформе** (`platformNames`) — то, как свойство называется в коде платформы. У Compose это
   `id`, у View — XML-атрибуты (их может быть несколько). Выбор для вашей платформы фиксируется в
   `design.md`.
8. **Не падать на лишних полях.** `Json { ignoreUnknownKeys = true }`, все поля моделей чтения с
   значениями по умолчанию: меты расширяются (так появился `deprecated`).

## 5. Тесты

1. **Корпус** — реальный фрагмент меты вашей платформы константой в `commonTest` (как
   `COMPOSE_API_META_CORPUS`). Выбирайте фрагмент так, чтобы он покрывал правила: повторы `id`, состояния,
   компонент без состояний, то, что пропускается, `deprecated`. В KDoc корпуса напишите, что он покрывает.
2. **Что проверить** (минимум):
   - число компонентов и свойств на корпусе, ключ `(компонент, id)` без повторов;
   - имя платформы, описание, состояния (оба способа, если их два);
   - повтор с другим типом попадает в `conflicts`, первое вхождение побеждает;
   - `typeMap` применяется;
   - `skipped`: категории и числа на корпусе;
   - `deprecated`: пометка, пустое сообщение, отсутствие поля, поведение при повторах;
   - `Empty` для пустой меты и `Invalid` для меты другой платформы и не-JSON;
   - мета без `deprecated` разбирается без ошибки.
3. **Сквозной тест CLI** в `cli/src/commonTest/.../feature/components/ComponentsImportApiCliCommandTest.kt`:
   мета вашей платформы с `--platform <ваша>` уходит одним запросом с нужным `platform` в теле.
4. **Проверьте, что тесты не пустые:** сломайте правило (например, не вызывайте `typeMap`) и убедитесь, что
   тест падает.

Команды:

```bash
cd frontend-kt
./gradlew --offline spotlessApply :feature-components:jvmTest :cli:jvmTest
./gradlew --offline build --continue     # spotless, detekt, тесты, native
```

Ограничения кода: строки до 120 символов, KDoc у публичных свойств, `@Suppress("ReturnCount")` допустим для
`normalize` (образцы так делают). Зависимости модулей см. `frontend-kt/AGENTS.md`: нормализатор живёт в
`feature-components` и не зависит от других `feature-*`.

## 6. Проверка на живой базе

Поднимите локальный контур (gateway, Keycloak, db-service из вашей ветки), соберите CLI
(`frontend-kt/install-local-cli.sh`) и войдите администратором: импорт доступен только системному
администратору (`dsbuilder auth login --username admin@example.com`).

```bash
dsbuilder components import-api --from <файл меты> --platform swiftui          # dry run
dsbuilder components import-api --from <файл меты> --platform swiftui --apply
dsbuilder components import-api --from <файл меты> --platform swiftui --apply # повтор
```

Ожидаемо: на чистой платформе все счётчики `Created` растут, на повторе нули, `Rejected: 0`, раздел
`Absent from meta` пуст, `Property type mismatches` пуст (у каждой платформы свои компоненты, конфликтовать
не с чем). Затем сверьте базу с метой своим скриптом: каждому `(компонент, id)` из меты соответствует
свойство и алиас в компоненте нужной платформы.

```sql
select c.platform, count(*) from components c group by 1;
-- компоненты платформы: name + platform уникальны, алиас платформы равен платформе компонента
```

Веб-компоненты и компоненты других платформ импорт не меняет: проверьте, что их числа не изменились.

## 7. iOS: как решено

Платформа `swiftui` уже поддержана: нормализатор — `SwiftUiApiMetaNormalizer`, тесты —
`SwiftUiApiMetaNormalizerTest`, корпус — `SwiftUiApiMetaCorpus.kt`. Раздел оставлен как образец того,
какие решения платформа принимает перед тем, как заводить нормализатор.

Файл `ios-api-meta.json` (генератор в репозитории plasma-ios) по форме близок к Compose: корень —
массив `[{ "componentName", "params": [...], "stateEnum"?, ... }]`; у параметра есть `id`, `type`,
`group`, `methodName`, `paramName`, `paramSimpleType`, а также необязательные `unmapped`, `state`,
`stateOnly`, `copyOf`, `fromVariation`, `sizeFromIconId`, `valueEnum`, `markupValue`, `markupZero`,
`rawNumber`, `alwaysEmit`.

| Вопрос | Решение |
|---|---|
| Откуда состояния | из `stateEnum`: `configName`, иначе `name` в kebab-case. Поле `state` у параметра состоянием компонента не считается — оно говорит, из какого состояния ключа брать значение, и среди таких состояний есть состояния взаимодействия, чей словарь в базе общий |
| `unmapped` | пропускаются с категорией `properties without platform code`: у свойства нет кода на платформе, темизировать его на iOS нечем |
| Повторы `id` | при одном типе сливаются, имена складываются в `platformNames` в порядке появления; первое вхождение побеждает только при конфликте типа |
| Имя на платформе | `methodName` — имя свойства в коде. `id` не годится: он отличается от имени в коде у 290 свойств из 903 |
| Описание | `group: <group>; method: <methodName>; param: <paramSimpleType>`; значения, различающиеся у повторов, перечисляются через `/`. `group` входит в описание, потому что на iOS она различает свойство appearance (`root`) и свойство конфигурации размеров (`size`) |
| Регистр имён | имя компонента — как в мете; iOS привёл его к `CheckBox`, `RadioBox`, `ScrollBar`, `ToolBar` |
| `copyOf`, `fromVariation`, `valueEnum`, `markupValue` | в манифест не передаются: это то, как генератор добывает значение, а не свойство компонента |
| `deprecated` | мета iOS поля не отдаёт: свойства, которых нет в конфигурациях оформления, из неё убраны на стороне генератора, и помечать нечего |

Ошибки меты, о которых говорил прежний вариант раздела, закрыты на стороне генератора: дублей `id`
с разным типом нет, `*Alpha` отдаются как `float`, `duration` — как `integer`, стили `TextField` —
как `typography`, `ChipGroup.funcinsets` и `Segment.disabledAlpha` убраны, у `RadioBox` больше нет
набора `toggleIndeterminate*`. Форма закреплена тестами-инвариантами в репозитории iOS, поэтому
нормализатор на неё опирается.

## 8. Web: как сделано

Нормализатор `WebApiMetaNormalizer` читает `web-api-meta.json`, который строит
`npm run generate:api-meta` в `js/cli` по JSDoc-аннотациям словарей CSS-токенов пакета компонентов
(`@styleType`, `@styleProp`, `@stylePart`, `@styleState`, `@deprecated`). Корень — массив
`[{ "componentName", "params": [{ "paramName", "type", "id", "part"?, "state"?, "deprecated"? }] }]`,
запись в `params` — один токен.

| Вопрос | Решение |
|---|---|
| Свойство | `(componentName, id)`; `id` — `@styleProp`, по умолчанию ключ токена |
| Имя на платформе | ключи токенов (`paramName`) без `state`: так web-параметры заводят сиды и так их ищет генерация |
| Типографика | части (`part`) — несколько имён одного свойства типа `typography` |
| Токены `state` | значение свойства в состоянии; именем не становятся; свойство только из них — `skipped` |
| Состояния | `state` в kebab-case, кроме словаря состояний взаимодействия (`hovered`, `pressed`, …): те общие |
| `deprecated` | на уровне токена, как у View; `{}` без сообщения — пустое сообщение |
| Компонент без токенов | уходит без свойств и заводится в базе; `Empty` — только мета без компонентов |
| Отличие от Compose | у Compose та же форма списка, поэтому `paramName` обязателен: мета Compose даёт `Invalid` |

Веб-компоненты в базе уже есть из сидов (`platform = web`), импорт для `react` пополняет их же. Имена
компонентов и `id` в мете нужно сверять с сидами до импорта, иначе получатся дубли; начинайте с dry run.

## 9. Частые ошибки

- Нормализатор читает файл или ходит в сеть. Нельзя: он получает строку.
- Имя компонента в манифесте не совпадает с именем в мете (приведение регистра и т. п.): компонент
  идентифицируется по имени как есть.
- Типы вне словаря БД молча уходят в `rejected` на backend; пропускайте их в нормализаторе и считайте в `skipped`.
- Пустой компонент (без свойств) в манифесте: он отбрасывается, но если остался только он, нужен `Empty`.
- Повторы свойства сводятся неверно: проверяйте тестом на корпусе, где один `id` встречается в нескольких
  записях.
- Забыли зарегистрировать нормализатор в `ComponentsApplicationModule`: команда ответит, что платформа не
  поддержана.

Backend API URL is configured through `DSBUILDER_API_URL` only; the `--api-url` option is not supported.
For local development, set `export DSBUILDER_API_URL=http://localhost:8080` before CLI commands, and pass the same environment variable to the MCP process.
