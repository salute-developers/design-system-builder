# Design System Builder

Монорепозиторий DS Builder объединяет текущую JavaScript/TypeScript реализацию и новую Kotlin-архитектуру.

## Структура

- `backend-kt/` — Kotlin backend services, Gateway, build/deploy tooling и component preview contract.
- `frontend-kt/` — Kotlin Multiplatform frontend tooling и CLI `dsbuilder`.
- `js/` — существующие React-приложения и Node.js-сервисы.
- `openspec/` — архитектурные ADR, спецификации и история изменений.

Agent skills и команды OpenSpec находятся в корневых `.agents/`, `.claude/`, `.cursor/` и `.gigacode/`.

## Инструменты агентской разработки

Процесс разработки использует OpenSpec, репозиторный agent skill и Strictacode.
Репозиторий проверен со следующими версиями:

- OpenSpec `1.6.0`;
- Strictacode `0.0.12`.

Установите OpenSpec глобально через npm:

```bash
npm install --global @fission-ai/openspec@1.6.0
```

Strictacode устанавливается изолированно через [pipx](https://pipx.pypa.io/):

```bash
brew install pipx
pipx ensurepath
pipx install strictacode==0.0.12
```

Версия Strictacode также записана в `tools/strictacode-requirements.txt`.
Проверьте установку:

```bash
openspec --version
strictacode --help
openspec validate --all --strict --no-interactive
```

### Agent workflow

Главный агент Codex или Claude Code работает непосредственно в checkout
разработчика: реализует утверждённый OpenSpec Change, запускает проверки и
создаёт свежего read-only reviewer через нативный механизм своей среды.

Полный процесс описан в
[`.agents/workflows/dsbuilder-development.md`](./.agents/workflows/dsbuilder-development.md).
Codex использует репозиторный skill
[`dsbuilder-task-workflow`](./.agents/skills/dsbuilder-task-workflow/SKILL.md),
для Claude Code доступен тонкий адаптер в `.claude/skills`.

Git branch и OpenSpec Change имеют независимые имена. Для веток и worktree
используйте:

```bash
tools/task create <branch-name> [--worktree] [--base <ref>]
tools/task list
tools/task cleanup <branch-name>
```

Реализация остаётся незакоммиченной до human review. Основные gate:

```bash
tools/verify fast --change <change-name>
tools/verify full --change <change-name>
tools/verify audit --all
```

Конфигурация контуров и protected paths находится в `.verification/config`, а
версионированные Strictacode baseline — в `.verification/strictacode-baseline`.
Локальное состояние длинной задачи можно хранить в игнорируемом
`.agent-workflow/<change-name>/state.md`; Git diff и OpenSpec всегда имеют над
ним приоритет.

### Gradle в sandbox Codex

Gradle записывает wrapper distributions, зависимости, metadata и lock-файлы в
`GRADLE_USER_HOME`. Sandbox Codex не разрешает запись в стандартный `~/.gradle`,
поэтому можно использовать отдельный общий cache для всех checkout и worktree:

```bash
mkdir -p "$HOME/.cache/codex-gradle"
```

Добавьте абсолютный путь в пользовательский `~/.codex/config.toml`. TOML не
подставляет `$HOME` или `~`, поэтому замените `<username>` своим именем:

```toml
sandbox_mode = "workspace-write"

[sandbox_workspace_write]
writable_roots = ["/Users/<username>/.cache/codex-gradle"]

[shell_environment_policy]
set = { GRADLE_USER_HOME = "/Users/<username>/.cache/codex-gradle" }
```

Перезапустите Codex после изменения конфигурации. В cache хранится одна
скачанная Gradle distribution на версию и общие зависимости; проектные
`.gradle` и `build` остаются отдельными в каждом worktree.

## Основные команды

```bash
cd js && npm run build
cd backend-kt && ./gradlew build
cd frontend-kt && ./gradlew build
```

## Production

Backend production stack описан в [docker-compose.prod.yml](./docker-compose.prod.yml). GitHub Actions вручную собирает
десять Kotlin, JavaScript и infrastructure образов, публикует их в GitHub Container Registry (GHCR) и вызывает deploy webhook
DEV или PROD resource в Coolify. Compose использует только готовые registry images; исходники на deployment server не
собираются.

`js/apps/client` и `js/apps/admin` не входят в Docker Compose: их environment-specific статика продолжает публиковаться
существующими frontend workflow в S3. Снаружи Coolify публикует только `gateway`, а внутренние сервисы используют
service-name DNS внутри compose network.

```bash
cp .env.prod.example .env.prod
./deploy.sh --check
./deploy.sh
```

DEV resource использует `IMAGE_TAG=dev`, PROD — mutable alias `IMAGE_TAG=release`. Настройка GHCR permissions,
GitHub Variables/Secrets, tag policy и Coolify resource описана в [backend-kt/DEPLOY.md](./backend-kt/DEPLOY.md).

## Локальный запуск

Для первоначальной настройки и запуска общего локального контура выполните из корня репозитория:

```bash
./setup-local.sh
```

Скрипт сначала настраивает и запускает JavaScript-контур, а затем запускает Kotlin backend в detached-режиме. Такой порядок
нужен, потому что `documentation-service` использует JS `db-service` по адресу `host.docker.internal:3008`.

Для сборки Kotlin backend нужен JDK 17. `backend-kt/start-local.sh` автоматически использует JDK 17 из
`DSBUILDER_JAVA_HOME`, `JAVA_HOME`, `PATH` или стандартных системных установок. JetBrains IDE для запуска не требуется.
Если JDK установлен в нестандартной директории, укажите её явно:

```bash
DSBUILDER_JAVA_HOME=/path/to/jdk-17 ./setup-local.sh
```

Проверить, какой JDK будет использован, без запуска Docker:

```bash
./backend-kt/start-local.sh --check-java
```

Остановить оба контура:

```bash
./setup-local.sh --down
```

Перед первым запуском при необходимости создайте `js/.env`:

```bash
cp js/.env.example js/.env
```

Для локального запуска `NPM_PACKAGE_SCOPE` по умолчанию равен `@sddsjs`, а `NPM_TOKEN` не требуется. Токен нужен
только для legacy-сценария публикации npm-пакета.

Контуры можно запускать и отдельно:

```bash
./js/setup-docker.sh
./backend-kt/start-local.sh --detach
```

## Backend E2E

Сквозные backend-сценарии используют обычный общий локальный контур из `setup-local.sh`, обращаются к нему через
публичный Gateway с реальной авторизацией и при необходимости вызывают JVM CLI `dsbuilder`:

```bash
./tools/e2e all
./tools/e2e api-project-access
./tools/e2e cli-auth-session
```

E2E запускает разработчик, CI или главный агент как внешнюю проверку до
архивирования OpenSpec Change. Структура сценариев и правила тестовых данных
описаны в [`e2e/README.md`](./e2e/README.md).

`js/setup-docker.sh` выполняет полную подготовку JS dev-контура: пересоздаёт его Docker volumes, собирает контейнеры,
запускает миграции и seed базы, а затем поднимает Node.js-сервисы, client и admin. Поэтому локальные данные JS-базы при
таком запуске будут сброшены.
