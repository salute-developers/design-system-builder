## ADDED Requirements

### Requirement: Web-плагин превью — самостоятельное приложение

В репозитории SHALL быть приложение `js/apps/preview-web-plugin`, которое собирается в статический
бандл с `index.html`, `preview-plugin.json` и своими JS и CSS. Плагин SHALL содержать собственные
React, `styled-components`, `@salutejs/plasma-new-hope` и `@salutejs/plasma-icons` и SHALL NOT
импортировать код из `js/apps/client`.

#### Scenario: Сборка плагина

- **WHEN** в `js/apps/preview-web-plugin` выполняется `npm run build`
- **THEN** каталог сборки MUST содержать `index.html`, `preview-plugin.json` и все файлы, на которые они ссылаются

### Requirement: Манифест web-плагина

`preview-plugin.json` SHALL объявлять `schemaVersion: 1`, `platform: "web"`, `protocolVersion: 1`,
точку входа `index.html`, сообщения обмена `sdds.preview.*` в `payloadBridge` и список поддержанных
компонентов `components`. Список SHALL совпадать с реестром компонентов плагина и SHALL содержать `Button`. Рядом с манифестом SHALL лежать
`api-meta.json` — web API-мета, сгенерированная из той же версии `@salutejs/plasma-new-hope`, что входит
в бандл плагина. Манифест SHALL объявлять эту версию в `plasmaNewHopeVersion` и sha256 файла меты
в `apiMetaSha256`.

#### Scenario: Клиент читает манифест

- **WHEN** клиент загружает `preview-plugin.json` web-плагина
- **THEN** манифест MUST проходить проверку клиента для платформы `web`
- **THEN** `components` MUST содержать `Button`

#### Scenario: Мета соответствует бандлу

- **WHEN** проверяется сборка плагина
- **THEN** `apiMetaSha256` MUST совпадать с sha256 `api-meta.json`, а `plasmaNewHopeVersion` — с установленной версией `@salutejs/plasma-new-hope`
- **THEN** `api-meta.json` MUST содержать все компоненты из `components`

### Requirement: Мост сообщений совместим с хостом превью

Плагин SHALL отправлять `sdds.preview.ready` с версией протокола после загрузки и SHALL отвечать на
`sdds.preview.describe` сообщением `sdds.preview.description`, а на `sdds.preview.payload` — сообщением
`sdds.preview.result` с тем же `requestId`, в тех же форматах, что ожидает `ComposePreviewSession`.
Плагин SHALL принимать сообщения только от родительского окна. Ответ SHALL отправляться в origin
отправителя. `success` SHALL отправляться после отрисовки компонента.

#### Scenario: Отрисовка по payload

- **WHEN** хост отправил payload платформы `WEB` для `Button`
- **THEN** плагин MUST отрисовать `Button` и ответить `success` с тем же `requestId`

#### Scenario: Неизвестный компонент

- **WHEN** payload ссылается на компонент, которого нет в реестре плагина
- **THEN** плагин MUST ответить `failure` с кодом `component_not_found`

#### Scenario: Некорректный payload

- **WHEN** payload не соответствует платформе `WEB` или в нём нет обязательных полей
- **THEN** плагин MUST ответить `failure` с кодом `invalid_payload` и причиной

#### Scenario: Ошибка отрисовки

- **WHEN** при отрисовке компонента возникло исключение
- **THEN** плагин MUST ответить `failure` с кодом `render_crashed` и текстом ошибки в `details`

### Requirement: Story Button и её аргументы в плагине

Плагин SHALL содержать story `Button` `Default` с теми же аргументами и отрисовкой, что story клиента:
`disabled`, `isLoading`, `stretching` (`auto`/`filled`/`fixed`), `contentPlacing` (`default`/`relaxed`),
`value`, `text`, `enableContentLeft`, `enableContentRight`, иконки `IconPlasma` и `IconShazam`.
На `describe` плагин SHALL возвращать эти аргументы как описание свойств: логические — `boolean`,
строковые со списком — `singleChoice`, остальные строковые — `string`, со значениями по умолчанию
из story. Значения из `example.props` и имена стилей из `component.variations` SHALL передаваться
story как пропсы.

#### Scenario: Описание story

- **WHEN** хост запросил `describe` для `Button`
- **THEN** плагин MUST вернуть восемь свойств story с типами и значениями по умолчанию

#### Scenario: Изменён аргумент story

- **WHEN** payload содержит `example.props.text = "Купить"`
- **THEN** кнопка MUST отображать текст «Купить»

### Requirement: Локальная раздача web-плагина

Для разработки плагин SHALL раздаваться dev-сервером на отдельном порту (отдельный origin от клиента)
с разрешением CORS для чтения манифеста клиентом. Адрес по умолчанию SHALL быть задан в
`js/docker-compose.dev.yml`.

#### Scenario: Локальный контур

- **WHEN** разработчик поднял клиент и dev-сервер плагина
- **THEN** клиент MUST загрузить манифест и `index.html` плагина по адресу по умолчанию, и origin плагина MUST отличаться от origin клиента
