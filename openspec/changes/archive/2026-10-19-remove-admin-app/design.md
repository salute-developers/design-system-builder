## Контекст

`js/apps/admin` — React 18 + Vite приложение на порту 3004 с пятью страницами: Tables и Schema
читают `/api/admin/tables` и `/api/admin/schema` db-service, Queries — каталог именованных запросов
`/api/admin/queries`, Docs показывает `/api/openapi.json` через Scalar, Settings привязывает
компоненты к дизайн-системам. Клиент API типизирован файлом `src/api/types.gen.ts`, который
`openapi-typescript` строит из `src/api/openapi.json`; этот JSON пишет `npm run openapi:gen`
db-service (`src/openapi/generate.ts`). Тот же JSON читает `src/test/differential-runner.ts`
db-service, чтобы сверять ответы ds-service со схемами OpenAPI.

На стороне db-service админку обслуживают три роутера `src/routes/misc/*` (интроспекция таблиц
через drizzle-схему, DBML/Mermaid схемы, каталог запросов из `src/queries/catalog.ts`), описанные в
разделе Admin `src/openapi/spec.ts`. Снаружи их публикует gateway блоком
`location ~ ^/api/admin(/.*)?$` → `db_service_api` с `auth_request /_auth_user`; рядом стоит точный
`location = /api/admin/component-config/import-api-meta` → `ds_service_api`, которым пользуется
`dsbuilder components import-api`. В ds-service эти маршруты описаны как исключённая группа
`admin` в `contracts/excluded-route-groups.json` и как fallback в `consumer-route-audit.json`.

Статика админки собирается в `deploy-front-apps-dev.yml` и `deploy-front-apps-prom.yml` и
выгружается в S3 по пути `.../design-system-builder/admin/`. В dev compose админка — сервис
`admin` с volume на исходники.

Параллельно существует незаархивированный change `remove-admin-ad-hoc-queries`: он уже убрал из
db-service и админки NL query и saved queries, его спека `admin-ad-hoc-queries-removed` требует
от страницы Queries показывать только каталог, а последняя задача 4.3 — проверить эту страницу
на dev-стенде.

## Цели / Вне целей

**Цели:** удалить приложение и всё, что существует только ради него: маршруты db-service, блок
gateway, записи контрактов ds-service, сборку, CI, deploy, compose, скрипты, скиллы и документацию.

**Вне целей:** точный маршрут `POST /api/admin/component-config/import-api-meta` и
`dsbuilder components import-api`; `GET /api/openapi.json` db-service; консоль Keycloak на
`/admin/`; `src/queries/theme-previews.ts` (нужен `design-systems.ts` и `tenants.ts`); уже
опубликованная в S3 статика админки; секреты и переменные GitHub deploy workflow (ими
выгружается клиент).

## Решения

- **Маршруты `/api/admin/*` db-service удаляются вместе с роутерами и каталогом.** После удаления
  админки у них нет потребителей: клиент, CLI и ds-service к ним не обращаются (проверено поиском
  по `js/apps/client`, `frontend-kt`, `backend-kt`). Интроспекция схемы остаётся в
  `js/docs/db-schema.dbml`, `GET /api/openapi.json` и `psql`. `src/queries/catalog.ts` уходит
  вместе с `queries.ts`; `theme-previews.ts` в том же каталоге остаётся.
- **В gateway удаляется только regex-блок `/api/admin`.** Точный `location =` для
  `import-api-meta` имеет приоритет над regex и после удаления блока продолжает работать без
  изменений. Запросы к другим путям `/api/admin/*` попадают в общий обработчик неизвестных путей
  gateway, как было с маршрутами удалённых сервисов; заглушку `410` не вводим, внешних
  потребителей нет. `test-route-namespaces.sh` перестаёт требовать `admin_block` и начинает
  проверять, что regex-блока нет, а все проверки `import_meta_block` сохраняются как есть.
- **Контракты ds-service.** `excluded-route-groups.json` — аудиторный вход, не API-контракт:
  группа `admin` удаляется, потому что исходных файлов больше нет. В `consumer-route-audit.json`
  из `compatibilityFallbacks` уходит строка про `/api/admin/**`, а `decision` перестаёт упоминать
  административные маршруты db-service. Kotlin-тесты эти файлы не читают, поэтому `backend-kt`
  собирается без правок кода.
