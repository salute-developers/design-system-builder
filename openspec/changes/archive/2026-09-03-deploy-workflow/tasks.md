## 1. GitHub Actions workflow

- [x] 1.1 Добавить ручной workflow с `workflow_dispatch`, необязательным `release_tag`, проверкой веток `dev`/`master`, валидацией шаблона `release_*` и вычислением deployment/versioned tags.
- [x] 1.2 Добавить concurrency group по выбранной ветке с `cancel-in-progress: false` и минимальными permissions `contents: read`, `packages: write`.
- [x] 1.3 Добавить Buildx matrix для десяти согласованных образов с корректными build contexts и production Dockerfile.
- [x] 1.4 Настроить GHCR login через `github.actor`/`GITHUB_TOKEN`, lowercase organization namespace, `linux/amd64`, раздельный GitHub Actions cache scope и OCI labels с repository и source commit.
- [x] 1.5 Настроить публикацию единственного тега `dev` для ветки `dev` и двух тегов `release_*`/`release` на один digest для ветки `master` без SHA-тегов.
- [x] 1.6 Добавить зависимый от всей matrix deploy job, который выбирает `COOLIFY_DEV_WEBHOOK` или `COOLIFY_PROD_WEBHOOK`, вызывает его с deploy-only Bearer token и `force=false`, а при неуспешном HTTP status завершает workflow с ошибкой.
- [x] 1.7 Удалить общие Gradle BuildKit cache mounts и `sharing=locked` из production Kotlin Dockerfile, оставив изолированные matrix builds и внешний Buildx cache workflow.

## 2. Registry-based production compose

- [x] 2.1 Заменить все десять `build:` в `docker-compose.prod.yml` на `${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/<image>:${IMAGE_TAG}` и добавить `pull_policy: always`.
- [x] 2.2 Удалить компоненты `admin` и `client` из production compose, не меняя существующие S3 frontend workflow.
- [x] 2.3 Убрать фиксированные host ports gateway и Keycloak admin, оставить внутренние порты через `expose` и сохранить доступ к Keycloak admin через gateway `/admin/`.
- [x] 2.4 Сохранить существующие environment variables, healthchecks, volume `docs_output` и dependency graph десяти backend/infra компонентов.
- [x] 2.5 Обновить `.env.prod.example`: добавить `REGISTRY_HOST`, `REGISTRY_NAMESPACE` и `IMAGE_TAG`, удалить переменные, использовавшиеся только исключёнными frontend-контейнерами, и не добавлять реальные credentials.
- [x] 2.6 Перевести `deploy.sh` с локальной сборки на validate, pull и запуск готовых образов; адаптировать health check к отсутствию обязательного host port.

## 3. Deployment documentation

- [x] 3.1 Обновить `backend-kt/DEPLOY.md` под image-only compose: описать tag policy, GHCR permissions, read-only PAT, `docker login`, DEV/PROD resource и webhook flow.
- [x] 3.2 Обновить корневой `README.md`, чтобы production architecture отражала S3 deployment `admin`/`client` и Coolify deployment десяти backend/infra образов.
- [x] 3.3 Документировать частичный push failure, правило повторного запуска всего workflow, mutable release tags, сохранение commit/digest в CI и ограничения rollback после удаления GHCR package versions.

## 4. Automated verification

- [x] 4.1 Проверить синтаксис workflow статическим валидатором GitHub Actions и сценарии подготовки для `dev`, валидного `master release_*`, отсутствующего/невалидного release-тега и запрещённой ветки.
- [x] 4.2 Провалидировать `docker-compose.prod.yml` через `docker compose config` для наборов `IMAGE_TAG=dev` и `IMAGE_TAG=release`, убедиться в отсутствии `build`, `admin`, `client` и фиксированных host ports.
- [x] 4.3 Собрать все десять production Dockerfile для `linux/amd64` и проверить, что имена образов и build contexts matrix совпадают с compose.
- [x] 4.4 Выполнить `cd backend-kt && ./gradlew build` и `cd js && npm run build`.
- [x] 4.5 Выполнить `openspec validate --change deploy-workflow` и устранить все ошибки артефактов.
