## Context

`frontend-kt` сегодня содержит единственный Gradle-модуль `:cli`. Пакеты внутри него уже разложены по слоям clean architecture (`domain`, `application`, `data`, `di`, `presentation`) как для общих механизмов (`core/*`), так и для каждой CLI-фичи (`feature/{theme,docs,components,init,status}/*`). Это разделение существует только на уровне пакетов одного compilation unit: Kotlin `internal` в текущем коде означает «видимо в пределах `:cli`», и 48 из ~55 файлов бизнес-логики уже помечены `internal`.

Проверка импортов (`grep` по `import com.dsbuilder.frontend.cli.feature.*` внутри каждой фичи) показала, что фичи не зависят друг от друга — каждая импортирует только `core.*`. Проверка per-фича зависимостей от `core.*` показала неоднородность: `init` не использует `core.http`, `status` не использует `core.config`. Единственный `:cli` для этих двух фич сегодня скрывает то, что им не нужны все core-механизмы.

`presentation`-слой каждой фичи (`*CliCommand`) импортирует из `application` только use case-классы и их `*Command`/`*Result` модели (кроме `components`, где presentation дополнительно использует доменный тип `ComponentImportReport`). Порты и адаптеры внутри `application`/`data`/`domain` presentation не касается.

DI каждой фичи сегодня оформлен одним Koin-модулем (`feature/<name>/di/<Name>FeatureModule.kt`), который одновременно wire-ит use case'ы/адаптеры (business) и `*CliCommand` как `CliktCommand` (presentation) — единственное реальное место, где сегодня физически пересекаются слои, которые просит развести ADR-0004.

Тестовое покрытие сейчас неравномерное: unit-тесты есть только для `feature/components` (8 файлов) и `feature/docs` (частично, 5 файлов) плюс один тест `core/http`. `theme`, `init`, `status`, `core/config`, `core/credentials` не имеют собственных unit-тестов; единственная связанная проверка — монолитный `commonTest/.../DsBuilderCliTest.kt`, тестирующий `core.config`/`core.credentials`/`core.http` и `feature.theme.domain` в одном файле.

## Goals / Non-Goals

**Goals:**
- Разбить бизнес-логику `:cli` на отдельные Kotlin Multiplatform Gradle-модули так, чтобы направление зависимостей соответствовало clean architecture: `core-*` не знает про `feature-*`; `feature-*` не знают друг про друга; клиентские приложения (`:cli`, будущие `:mcp`/`:desktop`) знают про `feature-*`, но не наоборот.
- Сделать `:cli` тонкой presentation-оберткой: только `*CliCommand` и composition root.
- Зафиксировать правило Kotlin-видимости на новых границах модулей: `public` — только то, что реально пересекает границу; остальное остаётся `internal`, но уже в рамках нового, более узкого модуля.
- Устранить точку смешения слоёв в DI: разделить wiring бизнес-логики и wiring presentation по разным Koin-модулям и разным Gradle-модулям.
- Закрыть пробел в тестовом покрытии для `init`, `status`, `core-auth`, `core-workspace`, `core-network` до физического переноса кода, чтобы перенос был проверяем автоматически.
- Перенести все пять фич за одну итерацию/один change — не оставлять `:cli` в переходном состоянии, когда часть фич уже вынесена, а часть ещё нет.

**Non-Goals:**
- Не меняется наблюдаемое поведение CLI-команд: help-вывод, коды выхода, формат `.sdds/config.json`, тексты ошибок остаются прежними (проверяется существующими сценариями `cli-core`/`cli-themes`/`cli-components`/`frontend-cli`).
- MCP-сервер, desktop-приложение и IDE-плагины из ADR-0004 в этот change не входят — они станут будущими потребителями `feature-*`/`core-application`, но не создаются здесь.
- Не вводится новый механизм авторизации пользователя или разрешения контекста из ADR-0005 (`ContextResolver` с несколькими источниками, keychain-хранилище и т.п.) — сохраняется текущая модель `.sdds/config.json` + env credential.
- Не меняется набор CLI-команд и их аргументы.

## Decisions

### 1. Модульный граф — по слоям core + отдельный модуль на фичу

