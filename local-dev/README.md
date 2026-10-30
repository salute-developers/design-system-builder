# Данные для локального контура

Файлы, которые `./setup-local.sh` (на Windows — `.\setup-local.ps1`) берёт по умолчанию, чтобы после настройки в редакторе работали
Compose- и web-превью компонентов без сборки чего-либо в других репозиториях.

| Каталог | Что внутри | Кто использует |
|---|---|---|
| `compose-preview/preview-compose-plugin.zip` | Собранный Compose preview plugin (Kotlin/Wasm) вместе с `api-meta.json` | `./publish-preview-plugin.sh --platform compose` |
| `web-preview/preview-web-plugin.zip` | Собранный web preview plugin (`js/apps/preview-web-plugin`) вместе с `api-meta.json` | `./publish-preview-plugin.sh --platform react` |
| `design-system/components/` | Пакет конфигураций компонентов: `meta.json` и `*_config.json` | `./seed-local-design-system.sh` |
| `design-system/theme/android/` | Значения токенов темы для Android (`android_color.json` и др.) | `./seed-local-design-system.sh` |
| `apply_theme_values.py` | Помощник, который переносит значения токенов темы в тему контура | `./seed-local-design-system.sh` |

Происхождение текущих файлов:

<!-- provenance:start -->
- Plugin archive: build `e66280f5dcd9` (commit `e66280f5dcd97f5a2dfd834dd343155fd5c87b07`), uikit-compose `0.55.0`, protocol 1, sha256 `b9f40b1522fa45e3c64aabbd2ae60360234dbcae190e2a4527a19c199abccf96`.
- Theme (Android values): `sdds_serv` `0.9.0` from theme-converter.
- Component package: `sdds_serv` `0.18.0`, 144 configurations, from theme-converter.
- plasma-android commit of the refresh: `e66280f5dcd97f5a2dfd834dd343155fd5c87b07`.
<!-- provenance:end -->

<!-- web-provenance:start -->
- Web plugin archive: build `cfe2408854a3` (commit `cfe2408854a30ae437aea4686e50e08c87286da6`), plasma-new-hope `0.386.0`, protocol 1, sha256 `40da8a807ae7a9497be3def0226fd90f27f36aadc1b49b2f1dfb3f9a16191e20`.
- Web API meta: sha256 `2c9bc4ac38aea5fc8c8bf511e8dcc17620c6096ffc896e73f1a2c63e68c0e4e4`; built by `npm run package` in `js/apps/preview-web-plugin`.
<!-- web-provenance:end -->


## Как это работает

1. `setup-local.sh` или Windows-вариант `setup-local.ps1` поднимает контур и публикует оба архива плагинов командой CLI
   (`dsbuilder preview-plugin publish --platform compose|react`), как это делает CI: бэкенд кладёт файлы в бакет
   локального MinIO своей платформы (`compose-preview`, `web-preview`), импортирует API-мету платформы из архива
   (компоненты и свойства глобального слоя) и делает билд активным. Клиент получает адреса активных билдов у бэкенда
   и загружает плагины прямо из MinIO.
2. `seed-local-design-system.sh` создаёт дизайн-систему `sdds_serv_local` с одноимённой темой через API (другие дизайн-системы проекта, например `base`, не
   затрагиваются). Бэкенд создаёт
   стандартный набор токенов для стартовой палитры (`malachite`). Затем помощник `apply_theme_values.py` заменяет
   значения Android (их читает Compose-превью) значениями из пакета темы `sdds_serv`, сопоставляя токены по имени.
   После этого конфигурации загружаются командой `dsbuilder components push`. Конфигурации компонентов, которых нет
   в глобальном слое, отклоняются (в текущем пакете это `bottom-sheet`).

Ограничения темы: токены форм, типографики, градиентов, теней, отступов и шрифтов совпадают с `sdds_serv`. 343 цвета в
пакете заданы ссылками на палитру (например, `[general.red.300]`), и сервер раскрывает их палитрой стартового
профиля, а не палитрой SDDS, поэтому эти цвета могут отличаться от настоящих. Значения для iOS и Web не меняются.
Девять токенов типографики и один токен формы, которых нет в пакете, сохраняют значения бэкенда.

Шрифты темы загружаются браузером с `cdn-app.sberdevices.ru`, поэтому для превью нужен доступ к этому адресу.

## Свои файлы

Опции `./setup-local.sh --plugin-zip FILE|URL`, `--web-plugin-zip FILE|URL`, `--components-package DIR` и
`--theme-package DIR` (или переменные `COMPOSE_PREVIEW_PLUGIN_ZIP`, `WEB_PREVIEW_PLUGIN_ZIP`, `COMPOSE_COMPONENTS_PACKAGE`)
заменяют файлы из этого каталога, например свежую сборку плагина. `--skip-plugin` отключает публикацию обоих плагинов,
`--skip-design-system` — создание дизайн-системы.

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
