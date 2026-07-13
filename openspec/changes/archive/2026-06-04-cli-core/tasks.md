## 1. CLI Dependencies and Structure

- [x] 1.1 Inspect `dsbuilder-frontend/cli/build.gradle.kts` and choose minimal Kotlin Multiplatform-compatible dependencies for Clikt command parsing, kotlinx.serialization JSON config, and Ktor client HTTP request support.
- [x] 1.2 Add Clikt, kotlinx.serialization JSON, Ktor client, and required Ktor client engine dependencies to `dsbuilder-frontend/cli` without changing backend services or root microservice builds.
- [x] 1.3 Create logical package structure under `com.dsbuilder.frontend.cli.core.config`, `core.credentials`, `core.http`, and `feature.init`.
- [x] 1.4 Replace ad hoc command dispatch with a Clikt root command and subcommands while preserving testable CLI execution surface.

## 2. Core Config

- [x] 2.1 Add project config models for `projectId`, `designSystemId`, and env credential reference.
- [x] 2.2 Implement `.sdds/config.json` parser and serializer that never includes raw API key fields.
- [x] 2.3 Implement nearest-parent config discovery from current working directory upward.
- [x] 2.4 Return deterministic errors when project context is required and config cannot be found or parsed.

## 3. Core Credentials

- [x] 3.1 Add CLI option parsing support for `--api-key <value>` as a runtime credential override.
- [x] 3.2 Implement credential resolution priority: `--api-key`, configured env variable, then `DSBUILDER_API_KEY`.
- [x] 3.3 Return deterministic missing-credential errors that mention the configured env variable name when available.
- [x] 3.4 Ensure credential resolution does not persist raw API key to `.sdds`, user config, or generated output.

## 4. Core API URL

- [x] 4.1 Add CLI option parsing support for `--api-url <value>` as a runtime backend URL override.
- [x] 4.2 Implement API URL resolution priority: `--api-url`, `DSBUILDER_API_URL`, then default URL defined in code.
- [x] 4.3 Ensure API URL resolution does not read from or persist to `.sdds/config.json`.

## 5. Core HTTP

- [x] 5.1 Add reusable Ktor client/factory abstraction that uses resolved API URL as base URL.
- [x] 5.2 Add request decoration that sends `Authorization: ProjectKey <api_key>`.
- [x] 5.3 Add common response error mapping for `401`, `403`, and `404`.
- [x] 5.4 Keep API key verification delegated to backend gateway/auth-helper/projects-service and avoid local revoked/expired/scope checks.

## 6. Feature Init

- [x] 6.1 Add `dsbuilder init --project-id <id> --design-system-id <id> [--api-key-env <env>]` command handling.
- [x] 6.2 Generate `.sdds/config.json` in the target directory with project metadata and env credential reference only.
- [x] 6.3 Prevent silent overwrite when `.sdds/config.json` already exists.
- [x] 6.4 Add `dsbuilder status` command handling that uses core config, credentials, API URL, and HTTP layers.
- [x] 6.5 Implement `status` requests as `GET /api/projects/{projectId}` and `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}` with `Authorization: ProjectKey <api_key>`.
- [x] 6.6 Make `status` print deterministic project/design-system names and authorized/failure status without project list or raw API key values.
- [x] 6.7 Keep `--help` and `--version` behavior independent from `.sdds`, backend services, Docker, credentials, and private URLs.

## 7. Tests

- [x] 7.1 Add tests for config parsing, serialization, and absence of raw API key/API URL fields in generated config.
- [x] 7.2 Add tests for nearest-parent `.sdds/config.json` discovery and missing-config errors.
- [x] 7.3 Add tests for credential resolution priority and missing-credential errors.
- [x] 7.4 Add tests for API URL resolution priority and code default behavior.
- [x] 7.5 Add tests for Ktor client request header decoration and basic `401`/`403`/`404` error mapping.
- [x] 7.6 Add tests for `init` command config creation and existing-config protection.
- [x] 7.7 Add tests for `status` success output, `401`/`403`/`404` failure output, and absence of raw API key values in output.
- [x] 7.8 Add tests that `status` calls `/api/projects/{projectId}` and `/api/projects/{projectId}/ds/design-systems/{designSystemId}` and does not call `/api/projects` for API key validation.
- [x] 7.9 Add tests for Clikt root help, `init` missing required option errors, and unknown command errors.
- [x] 7.10 Add regression tests that baseline `--help` and `--version` do not require project config or credentials.

## 8. Verification

- [x] 8.1 Run `cd dsbuilder-frontend && ./gradlew test`.
- [x] 8.2 Run `cd dsbuilder-frontend && ./gradlew detekt`.
- [x] 8.3 Run `cd dsbuilder-frontend && ./gradlew spotlessCheck`.
- [x] 8.4 Run `cd dsbuilder-frontend && ./gradlew build`.
- [x] 8.5 If `spotlessCheck` fails only due to changed-file formatting, run `cd dsbuilder-frontend && ./gradlew spotlessApply`, inspect diff, and repeat relevant checks.
