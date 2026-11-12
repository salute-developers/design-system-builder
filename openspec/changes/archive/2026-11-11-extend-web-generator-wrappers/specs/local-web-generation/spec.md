## ADDED Requirements

### Requirement: Корневой индекс реэкспортирует компоненты ядра без конфига темы

Корневой `src/index.ts` пакета, в котором есть компоненты, SHALL реэкспортировать из `@salutejs/plasma-new-hope/styled-components` компоненты ядра из списка генератора. В список входят компоненты, которые sdds-serv реэкспортирует из ядра без конфига темы и которые не заводятся в ДС; первый элемент — `SSRProvider`.

#### Scenario: SSRProvider в пакете компонентов

- **WHEN** developer runs `generate:components` or `generate:ds`
- **THEN** `src/index.ts` MUST содержать `export { SSRProvider } from '@salutejs/plasma-new-hope/styled-components';`

#### Scenario: Пакет только с темой

- **WHEN** developer runs `generate:theme`
- **THEN** `src/index.ts` MUST NOT содержать реэкспорты компонентов ядра

### Requirement: Компонент, которому нужна тема, генерируется только вместе с темой

Генерация компонентов SHALL учитывать, будет ли в пакете тема: `generate:ds` — всегда, `generate:components` с `--package` — никогда, `generate:components` без `--package` — если в выходном каталоге есть `src/theme`.

#### Scenario: ViewContainer в пакете с темой

- **WHEN** developer runs `generate:ds` for a design system with `ViewContainer`
- **THEN** пакет MUST содержать `ViewContainer`, чьи стили `onDark` и `onLight` берут наборы переменных из `viewContainer` темы пакета

#### Scenario: ViewContainer в пакете без темы

- **WHEN** developer runs `generate:components --package`
- **THEN** `ViewContainer` MUST NOT попасть в пакет, а генератор MUST напечатать предупреждение и завершиться успешно
