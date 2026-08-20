## ADDED Requirements

### Requirement: CLI feature backend integration boundary

Use case фичи CLI SHALL обращаться к backend API только через port-интерфейс, объявленный в пакете `application` фичи и реализованный в её пакете `data`. Use case MUST NOT зависеть от HTTP client, пути запроса, конфигурации JSON и wire-моделей запроса и ответа. Presentation MUST получать доменные модели, а не DTO backend.

#### Scenario: Use case не работает с HTTP напрямую

- **WHEN** разработчик открывает use case фичи CLI, обращающейся к backend
- **THEN** use case MUST принимать port-интерфейс из пакета `application` фичи
- **THEN** use case MUST NOT принимать `AuthenticatedHttpClientFactory` или создавать HTTP client
- **THEN** use case MUST NOT содержать путь backend-запроса, конфигурацию `Json` и вызовы сериализации

#### Scenario: Wire-формат живёт в data

- **WHEN** разработчик открывает реализацию port-интерфейса в пакете `data` фичи
- **THEN** `@Serializable` модели тела запроса и ответа MUST быть объявлены в `data`
- **THEN** путь backend-запроса и разбор ответа MUST выполняться в `data`
- **THEN** реализация MUST возвращать доменные модели или result-типы порта, а не wire-DTO

#### Scenario: Presentation не рендерит DTO backend

- **WHEN** presentation фичи печатает результат backend-операции
- **THEN** presentation MUST рендерить доменную модель результата
- **THEN** presentation MUST NOT импортировать `@Serializable` модель ответа backend

#### Scenario: Components push обращается к backend через port

- **WHEN** выполняется `dsbuilder components push`
- **THEN** use case MUST отправлять пакет через port-интерфейс component-config remote source
- **THEN** реализация порта в `data` MUST выполнять `POST /api/projects/{projectId}/ds/component-config/import` через CLI core authenticated HTTP client
- **THEN** отчёт импорта MUST приходить в use case доменной моделью

#### Scenario: Проверки разнесены по слоям

- **WHEN** выполняются тесты фичи CLI, обращающейся к backend
- **THEN** wire-контракт (путь, состав тела, разбор ответа, нечитаемый ответ) MUST проверяться тестами реализации порта в `data`
- **THEN** тест use case MUST использовать fake порта и проверять оркестрацию, а не форму JSON
