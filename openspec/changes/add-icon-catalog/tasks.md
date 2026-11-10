## 1. Бэкенд: схема и домен

- [ ] 1.1 Прочитать `backend-kt/AGENTS.md`, `backend-kt/ds-service/README.md` и структуру `feature-components` (пакеты публикации плагина как образец)
- [ ] 1.2 Добавить Flyway `runtime/src/main/resources/db/migration/V18__icon_catalog.sql`: `icon_catalog_loads` (`load_id` PK с проверкой `^[0-9a-f]{12}$`, пакет, версия, счётчик, актор, время, `active`, частичный уникальный индекс активной) и `icons` (`name` PK, `legacy_key` уникальный, `style`, `category` nullable, `aliases text[]`, `sizes integer[]`)
- [ ] 1.3 Реализовать домен: `IconStyle`, `IconSize`, `IconEntry`, `IconAsset`, `IconNames` (разбор имени, начертание, ключ старого формата), `LegacyIconValue`, `SvgSafety`, проверка категории и синонимов, расчёт `loadId` (с категорией и синонимами) и различий каталога
- [ ] 1.4 Тесты домена: начертание (`Outline`, `OutlineBold`, `Fill`, без суффикса, суффикс внутри слова), ключ старого формата на значениях из `local-dev` (`disclosure.down.fill.16`, `info.circle.outline.16`, `dots.horizontal.outline.24`; отдельный случай `chevron.left.24` без совпадения), разбор значения, коллизии, `SvgSafety` (script, `on*`, внешние ссылки, корректный SVG), стабильность `loadId`, смена категории или синонимов как изменение иконки, ограничения категории и синонимов

## 2. Бэкенд: хранилище и конфигурация

- [ ] 2.1 Объявить порт `IconAssetStorage` и реализовать `S3IconAssetStorage` и заглушку `DisabledIconAssetStorage` (по образцу `S3PluginBuildStorage`; `Cache-Control: public, max-age=31536000, immutable`)
- [ ] 2.2 Расширить `ComposePreviewPluginConfiguration` созданием хранилища иконок на тех же настройках (префикс `<prefix>/icons/`), добавить `DS_ICON_KEEP_LOADS` и `DS_ICON_ORPHAN_GRACE_HOURS` и подключить в `app`
- [ ] 2.3 Тест `S3IconAssetStorage` на фейковом клиенте S3 (ключи, content type `image/svg+xml`, список и удаление загрузок)

## 3. Бэкенд: application и data

- [ ] 3.1 Объявить порты `IconCatalogRepository`, `IconUsageReader` и реализовать `ExposedIconCatalogRepository` (замена каталога, журнал, активация в одной транзакции) и таблицы Exposed
- [ ] 3.2 Реализовать `ExposedIconUsageReader`: значения свойств типа `icon` из разрешённых ревизий `variation_property_values` и `invariant_property_values` по всем дизайн-системам с числом ссылок
- [ ] 3.3 Реализовать `PublishIconCatalogUseCase`: роль до разбора, проверки тела и SVG, `loadId`, различия, пробная загрузка, `unchanged`/`activated`, защита `icons_in_use`, отчёт сверки, порядок «S3, затем транзакция», очистка старых загрузок
- [ ] 3.4 Реализовать `GetIconCatalogUseCase` и `ETag` по `loadId`
- [ ] 3.5 Реализовать `IconValueValidator` и подключить его в use case записи значений свойств типа `icon` (создание и изменение значений вариации и инвариантного значения; ошибка `unknown_icon`, пустой каталог, прежнее значение, очистка)
- [ ] 3.6 Тесты use case на фейках: права, пустой список, дубликаты, `unsafe_svg`, `legacy_key_collision`, `dryRun`, `unchanged`, `activated`, `icons_in_use` и `allowRemovingUsed`, отчёт сверки, сбой транзакции после загрузки в S3, сбой очистки, валидатор значений

## 4. Бэкенд: presentation, контракты и gateway

- [ ] 4.1 Реализовать `POST /api/admin/icons/catalog` (регистрация рядом с остальными административными маршрутами, без префикса `/api/ds`) (JSON, лимит 32 МиБ, `dryRun` по умолчанию `true`, `allowRemovingUsed`, DTO запроса и ответа) и `GET /api/design-systems/catalog/icons` (публично `GET /api/projects/{projectId}/design-systems/catalog/icons`) с `ETag`/`304`; отобразить `unknown_icon` в ответ `400` в маршрутах записи значений
- [ ] 4.2 Подключить в DI `app`, обновить `contracts/route-manifest.json` (router `icons`, право `components:read`, владение `global-read-system-admin-write`) и `runtime/src/main/resources/openapi/documentation.yaml` (маршруты, DTO, коды ошибок)
- [ ] 4.3 Добавить в `identity-gateway` location `/api/admin/icons/catalog` (лимит 32 МиБ, таймауты, проверка токена пользователя, доверенные заголовки, rewrite) в `nginx.local.conf` и `nginx.prod.conf.template` и проверку в `test-route-namespaces.sh`
- [ ] 4.4 Проверить, что бакет плагина в локальном контуре и production отдаёт `icons/` анонимно с CORS для клиента (при необходимости поправить `docker/minio` и политику); добавить две переменные очистки в `production-env.example` и `DEPLOY.md`
- [ ] 4.5 Тесты Ktor-маршрутов: `403` участнику проекта, `400`/`413`/`503`/`409`, чтение каталога и `304`, пустой каталог, `unknown_icon` при записи значения
- [ ] 4.6 Интеграционный тест на Postgres: запись, повторная запись (`unchanged`), откат (`activated`), удаление используемой иконки, откат транзакции при сбое, проверка значения при записи
- [ ] 4.7 Прогнать архитектурные тесты `backend-kt/architecture-tests` для нового кода (без правки самих правил)

