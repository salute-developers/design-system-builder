## MODIFIED Requirements

### Requirement: Независимые функции web-маппинга

Пакет SHALL публиковать точку входа `@sddsjs/design-system-builder-generator/web-mapping` (поле `exports`
`package.json`) с правилами, которыми генератор переводит свойства компонента в web-параметры и переменные темы: типы API-меты и
базовые параметры свойства, суффиксы ключей состояний, данные `web-adapter.json`, подстановка `$1…$n`, имена
компонентов и `compose`-связи, перевод px в `rem` и радиус с поправкой, поле типографики параметра, основа имени переменных
типографики темы, имя объекта токенов и базового конфига ядра компонента по манифесту, имя переменной цвета
темы и суффиксы производных токенов состояний. Модуль SHALL
содержать только правила, которые вызывает сам генератор. Функции SHALL быть чистыми и SHALL NOT зависеть от генерации кода,
превью и формата payload. Модуль SHALL NOT импортировать модули Node.js, `@salutejs/plasma-new-hope` и код пакета вне
`src/web-mapping`, кроме `src/data/web-adapter.json`. Генератор SHALL пользоваться этими функциями сам, а не держать
вторую реализацию тех же правил.

#### Scenario: Генератор на общих функциях

- **WHEN** генератор подставляет шаблон web-адаптера, переводит размер в `rem`, выбирает ключ состояния или поле типографики, строит `deps` по `compose` имена переменных цвета и типографики темы или имя объекта ядра
- **THEN** он MUST вызывать функции `src/web-mapping`
- **THEN** сгенерированный код MUST совпадать с кодом до выноса функций

#### Scenario: Импорт в браузерной сборке

- **WHEN** приложение на Vite импортирует `@sddsjs/design-system-builder-generator/web-mapping`
- **THEN** сборка MUST завершиться без полифилов Node.js и MUST NOT включить в бандл `@salutejs/plasma-new-hope` из зависимостей пакета генератора

#### Scenario: Ограничение импортов

- **WHEN** запускаются тесты `js/cli`
- **THEN** тест MUST упасть, если файл `src/web-mapping`, кроме `*.test.ts`, импортирует `node:*`, `@salutejs/plasma-new-hope` или модуль вне `src/web-mapping` и `src/data/web-adapter.json`

#### Scenario: Проверка типов под флагами браузерного потребителя

- **WHEN** выполняется `npm run typecheck` в `js/cli`
- **THEN** `src/web-mapping` MUST проверяться и с настройками CLI, и с `moduleResolution: bundler`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`

#### Scenario: Тесты подкаталогов

- **WHEN** выполняется `npm test` в `js/cli`
- **THEN** MUST запускаться тесты из подкаталогов `src`, включая `src/web-mapping`

#### Scenario: Compose-связи из адаптера

- **WHEN** в `web-adapter.json` у `tabs` указано `compose: ["icon-tab-item", "tab-item"]`
- **THEN** `composeOf` MUST вернуть для `tabs` `[{ id: "icon-tab-item", name: "IconTabItem" }, { id: "tab-item", name: "TabItem" }]` в этом порядке

#### Scenario: Основа имени типографики

- **WHEN** вызывается `typographyVariableBase` для `header.h3.bold`, `display.l.normal` и `text.m.bold`
- **THEN** результат MUST быть `h3-bold`, `dspl-l` и `text-m-bold`, как в `@salutejs/plasma-typo` и сгенерированной теме

#### Scenario: Незнакомый вес в основе имени типографики

- **WHEN** вызывается `typographyVariableBase` для стиля с весом не из `normal`, `medium`, `bold` (`header.h3.semibold`)
- **THEN** вес MUST остаться в основе как есть (`h3-semibold`), а не выбрасываться: иначе два стиля получают одно имя переменной

#### Scenario: Объект ядра по манифесту

- **WHEN** манифест `TabItem` задаёт `coreTokensExport: "tabsTokens"`, а у `Button` манифеста нет
- **THEN** `coreTokensExportName` MUST вернуть `tabsTokens` для `TabItem` и `buttonTokens` для `Button`
