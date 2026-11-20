## ADDED Requirements

### Requirement: PAT и OAuth различаются при общей схеме Bearer

Gateway SHALL распознавать PAT по префиксу `dsb_pat_` в `Authorization: Bearer`, проверять его отдельным способом и MUST NOT повторять проверку отклонённого PAT как OAuth. Схема ProjectKey SHALL быть отклонена.

#### Scenario: Некорректный PAT
- **WHEN** Bearer содержит PAT с неверным секретом
- **THEN** Gateway MUST вернуть `401` без попытки OAuth-аутентификации

#### Scenario: Обычный OAuth
- **WHEN** Bearer содержит OAuth access token
- **THEN** Gateway MUST сохранить существующую проверку JWT и сессии

### Requirement: Пользовательский API PAT входит в публичную границу

Монолит SHALL публиковать `/api/settings/personal-access-tokens`, `/api/settings/personal-access-tokens/{id}` и `/api/settings/personal-access-tokens/scopes` с обязательной OAuth-авторизацией. Внутренние маршруты проверки MUST оставаться закрытыми снаружи.

#### Scenario: Запрос собственных PAT
- **WHEN** пользователь вызывает новый маршрут с валидной OAuth-сессией
- **THEN** app MUST передать проверенный userId в сценарий

#### Scenario: Внешняя проверка секрета
- **WHEN** внешний клиент обращается к внутреннему маршруту проверки PAT
- **THEN** app MUST отказать до выполнения внутреннего сценария

### Requirement: Проверенный контекст пользователя и PAT
Gateway SHALL передавать downstream-сервисам нормализованный trusted context только после успешной проверки и SHALL передавать `ds-service` все поля principal, необходимые общей RBAC-политике.

#### Scenario: User actor context

- **WHEN** authenticated user получает доступ к project-scoped route
- **THEN** Gateway MUST передать `X-Actor-Type`, `X-User-Id`, `X-Project-Id`, `X-Project-Role` и `X-System-Admin`

#### Scenario: Контекст PAT

- **WHEN** валидный PAT получает доступ к project-scoped route
- **THEN** Gateway MUST передать `X-Actor-Type: personal_access_token`, `X-User-Id` владельца, `X-Project-Id`, актуальный `X-Project-Role`, `X-Personal-Access-Token-Id`, `X-Project-Scopes` и `X-System-Admin` с актуальным проверенным значением владельца

#### Scenario: Incoming trusted headers are spoofed

- **WHEN** внешний клиент отправляет `X-User-Id`, `X-Project-Role`, `X-Project-Scopes` или другие trusted headers
- **THEN** Gateway MUST удалить incoming values и установить только значения, полученные от Auth Helper

#### Scenario: Project id не совпадает

- **WHEN** `projectId` публичного пути не совпадает с проверенным `X-Project-Id`
- **THEN** Gateway MUST отклонить запрос до переписывания пути и предметной операции
- **AND** MUST NOT передавать запрос в `ds-service`

## REMOVED Requirements

### Requirement: Trusted request context headers

**Reason**: Прежний контракт проектных ключей заменяется самостоятельным контрактом PAT.

**Migration**: Использовать требование «Проверенный контекст пользователя и PAT» этого изменения; старые проектные секреты отключаются без преобразования.
