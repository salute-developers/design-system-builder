## Context

`PushComponentsUseCase` появился в change `add-cli-components-push` и с тех пор рос вместе с контрактом импорта (`move-components-import-to-component-config`). Сейчас один файл `application/PushComponentsUseCase.kt` совмещает четыре роли:

- оркестрацию барьеров до записи — API URL, project context, credentials, чтение пакета, преобразование (строки 50–83);
- преобразование пакета в common-формат через `ConfigCodec` (строки 109–126);
- HTTP-адаптер: `Json`-конфигурация (36–40), сборка тела (85–93), путь (95), вызов `httpClientFactory.create(...).post(...)` (97), разбор отчёта (128–144);
- wire-контракт: `@Serializable ImportRequest`, `ImportMeta`, `ImportComponent`, `ImportReport`, `ImportRejection` (235–306).

`ComponentsPushCliCommand` импортирует `ImportReport` из `application` и печатает его напрямую — форма CLI output привязана к форме JSON-ответа backend.

Образец, по которому нужно выровняться, в репозитории уже есть:

```
feature/theme/application/FetchThemesPorts.kt     interface RemoteThemeDataSource
                                                  data class RemoteThemeCommand(context, apiUrl, apiKey)
                                                  sealed interface RemoteThemeResult<T>
feature/theme/data/HttpRemoteThemeDataSource.kt   class HttpRemoteThemeDataSource(httpClientFactory)
                                                  private @Serializable TenantResponse { toDomain() }
feature/status/…                                  ProjectAccessVerifier + HttpProjectAccessVerifier
```

Ограничения: change не меняет поведение CLI (пути, тела, тексты, exit codes зафиксированы требованиями `cli-components`), не трогает backend и не расширяет зависимости. `dsbuilder-frontend/cli/AGENTS.md` отдельно предупреждает против абстракций «на будущее», поэтому порт вводится минимальный.

## Goals / Non-Goals

**Goals:**

- Убрать из `application` HTTP client, путь запроса, `Json` и wire-модели; свести use case к оркестрации и преобразованию.
- Ввести port `ComponentConfigRemoteSource` в `application` и его HTTP-реализацию в `data`.
- Разорвать связь presentation с DTO backend через доменную модель отчёта импорта.
- Разнести тесты по слоям: wire-контракт — на адаптере, оркестрация — на use case.

**Non-Goals:**

- Поведение CLI не меняется: путь, тело, `dryRun`, формулировки сообщений и формат output прежние.
- Backend, gateway, формат `.sdds` и `common_config_scheme.json` не затрагиваются.
- `ConfigCodec` и модели common-формата не переписываются.
- `components fetch` не реализуется; порт не расширяется операциями чтения авансом.
- `RemoteThemeDataSource` и `ProjectAccessVerifier` не переименовываются и не приводятся к новому порту.

## Decisions

### Порт: одна операция `import`, команда и результат в `application`

```kotlin
// feature/components/application/ComponentConfigRemoteSource.kt
internal fun interface ComponentConfigRemoteSource {
    fun import(command: ImportComponentsCommand): ImportComponentsResult
}

internal data class ImportComponentsCommand(
    val apiUrl: ProjectApiUrl,
    val apiKey: ProjectApiKey,
    val projectId: ProjectId,
    val designSystemId: DesignSystemId,
    val packageName: String,
    val packageOrigin: String,
    val dryRun: Boolean,
    val components: List<ConvertedComponentConfig>,
)

internal sealed interface ImportComponentsResult {
    data class Imported(val report: ComponentImportReport) : ImportComponentsResult
    data class Failed(val message: String) : ImportComponentsResult
}
```

Форма повторяет `RemoteThemeCommand` / `RemoteThemeResult`: команда несёт runtime-адрес и credentials, потому что они разрешаются барьерами use case и не должны читаться адаптером заново. `fun interface` выбран, как у `ComponentPackageLoader` и `ProjectAccessVerifier`, — операция одна, fake в тестах пишется лямбдой.

Рассмотренные альтернативы:

- Порт с методами `import` и `fetch` сразу — нарушает запрет `AGENTS.md` на код «на будущее»; `components fetch` (change `add-cli-components-fetch`) ещё не спроектирован, и форма чтения неизвестна.
- Порт, принимающий `ComponentPackage` и сам вызывающий `ConfigCodec`, — преобразование native → common это бизнес-правило (требование «Components push transforms native configurations»), оно не может уехать в `data`.
- Порт, разрешающий API URL и key самостоятельно, — сломал бы требование «Components push requires explicit backend target»: отказ по code default URL обязан случаться до сетевого вызова.

### `apiUrl` в команде — `ProjectApiUrl`, не `ResolvedApiUrl`

`ApiUrlResolver.resolveForWrite` возвращает `ResolvedApiUrl` с полем `sourceName` — это данные для печати (`API URL: … (from --api-url)`). Порту источник значения не нужен, поэтому в команду уходит `ProjectApiUrl(resolved.value)`, а `ResolvedApiUrl` остаётся в `PushTarget` для presentation. Это же согласуется с `RemoteThemeCommand`, который принимает `ProjectApiUrl`.

Альтернатива — передавать `ResolvedApiUrl` целиком: короче на одну конверсию, но втягивает в порт презентационное поле и тип из `core.http`, тогда как `ProjectApiUrl` живёт в `core.domain`.

### Отчёт импорта — доменная модель, wire-модель приватна в `data`

В `feature/components/domain` появляются:

```kotlin
internal data class ComponentImportReport(
    val created: Int, val updated: Int, val unchanged: Int,
    val rejected: List<ComponentImportRejection>,
    val unknownProperties: List<String>,
    val unknownStates: List<String>,
    val typeMismatches: List<String>,
)

internal data class ComponentImportRejection(
    val componentName: String, val styleName: String, val reason: String,
)
```

