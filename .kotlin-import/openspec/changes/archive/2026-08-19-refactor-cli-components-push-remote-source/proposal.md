## Why

`PushComponentsUseCase` нарушает границы слоёв, зафиксированные в `AGENTS.md` и `dsbuilder-frontend/cli/AGENTS.md`: use case в пакете `application` сам создаёт HTTP client (`httpClientFactory.create(...).post(...)`), строит путь запроса, настраивает `Json`, объявляет `@Serializable` модели тела и отчёта и разбирает ответ backend. Из ~150 строк класса собственно оркестрации принадлежит около трети, остальное — HTTP-адаптер, живущий не в своём слое.

Побочный эффект той же протечки: `ComponentsPushCliCommand` рендерит `ImportReport` — wire-DTO backend, — то есть форма CLI output привязана к форме JSON-ответа. Изменение схемы ответа backend немедленно доходит до presentation, минуя domain.

Фичи `theme` и `status` уже сделаны правильно (`RemoteThemeDataSource` + `HttpRemoteThemeDataSource`, `ProjectAccessVerifier` + `HttpProjectAccessVerifier`), `components` — единственная выпадающая. Change выравнивает её по существующему в репозитории образцу и снимает блокер для `components fetch`, которому понадобится тот же порт для чтения.

## What Changes

- В `feature/components/application` появляется port-интерфейс `ComponentConfigRemoteSource` с единственной операцией `import`, вместе с моделями `ImportComponentsCommand` и `ImportComponentsResult`.
- В `feature/components/data` появляется `HttpComponentConfigRemoteSource` — реализация порта поверх `AuthenticatedHttpClientFactory`. Туда переезжают путь `/api/projects/{projectId}/ds/component-config/import`, конфигурация `Json`, `@Serializable` модели тела запроса и ответа, обработка нечитаемого отчёта.
- `PushComponentsUseCase` теряет зависимость `httpClientFactory` и вызывает порт. За ним остаются барьеры до записи (API URL, project context, credentials, чтение пакета), преобразование пакета в common-формат и сборка `PushTarget`.
- Отчёт импорта становится доменной моделью `ComponentImportReport` / `ComponentImportRejection` в `feature/components/domain`; wire-модель ответа остаётся приватной в `data` и маппится в доменную. `ComponentsPushCliCommand` рендерит доменную модель.
- Проверки wire-контракта (путь, состав тела, ключ `properties`, флаг `dryRun`, нечитаемый отчёт) переезжают из `PushComponentsUseCaseTest` в новый `HttpComponentConfigRemoteSourceTest`. Тест use case переходит на fake порта и проверяет барьеры, порядок отказов, all-or-nothing преобразование и заполнение `PushTarget`.
- `ComponentsFeatureModule` регистрирует порт и реализацию; из конструктора `PushComponentsUseCase` уходит `httpClientFactory`, а у параметра `codec` снимается значение по умолчанию `ConfigCodec()`.
- Поведение CLI не меняется: путь, тело запроса, семантика `dryRun`, тексты сообщений и формат output остаются прежними.

## Capabilities

### New Capabilities

Новых capability нет.

### Modified Capabilities

- `frontend-cli`: добавляется требование о границе интеграции с backend внутри фичи CLI — use case обращается к backend только через application port, а wire-формат живёт в `data`.

## Impact

- `dsbuilder-frontend/cli`, фича `components`: `application/PushComponentsUseCase.kt` (сокращается до оркестрации), новые `application/ComponentConfigRemoteSource.kt` и `data/HttpComponentConfigRemoteSource.kt`, дополнение `domain/ComponentPackage.kt` моделями отчёта и преобразованной конфигурации, `presentation/ComponentsPushCliCommand.kt` (рендер доменной модели), `di/ComponentsFeatureModule.kt`.
- Тесты: `PushComponentsUseCaseTest` (346 строк, переписывается на fake порта), новый `HttpComponentConfigRemoteSourceTest`, `ComponentsCliCommandTest` (подменяет HTTP на уровне `CliRuntime` и изменений не требует).
- Backend, API-контракт, gateway и `.sdds` формат не затрагиваются — правки чисто внутренние для CLI.
- Зависимостей и Gradle-конфигурации change не меняет.
