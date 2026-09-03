## Context

CLI и интеграции DS Builder должны иметь доступ к project-scoped API без интерактивного user login. ADR-0001 выбирает project-bound access keys, которые не являются пользователями и не имеют administrative member-management permissions.

Эта change зависит от Projects Service core и Gateway/Auth Helper foundation.

## Goals / Non-Goals

**Goals:**

- Добавить безопасную модель project-bound access keys.
- Ограничить machine access через scopes.
- Поддержать проверку ключей через Auth Helper.
- Не раскрывать raw secret после создания.

**Non-Goals:**

- Не реализовывать user-bound personal access tokens.
- Не разрешать keys управлять members, ownership или другими keys.
- Не реализовывать publish-specific scopes, пока `project-publisher` вне production scope.

## Decisions

### Project-bound keys

Ключ принадлежит одному project и не привязан к membership конкретного пользователя. `createdByUserId` сохраняется для audit context.

Альтернатива: user-bound tokens. Отклонено для MVP CLI/integration сценариев, потому что automation должна жить в контексте проекта, а не личной сессии.

### Hash-only storage

Raw secret показывается только один раз при создании. В БД хранится hash.

Альтернатива: хранить encrypted secret. Отклонено, потому что для verification достаточно hash, а восстановление raw secret не требуется.

### Scopes вместо project role

Access key получает scopes, а не роль `owner`/`maintainer`/`editor`. Это не позволяет machine actor случайно получить member-management права.

Альтернатива: назначать ключу project role. Отклонено из-за риска выдать automation административные возможности.

## Risks / Trade-offs

- [Risk] Слишком широкие scopes создадут security gap -> Mitigation: начать с минимального набора `project:read` и явно запрещенных admin actions.
- [Risk] Утечка raw secret даст доступ до revoke/expire -> Mitigation: hash-only storage, optional expiration, revoke endpoint и audit fields.
- [Risk] Gateway должен различать JWT и access key -> Mitigation: Auth Helper инкапсулирует actor detection и возвращает normalized actor context.

## Migration Plan

1. Добавить persistence для access keys.
2. Добавить Projects Service API для управления keys.
3. Добавить internal verification endpoint.
4. Расширить Auth Helper проверкой project access key.
5. Обновить Gateway context headers для `project_key` actor.

## Open Questions

- Делать ли expiration обязательным в MVP?
- Какие scopes кроме `project:read` нужны первой CLI-версии?
- Нужен ли rate limit отдельно для project access keys?
