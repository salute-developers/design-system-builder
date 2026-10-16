## ADDED Requirements

### Requirement: Web client does not build documentation

Веб-клиент SHALL NOT запускать генерацию документации и SHALL NOT обращаться к маршрутам
`/api/projects/{projectId}/docs/*`.

#### Scenario: Страница Debug без генерации документации

- **WHEN** пользователь открывает страницу Debug
- **THEN** на ней MUST NOT быть действия «Опубликовать документацию»

#### Scenario: Сохранение без документации

- **WHEN** пользователь сохраняет дизайн-систему
- **THEN** клиент MUST NOT отправлять запросы к `/api/projects/{projectId}/docs/*`
