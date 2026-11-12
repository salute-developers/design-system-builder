## MODIFIED Requirements

### Requirement: Окружения собираются с заданным значением флага

Сборки DEV и PROM SHALL выполняться с включённым флагом. Локальная разработка (`vite dev` и `js/docker-compose.dev.yml`) SHALL включать флаг по умолчанию.

#### Scenario: Сборка PROM

- **WHEN** workflow публикации PROM собирает клиент
- **THEN** `VITE_COMPONENT_EDITOR_ENABLED` MUST быть равна `true`.

#### Scenario: Сборка DEV

- **WHEN** workflow публикации DEV собирает клиент
- **THEN** `VITE_COMPONENT_EDITOR_ENABLED` MUST быть равна `true`.
