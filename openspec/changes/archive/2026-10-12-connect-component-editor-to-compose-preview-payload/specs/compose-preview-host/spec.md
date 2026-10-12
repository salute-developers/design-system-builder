## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Первый client vertical slice использует canonical Button fixture

**Reason**: browser host уже проверен canonical fixture; production preview теперь получает
payload, собранный из актуального component editor draft.

**Migration**: fixture сохраняется только в host/session tests и smoke harness, а
`ComponentEditorPreview` использует `ComposePreviewPayloadAssembler`.
