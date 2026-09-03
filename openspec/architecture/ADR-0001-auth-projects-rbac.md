---
description: ADR по авторизации, проектам и ролевой модели DS Builder
---

# ADR-0001: Auth, Projects и project-scoped RBAC

## Статус

Accepted for proposal input.

## Контекст

DS Builder строится как набор микросервисов. Клиенты должны обращаться к сервисам через единую точку входа, а доступ к данным должен определяться не только фактом аутентификации пользователя, но и его ролью внутри конкретного проекта.

В продуктовой модели `project` является верхнеуровневым workspace. Внутри проекта в будущем могут существовать дизайн-системы, темы, токены, компоненты, версии, артефакты публикации и интеграции.

Для MVP требуется реализовать только основу доступа:

- аутентификацию и регистрацию пользователей;
- создание и управление проектами;
- членство пользователей в проектах;
- project-scoped роли;
- архивирование и восстановление проектов;
- project-bound ключи для CLI и интеграций;
- gateway-авторизацию для маршрутов, которые работают в контексте проекта.

Сервис `project-publisher` пока считается экспериментальным и не входит в production scope этого решения.

## Решение

Используем разделение ответственности между Keycloak, Gateway/Auth и Projects Service.

```text
┌────────┐      ┌─────────────────┐      ┌────────────────────┐
│ Client │─────▶│ nginx Gateway   │─────▶│ Domain services    │
└────────┘      │ routing / edge  │      │ project-scoped API │
                └────────┬────────┘      └────────────────────┘
                         │ auth_request
                         ▼
                ┌─────────────────┐
                │ Auth Helper     │
                │ JWT/API key     │
                │ project context │
                └───────┬─────────┘
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
┌─────────────────┐             ┌─────────────────┐
│ Keycloak        │             │ Projects Service│
│ users / login   │             │ projects / RBAC │
│ global roles    │             │ access keys     │
└─────────────────┘             └─────────────────┘
```

### Keycloak

Keycloak используется как identity provider:

- self-registration пользователей;
- login/logout/refresh flow из коробки;
- хранение пользователей;
- JWT/OAuth2;
- глобальные роли.

Keycloak не хранит project-scoped роли и не является источником project membership.

### Gateway

Gateway строится вокруг nginx как edge-прокси:

- маршрутизация запросов;
- TLS, rate limit, request size limits, access logs;
- закрытие internal endpoints от внешнего доступа;
- делегирование проверки доступа через `auth_request` или эквивалентный internal flow.

Сложную авторизационную логику не размещаем в nginx config. Для нее предусматривается отдельный внутренний Auth Helper на Kotlin/Ktor или аналогичный небольшой сервис.

Auth Helper отвечает за:

- проверку Keycloak JWT по JWKS;
- проверку project-bound access key;
- извлечение `userId`, global roles, `projectId`;
- запрос project role/scopes из Projects Service;
- возврат gateway решения `401`, `403` или enriched request context.

### Projects Service

Projects Service является источником истины для:

- проектов;
- владельца проекта;
- участников проекта;
- project-scoped ролей;
- статуса проекта;
- project-bound access keys;
- internal API для проверки проектного доступа.

Projects Service не должен протаскивать Keycloak SDK, Ktor или Exposed в domain/application слои. Интеграция с Keycloak для lookup пользователя по email должна быть оформлена через application port и data implementation.

## Аутентификация

Поддерживаются два типа actor.

### User actor

Пользователь проходит login через Keycloak и получает JWT.

```text
Authorization: Bearer <keycloak-jwt>
```

JWT должен позволять определить:

- `sub` как stable `userId`;
- email пользователя;
- признак verified email, если используется операция, завязанная на email;
- global roles, например `user` и `system_admin`.

### Project key actor

CLI и интеграции используют project-bound access key.

```text
Authorization: Bearer <project-access-key>
```

Project-bound access key:

- принадлежит одному проекту;
- хранится только в виде hash;
- имеет имя;
- имеет scopes;
- может иметь срок действия;
- может быть отозван;
- передается через `Authorization: ProjectKey <access-key>` или `Authorization: <access-key>`;
- не является пользователем и не должен получать административные права над участниками проекта.

## Глобальные роли

Глобальные роли живут в Keycloak.

| Роль | Назначение |
| --- | --- |
| `user` | Обычный зарегистрированный пользователь. Может создавать проекты и работать в проектах, где он является Owner или member. |
| `system_admin` | Системный администратор. Имеет доступ ко всем проектам без добавления в project membership. |

`system_admin` является platform override, а не project role. Он не должен автоматически добавляться в `project_members`.

## Project-scoped роли

Project-scoped роли живут в Projects Service.

```text
Project
  id
  ownerUserId
  status

ProjectMember
  projectId
  userId
  role: viewer | editor | maintainer
```

Owner хранится как поле проекта, а не как запись в `project_members`. Это фиксирует инвариант: у проекта ровно один Owner.

| Роль | Назначение |
| --- | --- |
| `owner` | Единственный владелец проекта. Полный контроль над проектом. |
| `maintainer` | Администрирование проекта без права стать Owner или изменить Owner. |
| `editor` | Редактирование контента проекта в доменных микросервисах. В MVP Projects Service почти не отличает Editor от Viewer. |
| `viewer` | Чтение проекта и базовой информации. |

Editor нужен уже в MVP как cross-service роль, потому что другие микросервисы DS Builder могут использовать ее независимо от текущего репозитория.

## Инварианты ролей

- Любой authenticated `user` может создать проект.
- Создатель проекта автоматически становится единственным Owner.
- В проекте может быть только один Owner.
- В проекте может быть несколько Maintainer.
- Owner не хранится в `project_members`.
- Maintainer не может назначить Owner.
- Maintainer не может изменить Owner.
- Maintainer не может удалить Owner.
- Maintainer не может архивировать или восстановить проект.
- Owner и `system_admin` могут архивировать и восстанавливать проект.
- `system_admin` имеет доступ ко всем проектам через global-role override.
- Архивированный проект нельзя изменять, кроме операции restore и явно разрешенных read/admin операций.

## Permissions для MVP

### User actor permissions

```text
Capability                  Viewer  Editor  Maintainer  Owner  System Admin
----------------------------------------------------------------------------
project.read                yes     yes     yes         yes    yes
project.create              yes     yes     yes         yes    yes
project.update_metadata     no      no      yes         yes    yes
project.archive             no      no      no          yes    yes
project.restore             no      no      no          yes    yes

members.read                yes     yes     yes         yes    yes
members.add                 no      no      yes         yes    yes
members.remove              no      no      yes         yes    yes
members.change_role         no      no      yes         yes    yes

access_keys.read            no      no      yes         yes    yes
access_keys.create          no      no      yes         yes    yes
access_keys.revoke          no      no      yes         yes    yes
```

`project.create` является global authenticated capability, а не permission внутри существующего проекта.

Maintainer может управлять только ролями `viewer`, `editor`, `maintainer`. Операции с Owner должны быть отдельными Owner-only или `system_admin`-only operations.

### Project key actor capabilities

```text
Capability                  Project Key
--------------------------------------
project.read                yes, если есть scope projects:read
project.update_metadata     no
project.archive             no
project.restore             no

members.read                yes, если есть scope members:read
members.add                 no
members.remove              no
members.change_role         no

access_keys.read            no
access_keys.create          no
access_keys.revoke          no
```

Project-bound access keys не должны получать permissions для:

- управления участниками;
- изменения metadata проекта;
- создания или отзыва других access keys;
- архивирования или восстановления проекта;
- передачи ownership.

В текущем MVP user authorization остается role-based, а `project_key` использует scope-based модель. Scope вычисляются в Projects Service и передаются Gateway только как доверенный контекст.

## Добавление участников без invite

Invite flow откладывается за пределы MVP.

