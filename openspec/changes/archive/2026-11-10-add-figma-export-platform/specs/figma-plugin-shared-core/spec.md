## MODIFIED Requirements

### Requirement: Сборка плагина

Сборка плагина MUST собирать Kotlin-модуль сама. Результат сборки Kotlin MUST NOT храниться в Git. Размер `dist/ui.html` MUST NOT превышать 900 КиБ.

#### Scenario: Чистая копия репозитория

- **WHEN** разработчик запускает сборку плагина в чистой копии
- **THEN** сборка MUST создать `dist/ui.html` со встроенным Kotlin-кодом без ручных шагов

#### Scenario: Лишние зависимости

- **WHEN** размер `dist/ui.html` превышает 900 КиБ
- **THEN** проверка сборки MUST завершиться ошибкой
