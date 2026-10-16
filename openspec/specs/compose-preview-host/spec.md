# compose-preview-host Specification

## Purpose
TBD - created by archiving change add-compose-preview-host-to-dsbuilder-client. Update Purpose after archive.
## Requirements
### Requirement: Client загружает Compose plugin по runtime URL

`apps/client` SHALL получать базовый URL Compose Preview Plugin из runtime-конфигурации,
загружать `preview-plugin.json` и разрешать iframe entrypoint относительно URL manifest.
Совместимый Compose plugin SHALL объявлять render и component-description bridge operations.

#### Scenario: Совместимый plugin доступен

- **WHEN** manifest объявляет Compose platform, Preview Protocol v1, обязательные
  ready/payload/result/describe/description message types и выбранный component
- **THEN** client MUST создать iframe с entrypoint из manifest.

#### Scenario: Description bridge отсутствует

- **WHEN** manifest не объявляет describe либо description operation
- **THEN** Compose story controls MUST считаться несовместимыми
- **AND** существующее React preview MUST оставаться доступным.

### Requirement: ComposePreviewSession управляет iframe lifecycle

Client SHALL инкапсулировать manifest, iframe window, ready lifecycle, render и describe request
correlation, timeouts и disposal в отдельной `ComposePreviewSession`, не зависящей от `Config`,
`Theme` и component editor models.

#### Scenario: Plugin сообщает о готовности

- **WHEN** session получает совместимый `sdds.preview.ready` от ожидаемых iframe window и origin
- **THEN** session MUST разрешить render и component describe operations.

#### Scenario: Description пришло от другого source или origin

- **WHEN** window получает `sdds.preview.description` от неожиданного source либо origin
- **THEN** session MUST игнорировать сообщение
- **AND** pending describe request MUST сохранить состояние.

#### Scenario: Session уничтожена

- **WHEN** React wrapper unmount-ится или plugin URL меняется
- **THEN** session MUST удалить listeners и timers
- **AND** render и describe pending requests MUST завершиться контролируемой disposal error.

### Requirement: Host коррелирует полный payload и PreviewResult

Ready session SHALL отправлять полный typed `PreviewPayload` в `sdds.preview.payload` envelope
и завершать request только schema-compatible результатом с совпадающим `requestId`.

#### Scenario: Button render успешен

- **WHEN** host отправляет assembled BasicButton payload с новым `requestId`
- **AND** plugin возвращает `PreviewResult.Success` с тем же `requestId`
- **THEN** host MUST отметить актуальный render успешным.

#### Scenario: Предыдущий request вытеснен

- **WHEN** plugin возвращает `PreviewResult.Failure` с `code: "superseded"` для предыдущего
  `requestId`
- **THEN** host MUST завершить соответствующий старый request как failure
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

### Requirement: Host проверяется с настоящим production plugin

Client SHALL иметь воспроизводимую browser smoke-проверку с production artifact
`preview-compose-plugin`, доступным по отдельному HTTP origin.

#### Scenario: Cross-origin browser lifecycle работает end-to-end

- **WHEN** React client и Compose plugin запущены на разных локальных HTTP origins
- **THEN** проверка MUST пройти manifest load, iframe ready, payload submission и success result
- **AND** она MUST подтвердить повторный Button render без reload iframe.

