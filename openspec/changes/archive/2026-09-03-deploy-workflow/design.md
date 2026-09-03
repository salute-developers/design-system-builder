## Context

Корневой `docker-compose.prod.yml` сейчас описывает двенадцать локально собираемых контейнеров и рассчитан на checkout исходников на deployment server. Два frontend-приложения уже имеют отдельные GitHub Actions workflow, которые собирают статику с environment-specific `VITE_*` и публикуют её в S3. Kotlin `project-publisher` остаётся экспериментальным и в общий production compose не входит.

Целевой контур использует GitHub-hosted runner для сборки, GHCR как границу доставки и два Coolify resource для DEV и PROD. Решение должно оставаться ручным и простым: без временных тегов, promotion pipeline, изменения Coolify variables через API и автоматического rollback.

## Goals / Non-Goals

**Goals:**

- Собирать и публиковать один согласованный набор из десяти backend/infra образов выбранной ветки.
- Поддержать перезаписываемый DEV-тег `dev`, versioned PROD-тег `release_*` и перезаписываемый PROD alias `release`.
- Автоматически запускать нужный Coolify deployment только после успешной публикации всего набора.
- Сделать `docker-compose.prod.yml` image-only источником конфигурации для обоих Coolify resource.
- Исключить конфликт host ports при размещении DEV и PROD на одном Coolify server.

**Non-Goals:**

- Перенос `js/apps/client` и `js/apps/admin` с S3 в Docker Registry.
- Публикация `backend-kt/project-publisher` или `frontend-kt`.
- Полностью атомарная promotion всех образов, автоматический rollback и ожидание финального Coolify health status из CI.
- Multi-platform сборка; первая версия ориентируется на `linux/amd64`.
- Изменение бизнес-API, persistence или runtime-конфигурации приложений.

## Decisions

### 1. Один ручной workflow и штатный выбор Git ref

Workflow запускается только через `workflow_dispatch`. Пользователь выбирает ветку штатным GitHub dropdown; отдельный input ветки не вводится. Workflow принимает необязательный `release_tag` и на шаге подготовки разрешает только две комбинации:

- `dev` и пустой `release_tag`: deployment tag равен `dev`;
- `master` и `release_tag`, соответствующий `^release_[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$`: deployment tag равен `release`, versioned tag равен введённому значению.

Другие ветки и сочетания завершаются до входа в GHCR. Публикации сериализуются concurrency group по `github.ref_name` с `cancel-in-progress: false`.

Альтернатива с отдельным branch input отклонена как дублирующая стандартный UI GitHub и допускающая рассинхронизацию input с фактически checkout-нутым ref.

### 2. Статическая matrix из десяти образов

Matrix хранит `image`, `context` и `file` для следующих образов:

| Image | Context | Dockerfile |
|---|---|---|
| `keycloak` | `backend-kt` | `identity-gateway/keycloak/Dockerfile` |
| `keycloak-bootstrap` | `backend-kt` | `identity-gateway/keycloak/Dockerfile.bootstrap` |
| `gateway` | `backend-kt` | `identity-gateway/gateway/Dockerfile` |
| `auth-helper` | `backend-kt` | `identity-gateway/app/Dockerfile` |
| `projects-service` | `backend-kt` | `projects-service/app/Dockerfile` |
| `documentation-service` | `backend-kt` | `documentation-service/app/Dockerfile` |
| `db-service` | `js/services/db-service` | `Dockerfile` |
| `generator` | `js/services/generator` | `Dockerfile` |
| `publisher` | `js/services/publisher` | `Dockerfile` |
| `documentation-generator` | `js/services/documentation-generator` | `Dockerfile` |

Каждая matrix job выполняет checkout, настраивает Buildx, авторизуется в `ghcr.io` встроенным `GITHUB_TOKEN` и делает build/push. Workflow получает `packages: write`, а namespace вычисляет из lowercase `github.repository_owner`. Существующие multi-stage Kotlin Dockerfile сами запускают Gradle; отдельная host-сборка jar не добавляется. GitHub Actions Buildx cache разделяется по имени образа.

Kotlin Dockerfile не используют общие writable BuildKit cache mounts для Gradle. Они создавали неактуальную связь между параллельными локальными сборками через `sharing=locked`, тогда как GitHub matrix jobs выполняются на изолированных runners и используют внешний Buildx cache. Gradle запускается с `--no-daemon` без отдельного `GRADLE_USER_HOME`, `--project-cache-dir` и `--build-cache`.

`gateway`, `keycloak` и `keycloak-bootstrap` включены, потому что их Dockerfile добавляют repository-owned nginx, realm и bootstrap artifacts поверх внешних base images. Публичные base images отдельно не зеркалируются.

### 3. Mutable deployment tags без дополнительных SHA-тегов

DEV build публикует только `ghcr.io/<organization>/${image}:dev`. PROD build одной операцией публикует `${image}:release_<version>` и `${image}:release`; оба тега указывают на один digest. Повторная публикация одинакового тега разрешена и передвигает его на новый manifest.

Постоянные SHA-теги не создаются, чтобы не увеличивать каталог DEV-версий. Source commit и итоговый digest остаются в GitHub Actions log/summary и OCI labels.

Альтернатива с immutable release tags отклонена, поскольку согласованное операционное правило допускает повторную публикацию того же `release_*`. Цена решения — невозможность считать имя release-тега неизменяемым идентификатором без сверки digest.

### 4. Прямой push и deployment gate

