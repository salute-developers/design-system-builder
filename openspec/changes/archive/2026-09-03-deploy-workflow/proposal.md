## Why

Текущий production deployment собирает Kotlin и JavaScript сервисы непосредственно на сервере из `docker-compose.prod.yml`, а рабочей схемы публикации и доставки готовых образов через registry нет. Нужен простой воспроизводимый ручной release flow, в котором GitHub Actions собирает образы выбранной ветки, публикует их в GitHub Container Registry (GHCR) организации и после успешной публикации запускает соответствующий deployment в Coolify.

## What Changes

- Добавить ручной GitHub Actions workflow для веток `dev` и `master`.
- Для `dev` публиковать десять backend/infra образов с перезаписываемым тегом `dev` и запускать DEV deployment в Coolify.
- Для `master` требовать тег формата `release_*`, публиковать каждый образ одновременно с versioned-тегом и перезаписываемым тегом `release`, затем запускать PROD deployment в Coolify.
- Собирать и публиковать `projects-service`, `auth-helper`, `documentation-service`, `db-service`, `generator`, `publisher`, `documentation-generator`, `gateway`, `keycloak` и `keycloak-bootstrap`.
- Сериализовать публикации одной ветки и не вызывать Coolify, если хотя бы один образ не собран или не опубликован.
- **BREAKING** Перевести `docker-compose.prod.yml` с локальных `build:` на образы из registry и исключить `admin` и `client`, которые продолжают публиковаться существующими frontend workflow в S3.
- Настроить два Coolify resource на один compose: DEV использует `IMAGE_TAG=dev`, PROD использует `IMAGE_TAG=release`; оба deployment получают обновления через authenticated webhook.
- Использовать встроенный `GITHUB_TOKEN` для публикации в GHCR и отдельный read-only PAT classic с `read:packages` только для загрузки приватных образов deployment-сервером Coolify.

## Capabilities

### New Capabilities

- `container-image-delivery`: Ручная сборка, тегирование, публикация и доставка набора production-образов DS Builder через GHCR и Coolify.

### Modified Capabilities

- Нет.

## Impact

- GitHub Actions: новый workflow публикации образов и вызова Coolify deploy webhook.
- Deployment: корневой `docker-compose.prod.yml`, `.env.prod.example`, `deploy.sh` и документация production deployment.
- Kotlin backend: Dockerfile образов `identity-gateway`, `projects-service` и `documentation-service`; бизнес-API и persistence не меняются.
- JavaScript: Dockerfile четырёх backend-сервисов; `js/apps/client` и `js/apps/admin` исключаются из Docker Compose, но их S3 deployment не меняется.
- Infrastructure: организация и private container packages в GHCR, два Coolify resource, read-only GHCR credential и Coolify API token/webhook secrets.
- `frontend-kt` и экспериментальный `backend-kt/project-publisher` не затрагиваются.
