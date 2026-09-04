## Context

ADR-0001 фиксирует разделение ответственности: Keycloak владеет identity и global roles, nginx Gateway является edge-точкой входа, а Auth Helper выполняет проверку JWT и формирует нормализованный контекст для project-scoped API.

Сейчас в репозитории есть экспериментальный `project-publisher`, но production foundation для auth/gateway отсутствует. Новая foundation должна быть пригодна для микросервисов, которые реализуются как в этом mono-repo, так и другой командой в другом репозитории.

## Goals / Non-Goals

**Goals:**

- Подключить Keycloak как единственный источник пользовательской identity.
- Сохранить nginx как простой edge Gateway без бизнес-логики RBAC в nginx config.
- Вынести auth logic в тестируемый Auth Helper.
- Передавать downstream-сервисам доверенный request context через headers.
- Защитить trusted headers от подделки внешними клиентами.

**Non-Goals:**

- Не реализовывать project membership и project roles в этой change.
- Не реализовывать project-bound access keys.
- Не подключать production-интеграцию `project-publisher`.
- Не добавлять invite flow.

## Decisions

### Keycloak как identity provider

Keycloak используется для self-registration, login/logout/refresh flow, JWT и global roles. Project-scoped роли не хранятся в Keycloak.

Альтернатива: собственный Auth service. Отклонено для MVP, потому что Keycloak закрывает стандартные OAuth2/OIDC сценарии и уменьшает объем security-sensitive кода.

### nginx Gateway + Auth Helper

nginx отвечает за edge-функции: routing, rate limit, access logs, request limits и закрытие internal endpoints. Auth Helper отвечает за JWT validation, извлечение actor context и ответ Gateway через internal auth flow.

Альтернатива: разместить JWT/RBAC logic в nginx. Отклонено, потому что сложная authz-логика будет хуже тестироваться и расширяться, особенно при появлении project access keys.

### Trusted headers

Gateway должен удалять incoming `X-Actor-*`, `X-User-*`, `X-Project-*`, `X-System-Admin` и устанавливать их только после успешной проверки Auth Helper.

Альтернатива: позволить сервисам читать headers напрямую без очистки на Gateway. Отклонено из-за риска header spoofing.

## Risks / Trade-offs

- [Risk] Auth Helper становится дополнительным internal service hop -> Mitigation: добавить healthcheck, timeouts и кеширование JWKS.
- [Risk] Разные репозитории могут по-разному трактовать headers -> Mitigation: зафиксировать names и semantics в spec.
- [Risk] Неверная nginx-конфигурация может пропустить поддельные headers -> Mitigation: добавить route/config tests или smoke checks для очистки headers.

## Migration Plan

1. Добавить foundation-компоненты в локальный compose.
2. Подключить Keycloak realm/client configuration для local/dev.
3. Поднять Auth Helper и проверить JWT validation на health/smoke routes.
4. Подключить nginx Gateway и убедиться, что external clients не могут обращаться к internal endpoints.
5. Rollback: отключить Gateway route на новые сервисы и вернуть прямой local access только для разработки.

## Open Questions

- Какие exact ports закрепить для Gateway, Auth Helper и Keycloak в local compose?
- Нужен ли отдельный realm для local/dev/test окружений?
- Какой TTL использовать для JWKS cache?
