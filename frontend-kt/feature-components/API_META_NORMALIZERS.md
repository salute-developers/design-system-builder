# Как написать нормализатор API-меты для новой платформы

Инструкция для разработчиков iOS и web. Нужна, чтобы команда `dsbuilder components import-api` начала
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

Сейчас есть два готовых образца, на которые стоит опираться:

| Платформа | Нормализатор | Тесты | Корпус |
|---|---|---|---|
| `compose` | `ComposeApiMetaNormalizer` | `ComposeApiMetaNormalizerTest` | `ComposeApiMetaCorpus.kt` |
| `android-view` | `ViewApiMetaNormalizer` | `ViewApiMetaNormalizerTest` | `ViewApiMetaCorpus.kt` |

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
2. **Компонент без свойств в манифест не попадает.** Если не осталось ни одного компонента — `Empty`.
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
администратору (`dsbuilder auth login --username admin@example.com --api-url http://localhost:8080`).

```bash
dsbuilder components import-api --from <файл меты> --platform swiftui --api-url http://localhost:8080          # dry run
dsbuilder components import-api --from <файл меты> --platform swiftui --api-url http://localhost:8080 --apply
dsbuilder components import-api --from <файл меты> --platform swiftui --api-url http://localhost:8080 --apply # повтор
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

## 7. iOS: что нужно решить

Файл `ios-api-meta.json` (генератор в iOS-репозитории) по форме близок к Compose:

- корень — массив `[{ "componentName", "params": [...], "qualifiedName", ... }]`;
- у параметра: `id`, `type`, `group`, `methodName`, `paramName`, `paramQualifiedType`, `paramSimpleType`,
  `valueQualifiedType`, а также необязательные `unmapped`, `state`, `stateOnly`, `copyOf`, `fromVariation`,
  `sizeFromIcon`, `valueEnum`, `markupValue`, `markupZero`, `rawNumber`, `alwaysEmit`;
- блока `stateEnum`, как у Compose, нет.

Решения, которые нужно принять и записать в `design.md` (предложения в скобках):

| Вопрос | Факты | Предложение |
|---|---|---|
| Откуда состояния | у 13 параметров `state` (`checked`, `indeterminate`, `collapsed`, `activated`), у 4 `stateOnly` | собирать из `state` на параметрах; состояние `stateOnly` самостоятельным свойством не считать |
| `unmapped` | 62 параметра без прямого соответствия в коде | пропускать в `skipped` с категорией «unmapped» или включать, если они темизируемые: решить с владельцем генератора |
| Дубли `id` с разным типом | 9 пар, например `Drawer.closeIcon` (`icon` и `dimension`), всегда первый вхождение из группы `root` | брать первое вхождение, в `conflicts` не шуметь; лучше, чтобы генератор не дублировал |
| Имя на платформе | `methodName` отличается от `id` у 363 из 965 параметров | решить явно; для Compose это `id`, для iOS, вероятно, имя параметра в коде (`methodName`/`paramName`) |
| Регистр имён | в iOS `Checkbox`, `Radiobox`, `Scrollbar`, `Toolbar`; в конфигах и Compose `CheckBox`, `RadioBox`, `ScrollBar`, `ToolBar` | имя компонента — как в мете платформы; для сопоставления с конфигурациями отвечает импорт `components push` (канонизация без регистра), на импорт API это не влияет |
| `copyOf`, `fromVariation`, `valueEnum`, `markupValue` | служебные признаки генератора | в манифест не передаются; решить, нужны ли `valueEnum` как типы |

Отдельно, ошибки самой меты, которые стоит исправить в генераторе до импорта, иначе они попадут в базу
(это не задача нормализатора):

- `*Alpha` (`disableAlpha`, `loadingAlpha`) отдаются как `dimension`, а в остальных платформах это `float`;
- `RectSkeleton.duration`, `TextSkeleton.duration` — `dimension`, должно быть `integer`;
- `TextField.counterStyle`, `placeholderStyle`, `optionalStyle` — `value`, должно быть `typography`;
- опечатки: `ChipGroup.funcinsets`, `Segment.disabledAlpha` (везде `disableAlpha`);
- `Radiobox` содержит набор `toggleIndeterminate*` (похоже на копию `Checkbox`).

В `TargetPlatform` iOS называется `SWIFT_UI` (`--platform swiftui`), на backend уходит `ios`.

## 8. Web: что нужно выяснить сначала

Формата веб-меты в репозитории пока нет, поэтому сначала нужны ответы:

1. **Что считается мета для web и кто её генерирует** (типы пропсов TypeScript, конфиги, свой генератор)?
   Приложите образец файла.
2. **Как называются свойства на платформе**: имена пропсов, CSS-переменные или и то и другое (список
   `platformNames` допускает несколько имён).
3. **Откуда состояния** и какие они (в мете, в пропсах, в конфигах).
4. **Как выражается `deprecated`** (JSDoc `@deprecated`, отдельное поле).
5. **Какие у свойств типы** и как их привести к словарю из раздела 3.

Что важно знать про web в базе уже сейчас:

- Веб-компоненты в базе есть (из сидов, `platform = web`, около 63 штук: `Button`, `Link`, `Checkbox`,
  `Radiobox` и др.), на них висят конфигурации оформления дизайн-систем (appearances, значения, вариации).
- Импорт API-меты для `react` пополняет **эти же** компоненты: ищет по паре `(имя, web)`, создаёт недостающие
  свойства и алиасы, существующее не меняет. Расхождения типа с тем, что уже есть, попадут в
  `Property type mismatches` и не будут исправлены.
- Поэтому имена компонентов и свойств в веб-мете нужно сверять с сидами **до** импорта. Иначе получатся
  дубли: например, сид называет компонент `Link`, а мета — `LinkButton`.
- Начните с `--dry-run`: отчёт покажет, сколько будет создано и какие типы расходятся.

В `TargetPlatform` web называется `REACT` (`--platform react`), на backend уходит `web`.

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
