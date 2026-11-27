## MODIFIED Requirements

### Requirement: Documentation platform step

CLI `docs generate` SHALL enrich the documentation tree with the platform tool before building the package, and SHALL resolve the documentation platform from the explicit option or from project config.

#### Scenario: Платформенный шаг собирает дерево

- **WHEN** developer runs `dsbuilder docs generate` without `--docs-dir`
- **WHEN** a delegate serves the resolved platform and supports documentation aggregation
- **THEN** CLI MUST run that delegate before reading structures
- **THEN** CLI MUST build the package from the tree the delegate produced
- **THEN** CLI MUST report which toolchain aggregated the tree

#### Scenario: Готовое дерево не трогается

- **WHEN** developer runs `dsbuilder docs generate --docs-dir <dir>` or passes `--no-aggregate`
- **THEN** CLI MUST NOT run the platform aggregation step
- **THEN** CLI MUST build the package from the given or default tree

#### Scenario: Платформа без инструмента не ломает сборку

- **WHEN** the resolved platform is not `design`
- **WHEN** no delegate serves the resolved platform or the delegate does not support documentation aggregation
- **THEN** CLI MUST skip the aggregation step
- **THEN** CLI MUST build the package from the default tree

#### Scenario: Документацию дизайна агрегирует сам CLI

- **WHEN** the resolved platform is `design` and neither `--docs-dir` nor `--no-aggregate` is given
- **THEN** CLI MUST run its own design documentation aggregation instead of a platform delegate
- **THEN** CLI MUST build the package from the tree that aggregation produced
- **THEN** CLI MUST report the toolchain `dsbuilder-design`

#### Scenario: Ошибка платформенного шага останавливает сборку

- **WHEN** the platform aggregation step fails
- **THEN** CLI MUST return that failure
- **THEN** CLI MUST NOT write `docs.json`, `manifest.json` or the archive

#### Scenario: Платформа документации без опции

- **WHEN** `--platform` is absent and project config declares exactly one platform
- **THEN** CLI MUST use that platform
- **WHEN** `--platform` is absent and project config declares no platform
- **THEN** CLI MUST use the historical default `compose`
- **WHEN** `--platform` is absent and project config declares several platforms
- **THEN** CLI MUST fail deterministically naming `--platform`
- **WHEN** `--platform` is given
- **THEN** CLI MUST use it, including `design`, which has no platform tool
