# Данные для локального контура

Комплектные архивы Compose и Web содержат координаты `coreRelease` в `preview-plugin.json`.
Собственные архивы для автоматической регистрации и публикации можно передать через
`--plugin-zip` и `--web-plugin-zip`. Пакеты темы и конфигураций
импортируются по явному запросу.

| Каталог | Что внутри | Кто использует |
|---|---|---|
| `compose-preview/preview-compose-plugin.zip` | Собранный Compose preview plugin (Kotlin/Wasm) вместе с `api-meta.json` | `./publish-preview-plugin.sh --platform compose --channel dev` |
| `web-preview/preview-web-plugin.zip` | Собранный web preview plugin (plasma `packages/sdds-preview-web-plugin`) вместе с `api-meta.json` | `./publish-preview-plugin.sh --platform react --channel dev` |
| `design-system/components/` | Пакет конфигураций компонентов: `meta.json` и `*_config.json` | `./seed-local-design-system.sh` |
| `design-system/theme/android/` | Значения токенов темы для Android (`android_color.json` и др.) | `./seed-local-design-system.sh` |
| `design-system/documentation.tar.gz` | Документация SDDS Serv с кодовыми ссылками токенов и стилей Compose | `./publish-local-documentation.sh` и `setup-local` |
| `icons/icons-manifest.json` | Стартовый набор иконок `@salutejs/sdds-icons` (185 иконок трёх размеров с SVG, категориями и синонимами) | `./publish-local-icons.sh` |
| `icons/starter-icons.txt` | Канонические имена иконок стартового набора, по одному в строке | `./refresh-local-dev-icons.sh` |
| `apply_theme_values.py` | Помощник, который переносит значения токенов темы в тему контура | `./seed-local-design-system.sh` |

Происхождение текущих файлов:

<!-- provenance:start -->
- Compose plugin archive: build `754c61a48f3d` (plasma-android commit `9d38c726e78831b60deaee7810937cc3868aecb7`), uikit-compose `0.57.0`, protocol 1, sha256 `1b179217428fa34ed17d67a86d1999dc82540b57a610c8619a4a7945caba3f25`. Core coordinates and build ID were added to the manifest of the build from DS Builder #196.
- Compose API meta: sha256 `1457b62d34448f7ab302cb0721c673e4574511c850a033ff54c70932b63f33e1`. All 79 component records include `stateSupport`.
- Theme (Android values): `sdds_serv` `0.9.0` from theme-converter.
- Component package: `sdds_serv` `0.18.0`, 144 configurations, from theme-converter.
- plasma-android commit for the bundled theme and component package: `0dc782c1cfa35302d71fb53ded20eb9282d388f9`.
<!-- provenance:end -->

<!-- web-provenance:start -->
- Web plugin archive: build `db3543c62277` (plasma commit `0873de21a0718b1bd4fe0285db739262479925f3`), plasma-new-hope `0.391.0-dev.0`, protocol 1, sha256 `ad2060203aba25cca25b01da948f4ae13b10b4d79ce3b452eb656a63283cf568`. The Core coordinates were added to the existing build manifest.
- Web API meta: sha256 `d7aa5a3278e91f25194eb54ada4ba42e61db062312d78cd1006ff35a5e6f5525`; built by `npm run package` in plasma `packages/sdds-preview-web-plugin`.
<!-- web-provenance:end -->


## Переход на Core-релизы

Сервер и CLI требуют `coreRelease: {libraryId, platform, version}` в `preview-plugin.json`.
`version` внутри `coreRelease` должна совпадать с `uikitComposeVersion` или `plasmaNewHopeVersion`;
верхнеуровневая `version` остаётся ID сборки. `apiMetaSha256` считается по исходным байтам
`api-meta.json`, формат этого файла не меняется.

