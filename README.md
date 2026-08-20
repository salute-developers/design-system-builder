# Design System Builder

Монорепозиторий DS Builder объединяет текущую JavaScript/TypeScript реализацию и новую Kotlin-архитектуру.

## Структура

- `backend-kt/` — Kotlin backend services, Gateway, build/deploy tooling и component preview contract.
- `frontend-kt/` — Kotlin Multiplatform frontend tooling и CLI `dsbuilder`.
- `js/` — существующие React-приложения и Node.js-сервисы.
- `openspec/` — архитектурные ADR, спецификации и история изменений.

Agent skills и команды OpenSpec находятся в корневых `.claude/`, `.cursor/` и `.gigacode/`.

## Основные команды

```bash
cd js && npm run build
cd backend-kt && ./gradlew build
cd frontend-kt && ./gradlew build
```

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

Контуры можно запускать и отдельно:

```bash
./js/setup-docker.sh
./backend-kt/start-local.sh --detach
```

`js/setup-docker.sh` выполняет полную подготовку JS dev-контура: пересоздаёт его Docker volumes, собирает контейнеры,
запускает миграции и seed базы, а затем поднимает Node.js-сервисы, client и admin. Поэтому локальные данные JS-базы при
таком запуске будут сброшены.
