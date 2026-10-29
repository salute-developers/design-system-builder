## MODIFIED Requirements

### Requirement: Полный набор production-образов
Workflow MUST собирать и публиковать образы `projects-service`, `auth-helper`, `documentation-service`, `ds-service`, `gateway`, `keycloak` и `keycloak-bootstrap` из соответствующих production Dockerfile репозитория. Образы `generator`, `publisher`, `documentation-generator` и `db-service` MUST NOT собираться и публиковаться.

#### Scenario: Успешная сборка набора
- **WHEN** все семь production Dockerfile успешно собираются для выбранного commit
- **THEN** registry MUST содержать все семь образов с тегами, определёнными политикой выбранной ветки

#### Scenario: Ошибка одного образа
- **WHEN** сборка или push хотя бы одного из семи образов завершается ошибкой
- **THEN** workflow MUST завершиться неуспешно и MUST NOT вызывать Coolify deploy webhook

#### Scenario: Удалённые сервисы не публикуются
- **WHEN** workflow строит матрицу образов
- **THEN** матрица MUST NOT содержать `generator`, `publisher`, `documentation-generator` и `db-service`
