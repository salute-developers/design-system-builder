# Deploy production stack

Production deployment использует готовые Docker images из GitHub Container Registry (GHCR). GitHub Actions собирает и публикует образы вручную, после чего вызывает deploy webhook нужного Coolify resource. Coolify не собирает исходники на deployment server.

## Состав stack

Корневой [docker-compose.prod.yml](../docker-compose.prod.yml) запускает десять backend/infra компонентов:

- `gateway`;
- `keycloak` и одноразовый `keycloak-bootstrap`;
- `auth-helper`;
- `projects-service`;
- `documentation-service`;
- `db-service`;
- `generator`;
- `publisher`;
- `docs-generator` из образа `documentation-generator`.

`admin` и `client` не входят в production compose. Их статика продолжает собираться отдельными frontend workflow и публиковаться в S3. Экспериментальный `project-publisher` также не входит в этот deployment.

Снаружи через Coolify proxy публикуется только `gateway` на внутреннем порту `8080`. Остальные компоненты доступны по service-name DNS внутри compose network. Keycloak admin console проксируется gateway по `/admin/`.

## Tag policy

Workflow [publish-backend-images.yml](../.github/workflows/publish-backend-images.yml) запускается вручную через GitHub Actions.

Для ветки `dev` поле `release_tag` оставляют пустым. Каждый образ публикуется с mutable-тегом `dev`.

Для ветки `master` обязателен тег формата `release_1.4.0`. Каждый образ получает одновременно versioned-тег и mutable alias:

```text
release_1.4.0
release
```

Одинаковые теги разрешено перезаписывать. PROD Coolify resource всегда использует alias `release`, поэтому workflow не меняет Coolify environment variables между релизами.

## GitHub permissions и Secrets

Workflow публикует в `ghcr.io/<lowercase-repository-owner>/<image>` и вычисляет namespace из `github.repository_owner`. Отдельные registry Variables, username и password для push не нужны. Workflow использует встроенный `GITHUB_TOKEN` с permissions:

```yaml
contents: read
packages: write
```

Repository Secrets:

```text
COOLIFY_TOKEN
COOLIFY_DEV_WEBHOOK
COOLIFY_PROD_WEBHOOK
```

`COOLIFY_TOKEN` должен иметь только deploy permission. Deploy webhook копируется из Configuration → Webhooks соответствующего Coolify resource и должен содержать `force=false`.

## GHCR

1. Доставьте workflow в default branch GitHub и в обе запускаемые ветки `master`/`dev`.
2. Убедитесь, что organization policy разрешает workflow создавать container packages.
3. Первый успешный push создаст десять packages. Проверьте, что они private, связаны с исходным repository через OCI label и наследуют нужные permissions.
4. Создайте для deployment server PAT classic отдельного технического или выделенного пользователя с минимальным scope `read:packages`. `write:packages`, `delete:packages` и `repo` для pull не нужны. Если organization использует SSO, авторизуйте token для неё.
5. Авторизуйте Docker daemon deployment server тем же системным пользователем, которого Coolify использует для Docker:

```bash
printf '%s' "$GHCR_READ_TOKEN" | \
  docker login ghcr.io \
  --username "$GHCR_USERNAME" \
  --password-stdin
```

6. После первой публикации проверьте pull непосредственно с deployment server:

```bash
docker pull ghcr.io/<organization>/gateway:dev
```

PAT хранится в Docker credential store deployment server, а не в репозитории или GitHub Actions Secrets. Задайте срок действия и процедуру ротации согласно политике организации. Self-hosted Registry для этого deployment не требуется.

## Coolify resources

Создайте два Docker Compose resource из одного репозитория и файла `/docker-compose.prod.yml`.

DEV:

```text
Branch: dev
REGISTRY_HOST=ghcr.io
REGISTRY_NAMESPACE=<lowercase-github-organization>
IMAGE_TAG=dev
```

PROD:

```text
Branch: master
REGISTRY_HOST=ghcr.io
REGISTRY_NAMESPACE=<lowercase-github-organization>
IMAGE_TAG=release
```

В каждом resource:

1. Заполните остальные variables из корневого `.env.prod.example` отдельными значениями окружения.
2. Назначьте публичный domain только компоненту `gateway`, указав внутренний порт `8080`.
3. Не добавляйте фиксированные host ports.
4. Убедитесь, что deployment server может выполнить `docker pull` приватного образа.
5. Скопируйте authenticated deploy webhook в соответствующий GitHub Secret.

DEV и PROD могут работать на одном server: compose не резервирует фиксированные host ports, а Coolify создаёт отдельную network для каждого resource.

## Ручной запуск workflow

DEV:

1. Откройте GitHub Actions → Publish backend images → Run workflow.
2. Выберите branch `dev`.
3. Оставьте `release_tag` пустым.
4. Запустите workflow.

PROD:

1. Выберите branch `master`.
2. Укажите `release_tag`, например `release_1.4.0`.
3. Запустите workflow.

Workflow собирает matrix из десяти образов для `linux/amd64`. Coolify webhook вызывается только после успешного завершения всей matrix. Успешный webhook response означает, что deployment поставлен в очередь; финальный status и health проверяются в Coolify.

## Локальная проверка compose

Создайте `.env.prod` на основе примера и выполните:

```bash
cp .env.prod.example .env.prod
./deploy.sh --check
```

Если машина авторизована в registry, готовые образы можно подтянуть и запустить:

```bash
./deploy.sh
```

Скрипт валидирует compose, выполняет `docker compose pull`, запускает stack и проверяет `/health` внутри контейнера gateway. Логи:

```bash
./deploy.sh --logs
```

## Ошибки публикации и rollback

Matrix публикует образы напрямую. Если один build/push завершился ошибкой, часть тегов уже может указывать на новый commit, но Coolify webhook не вызывается и работающий stack не меняется. После исправления причины повторно запускайте весь workflow, а не отдельный failed job.

Workflow сериализован по ветке и не допускает одновременную публикацию двух наборов `dev` или двух наборов `release`.

GitHub Actions summary сохраняет commit и digest каждого успешно опубликованного образа. Поскольку `dev`, `release` и даже одинаковый `release_*` являются mutable, для расследования и rollback сверяйте именно digest.

Для rollback переместите alias `dev` или `release` на ранее сохранённые digests и повторно вызовите Coolify deploy webhook. Если старая GHCR package version уже удалена, пересоберите соответствующий Git commit и опубликуйте alias заново.

## Runtime configuration

Минимально проверьте:

- публичные `OIDC_*`, `KEYCLOAK_ISSUER`, `KEYCLOAK_AUDIENCE` и `KC_HOSTNAME`;
- bootstrap admin и PostgreSQL-настройки Keycloak;
- `PROJECTS_DATABASE_URL`, credentials и `PROJECTS_INTERNAL_API_KEY`;
- PostgreSQL URL для `db-service` и `documentation-service`;
- S3 credentials отдельно для Kotlin `documentation-service` и JS `docs-generator`.

`KEYCLOAK_ISSUER` должен совпадать с публичным issuer URL. Внутренние адреса сервисов уже заданы через compose service-name DNS. Не включайте для stack опцию Coolify `Connect to Predefined Network`, иначе одинаковые service names разных environments окажутся в общей сети и начнут конфликтовать. Реальные `.env`, GHCR PAT, Coolify tokens и webhook URLs не должны попадать в git или логи.
