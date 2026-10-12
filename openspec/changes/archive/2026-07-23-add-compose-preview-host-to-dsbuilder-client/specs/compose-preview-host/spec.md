## ADDED Requirements

### Requirement: Client загружает Compose plugin по runtime URL

`apps/client` SHALL получать базовый URL Compose Preview Plugin из runtime-конфигурации,
загружать `preview-plugin.json` и разрешать iframe entrypoint относительно URL manifest.

#### Scenario: Совместимый plugin доступен

- **WHEN** `VITE_COMPOSE_PREVIEW_PLUGIN_URL` указывает на доступный plugin artifact
- **AND** manifest объявляет Compose platform, Preview Protocol v1, обязательные bridge messages
  и `BasicButton`
- **THEN** client MUST создать iframe с entrypoint из manifest.

#### Scenario: Plugin URL отсутствует или manifest несовместим

- **WHEN** plugin URL не настроен, недоступен или manifest не поддерживается client
- **THEN** Compose preview MUST перейти в диагностируемое failure state
- **AND** существующее React preview MUST оставаться доступным.

### Requirement: ComposePreviewSession управляет iframe lifecycle

Client SHALL инкапсулировать manifest, iframe window, ready lifecycle, request correlation,
timeouts и disposal в отдельной `ComposePreviewSession`, не зависящей от `Config`, `Theme` и
component editor models.

#### Scenario: Plugin сообщает о готовности

- **WHEN** session получает `sdds.preview.ready` от ожидаемых iframe window и origin
- **AND** message содержит поддерживаемый protocol version
- **THEN** session MUST перейти в ready и разрешить отправку полного payload.

#### Scenario: Сообщение пришло от другого source или origin

- **WHEN** window получает lifecycle или result message от неожиданного source либо origin
- **THEN** session MUST игнорировать сообщение
- **AND** pending requests MUST сохранить состояние.

#### Scenario: Session уничтожена

- **WHEN** React wrapper unmount-ится или plugin URL меняется
- **THEN** session MUST удалить listeners и timers
- **AND** все pending requests MUST завершиться контролируемой disposal error.

### Requirement: Host коррелирует полный payload и PreviewResult

Ready session SHALL отправлять полный JSON-compatible `PreviewPayload` в
`sdds.preview.payload` envelope и завершать request только результатом с совпадающим
`requestId`.

#### Scenario: Button render успешен

- **WHEN** host отправляет canonical BasicButton payload с новым `requestId`
- **AND** plugin возвращает `PreviewResult.Success` с тем же `requestId`
- **THEN** host MUST отметить актуальный render успешным.

#### Scenario: Result относится к устаревшему request

- **WHEN** после нового payload приходит success, failure или `superseded` для предыдущего
  `requestId`
- **THEN** host MUST завершить соответствующий старый request
- **AND** result MUST NOT изменить UI status актуального request.

#### Scenario: Plugin не отвечает

- **WHEN** ready или render result не получен за настроенный timeout
- **THEN** host MUST завершить ожидание контролируемой timeout error
- **AND** UI MUST оставаться способным пересоздать session или переключиться на React preview.

### Requirement: Component editor переключает React и Compose renderer

`ComponentEditorPreview` SHALL предоставлять явный выбор React или Compose renderer для
пилотной кнопки, сохраняя существующее React preview.

#### Scenario: Выбран React renderer

- **WHEN** пользователь выбирает React
- **THEN** editor MUST использовать текущий `useStory`, CSS variables и React story controls
  без изменения существующего поведения.

#### Scenario: Выбран Compose renderer

- **WHEN** пользователь выбирает Compose для поддержанной пилотной кнопки
- **THEN** preview viewport MUST отображать `ComposePreviewFrame`
- **AND** frame MUST оставаться тем же iframe при последовательных полных payload.

### Requirement: Первый client vertical slice использует canonical Button fixture

Change SHALL проверять browser host на canonical полном `BasicButton` payload, не формируя его
из текущей предметной модели DS Builder.

#### Scenario: Первичный Compose Button preview

- **WHEN** Compose renderer готов
- **THEN** client MUST отправить canonical Button fixture с новым `requestId`
- **AND** настоящий Compose plugin MUST отобразить `BasicButtonStory`
- **AND** client MUST получить коррелированный success.

#### Scenario: Тестовое значение Button изменено

- **WHEN** поддержанное тестовое значение token, effective property или example prop меняется
- **THEN** client MUST отправить новый полный payload
- **AND** Compose Button MUST обновиться без reload iframe.

#### Scenario: Application payload source отсутствует

- **WHEN** vertical slice использует canonical fixture
- **THEN** change MUST NOT интерпретировать `Config`, `Theme`, variation/style IDs или
  db-service entities как Preview Protocol
- **AND** подключение реального application payload MUST остаться отдельным change.

### Requirement: Host проверяется с настоящим production plugin

Client SHALL иметь воспроизводимую browser smoke-проверку с production artifact
`preview-compose-plugin`, доступным по отдельному HTTP origin.

#### Scenario: Cross-origin browser lifecycle работает end-to-end

- **WHEN** React client и Compose plugin запущены на разных локальных HTTP origins
- **THEN** проверка MUST пройти manifest load, iframe ready, payload submission и success result
- **AND** она MUST подтвердить повторный Button render без reload iframe.
