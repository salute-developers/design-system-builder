# Projects Service

`projects-service` - микросервис управления проектами DS Builder, их участниками и project-level access rules.

Сервис хранит:

- проекты и их метаданные;
- `ownerUserId` проекта;
- участников проекта с ролями `maintainer`, `editor`, `viewer`;
- project-bound access keys для CLI и интеграций;
- internal access-check API для `identity-gateway` / `auth-helper`.

## Структура

- `app/` - Ktor entrypoint, application config и Docker image.
- `feature-projects/` - project CRUD, members, role policy, persistence и HTTP routes.
- `core/` - общая инфраструктура сервиса.

## Основные возможности

- `POST /projects` - создать проект.
- `GET /projects` - получить список проектов пользователя.
- `GET /projects/{projectId}` - получить проект по id.
- `PATCH /projects/{projectId}` - обновить имя или описание.
- `POST /projects/{projectId}/archive` - архивировать проект.
- `POST /projects/{projectId}/restore` - восстановить проект.
- `GET /projects/{projectId}/members` - получить участников проекта.
- `POST /projects/{projectId}/members` - добавить участника по `email` зарегистрированного Keycloak user.
- `PATCH /projects/{projectId}/members/{userId}` - изменить роль участника.
- `DELETE /projects/{projectId}/members/{userId}` - удалить участника.
- `GET /projects/{projectId}/access-keys` - получить metadata project access keys без raw secret.
- `POST /projects/{projectId}/access-keys` - создать project access key и вернуть raw secret только один раз.
- `DELETE /projects/{projectId}/access-keys/{keyId}` - отозвать project access key.

Internal API:

- `GET /internal/projects/{projectId}/access-check` - вернуть effective role пользователя в проекте.
- `POST /internal/access-keys/verify` - проверить project access key для `identity-gateway`.

## Ролевая модель

- `owner` хранится в самом проекте через `ownerUserId` и не записывается в `project_members`.
- `members` содержат только роли `maintainer`, `editor`, `viewer`.
- `system_admin` получает effective access как `owner`.

## Access Keys

- Access key принадлежит одному проекту и не привязан к membership конкретного пользователя.
- В audit context сохраняется `createdByUserId`.
- Raw secret возвращается только в ответе создания и не хранится в БД.
- В persistence хранится только hash секрета.
- Key может быть отозван через revoke endpoint.
- По умолчанию key получает срок жизни 30 дней, но при создании можно передать любой `ttlSeconds > 0`.

### Scopes

- User authorization остается role-based: `owner`, `maintainer`, `editor`, `viewer`.
- Project access key authorization использует scope-based модель.
- Допустимые scope задаются через `projects.accessKeys.availableScopes` в application config.
- Сейчас для самой сущности `projects` доступен только `projects:read`.
- Machine actor не может изменять metadata проекта, архивировать/восстанавливать проект и не может управлять участниками проекта.

Примеры доступных scope:

- `projects:read`
- `members:read`
- `design-systems:read`
- `design-systems:write`
- `design-systems:delete`
- `components:variations:read`
- `components:variations:write`
- `components:variations:delete`

### Использование через Gateway

- Для project-scoped запросов access key передается в `Authorization`.
- Поддерживаются форматы `Authorization: ProjectKey <token>` и `Authorization: <token>`.
- После internal verify `identity-gateway` прокидывает downstream trusted headers, включая `X-Actor-Type: project_key`, `X-Project-Id`, `X-Project-Key-Id` и `X-Project-Scopes`.

## Конфигурация