При реализации (шаги 2–4 `tasks.md`) фактический граф зависимостей между `core-domain`, `core-network`, `core-auth`, `core-workspace` оказался не таким, как предполагалось на этапе планирования: `core.http.ApiUrlResolver` (→ `core-network`) уже использовал `core.credentials.EnvironmentReader` (→ `core-auth`), а `core.credentials.ApiKeyResolver` принимал `core.config.CredentialReference` (→ `core-workspace`) только чтобы прочитать `.name`. Второе — случайная связанность: `ApiKeyResolver` не использует остальные поля `CredentialReference` (`type` всегда `ENV`), поэтому сигнатура `resolve()` изменена на `configuredEnvName: String?`, и `core-auth` перестал зависеть от `core-workspace`. Первое — реальная связанность (оба резолвера читают env-переменные через общий порт), оставлена как есть: `core-network` зависит от `core-auth`. После этой правки `core-domain` оказался не нужен ни одному из трёх core-слоёв напрямую — он используется только `core-application` и `feature-*` как словарь доменных типов (`ProjectId`, `ProjectApiKey` и т.п.), а не тремя core-слоями между собой:

```
core-domain (leaf)   core-workspace (leaf)   core-auth (leaf)
                                                    │
                                                    ▼
                                              core-network

core-domain, core-network, core-auth, core-workspace
       │                 │                 │
       └─────────────────┼─────────────────┘
                          ▼
                   core-application  (порты core/application + адаптеры core/data;
                                       зависит от всех четырёх модулей выше)
                          │
    ┌─────────┬─────────┬┴────────┬─────────┐
feature-theme feature-docs feature-components feature-init feature-status
    │         │            │                  │            │
    └─────────┴─────┬──────┴──────────────────┴────────────┘
                    :cli (presentation + composition root)
```

Альтернатива — единый `:core`-модуль без разбивки по слоям — была отклонена: `init` не использует `core.http`, `status` не использует `core.config`, и монолитный `:core` заставил бы будущий MCP/desktop клиент тянуть неиспользуемые транзитивные зависимости (HTTP-клиент туда, где нужен только доступ к файлам). Разбивка по фичам без разбивки core по слоям (вариант «один `:core`, N `:feature-*`») тоже была отклонена по той же причине.

Альтернатива — модуль на каждую пару (слой × фича), то есть `feature-theme-domain`, `feature-theme-application` и т.д. отдельными Gradle-модулями — отклонена как избыточная гранулярность: внутри фичи domain/application/data взаимно используются намного плотнее, чем core-слои между собой, а presentation фичи и так уже физически отделяется в `:cli`. `internal`-видимость внутри одного `feature-<name>`-модуля продолжает работать без дополнительных private-API ухищрений.

### 2. Правило видимости на границах модулей

`public` получают только типы, которые сегодня фактически пересекают границу «фича → presentation» или «core → фича»:
- use case-классы фичи (`FetchThemesUseCase`, `DocsPublishUseCase`, …);
- их `*Command`/`*Result` модели;
- отдельные доменные типы, которые presentation использует напрямую (пример: `ComponentImportReport` в `components`);
- всё содержимое `core-domain`, `core-network`, `core-auth`, `core-workspace`, `core-application`, что сегодня импортируется хотя бы одной фичей.

Всё остальное (`DocsCodec`, `DocsHttpClient`, `ComponentPackageLoader`, `ThemeWritePlanBuilder`, `ComponentPackageWritePlanBuilder` и другие внутренние порты/адаптеры/domain-builders фичи) остаётся `internal` — граница видимости просто сужается с «весь `:cli`» до «свой `feature-<name>`-модуль», исходного кода это не требует, требует только явного аудита при переносе файла.

Альтернатива — сделать все перенесённые типы `public` без аудита — отклонена: это превратило бы внутренние адаптеры каждой фичи в случайный публичный API, которым потом придётся поддерживать обратную совместимость для MCP/desktop, хотя они никогда не были задуманы как внешний контракт.

#### 2.1 Дополнение по код-ревью: Kotlin-видимость — не единственная граница; `api`/`implementation` в Gradle тоже часть контракта

Код-ревью после реализации нашло, что правило видимости выше учитывает только видимость Kotlin (`public`/`internal`), но не то, какие Gradle-зависимости фактически пересекают ту же границу. Публичный тип может ссылаться на тип из зависимости, объявленной как `implementation` — тогда сам тип виден, а модуль, откуда он приходит, консьюмеру не долетает: `FetchSource`/`PushTarget` в `feature-components` публично возвращают `ResolvedApiUrl` из `core-network`, а `core-network` был подключён как `implementation`. Внутри этого repo проблема не проявлялась компиляцией, потому что `:cli` уже тянет `core-network` напрямую по другой причине (composition root), и она же маскировала аналогичные утечки в `core-application` (`ClientRuntime` публично отдаёт типы всех четырёх core-слоёв), `feature-theme` (`ProjectConfigTenant` в `ThemeAliasListResult`) и `core-network` (публичные конструкторы `ApiUrlResolver`/`KtorAuthenticatedHttpClientFactory` берут `EnvironmentReader`/`HttpClient`). Каждая `*ApplicationModule()`/`coreApplicationModule()` фабрика, возвращающая `Module`, по той же причине требует `api(libs.koin.core)`, а не `implementation`.

