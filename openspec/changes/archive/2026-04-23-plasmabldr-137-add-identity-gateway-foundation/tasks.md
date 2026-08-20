## 1. Scaffold and configuration

- [x] 1.1 Создать структуру Auth Helper как production microservice с `app` и feature-модулем, добавляя `core` только при необходимости
- [x] 1.2 Подключить Gradle conventions, Ktor, Koin, serialization и JWT/JWKS dependencies
- [x] 1.3 Добавить configuration keys для Keycloak issuer, audience, JWKS URL, internal service URLs, ports и timeouts
- [x] 1.4 Добавить Dockerfile для Auth Helper
- [x] 1.5 Добавить docker-compose/local configuration для Keycloak, nginx Gateway и Auth Helper с healthcheck

## 2. Auth Helper

- [x] 2.1 Реализовать application ports для JWT verification и project context resolution
- [x] 2.2 Реализовать data adapter для Keycloak JWKS/JWT validation
- [x] 2.3 Реализовать internal auth endpoint для nginx Gateway
- [x] 2.4 Реализовать response contract для allow/deny и trusted headers

## 3. Gateway

- [x] 3.1 Добавить nginx routes для public, project-scoped и internal paths
- [x] 3.2 Настроить auth_request или эквивалентный internal auth flow для `/projects/{projectId}/**`
- [x] 3.3 Настроить очистку incoming trusted headers перед проксированием
- [x] 3.4 Настроить rate limit, request size limits и access logging

## 4. Tests and verification

- [x] 4.1 Добавить unit tests для JWT validation и error mapping
- [x] 4.2 Добавить Ktor route tests для internal auth endpoint
- [x] 4.3 Добавить smoke checks для Gateway header cleanup и `/internal/**` deny behavior
- [x] 4.4 Запустить relevant Gradle `build`, `detekt`, `spotlessCheck` и tests
- [x] 4.5 Если `spotlessCheck` падает только на измененных файлах, запустить `spotlessApply`, проверить diff и повторить checks
