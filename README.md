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

Локальные Docker-контуры запускаются из соответствующей части репозитория:

```bash
cd js && docker compose -f docker-compose.dev.yml up
cd backend-kt && ./start-local.sh --detach
```
