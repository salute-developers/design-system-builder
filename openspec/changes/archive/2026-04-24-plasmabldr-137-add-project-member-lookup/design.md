## Context

Projects Service core может управлять membership по `userId`, но для реального UI/операционного сценария Owner или Maintainer должен добавлять участника по email. При этом invite flow решено отложить: если пользователь еще не зарегистрирован в Keycloak, membership не создается.

Эта change зависит от Projects Service core и Keycloak foundation.

## Goals / Non-Goals

**Goals:**

- Добавить участника проекта по email зарегистрированного Keycloak user.
- Спрятать Keycloak Admin API за application port.
- Не протаскивать Keycloak SDK в domain/application.
- Вернуть понятную client error, если пользователь не найден.

**Non-Goals:**

- Не создавать pending invitations.
- Не отправлять email-письма.
- Не реализовывать invite acceptance flow.
- Не синхронизировать всех Keycloak users в Projects Service.

## Decisions

### Lookup через application port

Application layer зависит от порта `IdentityUserLookup`, который возвращает минимальный identity snapshot: `userId`, `email`, optional display name. Data layer реализует порт через Keycloak Admin API.

Для local/dev stack нужен отдельный confidential client для `projects-service` с service account и read-only ролями `query-users` / `view-users`, а также корректный `baseUrl` до Keycloak внутри docker network.

Альтернатива: вызывать Keycloak client прямо из use case. Отклонено, потому что external SDK не должен протекать в application/domain.

### Только registered users

Если email не найден в Keycloak, Projects Service возвращает client error и не создает pending state.

Альтернатива: сразу создать pending invite. Отклонено, потому что invite flow оставлен за scope MVP.

### Email как lookup input, userId как persistence identity

Membership хранит `userId`, а не email. Email используется только на API boundary и для lookup.

Альтернатива: хранить membership по email. Отклонено, потому что email может измениться и не является stable identity.

## Risks / Trade-offs

- [Risk] Keycloak Admin API недоступен при добавлении участника -> Mitigation: явно маппить ошибку во временную service error и покрыть adapter tests.
- [Risk] Email lookup может быть неоднозначным при неправильной настройке Keycloak -> Mitigation: требовать normalized unique email в realm configuration.
- [Risk] Service account получит лишние права -> Mitigation: использовать минимальные read-only permissions для user lookup.

## Migration Plan

1. Добавить identity lookup port.
2. Добавить Keycloak Admin API adapter в data layer.
3. Обновить add-member request DTO на email-based input.
4. Добавить error mapping для user-not-found.
5. Rollback: вернуть add-member endpoint на userId-based input для internal/dev сценариев.

## Open Questions

- Требовать ли `email_verified=true` для добавления участника?
- Нужно ли хранить denormalized email/display name в read model members list?
- Какой exact error code использовать для user-not-found: `404 Not Found` или `422 Unprocessable Entity`?
