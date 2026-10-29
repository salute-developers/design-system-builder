# DS Builder Frontend

`frontend-kt` — отдельный Gradle build для frontend tooling DS Builder.

Активные клиентские модули:

- [`cli`](./cli/src) — Kotlin Multiplatform CLI-приложение `dsbuilder` для JVM, macOS и Windows x64, включая `dsbuilder mcp serve`.
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
./gradlew :cli:runJvm --args="status --api-key dev-token"
./gradlew :cli:runJvm --args="auth status"
./gradlew :cli:runJvm --args="mcp serve --workspace /path/to/project"
./gradlew :cli:runJvm --args="theme fetch --api-key dev-token"
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

Ссылка задаёт только контекст. API URL выбирается отдельно только через переменную окружения
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
dsbuilder-mcp auth status
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

## Локальная установка для Windows x64

Из PowerShell в каталоге `frontend-kt` соберите нативный CLI и установите его в профиль пользователя:

```powershell
.\install-local-cli.ps1
dsbuilder --help
```

Для сборки из исходников нужен JDK, доступный Gradle. Установленный `dsbuilder.exe` работает без Java.
Скрипт использует тот же установщик и каталог `%LOCALAPPDATA%\DSBuilder\cli`, что и release-архив.
Каталог установки можно переопределить переменной `DSBUILDER_INSTALL_DIR`.

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

## Архив CLI для Windows x64

На macOS можно собрать и связать Windows executable, но проверить его запуск и системные API может только тестировщик на Windows:

```bash
./gradlew :cli:packageWindowsX64Cli
```

`cli/build/distributions/dsbuilder-cli-windows-x64.zip` содержит `dsbuilder.exe`, `install.ps1` и `USAGE.md`.
Пользователю Windows не нужны Java, Node.js или Gradle для базовых команд, авторизации и `mcp serve`.
Генерация для Android через `gradlew.bat` требует установленный JDK; web-генерация через `npm.cmd` требует Node.js.
Для локального Docker-контура на Windows используйте [`setup-local.ps1`](../setup-local.ps1) с Docker Desktop.
Этот сценарий не входит в архив CLI и не требует JDK или Node.js на Windows-хосте. iOS-инструмент на Windows недоступен.

Backend API URL is configured through `DSBUILDER_API_URL` only; the `--api-url` option is not supported.
For local development, set `export DSBUILDER_API_URL=http://localhost:8080` before CLI commands, and pass the same environment variable to the MCP process.

### Браузерный вход CLI и MCP

`dsbuilder auth login` и `dsbuilder-mcp auth login`
открывают системный браузер и используют Authorization Code + PKCE S256.
Ввод пароля и `--username`/`--password` удалены. В CI используйте project key.
Вне localhost/127.0.0.1 требуется HTTPS. Ожидание входа ограничено 180 секундами;
браузер должен работать на той же машине, где запущена команда.

После обновления выполните один повторный браузерный вход: старые файловые сессии
несовместимы с новым OAuth-клиентом. CLI и MCP используют общий файл в
`~/.sdds/sessions`, а IDE сохраняет независимую сессию в защищённом хранилище.
Файл содержит только refresh token и локальные метаданные; access token кешируется
в памяти до истечения с запасом 30 секунд. `auth status` показывает локальные данные,
не проверяя доступ на сервере. `auth logout` удаляет локальную сессию даже при ошибке
отзыва на сервере. `serve` и инструменты никогда не открывают браузер автоматически.

После браузерного `auth login` CLI/MCP показывают русскую страницу результата
в тёмном оформлении DS Builder. Сообщение об успехе появляется после обмена кода
и сохранения локальной сессии; вкладку можно закрыть. При ошибке страница
предлагает повторить `auth login` в терминале. Страница автономна и не содержит
параметров OAuth, токенов или имени пользователя. Закрытие вкладки не отменяет
уже сохранённую сессию.
