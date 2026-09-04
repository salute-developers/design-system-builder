## Context

`dsbuilder-frontend/cli` сейчас содержит минимальный Kotlin Multiplatform CLI bootstrap с `--help` и `--version`. Будущие команды DS Builder будут работать в project-scoped context и обращаться к backend через gateway, где project access key уже проверяется Auth Helper и Projects Service.

Ключевая граница этой change: CLI не создает, не отзывает и не валидирует API key локально. CLI только находит project config, получает raw API key из runtime source и передает его в `Authorization: ProjectKey <api_key>`.

## Goals / Non-Goals

**Goals:**

- Ввести `core` структуру внутри `:cli` для local project config, credential resolution и authenticated HTTP layer.
- Использовать Kotlin Multiplatform command parser для `init`, `status`, global options, help и CLI errors.
- Поддержать `.sdds/config.json` как commit-able project config без secrets.
- Поддержать API key из `--api-key`, project-specific env variable и fallback `DSBUILDER_API_KEY`.
- Поддержать API URL из `--api-url`, `DSBUILDER_API_URL` и default URL на уровне кода.
- Добавить `init` command для создания `.sdds/config.json`.
- Добавить `status` command для проверки, что resolved API key авторизует доступ к configured project.
- Сохранить возможность monorepo layout, где разные поддиректории имеют разные `.sdds` и разные env variable names.
- Покрыть config discovery, credential priority, config generation и HTTP header behavior тестами.

**Non-Goals:**

- Не добавлять username/password login, OAuth browser login, device flow или refresh token storage.
- Не добавлять `feature-auth`, `feature-publish` или product-specific backend команды.
- Не сохранять raw API key в `.sdds`, OS keychain или user-level config.
- Не добавлять CLI команды для создания, отзыва или list project access keys.
- Не менять backend endpoints, Auth Helper, Projects Service или gateway authorization.

## Decisions

### 1. Core остается внутри `:cli`, а не отдельным Gradle module

В первой итерации `dsbuilder-frontend` содержит только `:cli`, поэтому физический `:core` module добавит build complexity без реальной переиспользуемости. Логическую границу выражаем пакетами:

```text
com.dsbuilder.frontend.cli.core.config
com.dsbuilder.frontend.cli.core.credentials
com.dsbuilder.frontend.cli.core.http
com.dsbuilder.frontend.cli.feature.init
```

Альтернатива: сразу создать `:core` и `:feature-init`. Отклонено для этой change, потому что пока нет нескольких CLI modules или shared native/JVM implementations, которым нужен отдельный artifact.

### 2. Command parsing строится на Clikt

CLI должен использовать Clikt как command parser для root command `dsbuilder`, subcommands `init` и `status`, typed options, generated help и deterministic option errors. Clikt поддерживает Kotlin Multiplatform targets и снимает необходимость поддерживать собственный parser для required options, nested commands и future command growth.

Ожидаемая структура:

```text
dsbuilder
  init --project-id <id> --design-system-id <id> [--api-key-env <env>]
  status [--api-key <value>] [--api-url <url>]
```

Альтернатива: оставить ручной parser поверх `Array<String>`. Отклонено, потому что уже в этой change появляются subcommands, required options, global credential override и стабильные help/error contracts. Ручной parser быстро начнет дублировать поведение CLI framework.

### 3. `.sdds/config.json` хранит только non-secret project context

Локальный config должен содержать только `projectId`, `designSystemId` и credential reference через env variable name:

```json
{
  "projectId": "project-a",
  "designSystemId": "design-system-a",
  "credential": {
    "type": "env",
    "name": "DSBUILDER_PROJECT_A_API_KEY"
  }
}
```

Raw API key не записывается в `.sdds`, потому что директория может быть добавлена в git. `.sdds` считается project metadata, а не private credential storage.

JSON выбран вместо TOML, потому что config маленький, генерируется `init` command и может парситься через `kotlinx.serialization` без отдельной TOML dependency. Комментарии и ручное редактирование не являются приоритетом MVP.

Альтернатива: использовать `.sdds/config.toml` или `.sdds/config.local.toml`. Отклонено для MVP, потому что TOML добавляет отдельную dependency, а local secret config усложняет workflow и все равно оставляет риск accidental commit.

### 4. Config discovery использует nearest-parent lookup

CLI запускается из `cwd` и ищет ближайший `.sdds/config.json` вверх по дереву. Это позволяет monorepo layout:

```text
repo/
  package-a/.sdds/config.json
  package-b/.sdds/config.json
```

Команда из `package-a/src` использует config `package-a`, а команда из `package-b/src` использует config `package-b`.

Альтернатива: требовать explicit `--config` или root-level multi-project config. Отклонено для первой версии, потому что nearest-parent lookup проще и совпадает с поведением многих CLI tools.

### 5. Credential resolution ограничен env/arg sources

Порядок приоритета:

