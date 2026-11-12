# Данные для локального контура

Файлы для локального контура. Обычный `./setup-local.sh` (на Windows — `.\setup-local.ps1`) использует
Compose- и web-плагины с API-метаданными. Пакеты темы и конфигураций импортируются только по явному запросу.

| Каталог | Что внутри | Кто использует |
|---|---|---|
| `compose-preview/preview-compose-plugin.zip` | Собранный Compose preview plugin (Kotlin/Wasm) вместе с `api-meta.json` | `./publish-preview-plugin.sh --platform compose` |
| `web-preview/preview-web-plugin.zip` | Собранный web preview plugin (`js/apps/preview-web-plugin`) вместе с `api-meta.json` | `./publish-preview-plugin.sh --platform react` |
| `design-system/components/` | Пакет конфигураций компонентов: `meta.json` и `*_config.json` | `./seed-local-design-system.sh` |
| `design-system/theme/android/` | Значения токенов темы для Android (`android_color.json` и др.) | `./seed-local-design-system.sh` |
| `icons/icons-manifest.json` | Стартовый набор иконок `@salutejs/sdds-icons` (185 иконок трёх размеров с SVG, категориями и синонимами) | `./publish-local-icons.sh` |
| `icons/starter-icons.txt` | Канонические имена иконок стартового набора, по одному в строке | `./refresh-local-dev-icons.sh` |
| `apply_theme_values.py` | Помощник, который переносит значения токенов темы в тему контура | `./seed-local-design-system.sh` |

Происхождение текущих файлов:

<!-- provenance:start -->
- Plugin archive: build `e66280f5dcd9` (commit `e66280f5dcd97f5a2dfd834dd343155fd5c87b07`), uikit-compose `0.55.0`, protocol 1, sha256 `b9f40b1522fa45e3c64aabbd2ae60360234dbcae190e2a4527a19c199abccf96`.
- Theme (Android values): `sdds_serv` `0.9.0` from theme-converter.
- Component package: `sdds_serv` `0.18.0`, 144 configurations, from theme-converter.
- plasma-android commit of the refresh: `e66280f5dcd97f5a2dfd834dd343155fd5c87b07`.
<!-- provenance:end -->

<!-- web-provenance:start -->
- Web plugin archive: build `30fdc9c99790` (commit `30fdc9c99790cdcc48f1766b8b4603ccb1256a70`), plasma-new-hope `0.386.0`, protocol 1, sha256 `880e96434c8b5c0b4da63c8e8c14888c4341a69f6f3421ba24e6f26b8cf7ed01`.
- Web API meta: sha256 `2c9bc4ac38aea5fc8c8bf511e8dcc17620c6096ffc896e73f1a2c63e68c0e4e4`; built by `npm run package` in `js/apps/preview-web-plugin`.
<!-- web-provenance:end -->


## Как это работает

1. `setup-local.sh` или Windows-вариант `setup-local.ps1` поднимает контур и публикует оба архива плагинов командой CLI
   (`dsbuilder preview-plugin publish --platform compose|react`), как это делает CI: бэкенд кладёт файлы в бакет
   локального MinIO своей платформы (`compose-preview`, `web-preview`), импортирует API-мету платформы из архива
   (компоненты и свойства глобального слоя) и делает билд активным. Клиент получает адреса активных билдов у бэкенда
   и загружает плагины прямо из MinIO.
2. Затем `setup-local.sh` загружает каталог иконок командой CLI (`dsbuilder icons publish --apply`, как это делает CI):
   бэкенд кладёт SVG в бакет `compose-preview` локального MinIO и заменяет каталог одной транзакцией. По умолчанию
   используется стартовый набор `local-dev/icons/icons-manifest.json`, и только если каталог пуст: повторный запуск не
   заменяет каталог, загруженный вручную. Весь набор грузится так: `./setup-local.sh --icons path/to/plasma/packages/sdds-icons`
   (или `./publish-local-icons.sh --from …`); `--skip-icons` пропускает шаг. Стартовый набор пересобирается командой
   `./refresh-local-dev-icons.sh --sdds-icons path/to/plasma/packages/sdds-icons` по списку `icons/starter-icons.txt`
   (PowerShell: `-Icons`, `-SkipIcons`).
3. Только при явном `--components-package DIR` (PowerShell: `-ComponentsPackage DIR`) либо
   `COMPOSE_COMPONENTS_PACKAGE` вызывается `seed-local-design-system.sh`: он создаёт дизайн-систему `sdds_serv_local` с одноимённой темой через API (другие дизайн-системы проекта, например `base`, не
   затрагиваются). Бэкенд создаёт
   стандартный набор токенов для стартовой палитры (`malachite`). Затем помощник `apply_theme_values.py` заменяет
   значения Android (их читает Compose-превью) значениями из пакета темы `sdds_serv`, сопоставляя токены по имени.
   После этого конфигурации загружаются командой `dsbuilder components push` с временным PAT
   (`components:write`, срок один час), переданным через `DSBUILDER_API_KEY`. Скрипт отзывает PAT
   при завершении, включая ошибку импорта. Конфигурации компонентов, которых нет
   в глобальном слое, отклоняются (в текущем пакете это `bottom-sheet`).

