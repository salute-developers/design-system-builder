# Ожидание готовности Keycloak

## ADDED Requirements

### Requirement: Начальная проверка Keycloak допускает медленный запуск

Production compose SHALL задавать `keycloak.healthcheck.start_period: 120s` и сохранять запуск bootstrap по фактической готовности Keycloak.

#### Scenario: Проверка конфигурации Compose
- **WHEN** production compose разбирается с тестовыми переменными окружения
- **THEN** начальный период MUST составлять 120 секунд
- **AND** интервал 15 секунд, таймаут 5 секунд и число повторов 10 MUST сохраняться
- **AND** зависимость bootstrap MUST сохранять условие успешной проверки готовности
