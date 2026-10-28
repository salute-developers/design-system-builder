## MODIFIED Requirements

### Requirement: User session для всех авторизованных CLI операций

Каждая CLI-команда, выполняющая project-scoped backend request, SHALL поддерживать выбранный Bearer user credential наряду с project key и SHALL передавать ответ backend об отказе без смены actor.md`.

#### Scenario: Публикация с user session

- **WHEN** локальная policy выбирает `user-session` и пользователь имеет нужную роль в проекте
- **THEN** `docs publish` MUST отправить Bearer access token через project-scoped gateway route
- **THEN** команда MUST обработать backend результат без требования project key

#### Scenario: Пользователь не имеет права на запись

- **WHEN** backend отвечает `403` на запись с Bearer credential
- **THEN** CLI MUST вернуть `FORBIDDEN`
- **THEN** CLI MUST NOT повторять запрос с project key