- **Спека `design-system-model-api`** меняется в двух требованиях: таблица исключённых областей
  теряет строку «Администрирование», а требование о compatibility routing — фразу про
  `/api/admin/**` к db-service. Административный маршрут остаётся один и уже описан в
  `component-api-meta-import`.
- **OpenAPI db-service.** Из `spec.ts` удаляются схемы и операции раздела Admin и тег `Admin`;
  `info.title` «Admin API» переименовывается в «DB Service API», так как описывает весь сервис.
- **Generate-скрипт OpenAPI удаляется, JSON нигде не хранится.** Единственный потребитель файла
  после удаления админки — `differential-runner.ts`, и он живёт в том же пакете, что и
  `src/openapi/spec.ts`. Он импортирует `spec` напрямую: один источник истины без проверяемого в
  Git артефакта, который мог отставать от `spec.ts`. Альтернатива — переложить `openapi.json` в
  db-service и оставить `openapi:gen` — отвергнута как лишний шаг синхронизации; живая спека
  по-прежнему отдаётся `GET /api/openapi.json`.
- **Скилл `/sync-api-types` удаляется**, а не переписывается: генерировать больше нечего. В
  `/sync-all` остаются `/sync-validation`, `/sync-routes`, `/sync-spec`; упоминания
  `apps/admin/src/api/*` в `js/CLAUDE.md` и `js/README.md` убираются вместе с разделами
  «Admin: API types» и «Admin: pages». `/sync-routes` и `/sync-spec` перестают упоминать `misc/*`.
- **Deploy workflow только для клиента.** Из обоих workflow уходят шаги `Npm install admin`,
  `Build admin`, копирование `dist` и `s3 Upload admin build`; имена секретов и переменных не
  меняются. В `validate-js.yml` уходят маска ESLint `apps/admin/src/**` и элемент matrix `admin`.
- **Change `remove-admin-ad-hoc-queries` архивируется первым.** Его задача 4.3 (проверка страницы
  Queries на dev) теряет смысл: страницы не будет. Разработчик закрывает её как выполненную или
  снимает, change архивируется, спека `admin-ad-hoc-queries-removed` попадает в `openspec/specs`,
  и уже этот change дельтой расширяет её до отсутствия всех `/api/admin/*` в db-service.
- **Привязка компонента к дизайн-системам идёт через `dsbuilder components push`.** Вкладка
  Design Systems в Settings админки добавляла компонент в дизайн-систему и копировала в неё
  appearances, стили и значения свойств из дизайн-системы `base`. В клиенте такого действия нет;
  штатный путь сейчас — конфигурации компонентов в проекте и `dsbuilder components push` (на
  стендах — сидер `db:seed:prod`). Шаг в `js/docs/component-creation.md` переписывается на этот
  путь, сам шаг не удаляется, чтобы инструкция осталась полной. Переносить логику копирования из
  `base` в клиент не нужно.

## Риски / Компромиссы

- [Пропадает визуальный просмотр таблиц и схемы] → остаются `GET /api/openapi.json`,
  `js/docs/db-schema.dbml` и `psql` к базе стенда.
- [Пропадает копирование значений из `base` в новую дизайн-систему одной кнопкой] → этот сценарий
  закрывает `dsbuilder components push` с конфигурацией компонента; если ручное копирование
  понадобится снова, это отдельный change для клиента или CLI.
- [Ошибка в nginx ломает `import-api-meta`] → точный `location =` не трогаем, а
  `test-route-namespaces.sh` по-прежнему проверяет его `auth_request`, лимит тела, заголовки,
  `rewrite` и upstream `ds_service_api`.
- [Статика админки остаётся в S3 и продолжает открываться по старому URL] → её удаляют вручную из
  бакета dev и prod после выкладки; ссылка в `component-creation.md` убирается этим change.
- [Код под `apps/admin` мог ссылаться на утилиты, нужные кому-то ещё] → `importProps.ts` и
  `baseName.ts` используются только внутри админки; проверяется поиском по репозиторию в задаче 1.1.

## План миграции

1. Архивировать `remove-admin-ad-hoc-queries`.
2. Одним PR удалить приложение, маршруты db-service, блок gateway, контракты, CI/deploy-шаги,
   compose, скрипты, скилл и документацию.
3. После выкладки вручную удалить статику `design-system-builder/admin/` и
   `dev/design-system-builder/admin/` из S3. Откат — revert PR, образы db-service и gateway
   прошлого тега остаются в registry.
