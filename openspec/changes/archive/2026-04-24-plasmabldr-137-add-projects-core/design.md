## Context

ADR-0001 определяет `project` как верхнеуровневый workspace DS Builder. Внутри проекта могут жить дизайн-системы и другие доменные сущности, но MVP этой change ограничен project core и RBAC.

Projects Service должен следовать границам `presentation -> application -> domain`, хранить infrastructure в `data`, а DI в `di`.

## Goals / Non-Goals

**Goals:**

- Создать Projects Service как production microservice.
- Сделать project источником workspace metadata и ownership.
- Гарантировать ровно одного Owner на проект.
- Поддержать роли `viewer`, `editor`, `maintainer` для участников проекта.
- Дать Gateway/Auth Helper internal API для определения project role.

**Non-Goals:**

- Не реализовывать добавление участника по email через Keycloak lookup; это отдельная change.
- Не реализовывать project access keys; это отдельная change.
- Не реализовывать transfer ownership.
- Не реализовывать invite flow и hard delete.

## Decisions

### Owner как поле проекта

Owner хранится в `projects.owner_user_id`, а не в `project_members`. Это делает инвариант "ровно один Owner" частью модели.

Альтернатива: хранить Owner как роль в `project_members`. Отклонено, потому что тогда уникальность Owner требует дополнительного ограничения и усложняет role-change сценарии.

### Project members без роли owner

`project_members.role` допускает только `viewer`, `editor`, `maintainer`. Owner считается effective role через `owner_user_id`.

Альтернатива: единая таблица всех ролей. Отклонено по той же причине: Owner в DS Builder является identity проекта, а не обычным membership.

### Archive вместо delete

Проект имеет status `active` или `archived`. Hard delete не входит в MVP.

Альтернатива: физическое удаление. Отклонено, потому что проекты являются workspace-контейнерами и в будущем будут связаны с дизайн-системами, интеграциями и audit.

## Risks / Trade-offs

- [Risk] Owner как отдельное поле потребует отдельной операции transfer ownership позже -> Mitigation: явно вынести transfer ownership за scope MVP.
- [Risk] Editor в Projects Service почти равен Viewer -> Mitigation: сохранить роль для cross-service compatibility с другими микросервисами.
- [Risk] Projects Service одновременно источник ролей и потребитель authorization -> Mitigation: выделить application-level policy компонент и покрыть use case tests.

## Migration Plan

1. Добавить новый included build или service-модуль Projects Service.
2. Добавить database schema для projects и project_members.
3. Реализовать public API и internal role-check API.
4. Подключить service в local docker-compose.
5. Rollback: отключить Gateway routing на Projects Service и удалить локальную compose-зависимость.

## Open Questions

- Запрещать ли Maintainer менять собственную роль или удалять себя из проекта?
- Видит ли `system_admin` archived projects по умолчанию?
- Нужен ли audit log для members/archive уже в MVP?