```text
1. --api-key <value>
2. env variable из .sdds/config.json
3. DSBUILDER_API_KEY
```

`--api-key` нужен для одноразовых запусков и тестов, env variable - для локальной разработки и CI. Если key не найден, CLI возвращает понятную ошибку с именем ожидаемой env variable.

Альтернатива: добавить OS keychain и `auth store-key`. Отклонено для MVP, потому что это превращает change в feature-auth и требует platform-specific behavior.

### 6. API URL не хранится в project config

Backend base URL является runtime environment setting, а не project identity. Порядок resolution:

```text
1. --api-url <value>
2. DSBUILDER_API_URL
3. default API URL на уровне кода
```

Это позволяет коммитить `.sdds/config.json` без привязки к local/staging/production environment и не дублировать URL в monorepo подпроектах.

Альтернатива: хранить `apiUrl` в `.sdds/config.json`. Отклонено, потому что такой config становится environment-specific и хуже подходит для shared repository metadata.

### 7. Authenticated HTTP layer не валидирует key локально

Core HTTP layer строится на Ktor client и формирует requests с:

```text
baseUrl = resolved API URL
Authorization = ProjectKey <api_key>
```

Ktor client выбран, потому что проект уже использует Ktor stack, а client имеет Kotlin Multiplatform support и позволяет оставить networking внутри общего CLI подхода. Backend остается источником истины для revoked/expired/scopes/projectId checks. CLI может маппить `401`, `403`, `404` в пользовательские ошибки, но не должен пытаться повторять gateway authorization logic.

Альтернатива: использовать JVM-only HTTP client или добавить CLI-side preflight verification endpoint. JVM-only client отклонен из-за Kotlin Multiplatform направления CLI, а отдельный preflight endpoint не нужен для foundation, потому что существующий protected request уже даст корректный backend auth result.

### 8. `feature-init` владеет local project setup commands

`dsbuilder init` принимает `--project-id`, `--design-system-id` и optional `--api-key-env`, создает `.sdds/config.json` и не принимает raw API key или API URL. Если `--api-key-env` не указан, command использует `DSBUILDER_API_KEY`, что упрощает single-project сценарий. Если `.sdds/config.json` уже существует, command должен избежать silent overwrite и вернуть понятную ошибку или требовать explicit overwrite flag.

Альтернатива: `init` вызывает backend и автоматически создает project access key. Отклонено, потому что это требует user auth и server-side access key management из CLI, которые не входят в scope.

`dsbuilder status` использует тот же `.sdds/config.json`, credential resolution и HTTP layer, но делает read-only backend requests для проверки configured project и design system:

```text
GET {resolvedApiUrl}/api/projects/{projectId}
Authorization: ProjectKey <api_key>

GET {resolvedApiUrl}/api/projects/{projectId}/ds/design-systems/{designSystemId}
Authorization: ProjectKey <api_key>
```

Команда не печатает список проектов и не раскрывает raw API key. Она показывает только endpoint/config context и статус авторизации, например:

```text
Project: SDDS
Design system: sdds_cs
API: https://api.example.com
Status: authorized
```

Альтернатива: проверять key через `GET /api/projects`. Отклонено для этой change, потому что текущий gateway защищает `/api/projects` через user auth, а project-bound key в текущей архитектуре должен работать в context конкретного `projectId`.

## Risks / Trade-offs

- [Risk] Пользователь передаст `--api-key`, и key попадет в shell history или process list. → Mitigation: считать env recommended path и документировать `--api-key` как одноразовый override.
- [Risk] `.sdds/config.json` случайно начнут использовать для secrets. → Mitigation: validation и init command не должны иметь поля для raw key; tests должны проверять, что generated config содержит только env variable name.
- [Risk] Nearest-parent lookup может выбрать неожиданный config из родительской директории. → Mitigation: в ошибках и status/output полезно показывать путь найденного config; future флаг `--config` можно добавить отдельной change.
- [Risk] Clikt behavior может изменить baseline help/error output. → Mitigation: обновить baseline tests под новый command tree и проверять стабильность `--help`, `--version`, unknown command и missing option outputs.
- [Risk] Добавление JSON/HTTP dependencies усложнит Kotlin Multiplatform setup. → Mitigation: выбирать dependencies, совместимые с текущим `commonMain`/JVM target, и проверять `dsbuilder-frontend` через `build`, `test`, `detekt`, `spotlessCheck`.
- [Risk] HTTP client будет выглядеть слишком абстрактным без реальных product commands. → Mitigation: ограничить слой factory/request decoration и тестами на header/baseUrl behavior, не добавляя publish-specific API.
- [Risk] `status` может быть ошибочно реализован через `/api/projects`, который сейчас ожидает user JWT. → Mitigation: использовать project-scoped `GET /api/projects/{projectId}` и design-system scoped `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}`; оставить project discovery через API key вне scope.
