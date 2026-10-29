# Spec Delta

## Purpose

Определяет генератор маппингов Style API в `js/cli`: как из JSDoc-аннотаций токенов пакета компонентов строится
`web-api-meta.json`, связывающий свойства общего конфига с web-токенами компонентов.

## ADDED Requirements

### Requirement: Style API meta is built from token annotations

`npm run generate:api-meta` in `js/cli` SHALL build Style API metadata from JSDoc annotations of token dictionaries,
either of an installed package (`--package <name>`, reading `types/**/*.tokens.d.ts`) or of sources (`--source <dir>`).

#### Scenario: Параметры компонента из аннотаций

- **WHEN** a token is annotated with `@styleType <type>`
- **THEN** the component MUST get a param with `paramName` (the token key), `type` and `id` (`@styleProp`, default the token key)
- **THEN** `@stylePart` MUST become `part`, `@styleState` MUST become `state`, `@deprecated {@link <token>}` MUST become `deprecated`
- **THEN** `@styleComponent <A> [<B> …]` MUST assign the token to the listed components instead of the component of the file

#### Scenario: Какие словари читаются

- **WHEN** a token file is read
- **THEN** the dictionary MUST be the `tokens` export, or otherwise the only `*Tokens` export; `privateTokens` and `innerTokens` MUST be ignored
- **THEN** a dictionary without any `@styleType` MUST be skipped as not annotated yet, and a file without a dictionary MUST produce a component with empty params
- **THEN** `_beta` directories and `Tour/components/Card` MUST NOT be read

#### Scenario: Отказ при неполной разметке

- **WHEN** an annotated dictionary has a token without `@styleType`, or two files produce the same component name
- **THEN** generation MUST fail naming the tokens or the files

#### Scenario: Куда пишется результат

- **WHEN** `--out` is omitted
- **THEN** the metadata MUST be written to `<sdds>/web/web-api-meta.json`, where `<sdds>` is `--sdds` or `js/cli/.sdds`
- **THEN** components and params MUST be sorted, so that repeated runs over the same sources produce an identical file
