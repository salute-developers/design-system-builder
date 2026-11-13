## 1. Бэкенд: схема и домен

- [x] 1.1 Прочитать `backend-kt/AGENTS.md`, `backend-kt/ds-service/README.md` и структуру `feature-components` (пакеты публикации плагина как образец)
- [x] 1.2 Добавить Flyway `runtime/src/main/resources/db/migration/V20__icon_catalog.sql`: `icon_catalog_loads` (`load_id` PK с проверкой `^[0-9a-f]{12}$`, пакет, версия, счётчик, актор, время, `active`, частичный уникальный индекс активной) и `icons` (`name` PK, `legacy_key` уникальный, `style`, `category` nullable, `aliases text[]`, `sizes integer[]`)
- [x] 1.3 Реализовать домен: `IconStyle`, `IconSize`, `IconEntry`, `IconAsset`, `IconNames` (разбор имени, начертание, ключ старого формата), `LegacyIconValue`, `SvgSafety`, проверка категории и синонимов, расчёт `loadId` (с категорией и синонимами) и различий каталога
- [x] 1.4 Тесты домена: начертание (`Outline`, `OutlineBold`, `Fill`, без суффикса, суффикс внутри слова), ключ старого формата на значениях из `local-dev` (`disclosure.down.fill.16`, `info.circle.outline.16`, `dots.horizontal.outline.24`; отдельный случай `chevron.left.24` без совпадения), разбор значения, коллизии, `SvgSafety` (script, `on*`, внешние ссылки, корректный SVG), стабильность `loadId`, смена категории или синонимов как изменение иконки, ограничения категории и синонимов

## 2. Бэкенд: хранилище и конфигурация

- [x] 2.1 Объявить порт `IconAssetStorage` и реализовать `S3IconAssetStorage` и заглушку `DisabledIconAssetStorage` (по образцу `S3PluginBuildStorage`; `Cache-Control: public, max-age=31536000, immutable`)
- [x] 2.2 Расширить `ComposePreviewPluginConfiguration` созданием хранилища иконок на тех же настройках (префикс `<prefix>/icons/`), добавить `DS_ICON_KEEP_LOADS` и `DS_ICON_ORPHAN_GRACE_HOURS` и подключить в `app`
- [x] 2.3 Тест `S3IconAssetStorage` на фейковом клиенте S3 (ключи, content type `image/svg+xml`, список и удаление загрузок)

## 3. Бэкенд: application и data

- [x] 3.1 Объявить порты `IconCatalogRepository`, `IconUsageReader` и реализовать `ExposedIconCatalogRepository` (замена каталога, журнал, активация в одной транзакции) и таблицы Exposed
- [x] 3.2 Реализовать `ExposedIconUsageReader`: значения свойств типа `icon` из разрешённых ревизий `variation_property_values` и `invariant_property_values` по всем дизайн-системам с числом ссылок
- [x] 3.3 Реализовать `PublishIconCatalogUseCase`: роль до разбора, проверки тела и SVG, `loadId`, различия, пробная загрузка, `unchanged`/`activated`, защита `icons_in_use`, отчёт сверки, порядок «S3, затем транзакция», очистка старых загрузок
- [x] 3.4 Реализовать `GetIconCatalogUseCase` и `ETag` по `loadId`
- [x] 3.5 Реализовать проверку значений (`IconValueGuard` в слое `data`, где известен тип свойства и работает транзакция записи; вместо отдельного `IconValueValidator`) и подключить её в операции записи значений свойств типа `icon` (создание и изменение значений вариации и инвариантного значения, `SetAppearancePropertyValueUseCase`; ошибка `unknown_icon`, пустой каталог, прежнее значение, очистка)
- [x] 3.6 Тесты use case на фейках: права, пустой список, дубликаты, `unsafe_svg` (allowlist: `animate`/`set`, `style`, `a`, `data:`, DTD), `legacy_key_collision`, `dryRun`, `unchanged`, `activated`, `icons_in_use` и `allowRemovingUsed`, отчёт сверки, сбой транзакции после загрузки в S3, сбой очистки, валидатор значений

## 4. Бэкенд: presentation, контракты и gateway

