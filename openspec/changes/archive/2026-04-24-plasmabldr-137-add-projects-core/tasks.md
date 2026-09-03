## 1. Service scaffold

- [x] 1.1 Создать Projects Service как included build или service-модуль по существующему repo pattern
- [x] 1.2 Настроить Gradle conventions, Ktor, Koin, serialization, Exposed/PostgreSQL и test dependencies
- [x] 1.3 Добавить application configuration для service port, database connection и internal API protection
- [x] 1.4 Добавить Dockerfile для Projects Service
- [x] 1.5 Добавить docker-compose/local configuration с PostgreSQL, service port и healthcheck

## 2. Domain and application

- [x] 2.1 Описать domain-модели Project, ProjectStatus, ProjectMember и ProjectRole
- [x] 2.2 Реализовать use cases для create/list/read/update/archive/restore project
- [x] 2.3 Реализовать use cases для list/add/remove/change-role members
- [x] 2.4 Реализовать application policy для Owner, Maintainer, Editor, Viewer и `system_admin`
- [x] 2.5 Реализовать internal use case для effective project role check

## 3. Data and presentation

- [x] 3.1 Реализовать persistence entities/tables для projects и project_members
- [x] 3.2 Реализовать repositories/local sources и transaction boundaries
- [x] 3.3 Реализовать request/response DTO и mappers
- [x] 3.4 Реализовать public Ktor routes для projects и members
- [x] 3.5 Реализовать internal Ktor route для project role check
- [x] 3.6 Подключить Gateway/Auth Helper user-scoped auth для collection endpoints `/projects`
- [x] 3.7 Переключить local/runtime Gateway/Auth Helper на `PROJECT_ACCESS_MODE=http`
- [x] 3.8 Защитить internal access-check shared `PROJECTS_INTERNAL_API_KEY`

## 4. Tests and verification

- [x] 4.1 Добавить unit tests для role policy и owner invariant
- [x] 4.2 Добавить use case tests для project archive/restore и member role changes
- [x] 4.3 Добавить repository/local source tests для persistence behavior
- [x] 4.4 Добавить Ktor route tests для project, member и internal role-check endpoints
- [x] 4.5 Запустить relevant Gradle `build`, `detekt`, `spotlessCheck` и tests
- [x] 4.6 Если `spotlessCheck` падает только на измененных файлах, запустить `spotlessApply`, проверить diff и повторить checks
