## Контекст

`documentation-generator` принимает `POST /api/documentation/generate` с именем и версией пакета,
читает дизайн-систему из db-service, ставит пакет `${NPM_PACKAGE_SCOPE}/<name>` из npm, собирает
Docusaurus и выгружает результат в S3. Снаружи он доступен через шлюз:
`/api/projects/{projectId}/docs/*` → upstream `docs_service_api` (порт 3006). Единственный вызов —
`generateAndDeployDocumentation` из кнопки «Опубликовать документацию» на странице Debug. Новый
контур документации — Kotlin `documentation-service` за маршрутом
`/api/projects/{projectId}/documentation` — устроен отдельно и на этот сервис не опирается.

## Цели / Вне целей

**Цели:** удалить сервис и все его следы — код, сборку, CI, образ, compose, шлюз, переменные,
клиентскую кнопку и документацию.

**Вне целей:** Kotlin `documentation-service`, `dsbuilder docs`, маршрут `/documentation`; переменная
`NPM_PACKAGE_SCOPE` (нужна `js/cli`); S3-секреты deploy-workflow клиента (ими выгружается статика
клиента и админки); уже опубликованные в S3 сайты.

## Решения

- **Маршрут `/docs` удаляется целиком.** Запросы на `/api/projects/{id}/docs/*` попадают в общий
  маршрут `^/api/projects/([^/]+)(/.*)?$` к projects-service и получают его ответ на неизвестный путь,
  как это было с маршрутами generator и publisher. Отдельную заглушку с `410` не вводим: внешних
  потребителей у маршрута нет.
- **Проверка маршрутов шлюза** (`test-route-namespaces.sh`) перестаёт требовать блок `/docs` и
  начинает проверять, что его нет, а `docs_service_api` не упоминается. Проверки `/documentation`
  остаются.
- **Спека `documentation-bundle-ingestion`** сейчас требует, чтобы `/docs` продолжал вести в
  `docs_service_api`. Сценарий заменяется: `/docs` не проксируется в удалённый сервис, маршрут
  `/documentation` работает как прежде.
- **Переменные окружения.** Из prod compose уходят `AWS_*` и `NPM_PACKAGE_SCOPE` сервиса
  `docs-generator` — других потребителей в compose у них нет; `DOCS_SERVICE_UPSTREAM_*` уходят из
  окружения и `envsubst` шлюза. В `js/.env.example` удаляются `AWS_*`, `NPM_PACKAGE_SCOPE` остаётся
  для `js/cli`. Правку примеров окружения нельзя провести через `tools/verify`, поэтому она идёт
  отдельным коммитом вне Change.
- **Клиент.** Из Debug удаляется кнопка, из `Main.utils.ts` — `generateAndDeployDocumentation`; тест
  `Main` перестаёт мокать эту функцию.

## Риски / Компромиссы

- [Ручная генерация документации пропадает] → других способов собрать старый Docusaurus-сайт не
  остаётся; документация развивается в Kotlin-контуре и `dsbuilder docs`.
- [Остатки на стендах] → Coolify может оставить контейнер `docs-generator` и том `docs_output`;
  их удаляют вручную вместе с переменными `AWS_*` сервиса.

## План миграции

1. Удаление кода, клиента, шлюза, compose, CI и документации одним PR.
2. После деплоя: удалить на стендах контейнер `docs-generator`, том `docs_output`, переменные
   `AWS_*` сервиса и пакет `documentation-generator` в GHCR после переезда обоих стендов. Откат —
   revert PR, образ прошлого тега остаётся в registry.