Matrix jobs публикуют теги напрямую. Отдельные candidate tags и promotion job не используются. Coolify deploy job имеет dependency на всю matrix и поэтому не запускается после частичного failure.

Это не обеспечивает транзакционность GHCR: после частичного failure некоторые теги уже могут обновиться. Запущенный stack при этом не меняется; оператор повторно запускает весь workflow. Сериализация по ветке предотвращает смешивание двух параллельных публикаций одного deployment alias.

### 5. Image-only production compose

Из `docker-compose.prod.yml` удаляются `admin` и `client`, а у оставшихся десяти сервисов `build:` заменяется на:

```yaml
image: ${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/<image>:${IMAGE_TAG}
pull_policy: always
```

Compose сохраняет environment, volumes, healthcheck и dependency graph. Host `ports:` для `gateway` и Keycloak admin заменяются на внутренний `expose`, чтобы DEV и PROD могли работать на одном сервере без port collision. Публичный домен назначается компоненту `gateway` в Coolify на внутренний порт `8080`; Keycloak admin остаётся доступен через gateway route `/admin/`.

`deploy.sh` и production документация переводятся с build-oriented поведения на validate, pull и start готовых образов. Health check выполняется внутри compose network/container, а не через обязательный host port.

Альтернатива с отдельным `docker-compose.coolify.yml` отклонена, потому что существующий production deployment не работает и не требует обратной совместимости.

### 6. Два Coolify resource с фиксированными alias

DEV и PROD используют один compose, но разные variables:

| Resource | `IMAGE_TAG` | Webhook |
|---|---|---|
| DEV | `dev` | `COOLIFY_DEV_WEBHOOK` |
| PROD | `release` | `COOLIFY_PROD_WEBHOOK` |

После успешной matrix workflow вызывает выбранный authenticated deploy webhook с deploy-only Bearer token и `force=false`. `pull_policy: always` заставляет deployment проверить mutable tags и загрузить только отсутствующие content-addressed layers. Workflow считает успешным сам запрос постановки deployment в очередь и не опрашивает финальный статус Coolify.

Альтернатива с обновлением `IMAGE_TAG` через Coolify API отклонена: она требует write-доступа к environment variables и усложняет credentials. PROD alias `release` позволяет сохранить deploy-only token.

### 7. GHCR как внешний deployment boundary

Образы публикуются как private container packages `ghcr.io/<organization>/<image>`. GitHub Actions использует встроенный `GITHUB_TOKEN` с `packages: write`, поэтому отдельные push credentials в secrets не нужны. OCI label `org.opencontainers.image.source` связывает packages с репозиторием и его permissions.

Docker daemon deployment server заранее выполняет `docker login ghcr.io` под тем же системным пользователем, которого Coolify использует для Docker. Для pull используется отдельный PAT classic технического или выделенного пользователя с минимальным scope `read:packages`; token не передаётся workflow и не хранится в репозитории.

Self-hosted registry отклонён как лишняя операционная инфраструктура: он требует собственного HTTPS endpoint, persistent storage, backup, мониторинг диска и garbage collection. Действующая политика бесплатного GHCR может измениться, поэтому GitHub billing и usage следует периодически проверять.

## Risks / Trade-offs

- [Частично обновлённые теги после failure matrix] → Не вызывать Coolify до полного успеха, сериализовать workflow и повторять весь запуск после сбоя.
- [Повторная публикация `release_*` меняет содержимое именованного релиза] → Сохранять commit и digest в GitHub Actions summary и осознанно применять принятую mutable policy.
- [Mutable tag остаётся локально закэшированным] → Использовать `pull_policy: always` и запускать deployment только после успешного push.
- [Компрометация GHCR PAT или Coolify credentials] → Выдать PAT только `read:packages`, хранить его лишь в Docker credential store deployment server и использовать Coolify token с deploy-only permission.
- [Изменение бесплатной политики GHCR или рост Actions usage] → Контролировать GitHub billing/usage и вернуться к внешнему registry отдельным change при необходимости.
- [GitHub-hosted runner не достигает Coolify] → Coolify webhook должен быть доступен runner по HTTPS; иначе потребуется отдельное сетевое решение вне scope.
- [Текущие JS Dockerfile используют development-oriented команды] → Workflow публикует существующее runtime-поведение без его рефакторинга; production hardening остаётся отдельным change.

## Migration Plan

1. Доставить workflow в default branch и убедиться, что organization разрешает публикацию container packages из репозитория.
2. Создать read-only PAT classic с `read:packages`, выполнить `docker login ghcr.io` на deployment server и проверить pull приватного образа.
3. Добавить Coolify secrets в GitHub, задать GHCR host/namespace в Coolify и создать DEV и PROD resource из обновлённого `docker-compose.prod.yml` с gateway domains и environment variables.
4. Запустить workflow из `dev`, проверить публикацию десяти `:dev` образов и DEV webhook deployment.
5. Запустить workflow из `master` с тестовым `release_*`, проверить versioned tags, alias `release` и PROD deployment.
6. После подтверждения health удалить неиспользуемый self-hosted Registry resource и старые локально собранные deployment containers/images только отдельной контролируемой операцией.

Rollback выполняется повторным присвоением `dev` или `release` нужным ранее сохранённым digest в GHCR и повторным вызовом deployment webhook. Если старая package version уже удалена, требуется повторная сборка соответствующего Git commit.

## Open Questions

- Конкретный lowercase organization namespace и UUID Coolify resource задаются инфраструктурой при реализации и не фиксируются в git.
- Владелец и срок действия read-only PAT classic определяются организационной политикой GitHub.