Основные env-переменные:

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `PROJECTS_SERVICE_PORT` | `8082` | HTTP порт сервиса |
| `PROJECTS_DATABASE_URL` | `jdbc:postgresql://localhost:5434/projects_service` | JDBC URL PostgreSQL |
| `PROJECTS_POSTGRES_USER` | `projects` | Пользователь БД |
| `PROJECTS_POSTGRES_PASSWORD` | `projects` | Пароль БД |
| `PROJECTS_INTERNAL_API_KEY` | `local-projects-internal-key` | Shared key для internal access-check |
| `PROJECTS_ACCESS_KEYS_PREFIX` | `dsb_pk` | Префикс project access key |
| `PROJECTS_ACCESS_KEYS_DEFAULT_TTL_MS` | `2592000000` | TTL project access key по умолчанию, 30 дней |
| `PROJECTS_ACCESS_KEYS_SECRET_BYTE_LENGTH` | `32` | Размер случайного секрета access key |
| `PROJECTS_ACCESS_KEYS_HASH_ITERATIONS` | `120000` | PBKDF2 iterations для hash секрета |
| `PROJECTS_ACCESS_KEYS_HASH_KEY_LENGTH_BITS` | `256` | Длина hash ключа для PBKDF2 |
| `PROJECTS_ACCESS_KEYS_HASH_SALT_BYTE_LENGTH` | `16` | Размер salt для hash секрета |
| `PROJECTS_IDENTITY_KEYCLOAK_BASE_URL` | `http://localhost:8090` | Base URL Keycloak Admin API для lookup пользователя по email |
| `PROJECTS_IDENTITY_KEYCLOAK_REALM` | `dsbuilder` | Realm для identity lookup |
| `PROJECTS_IDENTITY_KEYCLOAK_CLIENT_ID` | `projects-service` | Confidential client для service-account lookup |
| `PROJECTS_IDENTITY_KEYCLOAK_CLIENT_SECRET` | `projects-service-secret` | Secret confidential client для lookup |
| `PROJECTS_IDENTITY_KEYCLOAK_TIMEOUT_MS` | `1500` | Timeout запросов к Keycloak Admin API |

Список допустимых scope задается в [application.yaml](./app/src/main/resources/application.yaml) через `projects.accessKeys.availableScopes`.

## Локальный запуск

Standalone запуск нужен в основном для разработки самого сервиса. Для end-to-end auth flow обычно достаточно запускать `identity-gateway`, потому что он уже поднимает встроенный `projects-service` в своём compose stack.

Важно: email-based add-member требует доступ к Keycloak Admin API. В standalone режиме нужно либо поднять совместимый local Keycloak, либо передать корректные `PROJECTS_IDENTITY_KEYCLOAK_*` env-переменные вручную.

Запуск shared local stack:

```bash
./start-local.sh --detach
```

Остановка:

```bash
./start-local.sh --down
```

Полезные опции:

```bash
./start-local.sh --build-only
./start-local.sh --logs
./start-local.sh --no-build --detach
```

После старта доступны:

| URL | Назначение |
| --- | --- |
| `http://localhost:8082/health` | Healthcheck сервиса |
| `http://localhost:5434` | PostgreSQL порт локальной БД |

## Production docker-compose

Для production используется общий корневой [docker-compose.prod.yml](../../docker-compose.prod.yml) и безопасный шаблон переменных [`.env.prod.example`](../../.env.prod.example).

Что важно:

- реальные секреты не хранятся в compose-файле и не должны коммититься в git;
- production stack поднимает `projects-service` как часть общего `identity-gateway` deployment stack;
- `projects-service` использует внешнюю PostgreSQL через `PROJECTS_DATABASE_URL`;
- образ `projects-service` собирается с `build.context: ./backend-kt`, чтобы Dockerfile видел общие Gradle build files;
- сервис слушает только внутреннюю docker-сеть через `expose` и публикуется наружу через `identity-gateway`.

Пример запуска на сервере:

```bash
cp .env.prod.example .env.prod
docker compose --env-file .env.prod -f docker-compose.prod.yml up --build -d
```

Если `projects-service` работает за `identity-gateway`, держите одинаковое значение `PROJECTS_INTERNAL_API_KEY` во всем общем production stack.

## Проверка

```bash
./gradlew build
./gradlew test
./gradlew detekt
./gradlew spotlessCheck
```

Или из корня репозитория:

```bash
./gradlew -p projects-service build
```

## Интеграция с Identity Gateway

- `identity-gateway` использует `GET /internal/projects/{projectId}/access-check` как source of truth для project-scoped authorization.
- `identity-gateway` использует `POST /internal/access-keys/verify` как source of truth для project access key verification.
- В локальном compose `auth-helper` передаёт `X-Internal-Api-Key`.
- Scope для `project_key` вычисляются в `projects-service` и передаются gateway в verify response; gateway сам их не расширяет.
- Для `POST /projects/{projectId}/members` по `email` `projects-service` делает lookup зарегистрированного пользователя в Keycloak Admin API и сохраняет membership по stable `userId`.
- Internal endpoint не должен публиковаться наружу как отдельный public contract.
