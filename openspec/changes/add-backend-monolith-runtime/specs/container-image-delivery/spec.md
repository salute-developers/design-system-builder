# Доставка монолитного backend

## MODIFIED Requirements

### Requirement: Полный набор production-образов
Workflow MUST собирать и публиковать образы `backend`, `keycloak` и `keycloak-bootstrap` из соответствующих production Dockerfile репозитория. Образы `projects-service`, `auth-helper`, `documentation-service`, `ds-service`, `gateway`, `generator`, `publisher`, `documentation-generator` и `db-service` MUST NOT собираться и публиковаться.

#### Scenario: Успешная сборка набора
- **WHEN** все три production Dockerfile успешно собираются для выбранного commit
- **THEN** registry MUST содержать все три образа с тегами, определёнными политикой выбранной ветки

#### Scenario: Ошибка одного образа
- **WHEN** сборка или push хотя бы одного из трёх образов завершается ошибкой
- **THEN** workflow MUST завершиться неуспешно и MUST NOT вызывать Coolify deploy webhook

#### Scenario: Удалённые сервисы не публикуются
- **WHEN** workflow строит матрицу образов
- **THEN** матрица MUST NOT содержать `generator`, `publisher`, `documentation-generator` и `db-service`

### Requirement: Image-only production compose
`docker-compose.prod.yml` MUST запускать монолитный `backend` и необходимую внешнюю инфраструктуру из `${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/<image>:${IMAGE_TAG}` и MUST NOT требовать checkout исходников или локальный Docker build.

#### Scenario: DEV compose deployment
- **WHEN** Coolify разворачивает compose с `IMAGE_TAG=dev`
- **THEN** все сервисы с образами из registry MUST использовать соответствующие registry images с тегом `dev`

#### Scenario: PROD compose deployment
- **WHEN** Coolify разворачивает compose с `IMAGE_TAG=release`
- **THEN** все сервисы с образами из registry MUST использовать соответствующие registry images с тегом `release`

#### Scenario: Обновление mutable tag
- **WHEN** Coolify повторно разворачивает compose после изменения manifest за существующим `IMAGE_TAG`
- **THEN** Compose MUST проверить registry и запустить контейнеры из актуальных manifests

#### Scenario: Gateway без удалённых сервисов
- **WHEN** Coolify разворачивает compose
- **THEN** compose MUST NOT содержать сервисы `projects-service`, `auth-helper`, `documentation-service`, `ds-service`, `gateway`, `generator`, `publisher` и `docs-generator` и том `docs_output`
- **THEN** единственный прикладной сервис `backend` MUST запускаться без nginx и внутренних HTTP upstream отдельных приложений

### Requirement: Отсутствие host port conflicts
Production compose MUST оставлять backend-компоненты внутренними и предоставлять публичный доступ через назначенный Coolify domain компонента `backend` на порту `8080` без фиксированного host port.

#### Scenario: DEV и PROD на одном server
- **WHEN** DEV и PROD resource развернуты на одном Coolify server
- **THEN** их compose stacks MUST запускаться без конфликта фиксированных host ports

### Requirement: Запуск Coolify deployment из CI
После успешной публикации полного набора workflow MUST вызвать authenticated deploy webhook DEV для ветки `dev` или PROD для ветки `master` с `force=false`.

#### Scenario: Успешная DEV-публикация
- **WHEN** все три образа с тегом `dev` успешно опубликованы
- **THEN** workflow MUST вызвать `COOLIFY_DEV_WEBHOOK` с Bearer token

#### Scenario: Успешная PROD-публикация
- **WHEN** все три образа с versioned-тегом и alias `release` успешно опубликованы
- **THEN** workflow MUST вызвать `COOLIFY_PROD_WEBHOOK` с Bearer token

#### Scenario: Coolify отклоняет запрос
- **WHEN** deploy webhook возвращает неуспешный HTTP status
- **THEN** deploy job и весь workflow MUST завершиться неуспешно
