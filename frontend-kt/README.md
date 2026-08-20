# DS Builder Frontend

`frontend-kt` — отдельный Gradle build для frontend tooling DS Builder.

Активный модуль:

- [`cli`](./cli/src) — Kotlin Multiplatform CLI-приложение `dsbuilder`.

## Проверки

Команды выполняются из директории `frontend-kt`:

```bash
./gradlew build
./gradlew test
./gradlew detekt
./gradlew spotlessCheck
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
./gradlew :cli:runJvm --args="theme fetch --api-url http://localhost:8080 --api-key dev-token"
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
