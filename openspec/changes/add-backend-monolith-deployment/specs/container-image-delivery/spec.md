## ADDED Requirements

### Requirement: Публикация backend monolith image
Image delivery workflow MUST собирать и публиковать единый backend monolith image из корневого production Dockerfile с той же branch/tag policy, что и остальные production images.

#### Scenario: DEV-публикация monolith
- **WHEN** разрешённый workflow успешно собирает commit ветки `dev`
- **THEN** registry MUST содержать backend monolith image с тегом `dev`

#### Scenario: Production-публикация monolith
- **WHEN** разрешённый workflow успешно собирает `master` с `release_tag=release_1.4.0`
- **THEN** теги `release_1.4.0` и `release` backend monolith image MUST указывать на один опубликованный digest

#### Scenario: Ошибка monolith image
- **WHEN** сборка или push backend monolith image завершается ошибкой
- **THEN** workflow MUST завершиться неуспешно
- **AND** MUST NOT запускать deployment monolith contour

### Requirement: Параллельная поставка на период миграции
Image delivery MUST сохранять существующие production image build paths, пока отдельный change явно не завершит миграцию на monolith.

#### Scenario: Monolith image добавлен в workflow
- **WHEN** workflow публикует новый backend monolith image
- **THEN** существующие Identity, Projects, Documentation, gateway и `db-service` image definitions MUST оставаться доступными
- **AND** новый monolith image MUST иметь отдельное package name

### Requirement: Production monolith использует готовый image
Production monolith deployment configuration MUST запускать опубликованный backend monolith image и MUST NOT требовать checkout исходников или локальную Docker build на deployment server.

#### Scenario: Развёртывание mutable dev tag
- **WHEN** deployment platform запускает monolith contour с `IMAGE_TAG=dev`
- **THEN** Compose MUST загрузить актуальный monolith manifest из configured registry

#### Scenario: Развёртывание release alias
- **WHEN** production platform запускает monolith contour с `IMAGE_TAG=release`
- **THEN** Compose MUST загрузить monolith image с alias `release`
- **AND** MUST предоставить публичный domain только nginx port `8080`
