## MODIFIED Requirements

### Requirement: Условие включения Compose-preview
Клиент SHALL показывать Compose-preview только если задан прямой адрес плагина либо бэкенд сообщает адрес активного билда. Без них клиент MUST вести себя так же, как до этого изменения. Compose-preview SHALL предлагаться компоненту платформы `compose`, чьё имя входит в `manifest.components`; web-компонентам Compose-переключатель MUST NOT предлагаться.

#### Scenario: Адреса плагина нет
- **WHEN** клиент собран без `VITE_COMPOSE_PREVIEW_PLUGIN_URL`, а бэкенд не сообщает активного билда
- **THEN** Compose-preview MUST NOT отображаться ни в одном компоненте
- **THEN** React-preview MUST работать без изменений

#### Scenario: Адрес плагина есть, компонент поддержан
- **WHEN** задан прямой адрес либо бэкенд сообщает адрес активного билда, manifest совместим и Compose-компонент перечислен в manifest
- **THEN** редактор компонента MUST предлагать Compose-preview

#### Scenario: Web-компонент
- **WHEN** пользователь открывает web-компонент
- **THEN** редактор MUST показывать только React-preview
