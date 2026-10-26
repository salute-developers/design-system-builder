# frontend-client-authentication Specification

## Purpose
Определяет пользовательскую авторизацию клиентов DS Builder, общий PKCE-вход CLI и MCP, хранение и обновление сессии, приоритет credentials и совместимость с IDE.

## Requirements

### Requirement: Общая пользовательская авторизация CLI и MCP

CLI и MCP SHALL получать общую пользовательскую сессию через Authorization Code + PKCE S256 в системном браузере и использовать тот же API URL, что и запросы DS Builder.

#### Scenario: Интерактивный login получает token через gateway

- **WHEN** пользователь запускает auth login в dsbuilder или dsbuilder-mcp
- **THEN** клиент MUST открыть браузер, проверить state callback и обменять code с code_verifier через Gateway
- **THEN** оба executable MUST использовать общий прикладной сценарий
- **THEN** клиент MUST NOT запрашивать логин/пароль в терминале или принимать пароль через argv

#### Scenario: Небезопасный auth URL отклоняется

- **WHEN** API URL использует HTTP вне localhost или 127.0.0.1
- **THEN** клиент MUST отклонить авторизацию до открытия браузера и передачи секретов

#### Scenario: Ошибка callback

- **WHEN** callback содержит неверный state, ошибку OAuth, повторный либо некорректный code
- **THEN** клиент MUST отклонить вход и не создавать сессию

#### Scenario: Ограниченный listener

- **WHEN** вход завершается, отменяется или превышает 180 секунд
- **THEN** loopback listener MUST закрыться
- **THEN** listener MUST быть доступен только на 127.0.0.1 со случайным свободным портом и проверяемым callback path

#### Scenario: Auth команды доступны в обоих executable

- **WHEN** пользователь вызывает auth --help любого executable
- **THEN** SHALL быть доступны login, status и logout
- **THEN** при отсутствии браузера login MUST вернуть диагностическую ошибку без парольного резервного пути

### Requirement: File-based user session

CLI/MCP SHALL сохранять refresh-сессию отдельно для нормализованного API URL в ~/.sdds/sessions через общий CredentialStore, указывая OAuth clientId. Access token SHALL оставаться только в памяти.

#### Scenario: Session сохраняет минимальный секретный state

- **WHEN** браузерный вход или refresh завершился успешно
- **THEN** файл MUST содержать только schemaVersion, apiUrl, clientId, username, refreshToken, refreshExpiresAt и updatedAt
- **THEN** файл MUST NOT содержать пароль, access/ID token, роли или контекст проекта/дизайн-системы
- **THEN** username MUST получаться из проверенного ответа identity-провайдера без дополнительного запроса пользователю

#### Scenario: Session из другого environment не используется

- **WHEN** сессия принадлежит другому API URL или прежнему OAuth-клиенту
- **THEN** клиент MUST вернуть AUTH_REQUIRED с предложением повторного входа
- **THEN** клиент MUST NOT отправить её refresh token другому серверу или clientId

#### Scenario: Session file защищен и заменяется атомарно

- **WHEN** платформа поддерживает POSIX permissions
- **THEN** каталог MUST иметь 0700, а файл 0600
- **WHEN** сессия обновляется
- **THEN** файл MUST заменяться атомарно после полной записи временного файла

### Requirement: Обязательная ротация refresh token

CLI и MCP SHALL сохранять включенную ротацию refresh token и координировать concurrent refresh одной session через
межпроцессную блокировку.

#### Scenario: Один процесс обновляет session

- **WHEN** процесс получает refresh lock
- **THEN** он MUST повторно прочитать актуальную session после получения lock
- **THEN** он MUST обменять актуальный refresh token через `POST <apiUrl>/auth/token`
- **THEN** он MUST атомарно сохранить rotated refresh token до снятия lock

#### Scenario: Второй процесс ожидает refresh

- **WHEN** CLI или MCP обнаруживает занятый refresh lock
- **THEN** процесс MUST дождаться освобождения lock в пределах ограниченного timeout
- **THEN** процесс MUST перечитать обновленную session вместо использования ранее прочитанного refresh token

#### Scenario: Rotated token не был сохранен из-за аварии

- **WHEN** новый refresh token выдан, но процесс завершился до atomic save
- **THEN** следующий refresh MUST завершиться `AUTH_REQUIRED`, если старый token уже невалиден
- **THEN** клиент MUST NOT отключать ротацию или повторно разрешать старый token как recovery mechanism

### Requirement: Единый credential priority

CLI и MCP SHALL выбирать backend credential согласно явной credential policy. В `auto` доступный project key имеет приоритет над user session; forced policy SHALL использовать только указанный тип; после backend authorization failure actor MUST NOT меняться.

#### Scenario: Project key найден

- **WHEN** policy `auto` находит непустой runtime project key
- **THEN** запрос MUST использовать `Authorization: ProjectKey <key>`
- **THEN** user session MUST NOT использоваться для этого запроса

#### Scenario: Project key отсутствует

- **WHEN** policy `auto` не находит project key
- **WHEN** для resolved API URL существует валидная user session
- **THEN** клиент MUST получить access token и использовать `Authorization: Bearer <token>`

