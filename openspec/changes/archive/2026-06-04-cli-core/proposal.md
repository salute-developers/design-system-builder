## Why

CLI `dsbuilder` должен стать основой для будущих project-scoped команд DS Builder, но сейчас у него нет общего механизма определения project context, чтения локального config и передачи project access key в backend API. Это нужно оформить до появления команд publish/build/tokens, чтобы не дублировать auth/config/http plumbing в каждой фиче.

## What Changes

- Добавить CLI core foundation для работы с локальным JSON config `.sdds/config.json`, который хранит только non-secret project config.
- Подключить Kotlin Multiplatform command parser для subcommands, options, help и deterministic CLI errors.
- Добавить resolution API key из runtime sources: `--api-key`, env variable из `.sdds/config.json`, затем fallback `DSBUILDER_API_KEY`.
- Добавить runtime API URL resolution из `--api-url`, `DSBUILDER_API_URL`, затем default URL на уровне кода.
- Добавить общий authenticated HTTP layer на Ktor client, который использует resolved API URL, project/design-system context и `Authorization: ProjectKey <api_key>`.
- Добавить `feature-init`, которая создает `.sdds/config.json` с `projectId`, `designSystemId` и именем env-переменной для API key.
- Добавить `status` command, которая проверяет, что config и API key работают для текущего project, без вывода списка проектов или raw secret.
- Не добавлять username/password login, `feature-auth`, `feature-publish`, OS keychain, stored sessions, logout/forget-key или server-side access key management из CLI.
- Не менять backend API: project access key уже проверяется gateway/auth-helper/projects-service.

## Capabilities

### New Capabilities

- `cli-core`: Определяет local project config, API key credential resolution, authenticated HTTP client foundation и `init` workflow для CLI `dsbuilder`.

### Modified Capabilities

- `frontend-cli`: Расширяет базовое CLI-приложение от smoke behavior к foundation для project-scoped backend команд.

## Impact

- Affected build/module: `dsbuilder-frontend/cli`.
- Affected CLI config: новая локальная директория `.sdds/` и файл `.sdds/config.json`.
- Affected runtime configuration: env variables для project API key, включая project-specific env name и fallback `DSBUILDER_API_KEY`, а также `DSBUILDER_API_URL` для override backend URL.
- Affected dependencies: Clikt для command parsing, kotlinx.serialization JSON для config, Ktor client для network requests.
- Backend services, gateway routes, Projects Service access key persistence и Auth Helper verification не меняются.
