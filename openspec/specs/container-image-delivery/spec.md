# container-image-delivery Specification

## Purpose
TBD - created by archiving change deploy-workflow. Update Purpose after archive.
## Requirements
### Requirement: Ручной запуск публикации из разрешённой ветки
Система MUST предоставлять ручной GitHub Actions workflow, который использует выбранный в GitHub ref и допускает публикацию только из веток `dev` и `master`.

#### Scenario: Запуск из dev
- **WHEN** оператор вручную запускает workflow для ветки `dev` без release-тега
- **THEN** система принимает запуск и выбирает deployment tag `dev`

#### Scenario: Запуск из master
- **WHEN** оператор вручную запускает workflow для ветки `master` с валидным тегом `release_*`
- **THEN** система принимает запуск и выбирает deployment tag `release` и указанный versioned-тег

#### Scenario: Запрещённая ветка
- **WHEN** оператор запускает workflow для ветки, отличной от `dev` и `master`
- **THEN** система MUST завершить workflow до авторизации в registry и публикации образов

### Requirement: Валидация release-тега
Система MUST принимать release-тег только для ветки `master`, а значение MUST соответствовать шаблону `^release_[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$`.

#### Scenario: Master без release-тега
- **WHEN** workflow запущен для `master` без `release_tag`
- **THEN** система MUST завершить workflow с понятным сообщением о необходимости release-тега

#### Scenario: Некорректный release-тег
- **WHEN** workflow запущен для `master` с тегом, который не соответствует шаблону `release_*`
- **THEN** система MUST завершить workflow до публикации образов

#### Scenario: Release-тег передан для dev
- **WHEN** workflow запущен для `dev` с непустым `release_tag`
- **THEN** система MUST завершить workflow до публикации образов

### Requirement: Полный набор production-образов
Workflow MUST собирать и публиковать образы `projects-service`, `auth-helper`, `documentation-service`, `db-service`, `generator`, `publisher`, `documentation-generator`, `gateway`, `keycloak` и `keycloak-bootstrap` из соответствующих production Dockerfile репозитория.

#### Scenario: Успешная сборка набора
- **WHEN** все десять production Dockerfile успешно собираются для выбранного commit
- **THEN** registry MUST содержать все десять образов с тегами, определёнными политикой выбранной ветки

#### Scenario: Ошибка одного образа
- **WHEN** сборка или push хотя бы одного из десяти образов завершается ошибкой
- **THEN** workflow MUST завершиться неуспешно и MUST NOT вызывать Coolify deploy webhook

### Requirement: Политика тегов dev
При запуске из `dev` workflow MUST публиковать каждый образ с единственным перезаписываемым тегом `dev`.

#### Scenario: Повторная DEV-публикация
- **WHEN** новый успешный workflow из `dev` публикует образ, у которого тег `dev` уже существует
- **THEN** тег `dev` MUST указывать на manifest нового образа без создания commit-specific тега

### Requirement: Политика тегов master
При запуске из `master` workflow MUST публиковать каждый образ одновременно с введённым тегом `release_*` и перезаписываемым alias `release`.

#### Scenario: Новый production release
- **WHEN** workflow из `master` запущен с `release_tag=release_1.4.0`
- **THEN** теги `release_1.4.0` и `release` каждого образа MUST указывать на один digest собранного образа

#### Scenario: Повторная публикация release-тега
- **WHEN** workflow повторно публикует существующий тег `release_*`
- **THEN** существующий versioned-тег и alias `release` MUST быть передвинуты на новый manifest

### Requirement: Сериализация публикаций
Система MUST предотвращать одновременную публикацию двух workflow из одной ветки и MUST NOT отменять уже выполняющийся push в пользу нового запуска.

#### Scenario: Повторный запуск для занятой ветки
- **WHEN** второй workflow запускается для ветки, публикация которой ещё выполняется
- **THEN** второй workflow MUST ожидать завершения первого

