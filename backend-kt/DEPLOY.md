# Deploy production stack

Инструкция описывает простой production deployment для сценария, где сервер держит checkout репозитория и поднимает stack напрямую через `docker compose`.

## Что поднимается

Production stack из корневого [docker-compose.prod.yml](../docker-compose.prod.yml) включает Kotlin и JS сервисы приложения, в том числе:

- `gateway` - публичный nginx entrypoint;
- `keycloak` - встроенный identity provider;
- `auth-helper` - internal auth service;
- `projects-service` - внутренний downstream service;
- `documentation-service`, `db-service`, `generator`, `publisher` и `docs-generator`;
- `admin` и `client` как отдельные frontend-сервисы.

Снаружи публикуется только порт `gateway`.
Keycloak admin console доступна через gateway по `/admin/`.
Прямой порт Keycloak по умолчанию привязан к `127.0.0.1`; при необходимости его можно открыть наружу через `KEYCLOAK_ADMIN_BIND` и `KEYCLOAK_ADMIN_PORT`.

Локальный конфиг [identity-gateway/gateway/nginx.local.conf](./identity-gateway/gateway/nginx.local.conf) в production не используется. Для production gateway генерирует конфиг из [identity-gateway/gateway/nginx.prod.conf.template](./identity-gateway/gateway/nginx.prod.conf.template) и переменных окружения.

## Требования к серверу

- установлен Docker с поддержкой `docker compose`;
- сервер умеет делать `git pull` вашего репозитория;
- для `keycloak`, `projects-service`, `documentation-service` и `db-service` уже созданы базы PostgreSQL;
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

Для удобного rollout можно использовать корневой [deploy.sh](../deploy.sh).

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

- публичные URL и OIDC-настройки `VITE_*`, `OIDC_*`, `KEYCLOAK_ISSUER`, `KEYCLOAK_AUDIENCE` и `KC_HOSTNAME`;
- bootstrap admin и PostgreSQL-настройки Keycloak;
- `PROJECTS_DATABASE_URL`, credentials `projects-service` и длинный случайный `PROJECTS_INTERNAL_API_KEY`;
- PostgreSQL URL для `db-service` (`DATABASE_URL`) и `documentation-service` (`DOCUMENTATION_DATABASE_URL`);
- S3 credentials отдельно для Kotlin `documentation-service` и JS `docs-generator`.

Важно:

- `KEYCLOAK_ISSUER` должен соответствовать публичному issuer URL, который увидит клиент;
- внутренний JWKS URL и адреса всех compose-сервисов уже заданы через service-name DNS и не требуют доменов;
- `KC_DB_URL_DATABASE`, `KC_DB_USERNAME` и `KC_DB_PASSWORD` выводятся автоматически из `KEYCLOAK_POSTGRES_*`;
- `PROJECTS_DATABASE_URL` должен указывать на внешнюю PostgreSQL `projects-service`;
- `DATABASE_URL` использует обычный PostgreSQL URL, а Kotlin-сервисы — JDBC URL;
- `OIDC_REDIRECT_URI` должен быть разрешен в настройках client в Keycloak;
- исторически названная `VITE_NPM_REGISTRY` фактически содержит npm token и попадает в браузерный bundle: не используйте широкий долгоживущий token.
- production bootstrap отключает self-registration, email verification и password reset через email в Keycloak realm;
- production user profile не требует `email`, `firstName` и `lastName`: вручную созданному пользователю достаточно `username` и `password`.

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
