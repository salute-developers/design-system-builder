# gateway-authorization Specification

## Purpose
Защита проектных маршрутов на Gateway, формирование доверенного контекста и изоляция внутренних маршрутов сервисов.

## Requirements

### Requirement: Gateway protects project routes

Gateway SHALL проверять проектные маршруты до предметного выполнения. Для явно разрешённого адресного чтения публичной ДС допускается проверенный контекст кандидата на публичное чтение; явно согласованные общие GET preview/иконок не требуют проекта или ДС, прочие маршруты сохраняют обязательную проектную авторизацию.

#### Scenario: Запрос к project-scoped API

- **WHEN** клиент обращается к проектному маршруту вне разрешённого адресного публичного чтения и исключений GET preview/иконок
- **THEN** Gateway MUST запросить Auth Helper до проксирования запроса

#### Scenario: Запрос без доступа

- **WHEN** Auth Helper возвращает отказ доступа для операции вне публичного чтения
- **THEN** Gateway MUST вернуть клиенту `401 Unauthorized` или `403 Forbidden` без вызова предметного сервиса

#### Scenario: Прямой доступ к ds-service

- **WHEN** внешний клиент пытается обратиться к внутреннему порту `ds-service`, минуя Gateway
- **THEN** сетевой контур MUST запретить внешний доступ
- **AND** сам `ds-service` MUST отклонить запрос без корректного доверенного контекста, кроме явно общедоступных GET preview/иконок за той же сетевой границей

#### Scenario: Кандидат на публичное чтение
- **WHEN** гость вызывает разрешённую операцию чтения с явно выбранной ДС
- **THEN** шлюз MUST передать внутренний ограниченный контекст без роли участника
- **THEN** предметный слой MUST проверить публичность, проект, ресурс и опубликованную версию до выдачи данных

### Requirement: Internal endpoints are not externally available

Gateway SHALL запрещать внешний доступ к internal endpoints.

#### Scenario: Внешний запрос к internal route

- **WHEN** внешний клиент обращается к `/internal/**`
- **THEN** Gateway MUST отклонить запрос без проксирования во внутренний сервис

### Requirement: Gateway направляет предметный API в ds-service

Gateway SHALL направлять согласованный набор `/api/projects/{projectId}/design-systems/**` в `ds-service` после проектной авторизации, формирования ограниченного контекста чтения ДС либо проверки явного исключения GET preview/иконок и SHALL переписывать публичный префикс во внутренний `/api/design-systems` без изменения остатка пути и строки запроса.

#### Scenario: Вызов перенесённого маршрута

- **WHEN** авторизованный клиент вызывает маршрут из манифеста маршрутов `ds-service`
- **THEN** Gateway MUST передать запрос в `ds-service`
- **AND** MUST сохранить HTTP-метод, строку запроса, тело и допустимые заголовки
- **AND** MUST установить доверенный контекст из Auth Helper

#### Scenario: Исключённый маршрут временно остаётся в db-service

- **WHEN** клиент вызывает исключённый маршрут `/api/projects/{projectId}/ds/legacy/**`
- **THEN** Gateway MUST ответить `404`: сервер db-service удалён
- **AND** общее правило `/api/projects/{projectId}/design-systems/**` MUST направлять разрешённый набор в `ds-service`

#### Scenario: Атомарный откат

- **WHEN** оператор откатывает предметный API
- **THEN** откат выполняется версией образа `ds-service`
- **AND** конфигурация Gateway MUST остаться прежней: единственный сервер предметного API — `ds-service`

### Requirement: Успешный CORS preflight допускает ограниченное переиспользование

Публичный Ktor-вход backend-kt/app SHALL возвращать `Access-Control-Max-Age: 600` для успешного OPTIONS разрешённого origin при локальном и production-запуске с корректным `Vary: Origin`. Оптимизация SHALL NOT расширять допустимые origin, методы или заголовки и SHALL NOT кешировать решение авторизации фактической команды.

#### Scenario: Повторный запрос разрешённого origin
- **WHEN** браузер повторяет запрос с тем же CORS-контекстом в пределах объявленного времени
- **THEN** успешный preflight MUST быть пригоден для переиспользования браузером
- **THEN** фактический GET или изменяющий запрос MUST по-прежнему проходить прежнюю авторизацию шлюза

#### Scenario: Запрещённый origin
- **WHEN** OPTIONS получен от origin вне разрешённого списка
- **THEN** Gateway MUST NOT возвращать разрешающий CORS-ответ для этого origin
- **THEN** наличие кеша другого origin MUST NOT давать доступ

#### Scenario: Доступ отозван после preflight
- **WHEN** браузер сохранил успешный preflight, но право на проект отозвано
- **THEN** последующий предметный запрос MUST быть отклонён серверной авторизацией

### Requirement: Оптимизация сохраняет публичную границу монолита

Подсчёт каталога SHALL выполняться внутри процесса через прикладные интерфейсы. Оптимизация SHALL NOT открывать внутренние маршруты или обходить пользовательскую авторизацию. Исторические nginx-конфигурации SHALL NOT изменяться.