- [x] 4.1 Реализовать `POST /api/admin/icons/catalog` (регистрация рядом с остальными административными маршрутами, без префикса `/api/ds`) (JSON, лимит 32 МиБ, `dryRun` по умолчанию `true`, `allowRemovingUsed`, DTO запроса и ответа) и `GET /api/design-systems/catalog/icons` (публично `GET /api/projects/{projectId}/design-systems/catalog/icons`) с `ETag`/`304`; отобразить `unknown_icon` в ответ `400` в маршрутах записи значений (в том числе `PUT /appearances/{id}/property-values`)
- [x] 4.2 Подключить в DI `app`, обновить `contracts/route-manifest.json` (router `icons`, право `components:read`, владение `global-read-system-admin-write`) и `runtime/src/main/resources/openapi/documentation.yaml` (маршруты, DTO, коды ошибок)
- [x] 4.3 Расширить шлюз монолита `backend-kt/app`: добавить `/api/admin/icons/catalog` в `publicGatewayPath` (`PublicRouteBoundary.kt`), в `GatewayRequestHandler.kt` — лимит тела 32 МиБ (отдельная ветка `acceptBody`, не 2 МиБ) и `userRoute` (токен пользователя или служебной учётки обязателен, личный токен PAT получает `403`, как у `import-api-meta`); тесты шлюза: старт приложения проходит `requirePublicRoutes`, запрос без токена `401`, тело 5–8 МБ принимается, тело больше 32 МиБ `413`. nginx и `gateway-contract.json` (исторический снимок) не менять
- [x] 4.4 Проверить, что бакет плагина в локальном контуре и production отдаёт `icons/` анонимно с CORS для клиента (при необходимости поправить `docker/minio` и политику); добавить две переменные очистки в `production-env.example` и `DEPLOY.md`
- [x] 4.5 Тесты Ktor-маршрутов: `403` участнику проекта, `400`/`413`/`503`/`409`, чтение каталога и `304`, пустой каталог, `unknown_icon` при записи значения
- [x] 4.6 Интеграционный тест на Postgres: запись, повторная запись (`unchanged`), откат (`activated`), удаление используемой иконки, откат транзакции при сбое, проверка значения при записи
- [x] 4.7 Прогнать архитектурные тесты `backend-kt/architecture-tests` для нового кода (без правки самих правил)

- [x] 4.8 Засеять каталогом локальный контур: стартовый набор `local-dev/icons/icons-manifest.json` (185 иконок), `publish-local-icons.sh` (с `--if-empty`), `refresh-local-dev-icons.sh`, шаг в `setup-local.sh` и `setup-local.ps1` (`--icons`, `--skip-icons`), описание в `local-dev/README.md`

## 5. CLI (`frontend-kt`)

- [x] 5.1 Прочитать `frontend-kt/AGENTS.md` и `frontend-kt/cli/AGENTS.md`; завести пакеты иконок в `feature-components` рядом с публикацией плагина превью
- [x] 5.2 Реализовать домен манифеста и `IconSourceReader` (обход `svg/16`, `svg/24`, `svg/36`, чтение SVG и лимитов, чтение метаданных `<metadata>` каждого SVG с раскодированием XML-сущностей, чтение `icons-manifest.json`, версия из `package.json`) с предупреждениями о неполных размерах
- [x] 5.3 Реализовать `PublishIconCatalogUseCase` и HTTP-источник `IconCatalogRemoteSource` (вход служебной учёткой как у `preview-plugin publish`, разбор `409 icons_in_use`)
- [x] 5.4 Добавить команду `icons publish` в `:cli` (`--from-dir`, `--from`, `--api-url`, `--package-version`, `--write-manifest`, `--allow-removing-used`, `--apply`) и подключить в composition root
- [x] 5.5 Тесты: сборка манифеста из временного каталога (полный и неполный набор, пустой каталог, нет подкаталогов, большой файл, метаданные: категория с `&amp;`, расхождение между размерами, отсутствие `<metadata>`), ошибки использования, пробная отправка и запись, `409`, `403`, отчёт
- [x] 5.6 Обновить `frontend-kt/cli/USAGE.md` разделом «Загрузка каталога иконок» (формат манифеста, пример шага CI)

## 6. Клиент: каталог и страница

