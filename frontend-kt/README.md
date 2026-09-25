# DS Builder Frontend

`frontend-kt` — отдельный Gradle build для frontend tooling DS Builder.

Активные клиентские модули:

- [`cli`](./cli/src) — Kotlin Multiplatform CLI-приложение `dsbuilder` для JVM/macOS, включая `dsbuilder mcp serve`.
- [`mcp-server-core`](./mcp-server-core/src) — общий MCP server core и tool registry поверх shared use cases.
- [`mcp-node`](./mcp-node/src) — Kotlin/JS Node.js executable и npm package `dsbuilder-mcp`.

Документация CLI: [USAGE.md](./cli/USAGE.md) — справочник по командам,
[README-ios.md](./cli/README-ios.md) — короткая инструкция по генерации для iOS.

## Проверки

Команды выполняются из директории `frontend-kt`:

```bash
./gradlew build
./gradlew test
./gradlew detekt
./gradlew spotlessCheck
./gradlew compileSharedMcpDependencyGraph
```

## Запуск CLI через Gradle

Для локальной разработки используйте JVM-задачу:

```bash
./gradlew :cli:runJvm
```

Аргументы CLI передаются после `--args`:

```bash
./gradlew :cli:runJvm --args="--help"
./gradlew :cli:runJvm --args="init --project-id project-123 --design-system-id ds-456"
./gradlew :cli:runJvm --args="status --api-url http://localhost:8080 --api-key dev-token"
./gradlew :cli:runJvm --args="auth status --api-url http://localhost:8080"
./gradlew :cli:runJvm --args="mcp serve --workspace /path/to/project"
./gradlew :cli:runJvm --args="theme fetch --api-url http://localhost:8080 --api-key dev-token"
```

## Контекст и авторизация

Локальная `.sdds/config.json` выбирает проект и дизайн-систему. `credential.type = "auto"`
сначала читает проектный ключ из указанной env-переменной, затем пользовательскую сессию;
старое значение `"env"` сохраняет этот порядок. `"user-session"` использует только
сессию после `dsbuilder auth login`. `"project-key-env"` использует только ключ из env.
Секреты в config не записываются.

Для работы без `.sdds` передайте ссылку каждому CLI-вызову или MCP tool call:

```bash
dsbuilder status --design-system 'dsbuilder://projects/project-123/design-systems/ds-456?version=1.0.0&platform=compose'
dsbuilder docs publish --bundle ./docs-bundle.tar.gz --design-system 'dsbuilder://projects/project-123/design-systems/ds-456?version=1.0.0&platform=compose'
DSBUILDER_API_KEY=... dsbuilder status --design-system 'dsbuilder://projects/project-123/design-systems/ds-456?version=1.0.0&platform=compose' --project-key-env DSBUILDER_API_KEY
```

Ссылка задаёт только контекст. API URL выбирается отдельно через `--api-url` или
`DSBUILDER_API_URL`. Без `--project-key-env` явная ссылка использует пользовательскую сессию.
Для `components push/fetch` с явной ссылкой требуются локальные `--from`/`--to`.
`theme fetch` записывает данные в локальную `.sdds`. При запуске без локального config укажите ссылку и каталог: `dsbuilder theme fetch --design-system '<uri>' --destination ./my-project`. Команда создаст `./my-project/.sdds/config.json` и не перезапишет существующий config.

## Node.js MCP launcher

Для локальной проверки npm package:

```bash
./gradlew :mcp-node:npmPackMcpNodeSmoke
```

Пакет содержит executable `dsbuilder-mcp`:

```bash
dsbuilder-mcp --help
dsbuilder-mcp auth status --api-url http://localhost:8080
dsbuilder-mcp serve --workspace /path/to/project
```

## Локальная установка для macOS

Скрипт собирает native executable под текущую macOS-архитектуру, кладет бинарник в
`~/.dsbuilder/cli/<target>/dsbuilder` и создает symlink `~/.local/bin/dsbuilder`.

```bash
./install-local-cli.sh
```

Для явного выбора архитектуры:

```bash
DSBUILDER_MACOS_ARCH=arm64 ./install-local-cli.sh
DSBUILDER_MACOS_ARCH=x64 ./install-local-cli.sh
```

## Архив CLI для macOS

Release-архив собирается Gradle-задачами модуля `:cli`:

```bash
./gradlew :cli:packageMacosCli
./gradlew :cli:packageMacosArm64Cli
./gradlew :cli:packageMacosX64Cli
```

Задача `packageMacosCli` выбирает архитектуру текущей машины. Готовый архив лежит в
`cli/build/distributions/` и содержит:

- native executable `dsbuilder`;
- скрипт установки `install.sh`;
- инструкцию `USAGE.md`.

После распаковки архива:

```bash
./install.sh
dsbuilder --help
```
