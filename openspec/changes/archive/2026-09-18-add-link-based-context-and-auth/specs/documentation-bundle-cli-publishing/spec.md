## MODIFIED Requirements

### Requirement: Project-scoped публикация documentation bundle

CLI SHALL публиковать documentation bundle через authenticated gateway endpoint выбранного проекта и MUST NOT обращаться напрямую к internal endpoint `documentation-service` или формировать trusted actor/project headers.

#### Scenario: Bundle отправлен через gateway

- **WHEN** пользователь запускает `dsbuilder docs publish` с выбранным project key
- **THEN** CLI SHALL отправить `POST /api/projects/{projectId}/documentation/bundles` относительно resolved API URL
- **THEN** request SHALL содержать `Authorization: ProjectKey <apiKey>`
- **THEN** CLI MUST NOT добавлять `X-Actor-*` или `X-Project-*` headers

#### Scenario: Bundle отправлен через gateway с user session

- **WHEN** выбранная policy указывает user session и backend разрешает публикацию пользователю
- **THEN** CLI SHALL отправить тот же project-scoped request с `Authorization: Bearer <token>`
- **THEN** CLI MUST NOT требовать project key или формировать trusted actor/project headers

#### Scenario: Project context отсутствует

- **WHEN** CLI не может получить контекст ни из явной ссылки, ни из `.sdds/config.json`
- **THEN** команда MUST завершиться с exit code `1`
- **THEN** CLI MUST NOT выполнять upload request

### Requirement: Runtime resolution API key и API URL

Команда `docs publish` SHALL использовать общий credential policy и API URL resolution CLI и SHALL поддерживать явные runtime inputs без сохранения secrets.

#### Scenario: Используются configured runtime sources

- **WHEN** `--api-key` и `--api-url` не переданы
- **THEN** CLI SHALL разрешить credential согласно `.sdds` policy или headless policy
- **THEN** CLI SHALL разрешить API URL через `DSBUILDER_API_URL` и code default

#### Scenario: Runtime overrides имеют приоритет

- **WHEN** выбран key mode и пользователь передаёт `--api-key` и `--api-url`
- **THEN** CLI SHALL использовать переданный key и API URL вместо environment и default sources
- **THEN** CLI MUST NOT сохранять API key в `.sdds/config.json`

#### Scenario: API key отсутствует

- **WHEN** выбранная policy не может разрешить credential из допустимых runtime sources
- **THEN** команда MUST завершиться с exit code `1` и сообщением о настройке выбранного способа авторизации
- **THEN** CLI MUST NOT выполнять upload request
