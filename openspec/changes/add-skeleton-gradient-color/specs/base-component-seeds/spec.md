## ADDED Requirements

### Requirement: Skeleton задаёт цвет градиента анимации shimmer

Сиды компонентов ds-service SHALL задавать `Skeleton` свойство `gradientColor`, привязанное к вариации `view`, со значением токена `surface.default.skeleton-gradient` в стиле `default`. Значения `fadeInColor` и `fadeOutColor` MUST остаться без изменений.

#### Scenario: Новая дизайн-система

- **WHEN** создаётся дизайн-система из сидов
- **THEN** стиль `view: default` компонента `Skeleton` MUST содержать `gradientColor` со ссылкой на `surface.default.skeleton-gradient`

#### Scenario: Превью Skeleton

- **WHEN** пользователь открывает web-превью `Skeleton` новой дизайн-системы с анимацией `shimmer`
- **THEN** web-плагин MUST задать `--plasma-skeleton-gradient-color` значением токена, и линия скелетона MUST быть видна