Проверено эмпирически через `./gradlew :feature-components:dependencies --configuration commonMainApiDependenciesMetadata` — до исправления `core-network` в этом отчёте отсутствовал, после исправления (`implementation` → `api` в затронутых `build.gradle.kts`) появился. Внутренние адаптеры (`ComponentPackageLoader`, `DocsCodec` и т.п.) под это правило не попадают: их конструкторы `internal`, поэтому типы их параметров не являются частью публичной сигнатуры и `implementation` для них остаётся корректным выбором.

Правило дополнено: при добавлении зависимости в `feature-*`/`core-*` модуль нужно проверять, ссылается ли **публичная** сигнатура (публичный класс с публичным или default-конструктором, публичная функция, публичное свойство) на тип из этой зависимости. Если да — `api`, если зависимость нужна только внутри `internal`-кода или `internal`-конструктора — `implementation`.

### 3. Разделение DI фичи на application- и presentation-wiring

Каждый `feature/<name>/di/<Name>FeatureModule.kt` разбивается на два файла:
- `<Name>ApplicationModule.kt` — Koin-регистрация use case'ов и data-адаптеров, переезжает в `feature-<name>`;
- `<Name>CliPresentationModule.kt` — Koin-регистрация `*CliCommand` как `CliktCommand`, остаётся в `:cli`.

`:cli`-composition root собирает `RootCliCommand` из `*CliPresentationModule` каждой фичи, которые в свою очередь резолвят use case'ы из `*ApplicationModule` через Koin-граф. Это тот же паттерн, который ADR-0004 описывает для будущего `mcp/`: MCP получит свой аналог `*McpToolsModule`, wire-ящий те же use case'ы из `*ApplicationModule` в MCP-инструменты вместо `CliktCommand`.

### 4. Переименование `CliFileSystem` → `WorkspaceFileSystem`, `CliRuntime` → `ClientRuntime`

Оба типа физически описывают платформенный доступ к файловой системе и композицию платформенных зависимостей (`fileSystem`, `environmentReader`, `httpClientFactory`) — ни один не специфичен для terminal CLI. Переименование делается на этом же шаге (не отдельным PR позже), потому что:
- после переноса в `core-workspace`/`core-application` от них будет зависеть не только `:cli`, но и `feature-*`, и позже `:mcp`/`:desktop`; имя с «Cli» станет вводящим в заблуждение для каждого нового читателя кода;
- откладывание переименования на будущий отдельный PR означает второй проход по всем точкам использования (DI-модули пяти фич, тесты), который дешевле сделать один раз вместе с переносом файла.

Использования (реализации для JVM/macOS в `:cli/src/jvmMain`, `:cli/src/macosMain`) переименовываются синхронно.

### 5. Тесты — до переноса, не после