## 5. CLI (`frontend-kt`)

- [ ] 5.1 Прочитать `frontend-kt/AGENTS.md` и `frontend-kt/cli/AGENTS.md`; завести пакеты иконок в `feature-components` рядом с публикацией плагина превью
- [ ] 5.2 Реализовать домен манифеста и `IconSourceReader` (обход `svg/16`, `svg/24`, `svg/36`, чтение SVG и лимитов, чтение метаданных `<metadata>` каждого SVG с раскодированием XML-сущностей, чтение `icons-manifest.json`, версия из `package.json`) с предупреждениями о неполных размерах
- [ ] 5.3 Реализовать `PublishIconCatalogUseCase` и HTTP-источник `IconCatalogRemoteSource` (вход служебной учёткой как у `preview-plugin publish`, разбор `409 icons_in_use`)
- [ ] 5.4 Добавить команду `icons publish` в `:cli` (`--from-dir`, `--from`, `--api-url`, `--package-version`, `--write-manifest`, `--allow-removing-used`, `--apply`) и подключить в composition root
- [ ] 5.5 Тесты: сборка манифеста из временного каталога (полный и неполный набор, пустой каталог, нет подкаталогов, большой файл, метаданные: категория с `&amp;`, расхождение между размерами, отсутствие `<metadata>`), ошибки использования, пробная отправка и запись, `409`, `403`, отчёт
- [ ] 5.6 Обновить `frontend-kt/cli/USAGE.md` разделом «Загрузка каталога иконок» (формат манифеста, пример шага CI)

## 6. Клиент: каталог и страница

- [ ] 6.1 Прочитать `js/CLAUDE.md`; реализовать `iconCatalogRepository` (чтение с `ETag`), типы каталога и `useIconCatalog`
- [ ] 6.2 Реализовать `filterIcons` (имя, синонимы, категория, начертание, размер), вывод списка категорий с числом иконок, `toLegacyValue`, `fromLegacyValue`; тесты, в том числе поиск по русскому синониму на значениях из `local-dev`
- [ ] 6.3 Реализовать `IconMask` (CSS-маска по адресу SVG, заглушка при ошибке) и `IconGrid` (виртуализация)
- [ ] 6.4 Реализовать страницу `/projects/:projectId/icons`: поиск по имени и синонимам, список категорий с числом, переключатели начертания и размера, счётчики, версия пакета, копирование имени, состояния «пусто», «ошибка», «ничего не найдено»; добавить маршрут и пункт навигации проекта
- [ ] 6.5 Тесты страницы и репозитория (пустой каталог, фильтры, заглушка, копирование)

## 7. Клиент: пикер в панели свойств

- [ ] 7.1 Найти компонент панели свойств, показывающий `IconProp` (`controllers/componentBuilder/props/icon.ts`), и реализовать `IconPicker` с теми же поиском и фильтрами (включая категории), действием «Очистить» и показом значения строкой, если его нет в каталоге или каталог не загружен
- [ ] 7.2 Сохранение выбора через существующее автосохранение значением старого формата; обработка `unknown_icon` (возврат прежнего значения и сообщение)
- [ ] 7.3 Тесты пикера: выбор, очистка, значение вне каталога, пустой каталог, `unknown_icon`
- [ ] 7.4 Обновить комментарий и логику `IconProp` и тест `composePreview/icons.test.ts` (payload остаётся литералом старого формата)

## 8. Локальные проверки

- [ ] 8.1 `cd backend-kt && ./gradlew build` (включая detekt, `spotlessCheck`, тесты)
- [ ] 8.2 `cd frontend-kt && ./gradlew build`
- [ ] 8.3 `cd js && npm run build` и тесты клиента
- [ ] 8.4 `tools/verify fast --change add-icon-catalog`

## 9. Внешние проверки до архивирования

- [ ] 9.1 [внешняя проверка] Поднять локальный контур `./setup-local.sh`; убедиться, что `GET /api/projects/{id}/design-systems/catalog/icons` на пустой БД отвечает `200` с `icons: []`, `source: null`, страница показывает пояснение, а запись значения `icon` в редакторе работает без проверки
- [ ] 9.2 [внешняя проверка] Выполнить `dsbuilder icons publish --from-dir <plasma>/packages/sdds-icons` без `--apply`, с `--apply`, затем повторить с `--apply`; успех: первый запуск не меняет БД и S3, второй даёт `published`, третий `unchanged`; число строк `icons` равно числу уникальных имён в `svg/24`, число объектов в бакете равно числу SVG; сохранить вывод, числа и время записи
- [ ] 9.3 [внешняя проверка] Сверить правило ключа старого формата: в отчёте сверки все значения `icon` из `local-dev/design-system/components` разрешаются (неразрешённых ноль или список зафиксирован; ожидаемо неразрешён `chevron.left.24`), `legacy_key_collision` не возникает; сохранить отчёт
- [ ] 9.4 [внешняя проверка] В редакторе компонента `AccordionItem` выбрать иконку пикером: значение сохраняется в старом формате, превью получает литерал старого формата; страница иконок показывает SVG из бакета без ошибок CORS в консоли; сохранить скриншоты и лог консоли
- [ ] 9.5 [внешняя проверка] Удалить из загружаемого каталога иконку, на которую есть ссылка: без разрешения `409 icons_in_use` с перечнем, с `--allow-removing-used` запись проходит; проверить права: участник проекта получает `403`, личный токен PAT — `401`; сохранить ответы

## 10. Завершение

- [ ] 10.1 `tools/verify full --change add-icon-catalog`
- [ ] 10.2 `openspec validate add-icon-catalog --type change --strict --no-interactive`
