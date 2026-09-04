# DS Builder CLI Architecture

Этот документ описывает общие требования к архитектуре приложения DS Builder CLI.

Архитектура отдельных фичей должна описываться в их собственных файлах. Здесь фиксируются только общие правила: назначение CLI, структура модуля, слои, зависимости между слоями, работа с внешними интеграциями и подход к build-логике.

## Назначение приложения

`dsbuilder` — CLI entrypoint для автоматизации операций над дизайн-системами.

CLI должен быть пригоден для локального запуска разработчиком и для запуска в CI/CD. Основные будущие сценарии:

- валидация дизайн-токенов, тем, компонентов и метаданных проекта;
- сборка артефактов дизайн-системы;
- публикация артефактов в backend DS Builder, package registry или другое внешнее хранилище;
- работа с проектными настройками, access keys и локальным контекстом;
- запуск repeatable workflow без интерактивной desktop UI.

CLI не является production microservice: он не открывает HTTP-порт, не имеет Docker runtime как обязательной части запуска и не должен требовать backend services, credentials или приватные URL для baseline-команд вроде help/version/smoke output.

## Общий подход

Проект должен следовать упрощенной Clean Architecture:

- `domain` содержит бизнес-модели, правила и port-интерфейсы фичи;
- `data` отвечает за источники данных, внешние интеграции и реализацию port-интерфейсов;
- `presentation` содержит CLI command surface: разбор команд/аргументов, форматирование output, mapping ошибок в exit code и user-facing сообщения;
- platform-specific entrypoint должен быть тонким и делегировать выполнение в общий CLI application surface;
- внешние инструменты, файловая система, backend API, package registries и process API должны быть скрыты за интерфейсами, datasource или gateway-классами.

Архитектура должна оставаться простой. Дополнительные слои, абстракции и shared-framework код добавляются только тогда, когда они реально уменьшают связность, упрощают тестирование или убирают meaningful duplication.

## Gradle и модульная структура

`frontend-kt` является отдельным Gradle build с одним активным Kotlin Multiplatform модулем:

```text
frontend-kt/
  cli/
    src/
      commonMain/
      commonTest/
      jvmMain/
      jvmTest/
  build.gradle.kts
  settings.gradle.kts
```

Активный frontend build должен включать только `:cli`.

CLI не многомодульный: все фичи живут внутри модуля `:cli` в отдельных package. Фича не должна оформляться отдельным Gradle module только ради структуры. Если позже появится несколько frontend-приложений или общий runtime-код, выделение нового модуля должно быть оформлено отдельным design decision.

## Структура CLI модуля

Базовая структура пакетов:

```text
cli/
  src/
    commonMain/
      kotlin/
        com/dsbuilder/frontend/cli/
          app/
          core/
          feature/<featureName>/
            data/
            domain/
            presentation/
    commonTest/
      kotlin/
        com/dsbuilder/frontend/cli/
          feature/<featureName>/
    jvmMain/
      kotlin/
        com/dsbuilder/frontend/cli/
          Main.kt
```

Роли верхнеуровневых пакетов:

- `app` — общий CLI application surface, top-level command registry, composition root, dependency wiring и запуск use cases;
- `core` — небольшие общие контракты, result/error модели, abstractions для clock/dispatching/files/process/config, если они используются несколькими фичами;
- `feature.<feature-name>` — изолированная фича с собственными `data`, `domain` и `presentation`;
- `jvmMain` — JVM entrypoint и platform-specific adapters, которые нельзя держать в `commonMain`.

`core` не должен становиться свалкой для кода "на будущее". Класс переносится в `core` только после появления реального переиспользования или стабильного cross-feature contract.

## Feature package

Каждая фича должна жить в отдельном package внутри `:cli`:

```text
com.dsbuilder.frontend.cli.feature.validate
com.dsbuilder.frontend.cli.feature.build
com.dsbuilder.frontend.cli.feature.publish
com.dsbuilder.frontend.cli.feature.config
```

Имена фичей могут уточняться, но принцип должен сохраняться: одна продуктовая capability — один feature package с явными слоями.

### Domain

Пакет `domain` содержит бизнес-логику фичи:

- domain entities и value objects;
- command/query модели, если они выражают бизнес-намерение, а не CLI syntax;
- use cases;
- repository/port interfaces;
- доменные ошибки и результат выполнения, если они относятся к бизнес-логике.

`domain` не должен зависеть от `data`, `presentation`, CLI parsing libraries, файловой системы, HTTP clients, Process API, SQLDelight или JVM-only API.

### Data

Пакет `data` содержит реализацию доступа к данным и внешним интеграциям:

- реализации port-интерфейсов из `domain`;
- datasource или gateway для файловой системы;
- datasource или gateway для локального config/storage;
- API clients для backend DS Builder;
- adapters для package registry, git, shell, Docker или других внешних процессов;
- mapping между external/storage моделями и domain-моделями.
- Для сетевого взаимодействия использовать Ktor client

