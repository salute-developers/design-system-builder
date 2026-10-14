## MODIFIED Requirements

### Requirement: Условие включения Compose-preview
Клиент SHALL показывать Compose-preview только если при сборке задан адрес плагина. Без адреса клиент MUST вести себя так же, как до этого изменения. Compose-preview SHALL предлагаться компоненту платформы `compose`, чьё имя входит в `manifest.components`; web-компонентам Compose-переключатель MUST NOT предлагаться.

#### Scenario: Адрес плагина не задан
- **WHEN** клиент собран без `VITE_COMPOSE_PREVIEW_PLUGIN_URL`
- **THEN** Compose-preview MUST NOT отображаться ни в одном компоненте
- **THEN** React-preview MUST работать без изменений

#### Scenario: Адрес плагина задан, компонент поддержан
- **WHEN** адрес задан, manifest совместим и Compose-компонент перечислен в manifest
- **THEN** редактор компонента MUST предлагать Compose-preview

#### Scenario: Web-компонент
- **WHEN** пользователь открывает web-компонент
- **THEN** редактор MUST показывать только React-preview