#### Scenario: Прямой вызов внутреннего пути
- **WHEN** клиент обращается к /internal/** или прямому /api/design-systems/** через публичный порт
- **THEN** app MUST сохранять действующий запрет обхода project-scoped авторизации
- **THEN** публичный список MUST включать только проекты user-scoped контекста

### Requirement: CORS для Figma-плагина

Публичный вход `backend-kt/app` SHALL разрешать origin из настройки `OIDC_PLUGIN_ORIGINS` (значение для Figma — `null`) только для `POST` на endpoint устройства Keycloak, `/auth/token` и `/auth/logout` и для `GET` на `/api/projects` и `/api/projects/**`. Настройка SHALL быть необязательной; без неё поведение CORS MUST NOT меняться. Gateway MUST NOT возвращать `Access-Control-Allow-Credentials` для такого origin. Авторизация запросов MUST NOT зависеть от origin.

#### Scenario: Чтение из плагина

- **WHEN** запрос `GET /api/projects/{id}/design-systems` приходит с `Origin: null`, а origin разрешён настройкой
- **THEN** ответ и его preflight MUST содержать `Access-Control-Allow-Origin: null` и `Vary: Origin`
- **THEN** `Access-Control-Allow-Methods` MUST NOT содержать методы записи, иначе браузер закэширует их на этот адрес

#### Scenario: Запись из плагина

- **WHEN** запрос `PATCH` или preflight `PATCH` на `/api/projects/**` приходит с `Origin: null`
- **THEN** Gateway MUST NOT возвращать разрешающий CORS-ответ

#### Scenario: Настройка не задана

- **WHEN** `OIDC_PLUGIN_ORIGINS` не задана, а запрос приходит с `Origin: null`
- **THEN** Gateway MUST NOT возвращать `Access-Control-Allow-Origin`

#### Scenario: Запрос без токена

- **WHEN** разрешённый origin отправляет запрос к `/api/projects` без `Authorization`
- **THEN** Gateway MUST вернуть `401`, как и для любого другого origin

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
Gateway SHALL передавать предметным сервисам нормализованный доверенный контекст только после успешной проверки и SHALL передавать `ds-service` все поля субъекта, необходимые общей RBAC-политике. Контекст публичного чтения MUST отдельно обозначать отсутствие проектных полномочий и выбранную систему.

#### Scenario: User actor context

- **WHEN** аутентифицированный пользователь получает доступ к проектному маршруту
- **THEN** Gateway MUST передать `X-Actor-Type`, `X-User-Id`, `X-Project-Id`, `X-Project-Role` и `X-System-Admin`

#### Scenario: Контекст PAT

- **WHEN** валидный PAT получает доступ к проектному маршруту
- **THEN** Gateway MUST передать `X-Actor-Type: personal_access_token`, `X-User-Id` владельца, `X-Project-Id`, актуальный `X-Project-Role`, `X-Personal-Access-Token-Id`, `X-Project-Scopes` и `X-System-Admin` с актуальным проверенным значением владельца

#### Scenario: Incoming trusted headers are spoofed

- **WHEN** внешний клиент отправляет `X-User-Id`, `X-Project-Role`, `X-Project-Scopes` или другие доверенные заголовки
- **THEN** Gateway MUST удалить входящие значения и установить только значения, полученные от Auth Helper

#### Scenario: Project id не совпадает

- **WHEN** `projectId` публичного пути не совпадает с проверенным `X-Project-Id`
- **THEN** Gateway MUST отклонить запрос до переписывания пути и предметной операции
- **AND** MUST NOT передавать запрос в `ds-service`

#### Scenario: Неверная авторизация не становится гостевой
- **WHEN** публичное чтение содержит неверный PAT или JWT
- **THEN** шлюз MUST вернуть `401` без повторного гостевого выполнения
- **WHEN** проверка личности или членства недоступна
- **THEN** шлюз MUST вернуть `503` без выдачи публичного разрешения

#### Scenario: Достоверное отсутствие членства пользователя
- **WHEN** действующая пользовательская сессия подтверждена, но пользователь не состоит в проекте
- **THEN** шлюз MUST допустить проверку публичного чтения только разрешённой адресной операции
- **THEN** недостаточные разрешения выбранного PAT MUST NOT заменяться гостевым доступом

#### Scenario: Нет ключа в кеше и JWKS недоступен
- **WHEN** JWT нельзя проверить без загрузки необходимого ключа, а загрузка JWKS завершилась транспортным отказом
- **THEN** шлюз MUST вернуть `503` без трактовки отказа как неверной подписи либо отсутствия членства
- **THEN** запрос MUST NOT выполняться повторно как гостевой

#### Scenario: Ключ доступен либо токен достоверно неверен
- **WHEN** необходимый проверенный ключ доступен в кеше и токен валиден
- **THEN** временная недоступность JWKS MUST NOT запрещать проверку через кеш
- **WHEN** подпись неверна, токен истёк либо успешно полученный JWKS не содержит указанного ключа
- **THEN** шлюз MUST вернуть `401`, а не `503` и не гостевой результат

#### Scenario: Явные общедоступные GET
- **WHEN** запрос без Authorization читает catalog/web-preview/plugin, catalog/compose-preview/plugin либо catalog/icons
- **THEN** шлюз MUST разрешить существующий обработчик без членства, ДС и версии
- **THEN** исключение MUST NOT распространяться на другие catalog-маршруты, методы публикации/загрузки или кеширование данных ДС
