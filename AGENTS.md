# AGENTS.md

## О репозитории

`design-system-builder` — общий монорепозиторий DS Builder.

- `backend-kt/` содержит Kotlin backend services и собственный Gradle composite build.
- `frontend-kt/` содержит Kotlin Multiplatform frontend tooling и CLI.
- `js/` содержит React/Vite приложения и Node.js-сервисы предыдущей реализации.
- `openspec/` содержит ADR и spec-driven artifacts для всего продукта.

## Архитектурные границы

- Для Kotlin backend сохранять направление `presentation -> application -> domain`, инфраструктуру размещать в `data`, DI — в `di`.
- Для Kotlin frontend следовать дополнительным правилам из `frontend-kt/AGENTS.md` (модульный граф `core-*`/`feature-*`) и `frontend-kt/cli/AGENTS.md` (правила `:cli` как presentation-слоя).
- Source of truth конфигурационной модели компонентов находится в `js/services/db-service`.
- Новая клиентская, CLI и MCP-архитектура развивается в `frontend-kt`.
- Изменения архитектурных контрактов отражать в `openspec`.

## Проверки

Проверять изменённую часть из её директории:

```bash
cd js && npm run build
cd backend-kt && ./gradlew build
cd frontend-kt && ./gradlew build
```

Не переносить в Git локальные `.env`, `.gradle`, `.kotlin`, `build`, `node_modules` и `.sdds`.
