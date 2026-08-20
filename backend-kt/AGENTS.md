# AGENTS.md

## О проекте

`backend-kt` - Kotlin/Gradle mono-repo для микросервисов DS Builder, конструктора дизайн-систем.

Проект ориентирован на сервисы, которые помогают собирать, валидировать, публиковать и обслуживать артефакты дизайн-систем: токены, темы, пакеты, документацию и связанные build/publish workflow.

## Структура

- `identity-gateway/` - edge/gateway сервис для аутентификации и авторизации запросов.
  - `app/` - Auth Helper приложение, конфигурация, DI и Docker-файлы.
  - `feature-auth/` - бизнес-логика проверки JWT, user-scoped и project-scoped authorization.
  - `gateway/` - nginx конфигурация публичной точки входа.
- `projects-service/` - микросервис управления проектами, участниками и project access rules.
  - `app/` - Ktor-приложение, application config, DI bootstrap и Docker-файлы.
  - `feature-projects/` - бизнес-фича проектов: presentation, application, domain, data и di.
  - `core/` - общая инфраструктура сервиса.
- `project-publisher/` - микросервис публикации проектов и артефактов.
  - `app/` - Ktor-приложение, конфигурация, DI, HTTP/WebSocket routing, Docker-файлы.
  - `feature-publish/` - бизнес-фича публикации: presentation, application, domain, data.
  - `core/` - общая инфраструктура сервиса.
- `build-system/` - composite build с Gradle conventions, detekt/spotless настройками и кастомными правилами.
- `openspec/` - OpenSpec change proposals, design/spec artifacts и repo-level config для spec-driven разработки.
- `gradle/libs.versions.toml` - общий version catalog.

## Правила для агентов

- Сохраняй архитектурные границы: `presentation -> application -> domain`, инфраструктура живет в `data`, DI - в `di`.
- Не протаскивай Ktor, Exposed, Docker и внешние SDK в domain/application без явной необходимости.
- Новую бизнес-логику сначала выражай через domain-модели, use case и port-интерфейсы; реализации подключай отдельно.
- Для новых микросервисов повторяй существующий подход: отдельный included build или модульная структура с `app`, `feature-*`. Если в одном микросервисе несколько `feature-*` модулей используют общий код, создавай `core` модуль и клади общий код туда.
- Предпочитай явные DTO/request/response модели на границах API, не отдавай domain/entity напрямую наружу.
- Не коммить секреты, локальные токены, реальные credentials и приватные URL. Для конфигурации используй env/application config.
- Перед крупными изменениями проверь Gradle conventions в `build-system/`.
- Пиши KDoc для публичных классов, функций и свойств на русском языке. Сохраняйте идентификаторы, пути к эндпоинтам, ключи конфигурации и устоявшиеся технические термины на английском там, где это необходимо.

## Команды

Из корня репозитория:

```bash
./gradlew build
```

Для конкретного сервиса:

```bash
cd <service>
./gradlew build
./gradlew detekt 
./gradlew spotlessCheck
./gradlew test
./gradlew spotlessApply

```

Если менялись Gradle conventions или detekt-правила:

```bash
cd build-system
./gradlew build
```

## Стиль разработки

- Язык: Kotlin.
- Build: Gradle Kotlin DSL.
- Форматирование и статический анализ держи совместимыми с `build-system`.
- Имена пакетов держи в пространстве `com.dsbuilder`.
- Тесты добавляй рядом с изменяемой логикой, особенно для use case, mapper и repository/local source поведения.
- Для каждого production микросервиса должен быть добавлен Dockerfile и docker-compose.yml или docker-compose.local.yml для локального запуска.
- Docker/config файлы должны использовать env/application config и не содержать секретов.
- Перед финалом проверяй измененный сервис через `./gradlew build` или релевантные `detekt`, `spotlessCheck`, `test`.
- Если `spotlessCheck` падает из-за форматирования измененных файлов, запускай `spotlessApply`, проверяй diff и повторяй проверки.


## Контекст продукта

DS Builder - это конструктор дизайн-систем. При проектировании API и моделей учитывай, что основными сущностями могут быть дизайн-токены, темы, компоненты, версии, артефакты публикации, пайплайны сборки и интеграции с репозиториями/пакетными registry.
