## ADDED Requirements

### Requirement: Имена конфигураций в сгенерированном коде

Web-генератор SHALL строить из kebab-case имени конфигурации camelCase-идентификатор (`clear-action` → `clearAction`)
для имени файла конфига (`<Компонент>.<идентификатор>.config.ts`, у `default` — `<Компонент>.config.ts`), переменных и
экспорта компонента конфигурации, а значение пропа `appearance` SHALL оставаться именем из данных, ключом-строкой в
`createConditionalComponent`. Имя не в kebab-case MUST останавливать генерацию с ошибкой, называющей компонент и
конфигурацию.

#### Scenario: Имя с дефисом

- **WHEN** у компонента `Accordion` есть конфигурации `default` и `clear-action`
- **THEN** генератор MUST создать `Accordion.clearAction.config.ts`, экспорт `AccordionClearAction` и ключ `'clear-action'`
- **THEN** сгенерированный код MUST компилироваться TypeScript

#### Scenario: Имя не по правилу

- **WHEN** у компонента `Accordion` есть конфигурация `Accordion new`
- **THEN** генерация MUST завершиться ошибкой с текстом, содержащим `Accordion` и `Accordion new`
