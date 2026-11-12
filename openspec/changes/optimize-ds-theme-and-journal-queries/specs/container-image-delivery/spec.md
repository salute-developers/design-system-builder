# Ожидание готовности Keycloak

## ADDED Requirements

### Requirement: Начальная проверка Keycloak допускает медленный запуск

Production compose SHALL задавать `keycloak.healthcheck.start_period: 120s` и сохранять запуск bootstrap по фактической готовности Keycloak.

#### Scenario: Проверка конфигурации Compose
- **WHEN** production compose разбирается с тестовыми переменными окружения
- **THEN** начальный период MUST составлять 120 секунд
- **AND** интервал 15 секунд, таймаут 5 секунд и число повторов 10 MUST сохраняться
- **AND** зависимость bootstrap MUST сохранять условие успешной проверки готовности

### Requirement: Production bootstrap не запускает JVM для каждой операции

Образ keycloak-bootstrap SHALL выполнять настройку одним лёгким процессом через Admin API без kcadm/JVM, сохраняя entrypoint и переменные production Compose, настройки realm, профиля, клиентов и обязательных ролей.

#### Scenario: Первый и повторный запуск
- **WHEN** bootstrap выполняется для нового или уже настроенного realm
- **THEN** публичный клиент и Studio PKCE/audience/тема MUST сохранять действующие настройки
- **AND** служебные клиенты MUST получать настроенные секреты и необходимые роли
- **AND** повторный запуск MUST NOT создавать дубли клиентов и audience mappers
- **AND** preview publisher MUST настраиваться только при заданном секрете

#### Scenario: Ошибка настройки
- **WHEN** Admin API недоступен либо обязательное назначение ролей отклонено
- **THEN** ожидание готовности MUST быть ограничено, а неуспешная настройка MUST завершаться ненулевым кодом
- **AND** токены, секреты и тело ответа сервера MUST NOT попадать в журнал