### Requirement: Image-only production compose
`docker-compose.prod.yml` MUST запускать десять production-сервисов из `${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/<image>:${IMAGE_TAG}` и MUST NOT требовать checkout исходников или локальный Docker build.

#### Scenario: DEV compose deployment
- **WHEN** Coolify разворачивает compose с `IMAGE_TAG=dev`
- **THEN** все десять сервисов MUST использовать соответствующие registry images с тегом `dev`

#### Scenario: PROD compose deployment
- **WHEN** Coolify разворачивает compose с `IMAGE_TAG=release`
- **THEN** все десять сервисов MUST использовать соответствующие registry images с тегом `release`

#### Scenario: Обновление mutable tag
- **WHEN** Coolify повторно разворачивает compose после изменения manifest за существующим `IMAGE_TAG`
- **THEN** Compose MUST проверить registry и запустить контейнеры из актуальных manifests

### Requirement: Разделение frontend и backend deployment
Production compose MUST исключать `admin` и `client`, а существующие S3 frontend deployment workflow MUST оставаться независимыми от публикации backend/infra образов.

#### Scenario: Разбор production compose
- **WHEN** Coolify загружает `docker-compose.prod.yml`
- **THEN** compose MUST NOT создавать компоненты `admin` и `client`

### Requirement: Отсутствие host port conflicts
Production compose MUST оставлять backend-компоненты внутренними и предоставлять публичный доступ через назначенный Coolify domain компонента `gateway` на порту `8080` без фиксированного host port.

#### Scenario: DEV и PROD на одном server
- **WHEN** DEV и PROD resource развернуты на одном Coolify server
- **THEN** их compose stacks MUST запускаться без конфликта фиксированных host ports

### Requirement: Запуск Coolify deployment из CI
После успешной публикации полного набора workflow MUST вызвать authenticated deploy webhook DEV для ветки `dev` или PROD для ветки `master` с `force=false`.

#### Scenario: Успешная DEV-публикация
- **WHEN** все десять образов с тегом `dev` успешно опубликованы
- **THEN** workflow MUST вызвать `COOLIFY_DEV_WEBHOOK` с Bearer token

#### Scenario: Успешная PROD-публикация
- **WHEN** все десять образов с versioned-тегом и alias `release` успешно опубликованы
- **THEN** workflow MUST вызвать `COOLIFY_PROD_WEBHOOK` с Bearer token

#### Scenario: Coolify отклоняет запрос
- **WHEN** deploy webhook возвращает неуспешный HTTP status
- **THEN** deploy job и весь workflow MUST завершиться неуспешно

### Requirement: Безопасная конфигурация GHCR и Coolify
Workflow MUST публиковать private container packages в GHCR встроенным `GITHUB_TOKEN` с минимальными permissions `contents: read` и `packages: write`. Coolify integration MUST использовать HTTPS и authentication, а PAT, tokens и webhook URLs MUST не попадать в git или workflow logs.

#### Scenario: Авторизация публикации
- **WHEN** matrix job публикует образ
- **THEN** она MUST авторизоваться в `ghcr.io` как `github.actor` встроенным `GITHUB_TOKEN`

#### Scenario: Авторизация pull на deployment server
- **WHEN** Coolify загружает приватный образ из GHCR
- **THEN** Docker daemon MUST использовать credential с минимальным scope `read:packages`, настроенный для системного пользователя Coolify server

#### Scenario: Авторизация deployment
- **WHEN** deploy job вызывает Coolify
- **THEN** он MUST получать deploy-only Bearer token и webhook URL из GitHub Secrets

### Requirement: Операционная документация GHCR
Production deployment documentation MUST описывать GHCR namespace и package permissions, публикацию через `GITHUB_TOKEN`, создание read-only PAT classic и авторизацию deployment server.

#### Scenario: Подготовка нового deployment server
- **WHEN** оператор следует production deployment documentation
- **THEN** он MUST получить проверяемый путь от создания `read:packages` credential до успешного pull приватного GHCR-образа на Coolify server

