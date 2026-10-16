## ADDED Requirements

### Requirement: Publication window saves the design system and builds documentation

Окно «Опубликовать» веб-клиента SHALL сохранять дизайн-систему и затем запускать генерацию документации.
Клиент SHALL NOT собирать npm-пакет, публиковать его и ожидать его появления в npm.

#### Scenario: Успешная публикация

- **WHEN** пользователь запускает публикацию и сохранение и генерация документации завершаются успешно
- **THEN** клиент MUST вызвать сохранение дизайн-системы, затем `POST /api/projects/{id}/docs/api/documentation/generate`
- **THEN** клиент MUST очистить локальный черновик и показать успешное завершение с переходом в обзор
- **THEN** экран успеха MUST NOT показывать версию npm-пакета, команду установки и ссылку на npm

#### Scenario: Ошибка сохранения

- **WHEN** сохранение дизайн-системы завершается ошибкой
- **THEN** клиент MUST показать ошибку и MUST NOT запускать генерацию документации
- **THEN** локальный черновик MUST остаться

#### Scenario: Ошибка документации

- **WHEN** генерация документации завершается ошибкой
- **THEN** клиент MUST показать ошибку и оставить локальный черновик

### Requirement: Web client does not call removed generation services

Веб-клиент SHALL NOT обращаться к маршрутам `/api/projects/{id}/generator/*` и `/api/projects/{id}/publisher/*`.

#### Scenario: Страница Debug

- **WHEN** пользователь открывает страницу Debug
- **THEN** на ней MUST NOT быть действий скачивания или публикации пакета дизайн-системы

#### Scenario: Шлюз без маршрутов генерации

- **WHEN** gateway получает запрос на `/api/projects/{id}/generator/...` или `/api/projects/{id}/publisher/...`
- **THEN** gateway MUST NOT проксировать его в сервис генерации или публикации