- [x] 6.1 Прочитать `js/CLAUDE.md`; реализовать `iconCatalogRepository` (чтение с `ETag`), типы каталога и `useIconCatalog`
- [x] 6.2 Реализовать `filterIcons` (имя, синонимы, категория, начертание, размер), вывод списка категорий с числом иконок, `toLegacyValue`, `fromLegacyValue`; тесты, в том числе поиск по русскому синониму на значениях из `local-dev`
- [x] 6.3 Реализовать `IconMask` (CSS-маска по адресу SVG, заглушка при ошибке) и `IconGrid` (виртуализация)
- [x] 6.4 Реализовать страницу `/projects/:projectId/icons`: поиск по имени и синонимам, список категорий с числом, переключатели начертания и размера, счётчики, версия пакета, копирование имени, состояния «пусто», «ошибка», «ничего не найдено»; добавить маршрут и пункт навигации проекта
- [x] 6.5 Тесты страницы и репозитория (пустой каталог, фильтры, заглушка, копирование)

## 7. Клиент: пикер в панели свойств

- [x] 7.1 Найти компонент панели свойств, показывающий `IconProp` (`controllers/componentBuilder/props/icon.ts`), и реализовать `IconPicker` с теми же поиском и фильтрами (включая категории), действием «Очистить» и показом значения строкой, если его нет в каталоге или каталог не загружен
- [x] 7.2 Сохранение выбора через существующее автосохранение значением старого формата; обработка `unknown_icon` (возврат прежнего значения и сообщение)
- [x] 7.3 Тесты пикера: выбор, очистка, значение вне каталога, пустой каталог, `unknown_icon`
- [x] 7.4 Обновить комментарий и логику `IconProp` и тест `composePreview/icons.test.ts` (payload остаётся литералом старого формата)

## 8. Локальные проверки

- [x] 8.1 `cd backend-kt && ./gradlew build` (включая detekt, `spotlessCheck`, тесты)
- [x] 8.2 `cd frontend-kt && ./gradlew build`
- [x] 8.3 `cd js && npm run build` и тесты клиента
- [x] 8.4 `tools/verify fast --change add-icon-catalog`

## 8a. Превью Compose

- [x] 8a.1 Клиент добавляет SVG-ресурсы иконок в payload превью (`resolveIconAsset` в черновике, `icon:` ресурсы в сборке payload) и покрывает это тестами
- [x] 8a.2 Проверить в локальном контуре с плагином из `plasma-android` (change `compose-preview-svg-icons`): иконка каталога, включая `OutlineBold`, рисуется в превью `AccordionItem`

## 9. Внешние проверки до архивирования

- [x] 9.1 [внешняя проверка] Поднять локальный контур `./setup-local.sh`; убедиться, что `GET /api/projects/{id}/design-systems/catalog/icons` на пустой БД отвечает `200` с `icons: []`, `source: null`, страница показывает пояснение, а запись значения `icon` в редакторе работает без проверки
- [x] 9.2 [внешняя проверка] Выполнить `dsbuilder icons publish --from-dir <plasma>/packages/sdds-icons` без `--apply`, с `--apply`, затем повторить с `--apply`; успех: первый запуск не меняет БД и S3, второй даёт `published`, третий `unchanged`; число строк `icons` равно числу уникальных имён в `svg/24`, число объектов в бакете равно числу SVG; сохранить вывод, числа и время записи
- [x] 9.3 [внешняя проверка] Сверить правило ключа старого формата: в отчёте сверки все значения `icon` из `local-dev/design-system/components` разрешаются (неразрешённых ноль или список зафиксирован; ожидаемо неразрешён `chevron.left.24`), `legacy_key_collision` не возникает; сохранить отчёт
- [x] 9.4 [внешняя проверка] В редакторе компонента `AccordionItem` выбрать иконку пикером: значение сохраняется в старом формате, превью получает литерал старого формата; страница иконок показывает SVG из бакета без ошибок CORS в консоли; сохранить скриншоты и лог консоли
- [x] 9.5 [внешняя проверка] Удалить из загружаемого каталога иконку, на которую есть ссылка: без разрешения `409 icons_in_use` с перечнем, с `--allow-removing-used` запись проходит; проверить права: участник проекта получает `403`, личный токен PAT — `403`; сохранить ответы

## 10. Завершение

- [x] 10.1 `tools/verify full --change add-icon-catalog`
- [x] 10.2 `openspec validate add-icon-catalog --type change --strict --no-interactive`
