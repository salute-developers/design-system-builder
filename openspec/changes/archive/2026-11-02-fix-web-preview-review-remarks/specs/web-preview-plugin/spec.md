## MODIFIED Requirements

### Requirement: Мост сообщений совместим с хостом превью

Плагин SHALL отправлять `sdds.preview.ready` с версией протокола после загрузки и SHALL отвечать на
`sdds.preview.describe` сообщением `sdds.preview.description`, а на `sdds.preview.payload` — сообщением
`sdds.preview.result` с тем же `requestId`, в тех же форматах, что ожидает `ComposePreviewSession`.
Плагин SHALL принимать сообщения только от родительского окна. Ответ SHALL отправляться в origin
отправителя. `success` SHALL отправляться после отрисовки компонента и завершения подготовки шрифтов темы.

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

## ADDED Requirements

### Requirement: Web-плагин дожидается шрифтов темы

Плагин SHALL запрашивать загрузку каждого начертания токенов `fontFamily` и SHALL отвечать на payload только после
завершения всех загрузок, но не позже чем через 5 секунд. Начертание, не загруженное за это время или с ошибкой,
SHALL считаться недоступным.

#### Scenario: Шрифт загружается

- **WHEN** загрузка начертания ещё не завершена
- **THEN** плагин MUST NOT отправлять `success` до её завершения

#### Scenario: Подмена шрифта разрешена

- **WHEN** начертание недоступно и у токена `allowFallback: true`
- **THEN** плагин MUST ответить `success` с warning `font_fallback` и путём токена

#### Scenario: Подмена шрифта не разрешена

- **WHEN** начертание недоступно и у токена нет `allowFallback: true`
- **THEN** плагин MUST ответить `failure` с кодом `font_unavailable` и путём токена

#### Scenario: Загрузка зависла

- **WHEN** загрузка начертания не завершилась за 5 секунд
- **THEN** плагин MUST ответить так же, как при ошибке загрузки, до истечения таймаута хоста
