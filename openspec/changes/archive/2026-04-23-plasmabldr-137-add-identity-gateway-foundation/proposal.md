## Why

DS Builder нужен единый и проверяемый вход для пользователей и микросервисов, чтобы проектные API не реализовывали аутентификацию по-разному. Эта change закладывает foundation для Keycloak-based identity, nginx Gateway и внутреннего Auth Helper, который формирует доверенный request context.

## What Changes

- Добавить Keycloak как identity provider для self-registration, login/logout/refresh flow, JWT и global roles.
- Добавить nginx Gateway как edge-компонент для routing, rate limit, trusted headers и защиты internal endpoints.
- Добавить внутренний Auth Helper для проверки Keycloak JWT и формирования project-scoped контекста запроса.
- Зафиксировать trusted headers для downstream-сервисов и очистку одноименных incoming headers от внешних клиентов.
- Добавить runtime-конфигурацию для локального запуска foundation-компонентов.

## Capabilities

### New Capabilities

- `identity-authentication`: аутентификация пользователей через Keycloak, self-registration и global roles.
- `gateway-authorization`: gateway-проверка JWT, извлечение project context и передача trusted headers downstream-сервисам.

### Modified Capabilities

- Нет.

## Impact

- Сервисы: новый Auth Helper, nginx Gateway, Keycloak runtime configuration.
- API: internal auth endpoint для Gateway, trusted request headers для downstream-сервисов.
- Конфигурация: Keycloak issuer/audience/JWKS, nginx routes, internal service URLs, ports, rate limits.
- Инфраструктура: Dockerfile для Auth Helper, docker-compose/local configuration для Gateway, Keycloak и Auth Helper, healthcheck endpoints.
- Зависимости: Ktor JWT/JWKS validation или эквивалентная библиотека, Koin, kotlinx.serialization.
