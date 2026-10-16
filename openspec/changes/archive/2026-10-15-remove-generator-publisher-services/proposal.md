## Why

Пакет web-дизайн-системы теперь собирается локально в `js/cli` (`generate:theme`, `generate:components`,
`generate:ds`), а сервисы `js/services/generator` и `js/services/publisher` остались от прежней схемы, где
веб-клиент сам собирал пакет и публиковал его в npm. Сервисы приходится собирать, деплоить и держать за
шлюзом, хотя единственный живой потребитель кода генератора — `js/cli`, и он подключает его через
`require('../../services/generator/...')` и чужой `node_modules`. Убираем оба сервиса и делаем код
генератора частью `js/cli`.

## What Changes

- **BREAKING** Удаляется сервис `js/services/publisher` (Express, порт 3007, публикация пакета в npm) —
  код, Dockerfile, образ, сервис в compose, маршрут шлюза, переменные окружения и документация.
- **BREAKING** Удаляется сервис `js/services/generator` как HTTP-сервис (Fastify, порт 3005): маршруты
  `generate-download`, `generate-publish`, `remove-result`, старый bin `plasma-ds-generate`, Dockerfile,
  образ, сервис в compose, маршрут шлюза `/api/projects/{id}/generator`.
- Код генерации (сборщики темы и компонентов, шаблоны и манифесты компонентов, заготовка пакета)
  переезжает в `js/cli/src/generator` как обычные ES-модули `js/cli`. Зависимости генератора и сборки
  пакета переходят в `package.json` `js/cli`; временный каталог сборки пакета создаётся внутри `js/cli`.
- **BREAKING** Веб-клиент перестаёт собирать и публиковать npm-пакет. Окно «Опубликовать» сохраняет
  дизайн-систему и запускает генерацию документации; шаги сборки, публикации и ожидания пакета в npm
  убираются. Из страницы Debug удаляются кнопки скачивания и публикации пакета.
- Инструмент импорта компонентов `db-service` пишет манифесты компонентов в `js/cli/src/generator/templates`.
- CI перестаёт собирать, проверять и публиковать образы `generator` и `publisher`; production compose
  запускает девять сервисов вместо одиннадцати.

## Capabilities

### New Capabilities

- `web-design-system-publication`: что делает окно публикации веб-клиента после удаления сборки и
  npm-публикации: сохранение, документация, отсутствие обращений к удалённым сервисам.

### Modified Capabilities

- `container-image-delivery`: набор production-образов и compose — девять сервисов без `generator` и
  `publisher`; в требование добавляется фактически публикуемый `ds-service`.
- `generator-component-manifest`: манифест и шаблоны компонентов лежат в `js/cli/src/generator/templates`;
  ошибка сборки пакета завершает команду CLI, а не HTTP-запрос.
- `local-web-generation`: генератор входит в `js/cli` и подключается без каталога `js/services/generator`;
  формулировки «как сервис генерации» заменяются описанием самой сборки.
- `plasma-component-import`: манифест генератора записывается в `js/cli/src/generator/templates`.

## Impact

- **js**: удаляются `services/generator`, `services/publisher`; `cli` получает `src/generator`, новые
  зависимости и правила `tsconfig`/`.gitignore`; `apps/client` — `Main.utils.ts`, `Debug.tsx`,
  `PublishProgress`; `services/db-service/src/db/import-plasma-component.ts` — путь к шаблонам;
  `package.json` (скрипты `dev:*`/`build:*`), `docker-compose.dev.yml`, `setup-docker.sh`,
  `README.md`, `CLAUDE.md`, `cli/README.md`.
- **backend-kt**: `identity-gateway/gateway/nginx.local.conf` и `nginx.prod.conf.template` теряют
  upstream и маршруты `generator`/`publisher`; `DEPLOY.md`. Сервис `backend-kt/project-publisher` не
  затрагивается.
- **frontend-kt**: изменений нет — web-делегат `dsbuilder` уже вызывает npm-скрипты `js/cli`.
- **Корень репозитория**: `docker-compose.prod.yml`,
  `.github/workflows/publish-backend-images.yml`, `.github/workflows/validate-js.yml`,
  скилл `.claude/skills/add-component` (проверка генератором через CLI вместо HTTP).
- **openspec**: `config.yaml` (описание JS-сервисов), `architecture/local-theme-generation.md`, дельты спецификаций.
- **Эксплуатация**: на стендах Coolify перестают разворачиваться контейнеры `generator` и `publisher`;
  npm-токен публикации больше не нужен. Документация строится по уже опубликованной версии пакета.
