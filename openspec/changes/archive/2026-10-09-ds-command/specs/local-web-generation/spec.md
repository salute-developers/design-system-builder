# Spec Delta

## ADDED Requirements

### Requirement: Local web design system generation

`npm run generate:ds` SHALL generate the theme and the components in one run, combining `generate:theme` and
`generate:components`.

#### Scenario: Исходники дизайн-системы

- **WHEN** developer runs `generate:ds` without `--package`
- **THEN** CLI MUST replace `src/theme`, `src/components` and `src/index.ts` in the output directory
- **THEN** the result MUST be identical to running `generate:theme` and `generate:components`

#### Scenario: Полный пакет с --package

- **WHEN** developer runs `generate:ds --package`
- **THEN** CLI MUST build one package with the theme and the components, the same way as the generation service
- **THEN** the archive MUST be written as `<scope>-<name>-<version>.tgz` without a part suffix

## MODIFIED Requirements

### Requirement: Local web generation output

`npm run generate:theme` and `npm run generate:components` SHALL generate the theme and the components
separately. Each command SHALL replace only its own part of the output directory (`--out`, default
`js/cli/output`).

#### Scenario: Исходники части

- **WHEN** developer runs `generate:theme` or `generate:components` without `--package`
- **THEN** CLI MUST replace only `src/theme` or `src/components` respectively and keep the other part
- **THEN** `src/index.ts` MUST export exactly what `src` contains: top-level components and the theme, if present

#### Scenario: Пакет части с --package

- **WHEN** developer runs either command with `--package`
- **THEN** CLI MUST build a package of that part only, the same way as the generation service (pacote: dependencies and `npm run build`)
- **THEN** the package name MUST be given by `--name`; without `--name` CLI MUST fail before generating anything
- **WHEN** a command runs without `--package`
- **THEN** `--name` MUST NOT be required, because the package name does not affect `src`
- **THEN** the archive MUST be written as `<scope>-<name>-<version>-theme.tgz` or `…-components.tgz`, so that archives of the parts do not overwrite each other
- **THEN** the temporary build directory MUST be removed, also when the build fails

#### Scenario: Пакет без темы

- **WHEN** the package has no theme
- **THEN** the build MUST skip copying theme CSS and MUST NOT export the theme
- **THEN** the full package of the generation service MUST build as before
