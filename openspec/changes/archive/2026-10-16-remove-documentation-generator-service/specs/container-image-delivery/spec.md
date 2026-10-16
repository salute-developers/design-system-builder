## MODIFIED Requirements

### Requirement: Полный набор production-образов
Workflow MUST собирать и публиковать образы `projects-service`, `auth-helper`, `documentation-service`, `ds-service`, `db-service`, `gateway`, `keycloak` и `keycloak-bootstrap` из соответствующих production Dockerfile репозитория. Образы `generator`, `publisher` и `documentation-generator` MUST NOT собираться и публиковаться.

#### Scenario: Успешная сборка набора
- **WHEN** все восемь production Dockerfile успешно собираются для выбранного commit
- **THEN** registry MUST содержать все восемь образов с тегами, определёнными политикой выбранной ветки

#### Scenario: Ошибка одного образа
- **WHEN** сборка или push хотя бы одного из восьми образов завершается ошибкой
- **THEN** workflow MUST завершиться неуспешно и MUST NOT вызывать Coolify deploy webhook

#### Scenario: Удалённые сервисы не публикуются
- **WHEN** workflow строит матрицу образов
- **THEN** матрица MUST NOT содержать `generator`, `publisher` и `documentation-generator`

### Requirement: Image-only production compose
`docker-compose.prod.yml` MUST запускать восемь production-сервисов из `${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/<image>:${IMAGE_TAG}` и MUST NOT требовать checkout исходников или локальный Docker build.

#### Scenario: DEV compose deployment
- **WHEN** Coolify разворачивает compose с `IMAGE_TAG=dev`
- **THEN** все восемь сервисов MUST использовать соответствующие registry images с тегом `dev`

#### Scenario: PROD compose deployment
- **WHEN** Coolify разворачивает compose с `IMAGE_TAG=release`
- **THEN** все восемь сервисов MUST использовать соответствующие registry images с тегом `release`

#### Scenario: Обновление mutable tag
- **WHEN** Coolify повторно разворачивает compose после изменения manifest за существующим `IMAGE_TAG`
- **THEN** Compose MUST проверить registry и запустить контейнеры из актуальных manifests

#### Scenario: Gateway без удалённых сервисов
- **WHEN** Coolify разворачивает compose
- **THEN** compose MUST NOT содержать сервисы `generator`, `publisher` и `docs-generator` и том `docs_output`
- **THEN** `gateway` MUST запускаться без переменных `GENERATOR_SERVICE_UPSTREAM_*`, `PUBLISHER_SERVICE_UPSTREAM_*` и `DOCS_SERVICE_UPSTREAM_*`

### Requirement: Запуск Coolify deployment из CI
После успешной публикации полного набора workflow MUST вызвать authenticated deploy webhook DEV для ветки `dev` или PROD для ветки `master` с `force=false`.

#### Scenario: Успешная DEV-публикация
- **WHEN** все восемь образов с тегом `dev` успешно опубликованы
- **THEN** workflow MUST вызвать `COOLIFY_DEV_WEBHOOK` с Bearer token

#### Scenario: Успешная PROD-публикация
- **WHEN** все восемь образов с versioned-тегом и alias `release` успешно опубликованы
- **THEN** workflow MUST вызвать `COOLIFY_PROD_WEBHOOK` с Bearer token

#### Scenario: Coolify отклоняет запрос
- **WHEN** deploy webhook возвращает неуспешный HTTP status
- **THEN** deploy job и весь workflow MUST завершиться неуспешно