В `data` остаются приватные `@Serializable ImportReportResponse` / `ImportRejectionResponse` с `toDomain()` — ровно как `TenantResponse.toDomain()` в `HttpRemoteThemeDataSource`. `PushComponentsResult.Pushed` и `ComponentsPushCliCommand` работают с доменной моделью.

Альтернатива — оставить единственный `@Serializable ImportReport`, переехавший в `data` и реэкспортируемый в presentation. Дешевле на семь полей дублирования, но тогда рефакторинг косметический: клиент вынесли, а форму CLI output по-прежнему диктует JSON backend, и правило «domain не знает про транспорт» держится только на честном слове. Дублирование здесь — та же цена, которую уже платит фича `theme`.

### `CommonConfig` пересекает границу как есть

`CommonConfig` объявлен `@Serializable` в `domain/codec` — формально сериализация уже протекла в domain. В этом change он **не** дублируется DTO в `data`: модель один-в-один повторяет `common_config_scheme.json`, её производит `ConfigCodec`, и параллельный DTO дал бы больше сотни строк механического маппинга без единого решения. Адаптер сериализует `CommonConfig` напрямую внутри своего `@Serializable ImportComponentPayload`.

Это осознанный компромисс, а не недосмотр: он зафиксирован здесь, чтобы при следующем прикосновении к `component-config-codec` решение пересматривалось явно.

### Преобразованная конфигурация — доменная модель

```kotlin
// feature/components/domain/ComponentPackage.kt
internal data class ConvertedComponentConfig(
    val componentName: String,
    val styleName: String,
    val config: CommonConfig,
)
```

Результат преобразования — доменное понятие («конфигурация в common-формате вместе с её идентичностью»), поэтому он живёт в `domain` рядом с `ComponentConfiguration`, а команда порта ссылается только на доменные типы.

### Преобразование остаётся в use case

Приватный `convert()` и `ConversionResult` не выносятся в отдельный domain-сервис. Правило «одна неудача отменяет весь push» выражено пятнадцатью строками поверх `ConfigCodec`, отдельный класс не уменьшил бы связность и попал бы под предупреждение `AGENTS.md` о лишних абстракциях. Если позже преобразование понадобится `components fetch` в обратную сторону, выделение `ComponentPackageConverter` делается отдельным решением.

### Имя порта — `ComponentConfigRemoteSource`

Имя названо в запросе на change и точно указывает ресурс backend (`component-config`), к которому порт обращается. В фиче `theme` используется другая форма — `RemoteThemeDataSource`. Расхождение осознанное и локальное: приводить обе фичи к одному суффиксу здесь не нужно, это отдельная косметическая правка, которая иначе раздула бы диф этого change.

### Разделение тестов

`PushComponentsUseCaseTest` (346 строк) сейчас проверяет через `FakeHttpClientFactory` в том числе wire-контракт: полный путь запроса, `designSystemId` в теле, ключ `properties` вместо `props`, `dryRun` в теле, единственность запроса, разбор отчёта, нечитаемый отчёт. Всё это переезжает в `HttpComponentConfigRemoteSourceTest` поверх того же fake HTTP client.

В тесте use case остаются: порядок барьеров и их сообщения, all-or-nothing преобразование с указанием компонента и файла, заполнение `PushTarget`, проброс `dryRun` в команду порта, отсутствие сверки имени пакета. Fake порта — лямбда, фиксирующая полученную `ImportComponentsCommand`.

`ComponentsCliCommandTest` подменяет HTTP на уровне `CliRuntime`, а не в конструкторе use case, поэтому изменений не требует: fake `AuthenticatedHttpClientFactory` доезжает до адаптера через Koin и продолжает покрывать сборку графа целиком.

### DI

`ComponentsFeatureModule` получает `single<ComponentConfigRemoteSource> { HttpComponentConfigRemoteSource(get<AuthenticatedHttpClientFactory>()) }` — по образцу регистрации `RemoteThemeDataSource`. У `PushComponentsUseCase` параметр `httpClientFactory` заменяется на `remoteSource`, а у `codec` снимается значение по умолчанию `= ConfigCodec()`: конструирование зависимости внутри use case — тот же класс дефекта, что и создание HTTP client, и DI уже передаёт `ConfigCodec` явно.

## Risks / Trade-offs

- **Регресс поведения при переносе wire-логики (путь, ключи тела, обработка нечитаемого отчёта)** → тексты сообщений и строка пути переносятся дословно; тесты, проверяющие их, переезжают в тест адаптера первыми, до удаления кода из use case, и должны оставаться зелёными на каждом шаге.
- **Дублирование полей между `ComponentImportReport` и `ImportReportResponse`: рассинхрон при следующем изменении отчёта backend** → маппинг сосредоточен в единственном `toDomain()`, а сценарий «Push печатает отчёт» из `cli-components` покрывает поля end-to-end через `ComponentsCliCommandTest`.
- **`CommonConfig` остаётся `@Serializable` в domain — граница выровнена не полностью** → зафиксировано решением выше как явный компромисс; изоляция common-формата от транспорта относится к capability `component-config-codec` и делается отдельным change, если появится второй потребитель формата.
- **Большой диф в тестах (346 строк переписываются) рискует потерять покрытие** → задачи требуют сверки числа тестов до и после: суммарно `PushComponentsUseCaseTest` + `HttpComponentConfigRemoteSourceTest` не меньше текущего набора, ни один сценарий не удаляется без переноса.
- **Порт спроектирован под `import` и может не подойти `components fetch`** → форма `command → sealed result` совпадает с `RemoteThemeDataSource`, куда чтение добавляется вторым методом; расширение порта не потребует ломать существующую операцию.
