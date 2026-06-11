# Deploy Identity Gateway

Инструкция описывает простой production deployment для сценария, где сервер держит checkout репозитория и поднимает stack напрямую через `docker compose`.

## Что поднимается

Production stack из [docker-compose.prod.yml](./docker-compose.prod.yml) включает:

- `gateway` - публичный nginx entrypoint;
- `keycloak` - встроенный identity provider;
- `auth-helper` - internal auth service;
- `projects-service` - внутренний downstream service;

Снаружи публикуется только порт `gateway`.
Keycloak admin console доступна через gateway по `/admin/`.
Прямой порт Keycloak по умолчанию привязан к `127.0.0.1`; при необходимости его можно открыть наружу через `KEYCLOAK_ADMIN_BIND` и `KEYCLOAK_ADMIN_PORT`.

Локальный конфиг [identity-gateway/gateway/nginx.local.conf](/Users/alex/IdeaProjects/design-system-builder-kt/identity-gateway/gateway/nginx.local.conf) в production не используется. Для production gateway генерирует конфиг из [identity-gateway/gateway/nginx.prod.conf.template](/Users/alex/IdeaProjects/design-system-builder-kt/identity-gateway/gateway/nginx.prod.conf.template) и переменных окружения.

## Требования к серверу

- установлен Docker с поддержкой `docker compose`;
- сервер умеет делать `git pull` вашего репозитория;
- для `keycloak` и `projects-service` уже созданы внешние PostgreSQL базы;
- `db-service` опубликован на том же сервере только в localhost, например `127.0.0.1:3008:3008`;
- домен и reverse proxy/TLS, если production должен работать по `https`.
- production compose должен запускаться из корня checkout репозитория, чтобы Docker build context корректно включал и `identity-gateway`, и `projects-service`.

Keycloak в этом production stack поднимается вместе с остальными сервисами, поэтому отдельный внешний Keycloak для базового деплоя не требуется.

## Подготовка

1. Клонируйте репозиторий на сервер.
2. Перейдите в корень checkout репозитория.
3. Создайте production env-файл на основе шаблона:

```bash
cp .env.prod.example .env.prod
```

4. Заполните `.env.prod`.

Файл `.env.prod` не должен попадать в git.
Если deployment идет через внешнюю платформу, реальные значения обычно задаются в ее переменных окружения, а `.env.prod.example` остается шаблоном и документацией.

Для удобного rollout можно использовать [deploy.sh](./deploy.sh).

## Deploy Bundle

Для локального запуска без полного checkout можно собрать минимальный bundle архив на базе [docker-compose.local.yml](./docker-compose.local.yml):

```bash
./build-deploy-bundle.sh
```

Если fat jar уже собраны и нужно только переупаковать bundle:

```bash
./build-deploy-bundle.sh --skip-build
```

Готовый архив появится по пути:

```bash
build/distributions/identity-gateway-deploy.tar.gz
```

Внутри архива лежат:

- `docker-compose.local.yml`
- `start-local.sh`
- `deploy.sh`
- `DEPLOY.md`
- `identity-gateway/.env.local`
- `identity-gateway/.env.local.example`
- `identity-gateway/app/Dockerfile.local`
- `identity-gateway/app/build/libs/app-all.jar`
- `identity-gateway/gateway/nginx.local.conf`
- `identity-gateway/keycloak/dsbuilder-realm.json`
- `projects-service/app/Dockerfile.local`
- `projects-service/app/build/libs/app-all.jar`

Внутри bundle `deploy.sh` запускает `start-local.sh --no-build --detach`: Gradle-проект не пересобирается, Docker-образы собираются из уже вложенных `app-all.jar`.

Локально достаточно:

```bash
tar -xzf identity-gateway-deploy.tar.gz
cd identity-gateway-deploy
./deploy.sh
```

## Что заполнить в `.env.prod`

Минимально проверьте и задайте:

- `GATEWAY_PORT` - публичный порт nginx на сервере;
- `GATEWAY_PROXY_TIMEOUT_SECONDS` - timeout в секундах для ожидания ответа и передачи request body между nginx gateway и upstream-сервисами;
- `KEYCLOAK_ADMIN_BIND` и `KEYCLOAK_ADMIN_PORT` - bind address и порт прямого доступа к Keycloak admin console; по умолчанию прямой доступ доступен только с сервера, а публичный доступ идет через gateway `/admin/`;
- `DB_SERVICE_UPSTREAM_SCHEME`, `DB_SERVICE_UPSTREAM_HOST` и `DB_SERVICE_UPSTREAM_PORT` - адрес `db-service`, доступный из контейнера `gateway`; для same-host deployment это обычно `http://host.docker.internal:3008`, а для обращения через публичный Coolify domain - `https://<domain>:443`;
- `DOCS_SERVICE_UPSTREAM_SCHEME`, `DOCS_SERVICE_UPSTREAM_HOST` и `DOCS_SERVICE_UPSTREAM_PORT` - адрес `docs-service`, доступный из контейнера `gateway`;
- `GENERATOR_SERVICE_UPSTREAM_SCHEME`, `GENERATOR_SERVICE_UPSTREAM_HOST` и `GENERATOR_SERVICE_UPSTREAM_PORT` - адрес `generator-service`, доступный из контейнера `gateway`;
- `PUBLISHER_SERVICE_UPSTREAM_SCHEME`, `PUBLISHER_SERVICE_UPSTREAM_HOST` и `PUBLISHER_SERVICE_UPSTREAM_PORT` - адрес `publisher-service`, доступный из контейнера `gateway`;
- `KEYCLOAK_UPSTREAM_HOST` и `KEYCLOAK_UPSTREAM_PORT` - адрес Keycloak, доступный из контейнера `gateway`;
- `KEYCLOAK_ADMIN` и `KEYCLOAK_ADMIN_PASSWORD` - bootstrap admin credentials Keycloak;
- `KEYCLOAK_POSTGRES_DB`, `KEYCLOAK_POSTGRES_USER`, `KEYCLOAK_POSTGRES_PASSWORD` - credentials внешней PostgreSQL для Keycloak;
- `KC_DB`, `KC_DB_URL_HOST`, `KC_DB_URL_PORT` - подключение Keycloak к внешней PostgreSQL;
- `KEYCLOAK_REALM` - realm, например `dsbuilder`;
- `OIDC_CLIENT_ID` - client для login flow;
- `OIDC_WEB_ORIGIN` - origin frontend приложения, например `https://app.example.com`;
- `OIDC_REDIRECT_URI` - production redirect URI без `localhost`, например `https://app.example.com/auth/callback`;
- `KEYCLOAK_ISSUER` - публичный issuer URL;
- `KEYCLOAK_JWKS_URL` - публичный JWKS URL;
- `KEYCLOAK_AUDIENCE` - expected audience JWT;
- `PROJECTS_INTERNAL_API_KEY` - длинный случайный shared key для `auth-helper -> projects-service`;
- `PROJECTS_POSTGRES_DB`, `PROJECTS_POSTGRES_USER`, `PROJECTS_POSTGRES_PASSWORD` - credentials внешней PostgreSQL для `projects-service`;
- `PROJECTS_IDENTITY_KEYCLOAK_BASE_URL` - base URL Keycloak Admin API для `projects-service`;
- `PROJECTS_IDENTITY_KEYCLOAK_CLIENT_ID` и `PROJECTS_IDENTITY_KEYCLOAK_CLIENT_SECRET` - confidential client для lookup пользователей.

Важно:

- `KEYCLOAK_ISSUER` должен соответствовать публичному issuer URL, который увидит клиент;
- `KEYCLOAK_JWKS_URL` в текущем stack может указывать на внутренний URL `keycloak`, чтобы не гонять backend-трафик наружу;
- `db-service` должен быть опубликован именно на `127.0.0.1`, а не на внешнем IP сервера;
- `KEYCLOAK_UPSTREAM_HOST` должен резолвиться именно из контейнера nginx;
- `KC_DB_URL_DATABASE`, `KC_DB_USERNAME` и `KC_DB_PASSWORD` выводятся автоматически из `KEYCLOAK_POSTGRES_*`;
- `PROJECTS_DATABASE_URL` должен указывать на внешнюю PostgreSQL `projects-service`;
- `OIDC_REDIRECT_URI` должен быть разрешен в настройках client в Keycloak.
- production bootstrap отключает self-registration, email verification и password reset через email в Keycloak realm;
- production user profile не требует `email`, `firstName` и `lastName`: вручную созданному пользователю достаточно `username` и `password`.