После импорта seed публикует версию `0.1.0` и оставляет активный черновик для редактирования.
Повторный запуск обновляет черновик, но не меняет уже опубликованную версию. Чтобы опубликовать
новую версию после повторного импорта:

```bash
./seed-local-design-system.sh --package ./local-dev/design-system/components --publish-version 0.1.1
```

Параметр `--publish-version` также поддерживается в `setup-local.sh` вместе с `--components-package`.
Версия должна иметь вид `MAJOR.MINOR.PATCH` без ведущих нулей. Ошибка публикации завершает seed
с ошибкой; импортированные данные остаются в черновике, временный PAT отзывается.

Проверка скрипта без живого контура:

```bash
python3 -m unittest discover -s local-dev -p 'test_seed_design_system.py' -v
```

Ограничения темы: токены форм, типографики, градиентов, теней, отступов и шрифтов совпадают с `sdds_serv`. 343 цвета в
пакете заданы ссылками на палитру (например, `[general.red.300]`), и сервер раскрывает их палитрой стартового
профиля, а не палитрой SDDS, поэтому эти цвета могут отличаться от настоящих. Значения для iOS и Web не меняются.
Девять токенов типографики и один токен формы, которых нет в пакете, сохраняют значения бэкенда.

Шрифты темы загружаются браузером с `cdn-app.sberdevices.ru`, поэтому для превью нужен доступ к этому адресу.

## Свои файлы

Опции `./setup-local.sh --plugin-zip FILE|URL`, `--web-plugin-zip FILE|URL`, `--components-package DIR` и `--theme-package DIR` (или переменные
`COMPOSE_PREVIEW_PLUGIN_ZIP`, `WEB_PREVIEW_PLUGIN_ZIP`, `COMPOSE_COMPONENTS_PACKAGE`) задают собственные файлы.
`--components-package` включает демонстрационный импорт; `--theme-package` требует явного пакета компонентов.
`--skip-plugin` и `--skip-design-system` отключают соответствующие шаги.
Например: `./setup-local.sh --components-package ./local-dev/design-system/components`.
Без этой опции ДС и тема создаются пользователем, а начальные данные берутся из ресурсов backend;
значения Android и конфигурации из этого каталога поверх них не импортируются.

В PowerShell используйте `-PluginZip`, `-WebPluginZip`, `-ComponentsPackage`, `-ThemePackage`, `-SkipPlugin` и `-SkipDesignSystem`.
Существующие Bash-скрипты выполняются во вспомогательном Linux-контейнере, без изменений для Windows.

## Посмотреть файлы в MinIO

Опубликованные билды плагинов лежат в локальном MinIO, в бакете своей платформы: `compose-preview` и `web-preview`,
каталог `builds/<build-id>/`.

- Веб-консоль: http://localhost:9001 (порт меняется переменной `MINIO_CONSOLE_PORT`), логин `minio`, пароль `minio123`.
  Это фиксированные учётные данные локального контура из `backend-kt/docker-compose.local.yml`, на стендах они другие.
- Файлы бакетов открыты на чтение без логина: `http://localhost:9000/compose-preview/builds/<build-id>/index.html`,
  `http://localhost:9000/web-preview/builds/<build-id>/index.html`
  (порт S3 меняется переменной `MINIO_PUBLIC_PORT`, если 9000 занят).

## Обновление файлов

Из чекаута plasma-android (нужны JDK 17, Node и доступ к GitHub):

```bash
./refresh-local-dev-assets.sh --plasma-android ../plasma-android
```

Скрипт собирает архив плагина и скачивает тему и пакет компонентов из публичного репозитория theme-converter в
имени и версии, которые модуль токенов объявляет в `gradle.properties` (`theme-name`, `theme-version`,
`components-name`, `components-version`). Сборка модуля токенов не нужна. Скрипт переписывает блок происхождения выше. Проверьте
`git status local-dev` и закоммитьте результат. Архив весит около 5,5 МБ, а каждая новая версия добавляет столько же
в историю репозитория, поэтому обновляйте файлы только когда меняется протокол плагина, версия `uikit-compose` или
состав компонентов.

### Web-плагин

Архив web-плагина собирается из `js/apps/preview-web-plugin` этого репозитория:

```bash
cd js/apps/preview-web-plugin && npm run package
```

Команда собирает плагин, записывает в его `preview-plugin.json` коммит (`commit`, `version` — первые 12 символов) и
`apiMetaSha256`, пишет `web-preview/preview-web-plugin.zip` и переписывает блок `web-provenance` выше. Она отказывается
работать, если в каталоге плагина есть незакоммиченные изменения: коммит в архиве должен описывать его содержимое.
Поэтому сначала закоммитьте изменения плагина, затем пересоберите архив и закоммитьте его отдельно. Обновляйте архив,
когда меняются story, мета, разрешение payload или версия `plasma-new-hope`. Для работы над самим плагином архив
пересобирать не нужно: запустите его напрямую (`npm run build && npm run preview` в `js/apps/preview-web-plugin`)
и задайте клиенту `VITE_WEB_PREVIEW_PLUGIN_URL=http://localhost:3011/`.