Для `init`, `status`, `core-auth`, `core-workspace`, `core-network` перед переносом добавляются characterization-тесты на существующее поведение (текущие use case'ы, config store, credential resolver, api url resolver). Явное решение по итогам обсуждения: перенос всей бизнес-логики делается за одну итерацию (все 5 фич сразу, не по одной), и без теста «до» у переноса «после» нет автоматической проверки, что видимость/пакет/DI поменялись, а поведение — нет.

`DsBuilderCliTest.kt` разрезается по новым границам модулей в рамках того же шага: assertions по `core.config`/`core.credentials`/`core.http` переезжают в тесты `core-workspace`/`core-auth`/`core-network`, assertions по `feature.theme.domain` — в тесты `feature-theme`. Само по себе разрезание не добавляет новых assertions сверх уже существующих в этом файле — новое покрытие даёт отдельно шаг с characterization-тестами.

### 6. Правила модульного графа фиксируются в `frontend-kt/AGENTS.md`, а не только в `frontend-kt/cli/AGENTS.md`

Сегодня единственный источник архитектурных правил для Kotlin-frontend — `frontend-kt/cli/AGENTS.md`, и корневой `AGENTS.md` указывает на него напрямую (`AGENTS.md:15`). Этот файл прямо предвидел текущую ситуацию: «если появится несколько frontend-приложений или общий runtime-код, выделение нового модуля должно быть оформлено отдельным design decision» — и требует, чтобы после такого решения структура была задокументирована.

Проблема: после переноса `core-*` и `feature-*` становятся Gradle-модулями, соседними с `:cli`, а не пакетами внутри него. `frontend-kt/cli/AGENTS.md` физически лежит внутри `cli/` — он не предок по дереву каталогов для `core-domain`, `feature-theme` и остальных новых модулей. Если оставить архитектурные правила только там, агент, работающий в `core-domain` или `feature-theme`, никогда их не увидит — файл лежит не на пути от корня репозитория до открытого файла.

Решение: создать `frontend-kt/AGENTS.md` на уровне `frontend-kt/` (предок всех модулей — `:cli`, всех `core-*`, всех `feature-*`), перенести туда модульный граф, правило направления зависимостей и правило видимости из этого change (то же содержание, что в `specs/frontend-core-modules/spec.md`, но в императивной AGENTS-форме). `frontend-kt/cli/AGENTS.md` сохраняется, но сужается до правил, специфичных для `:cli` как presentation-слоя (структура `*CliCommand`, composition root, entrypoint) и ссылается на `frontend-kt/AGENTS.md` вместо дублирования модульного графа. Корневой `AGENTS.md` меняет ссылку с `frontend-kt/cli/AGENTS.md` на `frontend-kt/AGENTS.md`.

Альтернатива — обновить только `frontend-kt/cli/AGENTS.md` на месте — отклонена по причине выше: она не решает задачу «агент всегда об этом знает» для новых модулей, только для `:cli`.

Альтернатива — продублировать правила модульного графа в `AGENTS.md` каждого нового модуля (`core-domain/AGENTS.md`, `feature-theme/AGENTS.md`, …) — отклонена: правило одно и то же для всех модулей, дублирование в 10 файлах создаёт 10 точек рассинхронизации при следующем изменении графа.

## Risks / Trade-offs

- **[Риск] Перенос всех пяти фич в одной итерации увеличивает размер review и время до мержа по сравнению с перефичевым rollout.** → Митигация: порядок задач в `tasks.md` линейный и checkpoint-ируемый (core-слои → core-application → все feature-* → тонкий `:cli`), каждый шаг компилируется и проходит тесты независимо, что позволяет останавливаться на любой границе, если потребуется, не оставляя код в неконсистентном состоянии дольше одного шага.
- **[Риск] Массовая правка `internal` → `public` без дисциплины превращает границу модуля в решето.** → Митигация: правило видимости из Decision 2 применяется по чек-листу «что импортирует presentation сегодня» для каждой фичи отдельно, а не глобальным find-replace.
- **[Риск] Переименование `CliFileSystem`/`CliRuntime` затрагивает файлы во всех пяти DI-модулей и в `jvmMain`/`macosMain` источниках `:cli` одновременно.** → Митигация: переименование делается через IDE rename (а не текстовый find-replace) сразу после физического переноса типа в `core-workspace`/`core-application`, чтобы компилятор подсвечивал все точки использования.
- **[Риск] Разрезание `DsBuilderCliTest.kt` может незаметно потерять часть assertions при копировании в новые файлы.** → Митигация: подсчёт количества `@Test`-функций до и после разрезания должен совпадать; задача в `tasks.md` явно требует эту проверку.
- **[Trade-off] `core-application` зависит от всех трёх core-слоёв (`core-network`, `core-auth`, `core-workspace`) сразу, то есть любая фича, использующая хотя бы один порт `core-application`, транзитивно получает все три.** Признано приемлемым: сегодня все фичи, использующие `core.application`, и так используют минимум два из трёх core-слоёв (см. таблицу зависимостей фич в контексте), реальной экономии от более тонкого разделения `core-application` нет, а сложность графа зависимостей выросла бы без practical benefit.

## Migration Plan

Пошаговый план — в `tasks.md`. Кратко: characterization-тесты → `core-domain` → `core-network`/`core-auth`/`core-workspace` параллельно → `core-application` → пять `feature-*` модулей → `:cli` становится тонким → обновление `openspec`-спек. Каждый шаг оставляет `frontend-kt` в компилируемом и проходящем тесты состоянии — отдельного отката на уровне production не требуется, поскольку это внутренний рефакторинг Gradle-модулей без пользовательских побочных эффектов; откат при необходимости — `git revert` соответствующих коммитов шага.

## Open Questions

- Нужно ли вводить отдельный `core-testing` модуль с общими test-fixtures (`InMemoryCliFileSystem`/`TestCliFileSystem` сегодня дублируются в `feature/components` и `feature/docs`) — решается в момент разрезания тестов, если дублирование фикстур станет заметным после переноса.
- Финальное имя для `CliRuntime` (`ClientRuntime` vs `PlatformRuntime` vs `HostRuntime`) — зафиксировать в момент реализации шага 3, любое из них не блокирует остальной план.