#### Scenario: Принудительная session

- **WHEN** policy выбирает `user-session`
- **THEN** клиент MUST использовать session для resolved API URL или вернуть `AUTH_REQUIRED`
- **THEN** клиент MUST NOT выбирать доступный project key

#### Scenario: Принудительный key

- **WHEN** policy выбирает `project-key-env`
- **THEN** клиент MUST использовать выбранный key или вернуть credential error
- **THEN** клиент MUST NOT выбирать user session

#### Scenario: Project key отклонен backend

- **WHEN** запрос с найденным project key получает `401` или `403`
- **THEN** клиент MUST вернуть `PROJECT_KEY_INVALID` или `FORBIDDEN`
- **THEN** клиент MUST NOT повторять запрос с пользовательским credential

#### Scenario: Bearer получает HTTP 401

- **WHEN** backend отвечает `401` на GET, POST или multipart POST с пользовательским Bearer
- **THEN** общий authenticated HTTP слой MUST принудительно обновить ту же user session и повторить запрос ровно один раз
- **THEN** повторный `401` MUST удалить session и вернуть `AUTH_REQUIRED` без выбора project key

#### Scenario: Bearer получает HTTP 403

- **WHEN** backend отвечает `403` на запрос с пользовательским Bearer
- **THEN** клиент MUST вернуть `FORBIDDEN` без refresh и повтора

#### Scenario: Token endpoint недоступен во время refresh

- **WHEN** credential provider возвращает `BACKEND_UNAVAILABLE` при обновлении выбранной user session
- **THEN** project-scoped read scenario и MCP MUST сохранить `BACKEND_UNAVAILABLE`
- **THEN** клиент MUST NOT сообщать `AUTH_REQUIRED` и MUST NOT удалять session из-за transport failure

### Requirement: User access token lifecycle

CLI/MCP SHALL кешировать access token только в памяти процесса до срока истечения с запасом 30 секунд и сохранять ограниченный повтор после 401 без удаления refresh-сессии при транспортных ошибках.

#### Scenario: Повторные чтения

- **WHEN** access token ещё пригоден
- **THEN** следующий запрос MUST использовать его без обращения к token endpoint

#### Scenario: Истечение токена

- **WHEN** токен истекает или отсутствует в памяти
- **THEN** клиент MUST обновить сессию с сохранением межпроцессной ротации
- **THEN** конкурентные обновления внутри процесса MUST быть объединены

#### Scenario: User access token получает 401

- **WHEN** API возвращает 401 пользовательскому запросу
- **THEN** клиент MUST выполнить не более одного принудительного refresh и одного повтора
- **THEN** повторный 401 или invalid_grant MUST очистить файл и кеш и вернуть AUTH_REQUIRED

#### Scenario: User access token получает 403

- **WHEN** API возвращает 403
- **THEN** клиент MUST вернуть FORBIDDEN без refresh или смены actor

#### Scenario: Backend временно недоступен

- **WHEN** refresh или API временно недоступны
- **THEN** клиент MUST вернуть BACKEND_UNAVAILABLE и сохранить refresh-сессию

### Requirement: User session для всех авторизованных CLI операций