В MVP участник добавляется по email, но только если пользователь уже зарегистрирован в Keycloak.

```text
POST /projects/{projectId}/members
{
  "email": "user@example.com",
  "role": "editor"
}
```

Projects Service через identity lookup port проверяет существование пользователя в Keycloak и получает его `userId`. После этого создает membership.

Если пользователь с таким email не найден, API должен вернуть доменную ошибку, которую presentation слой отобразит как корректный client error. На этом этапе не создается pending invite.

Будущий invite flow сможет расширить этот процесс:

- если пользователь существует, добавить member сразу;
- если пользователь не существует, создать pending invitation по email.

## Архивирование проекта

Проект имеет статус.

```text
active
archived
```

Архивирование обратимо.

Архивированный проект:

- остается в системе;
- может быть прочитан Owner и `system_admin`;
- может быть скрыт из обычных списков без `includeArchived=true`;
- не принимает изменения metadata, members и access keys;
- может быть восстановлен Owner или `system_admin`.

Hard delete не входит в MVP.

## Заголовки внутреннего контекста

Gateway/Auth Helper должен передавать downstream-сервисам нормализованный контекст.

Для user actor:

```http
X-Actor-Type: user
X-User-Id: <keycloak-sub>
X-Project-Id: <project-id>
X-Project-Role: owner|maintainer|editor|viewer
X-System-Admin: true|false
```

Для project key actor:

```http
X-Actor-Type: project_key
X-Project-Id: <project-id>
X-Project-Key-Id: <key-id>
X-Project-Scopes: projects:read,...
```

Внешние клиенты не должны иметь возможность подделать эти заголовки. Gateway обязан очищать incoming `X-Actor-*`, `X-User-*`, `X-Project-*`, `X-System-Admin` перед установкой доверенного контекста.

## Маршрутизация

Project-scoped APIs должны иметь `projectId` в path, а не в query parameter.

```text
/projects/{projectId}/...
```

Это позволяет Gateway/Auth Helper надежно извлекать project context.

Пример групп маршрутов:

```text
/auth/**                  Keycloak/auth frontend routes
/projects                 project creation and current user's project list
/projects/{projectId}/**  project-scoped authenticated routes
/internal/**              only internal network
```

## Последствия

Плюсы:

- Keycloak используется по назначению: identity, registration, OAuth2/JWT, global roles.
- Project membership остается в домене DS Builder.
- Роли проекта не завязаны на Keycloak groups/roles и могут развиваться вместе с продуктом.
- Один Owner выражен явно через модель проекта.
- nginx остается edge-компонентом, а сложная authz-логика живет в тестируемом сервисе.
- Будущий invite flow можно добавить без ломки базовой модели membership.
- Другие микросервисы могут использовать единую роль `editor` уже в MVP.

Минусы и риски:

- Появляется дополнительный internal Auth Helper.
- Gateway/Auth и Projects Service должны иметь четкую internal API границу.
- Нужно внимательно защищать trusted headers от подделки.
- Нужно продумать caching project role/access key checks, чтобы gateway не создавал лишнюю нагрузку.
- Keycloak Admin API lookup по email требует аккуратной настройки credentials и scopes.

## Вне scope MVP

- Pending invite по email для незарегистрированных пользователей.
- Transfer ownership.
- Hard delete проекта.
- Organization/workspace слой поверх project.
- Production-интеграция `project-publisher`.
- Полная permissions matrix для токенов, тем, компонентов и дизайн-систем.
- WebSocket authorization для production-сервисов.

## Вопросы для proposal/design

- Нужно ли запрещать Maintainer менять собственную роль или удалять себя из проекта?
- Какие scopes должны быть у project-bound access keys в первой версии?
- Должен ли `system_admin` видеть архивированные проекты по умолчанию?
- Нужен ли audit log уже в MVP для операций members/access keys/archive?
- Какой TTL/caching strategy использовать для проверки membership и access keys в Gateway/Auth Helper?
