## 1. Контракт и аудит backend

- [x] 1.1 Зафиксировать канонический `dsbuilder://` URI, допустимые identifiers, обязательность version/platform и error DTO; согласовать с существующими publication/model tool contracts.
- [x] 1.2 Составить перечень всех авторизованных CLI-команд и их backend routes, отметить key-only frontend ports и ограничения user Bearer в identity-gateway, documentation-service, project-publisher и db-service.
- [x] 1.3 Проверить совместимость backend routes без изменения backend: Ktor routes поддерживают user actor; отсутствие проверки project role в db-service `component-config/import` зафиксировать как отдельный backend gap в `backend-audit.md`.

## 2. Общий контекст и credential policy

- [x] 2.1 В `core-domain` разделить идентичность выбранной дизайн-системы, provenance, локальный `configPath` и credential policy; покрыть модели tests.
- [x] 2.2 В `core-application` реализовать строгий parser `dsbuilder://` и приоритет явного selection перед локальными sources; отсутствие `.sdds` сделать штатным `NotFound` для headless-вызова; покрыть parser/resolver tests.
- [x] 2.3 В `core-workspace` расширить codec для `auto`, `user-session`, `project-key-env` и совместимого `env` без автоматической перезаписи старых config; покрыть round-trip и compatibility tests.
- [x] 2.4 В `core-application` объединить выбор credential по policy: key-first только в `auto`, forced modes без fallback, headless session по умолчанию и явный key-env для CI; покрыть отсутствие credential, `401`/`403` и refresh tests.

## 3. Авторизованные feature-команды

- [x] 3.1 Перевести `feature-docs` publish/upload на общий типизированный credential и Bearer/ProjectKey HTTP mapping; покрыть upload и error tests.
- [x] 3.2 Перевести авторизованные `feature-theme` use cases и HTTP adapters на общий credential contract; покрыть fetch и denied tests.
- [x] 3.3 Перевести авторизованные `feature-components` use cases и HTTP adapters на общий credential contract; покрыть push/fetch и denied tests.
- [x] 3.4 Проверить остальные авторизованные CLI feature use cases по аудиту 1.2, устранить key-only paths и добавить focused tests для каждого изменённого пути.

## 4. CLI и MCP presentation

- [x] 4.1 Добавить `--design-system <uri>` в применимые project-scoped CLI-команды и явный key-env выбор для headless CI; сохранить локальные пути для исходников/bundle и проверить help/parse tests.
- [x] 4.2 Подключить explicit selection и credential policy ко всем MCP read tools без mutable active context; покрыть вызовы A/B в одном процессе, отсутствие контекста и неверный URI contract tests.
- [x] 4.3 Обновить CLI и MCP error mapping для `CONTEXT_REQUIRED`, `INVALID_CONTEXT`, `AMBIGUOUS_CONTEXT`, `AUTH_REQUIRED` и `FORBIDDEN`; проверить отсутствие raw secrets в output.
- [x] 4.4 Проверить CLI JVM/macOS и MCP Node launchers без `--workspace`, с локальной `.sdds` и с явным URI в интеграционных тестах.
- [x] 4.5 Добавить необязательный `--destination` для `theme fetch` по явной ссылке вне `.sdds`, создавать новый локальный config без secrets и покрыть headless/error tests.
- [x] 4.6 Убрать игнорирующие fallback из портов контекста и credential, сгруппировать параметры runtime в типизированный запрос и покрыть выбор явного контекста тестами.
- [x] 4.7 Сохранить HTTP status типизированным и централизовать один refresh/retry Bearer после `401` без смены actor; покрыть `401`/`403` тестами.
- [x] 4.8 Перенести выбор вариаций и извлечение token references из MCP в `feature-components`, оставив MCP только сериализацию и mapping DTO; покрыть сценарии feature tests.
- [x] 4.9 Сохранять категорию ошибок credential при разрешении runtime, включая недоступный backend во время refresh; покрыть отображение в MCP тестом.
- [x] 4.10 Объединить чтение конфигурации компонента и каталога токенов в одном сценарии `feature-components` с однократным разрешением runtime; покрыть неизменность контекста тестом.

## 5. Ссылка в клиенте и документация

- [x] 5.2 Обновить CLI/MCP README и примеры для четырёх сценариев: `.sdds` auto, forced session, forced key-env и headless URI без `.sdds`.
- [x] 5.3 Обновить ADR-0005 и существующие user-facing описания авторизации/контекста согласно новым правилам.

## 6. Проверка и завершение

- [x] 6.1 Прогнать frontend-kt focused tests, `build`, `detekt` и `spotlessCheck`; устранить ошибки только в изменённых файлах.
- [x] 6.4 Прогнать `openspec validate add-link-based-context-and-auth` и проверить, что все scenario из delta specs покрыты tests или явно проверенным локальным интеграционным прогоном.