## Dummy db-service для проверки routing

Для ручной проверки nginx routing можно поднять отдельный тестовый compose:

```bash
docker compose -f docker-compose.db-service-test.yml up -d
```

Файл [docker-compose.db-service-test.yml](/Users/alex/IdeaProjects/design-system-builder-kt/docker-compose.db-service-test.yml) поднимает dummy `db-service`, который:

- публикуется только на `127.0.0.1:3008`;
- доступен для `gateway` через `host.docker.internal:3008`;
- отвечает echo JSON, где видно path, method и headers после rewrite/proxy.

Это удобно и локально, и для двух отдельных docker-compose приложений на одном сервере, если `db-service` тоже публикуется только в localhost.

## Первый запуск

Из корня checkout репозитория:

```bash
./deploy.sh
```

Что делает команда:

- валидирует `docker-compose.prod.yml` и `.env.prod`;
- поднимает `keycloak`;
- генерирует production nginx config из env-переменных;
- bootstrap-ит realm и клиентов Keycloak;
- запускает весь stack в фоне.

Полезные режимы:

```bash
./deploy.sh --check
./deploy.sh --logs
./deploy.sh --no-build
./deploy.sh --pull
```

## Проверка после запуска

Проверьте состояние контейнеров:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

Проверьте health endpoint gateway:

```bash
curl http://localhost:${GATEWAY_PORT}/health
```

Если сервер стоит за внешним reverse proxy или балансировщиком, дополнительно проверьте публичный URL:

```bash
curl https://your-domain.example/health
```

Keycloak admin console через gateway:

```text
https://your-domain.example/admin/
```

Если `KEYCLOAK_ADMIN_BIND` открыт наружу, прямой доступ к admin console будет доступен по адресу:

```text
http://your-server.example:8090/admin/master/console/
```

Публичные aliases для OIDC API через gateway:

```text
POST https://your-domain.example/auth/token
POST https://your-domain.example/auth/logout
```

Они проксируются в Keycloak на `/realms/<realm>/protocol/openid-connect/token` и `/realms/<realm>/protocol/openid-connect/logout`.
`/auth/login`, `/auth/register`, Keycloak OIDC registration endpoint и browser registration action в production возвращают `404`.

Проверьте логи:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f
```

## Обновление

Если сервер смотрит на `master`, базовый rollout такой:

```bash
git pull
./deploy.sh
```

Этого достаточно, чтобы подтянуть изменения кода и пересобрать `auth-helper` и `projects-service`.

## Остановка и перезапуск

Остановить stack:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

Перезапустить stack:

```bash
./deploy.sh
```

## Частые проблемы

- `502 Bad Gateway` на `gateway`: обычно `auth-helper`, `projects-service` или Keycloak недоступны.
- `401/403` на protected routes: проверьте `KEYCLOAK_ISSUER`, `KEYCLOAK_JWKS_URL`, `KEYCLOAK_AUDIENCE` и `PROJECTS_INTERNAL_API_KEY`.
- redirect ведет на неверный адрес: проверьте `OIDC_REDIRECT_URI` и настройки client в Keycloak.
- `projects-service` или `keycloak` не могут подключиться к БД: проверьте `KC_DB_URL_HOST`, `KC_DB_URL_PORT`, `PROJECTS_DATABASE_URL` и credentials внешних PostgreSQL.
- `projects-service` не может lookup пользователя по email: проверьте `PROJECTS_IDENTITY_KEYCLOAK_*` и права service account в Keycloak.
- nginx не может достучаться до Keycloak: проверьте `KEYCLOAK_UPSTREAM_HOST`, DNS и network route с сервера до Keycloak.

## Рекомендуемый минимум по безопасности

- храните `.env.prod` только на сервере;
- используйте длинные случайные значения для `PROJECTS_INTERNAL_API_KEY`, `KEYCLOAK_POSTGRES_PASSWORD` и `PROJECTS_POSTGRES_PASSWORD`;
- не публикуйте Postgres наружу;
- ставьте TLS перед production gateway;
- не держите `KEYCLOAK_ADMIN_PORT` открытым дольше, чем это реально нужно;
- ограничьте доступ к серверу и docker group.