Основной паттерн доступа к данным — port + adapter/repository. Data-слой должен скрывать детали хранения, сетевых вызовов и внешних инструментов от `domain` и `presentation`.

### Presentation

Пакет `presentation` содержит CLI boundary фичи:

- описание команд, subcommands, options и arguments;
- parsing/validation CLI input на уровне синтаксиса;
- mapping CLI input в domain command/use case input;
- formatting stdout/stderr;
- mapping domain/data ошибок в user-facing сообщения и exit codes;
- help text, если он локален для фичи.

Presentation-слой вызывает use cases из `domain`, но не обращается напрямую к HTTP clients, файловой системе, локальной БД, Docker, shell или Process API.

CLI output должен быть предсказуемым и тестируемым. Для машинно-читаемых режимов формат output должен быть стабильным и описан в spec фичи.

## Направление зависимостей

Зависимости внутри фичи должны идти к `domain`:

```text
presentation -> domain <- data
```

Разрешено:

- `presentation` зависит от `domain`;
- `data` зависит от `domain`;
- `app` зависит от `presentation`, `domain` и `data` фичей для command registration и wiring;
- фича зависит от `core`, если это общие стабильные контракты или инфраструктура.

Не разрешено:

- `domain` зависит от `data` или `presentation`;
- `presentation` напрямую зависит от external implementation;
- одна фича напрямую использует внутренние `data` или `presentation` классы другой фичи;
- общая бизнес-логика живет в `app`;
- JVM-only API попадает в `commonMain` без expect/actual или отдельного adapter.

Если фичам нужно взаимодействовать, связь должна идти через общий contract/API, shared domain model в `core` или app-level orchestration, а не через импорт внутренних классов другой фичи.

## Entrypoint и Composition Root

`jvmMain` должен содержать минимальный entrypoint:

- принять raw CLI arguments;
- создать platform-specific adapters, если они нужны;
- вызвать общий application surface из `commonMain`;
- напечатать stdout/stderr;
- завершиться с корректным exit code.

Composition root должен находиться в `app` или рядом с entrypoint, но бизнес-логика фичей не должна жить в composition root. DI framework не обязателен: для CLI допустима явная сборка зависимостей обычными фабриками, пока это остается читаемым и тестируемым.

## Локальный контекст и хранение данных

Локальное хранение добавляется только для данных, которые должны сохраняться между запусками:

- выбранный проект или рабочая директория;
- endpoint/profile настройки;
- metadata о credentials/access keys без хранения секретов в открытом виде;
- cache remote metadata, если он ускоряет CLI и имеет понятную invalidation strategy;
- история запусков, если это нужно продукту.

Требования:

- domain-модели не должны быть storage-моделями;
- доступ к storage должен быть скрыт за datasource/repository;
- mapping между storage и domain должен находиться в `data`;
- секреты не должны попадать в репозиторий, логи, stack traces или debug output;
- формат и location локального config/storage должны быть описаны в spec фичи до реализации.

SQLDelight не является обязательным baseline для CLI. Его можно добавить отдельным решением, если появится устойчивый локальный relational state и миграции будут дешевле, чем file-based config/cache.

## Внешние инструменты и процессы

Интеграции с shell, Docker, git, package managers, registries, backend API и файловой системой должны быть изолированы.

Требования:

- запуск внешних процессов не должен происходить из presentation command handler напрямую;
- параметры запуска должны формироваться через domain/use case или dedicated command builder, пригодный для тестирования;
- stdout/stderr, exit code, progress и состояние выполнения должны приходить в presentation как явно смоделированный result/state;
- ошибки внешних инструментов должны преобразовываться в понятные domain или CLI errors;
- детали команд должны быть покрыты тестами на уровне формирования команды и обработки результата;
- long-running operations должны поддерживать понятное поведение при отмене, interrupted process и partial failure.

## Build-system и convention plugins

CLI должен использовать Gradle conventions из `build-system`.

Для Kotlin Multiplatform CLI baseline используется convention plugin, который:

- применяет Kotlin Multiplatform;
- настраивает JVM target для запуска `dsbuilder`;
- подключает Detekt и Spotless;
- подключает `kotlin.test` для shared tests;
- не добавляет Exposed, Docker, Compose Desktop или внешние SDK без явной необходимости фичи.

Если меняются Gradle conventions, нужно проверять `build-system` отдельно.

## Тестирование

Минимальные ожидания:

- use cases тестируются unit-тестами;
- command parsing и mapping CLI input в domain input покрываются тестами;
- formatting stdout/stderr и exit codes покрываются тестами для важных сценариев;
- repository/adapter implementations тестируются на mapping, ошибки и работу с datasource;
- process/API integrations тестируются через fake process runner, fake API client или contract tests;
- baseline CLI behavior должен оставаться deterministic и не требовать backend services, Docker, credentials или private URLs.

Интеграционные тесты с реальными внешними инструментами можно добавлять точечно и отделять от быстрых unit-тестов, если они требуют окружение.