Комплектные архивы содержат `coreRelease`. Чтобы передать собственные ZIP, используйте
`--plugin-zip` и `--web-plugin-zip`. Контракт новых сборок поддерживают
[Web-упаковщик в plasma](https://github.com/salute-developers/plasma/pull/3431) и
[Compose-упаковщик в plasma-android](https://github.com/salute-developers/plasma-android/pull/978).

Миграция БД закрепляет существующие опубликованные границы за техническим снимком каталога
с недоказанным историческим происхождением; она не приписывает им будущий Core или preview.
Сохранённые локальные конфигурации продолжают генерироваться без сервера и без сравнения с
версией Core в локальном репозитории. Новый `fetch` при конфликте завершается отказом и не
перезаписывает сохранённый снимок.

## Как это работает

После успешной публикации Compose-превью setup автоматически привязывает существующую локальную
`sdds_serv_local` к точному Core из опубликованного ZIP (координаты и SHA-256 метаданных), если
Core ещё не выбран либо остался технический снимок миграции. Шаг меняет только выбор Core
черновика и проверяет доступность совместимого preview; конфигурации, токены и опубликованные
версии сохраняются. Явный выбор Core сохраняется. Без демонстрационной ДС ничего не создаётся;
`--skip-plugin` / `-SkipPlugin`, `--skip-design-system` / `-SkipDesignSystem` отключают этот шаг.

`setup-local.sh` и `setup-local.ps1` после импорта компонентов (либо при повторном запуске с уже существующей
`sdds_serv_local`) публикуют отсутствующую Compose-документацию для последней опубликованной версии этой ДС.
Без демонстрационной ДС шаг пропускается: другие ДС и черновики не меняются. Уже активная документация
сохраняется. Пропустить этот шаг можно через `--skip-documentation` / `-SkipDocumentation` или
`--skip-design-system` / `-SkipDesignSystem`.

Для принудительной повторной публикации: `./publish-local-documentation.sh`.
Свой пакет можно передать через `--bundle path/to/docs-bundle.tar.gz`. Помощник принимает только локальный
gateway (`GATEWAY_URL`, по умолчанию `http://localhost:8080`) и использует ту же локальную учётную запись, что seed.
Он заменяет идентификатор и версию в manifest пакета на текущие, загружает пакет через API и ждёт успешной
обработки; ошибка публикации останавливает setup. Перезапуск setup не требует повторной генерации Android-библиотеки.

Встроенный пакет документации получен из агрегатора `tokens/sdds.serv.compose` репозитория plasma-android
(`.sdds/temp/docs`, SB Serv theme `0.9.0`), собран командой `dsbuilder docs generate --platform compose --docs-dir …`.
Он содержит исходные `components-info.json`, `theme-info.json`, страницы и примеры; кодовые ссылки не вычисляются
из имён токенов или конфигураций. Для обновления пакета сгенерируйте документацию той же SDDS Serv и замените
`local-dev/design-system/documentation.tar.gz` результатом `docs generate`.

1. `setup-local.sh` или Windows-вариант `setup-local.ps1` поднимает контур, регистрирует Core из ZIP
   под локальным администратором и публикует оба плагина служебной учёткой через `dsbuilder preview-plugin publish`.
   Для комплектных архивов используется `dev`. Бэкенд кладёт файлы в бакет локального MinIO своей платформы
   (`compose-preview`, `web-preview`) и активирует билд. Клиент получает адреса у бэкенда и загружает плагины из MinIO.
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
Для запуска с демо-импортом используйте
`./setup-local.sh --components-package ./local-dev/design-system/components`.
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

При создании окружения `setup-local.sh` (Windows: `setup-local.ps1`) автоматически публикует оба
плагина и импортирует вложенную API-мету. `publish-preview-plugin.sh` по умолчанию собирает JVM CLI
из текущего checkout (нужен JDK 17): установленный `dsbuilder` может ещё не переносить новые поля
меты, например `stateSupport`. Явный выбор CLI через `--cli` или `DSBUILDER_CLI` сохраняется.

Для обновления существующего окружения без сброса данных из корня DS Builder:

```bash
./publish-preview-plugin.sh --platform compose --channel dev --from ./local-dev/compose-preview/preview-compose-plugin.zip --register-core
./publish-preview-plugin.sh --platform react --channel dev --from ./local-dev/web-preview/preview-web-plugin.zip --register-core
```

Команды обновляют архивы в локальном MinIO, импортируют вложенную API-мету и активируют сборки.
Повторять импорт `sdds_serv_local` не требуется.

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

### Первый preview для нового Core

Соберите совместимый архив, как описано в разделе [«Обновление файлов»](#обновление-файлов).
При ручной публикации через `publish-preview-plugin.sh` сначала зарегистрируйте мету администратором.
Возьмите `api-meta.json` и координаты `coreRelease` из пересобранного ZIP. Задайте `DSBUILDER_API_URL` для входа и импорта.
Пример для Compose в канале `stable`. Подставьте координаты из вашего архива.

```bash
export DSBUILDER_API_URL=http://localhost:8080
dsbuilder auth login
dsbuilder components import-api --from ./api-meta.json --platform compose \
  --library-id uikit-compose --core-version 0.57.0 --channel stable --apply
./publish-preview-plugin.sh --platform compose --channel stable --from ./preview-compose-plugin.zip
```

Для Web передайте `--platform react` и координаты Web Core. Канал при импорте и публикации должен совпадать.
С сессией администратора можно вместо двух вызовов выполнить `dsbuilder preview-plugin publish`
напрямую с `--apply`, указав архив, платформу, канал и API URL.

Для комплектных ZIP локальный setup использует канал `dev`. Каналы можно задать через
`DSBUILDER_COMPOSE_CORE_CHANNEL` и `DSBUILDER_WEB_CORE_CHANNEL`. Регистрация и публикация читают одну локальную
копию ZIP каждой платформы, в том числе при передаче URL. `--skip-plugin` пропускает регистрацию Compose и публикацию
обоих плагинов. При отдельном запуске демо-импорта Compose Core из его ZIP должен быть уже зарегистрирован.

Bash setup использует один `DSBUILDER_GATEWAY_URL` для bootstrap и публикации. Для входа локального
администратора используется `DSBUILDER_PROJECT_CLIENT_ID` (по умолчанию `dsbuilder-api`).
`DSBUILDER_CLIENT_ID` и `DSBUILDER_CLIENT_SECRET` задают учётную запись публикации.

### Web-плагин

Web-плагин живёт в репозитории plasma (`packages/sdds-preview-web-plugin`). Архив собирается там:

```bash
cd packages/sdds-preview-web-plugin && npm run package   # в клоне plasma
```

Команда собирает плагин, записывает в его `preview-plugin.json` коммит plasma (`commit`), ID сборки (`version`), координаты `coreRelease`, `plasmaNewHopeVersion` и `apiMetaSha256`, пишет `archive/preview-web-plugin.zip` в каталоге пакета и печатает
блок происхождения. Она отказывается работать, если в пакете плагина или в пакетах plasma из его бандла есть
незакоммиченные изменения. Скопируйте архив в `web-preview/preview-web-plugin.zip` и замените напечатанным блоком
`web-provenance` выше. Обновляйте архив, когда меняются story, мета, разрешение payload или ядро. Для работы над самим
плагином архив пересобирать не нужно: запустите его в plasma (`npm run build && npm run preview` в пакете) и задайте
клиенту `VITE_WEB_PREVIEW_PLUGIN_URL=http://localhost:3011/`.

Чтобы загрузить только черновик без публикации версии ДС, передайте `--skip-publish`.
Например, для существующей ДС: `./seed-local-design-system.sh --name "Test DS" --package /path/to/components --theme-package '' --skip-publish`.
Пустой `--theme-package` сохраняет существующие значения темы; выбранный Compose Core скрипт не меняет.
