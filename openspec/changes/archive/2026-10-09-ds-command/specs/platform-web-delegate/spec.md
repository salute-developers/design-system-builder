# Spec Delta

## MODIFIED Requirements

### Requirement: Web toolchain delegate

CLI SHALL register a platform delegate with toolchain id `web` that serves the `react` target platform through
the npm scripts of the web generator `js/cli` in the DS Builder repository.

#### Scenario: Делегат объявляет себя

- **WHEN** CLI builds its platform delegate registry
- **THEN** the registry MUST resolve `react` to the `web` toolchain
- **THEN** the `web` toolchain MUST declare the capabilities `THEME`, `COMPONENTS` and `DESIGN_SYSTEM`
- **THEN** `DOCS_AGGREGATE` MUST be reported as unsupported without starting a process

#### Scenario: Тема и компоненты генерируются раздельно

- **WHEN** the delegate runs the `THEME` capability
- **THEN** it MUST run `npm run generate:theme -- --sdds <workspace .sdds>`
- **WHEN** the delegate runs the `COMPONENTS` capability
- **THEN** it MUST run `npm run generate:components -- --sdds <workspace .sdds>`
- **WHEN** the delegate runs the `DESIGN_SYSTEM` capability
- **THEN** it MUST run `npm run generate:ds -- --sdds <workspace .sdds>` once
- **THEN** `--output` MUST be passed as `--out <output>` and passthrough arguments (for example `--package`) as is
- **THEN** the working directory MUST be the web generator directory and the output MUST go to the terminal