Каждая CLI-команда, выполняющая project-scoped backend request, SHALL поддерживать выбранный Bearer user credential наряду с project key и SHALL передавать ответ backend об отказе без смены actor.md`.

#### Scenario: Публикация с user session

- **WHEN** локальная policy выбирает `user-session` и пользователь имеет нужную роль в проекте
- **THEN** `docs publish` MUST отправить Bearer access token через project-scoped gateway route
- **THEN** команда MUST обработать backend результат без требования project key

#### Scenario: Пользователь не имеет права на запись

- **WHEN** backend отвечает `403` на запись с Bearer credential
- **THEN** CLI MUST вернуть `FORBIDDEN`
- **THEN** CLI MUST NOT повторять запрос с project key

### Requirement: Authorization Code + PKCE как альтернативный способ получить user session

Общий PKCE-сценарий SHALL быть доступен CLI/MCP на JVM, macOS и Node, а также интерактивным IDE-клиентам через платформенные порты. CLI/MCP SHALL использовать его вместо Direct Access Grant; IDE SHALL сохранять защищённое хранилище и использовать тот же clientId dsbuilder-studio-plugin без объединения refresh-сессий с CLI/MCP.

#### Scenario: Клиент запускает PKCE-флоу

- **WHEN** любой клиент начинает PKCE-вход
- **THEN** сценарий MUST получить криптографически стойкие verifier/state, открыть браузер через порт, дождаться callback и проверить state до обмена кода

#### Scenario: Полученные токены применяются через общий resolver

- **WHEN** CLI/MCP получает токены
- **THEN** refresh token MUST поступить в общий файловый CredentialStore
- **WHEN** IDE получает токены
- **THEN** refresh token MUST поступить в предоставленное IDE защищённое хранилище без зависимости от файловой сессии CLI

#### Scenario: Тихий refresh на 401 переиспользует общий примитив

- **WHEN** IDE обновляет сессию по сохранённому refresh token
- **THEN** клиент SHALL использовать общий обмен токенов и существующий resolver с проверяемым результатом без необработанного исключения

#### Scenario: PKCE-флоу не требует username/password UI

- **WHEN** клиент использует PKCE
- **THEN** ввод логина/пароля MUST происходить только в браузере identity-провайдера

### Requirement: Переиспользование публичного OAuth-клиента IDE для CLI/MCP

CLI и MCP SHALL переиспользовать существующий dsbuilder-studio-plugin с обязательным PKCE S256, loopback redirect и audience dsbuilder-api, без client secret и password grant. Новая регистрация OAuth-клиента MUST NOT создаваться. Действующие настройки web/IDE SHALL сохраняться.

#### Scenario: Общая регистрация и независимые сессии

- **WHEN** пользователь входит через IDE, CLI или MCP
- **THEN** каждый клиент MUST использовать clientId dsbuilder-studio-plugin
- **THEN** CLI/MCP MUST сохранять свою общую файловую сессию, а IDE — отдельную сессию в защищённом хранилище без обмена refresh token между ними

#### Scenario: Проверка обмена

- **WHEN** клиент обменивает code без правильного code_verifier
- **THEN** identity-провайдер MUST отказать в выдаче токенов

#### Scenario: Проверка audience

- **WHEN** CLI/MCP получает access token
- **THEN** Gateway MUST принимать его для существующей project-scoped авторизации по audience dsbuilder-api

### Requirement: Сессионные команды не запускаются инструментами

MCP serve и tools SHALL использовать готовые credentials без открытия браузера; status SHALL описывать локальную сессию, logout SHALL отзывать refresh token и очищать локальное состояние.

#### Scenario: Авторизация отсутствует

- **WHEN** MCP запускается без сессии
- **THEN** initialize и tools/list MUST работать
- **THEN** авторизованное чтение MUST вернуть AUTH_REQUIRED без интерактивного входа

#### Scenario: Статус и выход

- **WHEN** пользователь вызывает status
- **THEN** команда MUST вернуть безопасные локальные метаданные без обещания проверки доступа на сервере
- **WHEN** пользователь вызывает logout
- **THEN** клиент MUST попытаться отозвать refresh token с сохранённым clientId и удалить файл и кеш процесса даже при ошибке отзыва

### Requirement: Единое оформление браузерного входа DS Builder

Браузерная форма входа OAuth-клиента dsbuilder-studio-plugin SHALL использовать оформление текущей страницы входа DS Builder; обработка учётных данных и продолжение OAuth SHALL оставаться в Keycloak.

#### Scenario: Показ формы и успешный вход

- **WHEN** CLI, MCP или IDE начинает вход без активной SSO-сессии
- **THEN** пользователь MUST увидеть русскую форму DS Builder с подзаголовком, полями учётных данных и доступной с клавиатуры кнопкой входа
- **THEN** размеры, интервалы, шрифты и цвета формы MUST соответствовать текущей странице входа web-клиента; регистрация и блок «Запросить доступ» MUST NOT отображаться
- **THEN** успешный вход MUST продолжить исходный PKCE-сценарий с сохранением state и redirect URI

#### Scenario: Ошибка и узкий экран

- **WHEN** пользователь вводит неверные учётные данные или открывает форму на узком экране
- **THEN** форма MUST отображать ошибку Keycloak и сохранять доступность полей и кнопки без горизонтального переполнения

#### Scenario: Совместимость web-клиента

- **WHEN** тема включается для dsbuilder-studio-plugin в локальном или производственном контуре
- **THEN** оформление и способ авторизации существующей React-страницы web-клиента MUST сохраняться
- **THEN** дополнительные шаги авторизации Keycloak MUST оставаться работоспособными

### Requirement: Браузерная страница результата входа CLI и MCP

CLI и MCP SHALL возвращать в браузер стилизованную русскую страницу результата вместо пустого HTTP-ответа callback на JVM, macOS и Node.

#### Scenario: Сессия сохранена

- **WHEN** callback проверен, код обменян и сессия успешно сохранена
- **THEN** браузер MUST показать «Вы успешно авторизованы. Можете закрыть вкладку.»
- **THEN** страница MUST соответствовать тёмному оформлению DS Builder и быть пригодной для узкого окна

#### Scenario: Вход не завершился успешно

- **WHEN** callback неверен, обмен или сохранение сессии отказали, вход отменён или истёк таймаут при подключённом браузере
- **THEN** ответ MUST показать нейтральное сообщение об ошибке без утверждения об успешном входе
- **THEN** повторный callback MUST NOT приниматься как новый успешный вход

#### Scenario: Безопасность и освобождение ресурсов

- **WHEN** listener возвращает результат или браузер закрывает соединение
- **THEN** HTML MUST NOT содержать код OAuth, state, verifier, токены, имя пользователя или текст ответа сервера
- **THEN** страница MUST работать без внешних ресурсов, а listener MUST освобождаться после ограниченного ожидания отправки
- **THEN** разрыв соединения MUST NOT отменять уже сохранённую сессию
