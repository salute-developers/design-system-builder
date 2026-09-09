# DS Builder Frontend

`frontend-kt` — отдельный Gradle build для frontend tooling DS Builder.

Активные клиентские модули:

- [`cli`](./cli/src) — Kotlin Multiplatform CLI-приложение `dsbuilder` для JVM/macOS, включая `dsbuilder mcp serve`.
- [`mcp-server-core`](./mcp-server-core/src) — общий MCP server core и tool registry поверх shared use cases.
- [`mcp-node`](./mcp-node/src) — Kotlin/JS Node.js executable и npm package `dsbuilder-mcp`.

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
