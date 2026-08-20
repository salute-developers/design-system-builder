## 1. Config Model

- [x] 1.1 Add optional `alias` field to `ProjectConfigTenant` with Russian KDoc and keep config without aliases valid.
- [x] 1.2 Extend config codec/store tests for reading and writing `tenants[].alias` without raw API key or API URL fields.
- [x] 1.3 Add a config-store update path that can update tenants while preserving local alias values by matching `tenant.id`.

## 2. Alias Domain And Application

- [x] 2.1 Add theme alias command/result models for list, set, and unset operations in `feature.theme.application`.
- [x] 2.2 Implement alias validation for blank aliases, missing tenants, duplicate aliases, and missing alias removal targets.
- [x] 2.3 Implement use cases that read nearest project context, update `.sdds/config.json`, and never require backend credentials.
- [x] 2.4 Add focused unit tests for alias list, set, unset, validation failures, and no-modification-on-error behavior.

## 3. CLI Presentation And DI

- [x] 3.1 Add `theme alias` command group with `list`, `set --tenant-id <id> --alias <alias>`, and `unset <alias>` subcommands.
- [x] 3.2 Map alias use case results to deterministic stdout/stderr and non-zero exit code on failures.
- [x] 3.3 Register alias commands and use cases in `ThemeFeatureModule` without changing baseline root command behavior.
- [x] 3.4 Add CLI execution tests for alias help without config, list output, set success, unset success, and validation errors.

## 4. Theme Fetch Preservation

- [x] 4.1 Update `theme fetch` config write flow so refreshed backend tenant metadata keeps existing aliases for matching `tenant.id`.
- [x] 4.2 Ensure aliases for tenants missing from the backend response are not preserved as stale config entries.
- [x] 4.3 Add regression tests that `theme fetch` preserves alias for existing tenant and removes alias with removed tenant.
- [x] 4.4 Confirm `theme fetch` still preserves `projectId`, `designSystemId`, `credential`, `directoryPath`, and secret-safety behavior.

## 5. Verification

- [x] 5.1 Run `cd dsbuilder-frontend && ./gradlew :cli:test`.
- [x] 5.2 Run `cd dsbuilder-frontend && ./gradlew :cli:spotlessCheck`.
- [x] 5.3 Run `cd dsbuilder-frontend && ./gradlew :cli:detekt`.
- [x] 5.4 If formatting fails only for changed files, run `cd dsbuilder-frontend && ./gradlew :cli:spotlessApply`, inspect diff, and rerun checks.
