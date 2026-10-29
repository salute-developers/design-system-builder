> Backend задаётся через окружение: `export DSBUILDER_API_URL=http://localhost:8080`.
> CLI и MCP используют эту переменную; параметр `--api-url` удалён.

# DS Builder CLI

`dsbuilder` — CLI для локальной работы с проектом дизайн-системы DS Builder.

Если вам нужна генерация под iOS, начните с короткой инструкции
[«Генерация iOS: с чего начать»](./README-ios.md).

## Установка на macOS из release-архива

Распакуйте архив и запустите установочный скрипт:

```bash
unzip dsbuilder-cli-macos-arm64.zip
cd dsbuilder-cli-macos-arm64
./install.sh
```

По умолчанию скрипт устанавливает бинарник в `~/.dsbuilder/cli/macos/dsbuilder`
и создает symlink `~/.local/bin/dsbuilder`.

Пути можно переопределить:

```bash
DSBUILDER_INSTALL_DIR="$HOME/tools/dsbuilder" DSBUILDER_BIN_DIR="$HOME/bin" ./install.sh
```

Если `~/.local/bin` или выбранная директория не входит в `PATH`, добавьте ее:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Проверка установки:

```bash
dsbuilder --help
dsbuilder --version
```

## Установка на Windows x64 из release-архива

Распакуйте `dsbuilder-cli-windows-x64.zip` и запустите PowerShell в каталоге `dsbuilder-cli-windows-x64`:

```powershell
./install.ps1
dsbuilder --help
dsbuilder --version
```

Сценарий копирует `dsbuilder.exe` в `%LOCALAPPDATA%\DSBuilder\cli` и добавляет каталог в пользовательский `PATH` без прав администратора. Для нового `PATH` откройте новое окно терминала. Каталог можно переопределить переменной `DSBUILDER_INSTALL_DIR`.

При работе с исходниками вместо release-архива выполните из каталога `frontend-kt` команду `.\install-local-cli.ps1`. Она собирает Windows executable через Gradle и устанавливает его тем же способом. Для сборки нужен JDK; установленный CLI работает без Java.

В настройке MCP-клиента укажите абсолютный путь к установленному файлу и аргументы `mcp`, `serve`, `--workspace` и абсолютный путь проекта. Например:

```json
{"command":"C:\\Users\\you\\AppData\\Local\\DSBuilder\\cli\\dsbuilder.exe","args":["mcp","serve","--workspace","C:\\work\\project"]}
```

Для запуска самого CLI и встроенного MCP не нужны Java или Node.js. Команды генерации Android вызывают `gradlew.bat` проекта и требуют JDK; генерация React вызывает `npm.cmd` и требует Node.js. Генерация SwiftUI на Windows недоступна.

## User auth

Для сценариев без project API key можно сохранить локальную user session:

```bash
dsbuilder auth login
dsbuilder auth status
dsbuilder auth logout
```

Вход проходит в системном браузере. `auth status` не печатает access token или refresh token.

## Инициализация дизайн-системы

Команда `init` создает локальный конфиг проекта в текущей директории. Запускайте
ее из корня проекта, в котором будет использоваться дизайн-система.

```bash
dsbuilder init --project-id project-123 --design-system-id ds-456
```

Целевую платформу проекта стоит записать сразу: тогда командам генерации и документации
не нужен `--platform` при каждом запуске.

```bash
dsbuilder init --project-id project-123 --design-system-id ds-456 --platform swiftui
```

Опция повторяется, если проект ведёт несколько платформ:

```bash
dsbuilder init --project-id project-123 --design-system-id ds-456 \
  --platform compose --platform android-view
```

Допустимые значения: `compose`, `android-view`, `swiftui`, `react`.

По умолчанию CLI ожидает API key в переменной окружения `DSBUILDER_API_KEY`.
Имя переменной можно сохранить в конфиге проекта:

```bash
dsbuilder init \
  --project-id project-123 \
  --design-system-id ds-456 \
  --api-key-env DSB_DEV_API_KEY
```

После инициализации задайте API key:

```bash
export DSB_DEV_API_KEY="dev-token"
```

Также можно положить локальный `.env` в корень проекта рядом с `.sdds/`:

```dotenv
# .env.example — замените значение в локальном .env
DSB_DEV_API_KEY=example-project-key
DSBUILDER_API_URL=https://api.example.test
```

CLI и MCP читают этот файл после обнаружения ближайшего `.sdds/config.json`, в том числе при запуске из вложенной
директории. Поддерживаются `NAME=VALUE`, необязательный `export`, одинарные/двойные кавычки и комментарии;
shell-команды и интерполяция не выполняются. Приоритет: аргумент команды → env процесса → `.env` проекта →
умолчание. Значение в `credential.name` ищется раньше общего `DSBUILDER_API_KEY`. `.env` исключён из Git;
на локальной машине ограничьте доступ к нему правами владельца. Команды `auth` и `init`, а также вызовы с явным
`--design-system` не читают проектный `.env`.

Проверить доступ к проекту можно командой:

```bash
dsbuilder status
```

Для разового запуска API key можно передать напрямую:

```bash
dsbuilder status --api-key dev-token
```

Если project API key отсутствует, `status` использует сохранённую user session. После `401` для user session
CLI делает один refresh/retry; для rejected project key fallback на user session не выполняется.

## MCP server

CLI может запустить локальный MCP server поверх тех же shared use cases:

```bash
dsbuilder mcp serve --workspace /path/to/project
```

Команда работает по stdio. Stdout зарезервирован под JSON-RPC protocol messages; диагностический вывод не должен
смешиваться с MCP protocol stream.

Read-only tools:

- `design_system_get_context`, `project_get_status`
- `design_system_versions_list`, `design_system_version_get`, `design_system_changes_list`
- `tenants_list`, `token_groups_list`, `palette_get`
- `documentation_publications_list`, `documentation_search`, `documentation_fetch`, `documentation_get_navigation`, `documentation_get_page`
- `code_binding_search`, `code_binding_get`
- `tokens_list`, `token_get`, `token_values_get`
- `components_list`, `component_get`, `component_styles_get`, `component_variations_get`
- `component_properties_get`, `component_dependencies_get`, `component_configurations_list`, `component_config_get`, `component_tokens_get`

`documentation_*` and `code_binding_*` read published documentation artifacts. Token and component tools read the
authoritative DS Builder model API through `/api/projects/{projectId}/ds/...`; they do not reconstruct model state from
published documentation.

Оба launcher предоставляют 27 read-only tools. `component_config_get` теперь принимает `appearanceId` и
необязательные `selectedValueIds` вместо прежнего `componentId`; ID конфигурации возвращает
`component_configurations_list`. Для страниц `documentation_search` передавайте фактический `publicationId`
из первого ответа вместе с исходными фильтрами. Если публикация уже недоступна, начните новый поиск.
`component_properties_get` по умолчанию возвращает краткий список (`id`, `name`, `type`, `defaultValue`);
`detail=full` добавляет платформенные параметры, описания и даты. Поиск документации без версии использует
последнюю активную публикацию выбранной платформы и сообщает, если документация ещё не опубликована.

## Загрузка темы

Команда `theme fetch` загружает темы из DS Builder API и записывает локальные
`.sdds`-файлы согласно конфигу проекта.

```bash
dsbuilder theme fetch
```

С явным API key:

```bash
dsbuilder theme fetch --api-key dev-token
```

После загрузки можно посмотреть tenant aliases:

```bash
dsbuilder theme alias list
```

Задать локальный alias для tenant:

```bash
dsbuilder theme alias set --tenant-id tenant-123 --alias default
```

Удалить alias:

```bash
dsbuilder theme alias unset default
```

## Загрузка компонентов

Команда `components push` берёт native-конфигурации компонентов, преобразует их в общий формат
DS Builder и загружает одним запросом.

По умолчанию читается локальная директория `.sdds/components`:

```bash
dsbuilder components push
```

Другая директория:

```bash
dsbuilder components push --from ./configs
```

### Платформа

Компонент в DS Builder идентифицируется парой «имя и платформа»: у `Avatar` для `compose` и у `Avatar`
для `android-view` свои свойства, вариации и конфигурации. Поэтому `push` и `fetch` всегда передают
платформу. Она берётся из `platforms` в `.sdds/config.json`:

- одна платформа в конфигурации используется как есть;
- несколько платформ: нужна опция `--platform` (`compose`, `android-view`, `swiftui`, `react`), иначе команда
  отказывает до обращения к backend;
- `--platform` переопределяет конфигурацию.

В словаре backend платформы называются `compose`, `xml` (Android View), `ios`, `web`. Перед отправкой
команда печатает строку `Platform:`.

Директория должна содержать `meta.json` и все перечисленные в нём файлы конфигураций.
`meta.json` задаёт состав пакета и идентичность каждого компонента — пару `componentName`
и `styleName`.

### Компоненты должны быть заведены заранее

Команда загружает оформление: appearances, стили и значения свойств. Сами компоненты и их
свойства она не создаёт — они приходят из кода компонентов и заводятся отдельно.

Поэтому конфигурация компонента, которого нет в DS Builder, отклоняется:

```
Rejected: 1
  bottom-sheet (modal-bottom-sheet): Component 'bottom-sheet' is not present in the global layer
```

Остальные конфигурации пакета при этом загружаются. Свойство, которого нет у компонента,
не отклоняет конфигурацию: значения для него пропускаются, а имя возвращается в отчёте.
И то, и другое означает, что дизайн ушёл вперёд кода — с этим нужно к разработчикам компонента.

### Dry run по умолчанию

Команда пишет в backend, поэтому реальная запись требует явного `--apply`:

```bash
dsbuilder components push           # план, ничего не пишется
dsbuilder components push --apply   # запись
```

Оба режима возвращают одинаковый отчёт, поэтому план совпадает с тем, что произойдёт при
применении. Одновременные `--apply` и `--dry-run` отклоняются.

### API URL передаётся явно

Умолчание в коде указывает на общую установку, поэтому для записи оно запрещено: нужен
переменная `DSBUILDER_API_URL`. Без неё команда отказывает и не отправляет
запрос.

Перед отправкой печатаются обе стороны — что отправляется и куда:

```
Package: sdds_sbcom
Source: /path/to/.sdds/components
Configurations: 47
API URL: https://your-gateway (from DSBUILDER_API_URL)
Project: f7328fe3-eedf-46b3-8fc4-e447357b4b0b
Design system: 7115755a-621f-49b1-b0e3-5c28c52b17af
```

Автоматической сверки имени дизайн-системы нет: `meta.json.name` имеет вид `sdds_serv`, тогда как
имя дизайн-системы в базе устроено иначе, то есть сопоставимого поля нет. Сравнение остаётся за
человеком, для чего обе стороны и печатаются рядом.

### Отчёт о загрузке

```
Created: 46
Updated: 0
Unchanged: 1
Rejected: 0
Status: components pushed
```

Единица учёта — конфигурация компонента. `Created`, если такого оформления в дизайн-системе
не было; `Unchanged`, если значения совпали с прежними; `Updated` в остальных случаях.
Отклонённые перечисляются с причиной, полученной от backend.

Повторный запуск без изменений в конфигурациях даёт `Unchanged` по всему пакету и ничего
не меняет в базе.

### Требуемые scope ключа проекта

```
projects:read
design-systems:read
components:read
components:write
```

`tenants:read` и `tokens:read` нужны дополнительно, если тем же ключом выполняется `theme fetch`.

### Ограничения

- Одна дизайн-система на один пакет: `sdds_serv` и `sdds_sbcom` — разные дизайн-системы,
  загружать их в одну запись не следует.
- Конфигурации должны содержать блок `bindings`. Без него оси вариаций не определяются,
  и команда отказывает с сообщением `Configuration declares N variations but no bindings`.
- Одна некорректная конфигурация отменяет загрузку всего пакета: частичная загрузка
  компонентной модели хуже отказа. В сообщении называются компонент, стиль и файл.

## Импорт API компонентов

Команда `components import-api` заводит в DS Builder глобальный слой компонентной модели —
компоненты, их свойства, состояния и платформенные имена свойств — по файлу API-меты платформы.
Слой общий для всех дизайн-систем всех проектов, поэтому команду может выполнить **только системный
администратор** (realm-роль Keycloak `system_admin`). Ключ проекта не принимается вообще: на gateway он
получает `401`. CLI роль сам не проверяет, её проверяет сервер.

`components push` и `components fetch` этот слой используют: свойства и состояния, которых в нём нет,
попадают в отчёт `push` как `unknownProperties` и `unknownStates`.

Нужна user session администратора на **том же API URL**, который задан через `DSBUILDER_API_URL`:

```bash
dsbuilder auth login --username admin@example.com
dsbuilder components import-api --from path/to/uikit-compose-api-meta.json --platform compose # план, ничего не пишется
dsbuilder components import-api --from path/to/uikit-compose-api-meta.json --platform compose \
  --apply   # запись
```

Команде не нужны проект, `.sdds/config.json`, Gradle и дизайн-система: только файл, платформа и API URL.
`--from` и `--platform` обязательны. Поддержаны `compose`, `android-view`, `swiftui` и `react`; остальные
платформы команда отклоняет до чтения файла и обращения к backend.

Файл меты — вывод генератора меты платформы (`uikit-compose-api-meta.json`, `uikit-api-meta.json`,
`ios-api-meta.json`) или вывод плагина `dsBuilder`; нормализатор читает эти формы. Для `react` это
`web-api-meta.json`, который строит `npm run generate:api-meta -- --package @salutejs/plasma-new-hope` в `js/cli`
(см. `js/cli/README.md`). Платформа должна совпадать с файлом: меты платформ разные, и файл другой платформы
команда отклоняет с указанием пути. Версию меты определяет выбранный файл, поэтому проверяйте, что он от нужного
релиза библиотеки или пакета компонентов.

Мету iOS собирает генератор репозитория plasma-ios (`scripts/generate_api_meta.sh`), результат лежит
в `DesignSystemBuilder/.sdds/ios-api-meta.json`. В базу из неё не идут параметры без кода на платформе:
они описывают свойство, которое знает дизайн-система, но не реализует библиотека, и команда печатает
их число строкой `Skipped: N properties without platform code`.

Платформенные имена свойств попадают в базу под платформой запроса: `compose` для Compose, `xml` для
Android View (XML-атрибуты вроде `sd_labelColor`), `ios` для SwiftUI (имена свойств в коде) и `web` для web
(ключи CSS-токенов вроде `buttonColor`). У одного свойства имён может быть несколько: на iOS один ключ
конфигурации раскладывается по нескольким свойствам кода (`toggleIconColor` → `toggleColorChecked`,
`toggleColorIndeterminate`).

Особенности веб-меты: запись в ней — токен, и токены сводятся в свойство по `id` (`@styleProp`). Части
типографики дают несколько имён одного свойства (`buttonFontFamily`, `buttonFontSize`, …). Токены с
`@styleState` несут значение свойства в состоянии и именами не становятся; свойство только из таких
токенов пропускается (`Skipped: N properties with state tokens only`). Состояния взаимодействия
(`hovered`, `pressed`, `focused` и др.) общие для всех компонентов и состояниями компонента не заводятся.
Компонент без токенов (файл токенов без словаря, например `AvatarGroup`) заводится в базе без свойств.
Веб-компоненты в базе уже есть из сидов: начинайте с dry run и сверяйте `Created components` и
`Property type mismatches`, чтобы имена из меты не завели дубли.

Перед отправкой команда печатает платформу, путь файла меты, число компонентов, свойств и состояний
и API URL. На backend уходит одно имя файла без каталогов. Данные идут одним запросом.

Отчёт:

```
Created components: 0
Created properties: 12
Created states: 3
Created platform names: 12
Unchanged properties: 1251
Rejected: 0
```

Запись только добавляет. Существующие компоненты, свойства, состояния и платформенные имена не
меняются и не удаляются; единственное исключение — статус устаревания платформенного имени (см. ниже).
Компонент идентифицируется парой «имя и платформа запроса»: компоненты других платформ не читаются и не
меняются, поэтому расхождения типов между платформами нет. Если тип существующего свойства в базе отличается от типа в мете, тип не меняется, а свойство
попадает в раздел `Property type mismatches`: глобальный слой общий для всех дизайн-систем. Свойство с
типом, которого нет в схеме БД, попадает в `Rejected` с причиной; остальной импорт от этого не зависит.
Повторный запуск без изменений в мете не создаёт ничего. Компоненты ни к какой дизайн-системе не
привязываются: привязка делается отдельными маршрутами `design-system-components`.

Импорт записывается в журнал `design_system_changes` со значением `design_system_id = NULL`
(`entity_type = components:import-api-meta`, в `data` — пользователь, платформа, имя файла и счётчики).
Dry run ничего не пишет, в том числе в журнал. В ленты дизайн-систем такая запись не попадает.

### Отказ доступа

Если у пользователя нет роли `system_admin`, сервер отвечает `403`, и CLI показывает причину сервера:

```
Status: forbidden. Credential has no access to this project. Server: System administrator role is required
```

Первая часть сообщения общая для всех команд; причина после `Server:` — из ответа backend. Если user
session для этого API URL нет, команда подскажет `dsbuilder auth login` и ничего не
отправит.

### Что при импорте View не попадает в базу

Мета View описывает `declare-styleable`, а не компоненты, и часть записей не ложится в модель. Команда
печатает сводку пропущенного после отчёта:

```
Skipped: 55 properties of type unknown
Skipped: 20 properties of sub-style records
```

- `properties of type unknown`: строковые атрибуты (`label`, `title`, `caption`, анимации), у которых нет
  темизируемого значения и типа в схеме БД;
- `properties of sub-style records`: параметры вложенных семей стилей внутри компонента (`CardContent`,
  `TextFieldChips`); смешивать их со свойствами самого компонента нельзя.

Пропущенное не считается отказом backend и не влияет на `--strict`. Про данные View стоит знать ещё два
факта. У части свойств несколько XML-атрибутов (`Avatar.width`: `android:minWidth` и `android:maxWidth`),
и в базе заводится платформенное имя на каждый. А один атрибут может соответствовать двум свойствам
(`ScrollBar.shape` и `ScrollBar.shapeAppearance` оба `sd_shapeAppearance`): для базы это допустимо.

Порядок импорта платформ не важен: у каждой платформы свои компоненты, и импорты друг на друга не влияют.
Раздел `Property type mismatches` показывает расхождения только внутри платформы, например при новом типе
свойства в новой версии библиотеки.

### Устаревшие свойства

Если генератор меты пометил свойство устаревшим (поле `deprecated` с сообщением), импорт сохраняет это на
уровне платформенного имени. У Compose устаревает свойство целиком (`@ApiDeprecated`), у View — конкретный
XML-атрибут: `sd_textColor` может быть устаревшим, а `android:textColor` того же свойства нет. Пустое
сообщение означает «устарело без сообщения».

При каждом импорте статус обновляется по мете: пометка ставится, сообщение меняется, а если в мете пометки
больше нет, она снимается. Отчёт показывает счётчики, если они не нулевые:

```
Deprecated marked: 2
Deprecated message changed: 1
Deprecated cleared: 4
```

Снятие автоматическое: **последний импорт побеждает**. Мета, собранная старой версией библиотеки, поля
`deprecated` не знает и снимет пометки, поставленные более новой метой, поэтому импортируйте файл нужного
релиза и сначала смотрите dry run: он показывает те же счётчики без записи.

### Чего нет в мете

После отчёта команда справочно печатает, что есть в базе для платформы, но отсутствует в мете:

```
Absent from meta (informational, nothing was removed): 2
  Box
  Avatar.size
```

Запись `Box` — компонент платформы целиком, `Avatar.size` — свойство импортируемого компонента. Ничего не
удаляется, код выхода и `--strict` от этого списка не зависят.

Параметры: `--map-type from:to` (заменить тип свойства до отправки, можно повторять), `--strict`
(завершиться с кодом 1, если что-то отклонено).

## Публикация Compose preview plugin

Команда отправляет билд плагина Compose-превью на бэкенд: архив `preview-compose-plugin.zip`, собранный в
`plasma-android`, и мета компонентов из него. Бэкенд за один шаг кладёт файлы в хранилище, импортирует мету и
делает билд активным; клиент редактора берёт адрес плагина у бэкенда.

```bash
# Пробная отправка: бэкенд проверяет архив и мету и ничего не записывает.
dsbuilder preview-plugin publish --platform compose --from preview-compose-plugin.zip --api-url https://api.example.com

# Запись билда.
dsbuilder preview-plugin publish --platform compose --from preview-compose-plugin.zip --api-url https://api.example.com --apply
```

Перед отправкой CLI проверяет архив локально: в нём должны быть `preview-plugin.json` и `api-meta.json`, а sha256
файла меты обязан совпасть с `apiMetaSha256` manifest. Мета нормализуется так же, как в `components import-api`.
Платформа поддерживается только `compose`, а `--api-url` обязателен, потому что команда пишет на бэкенд.

Итог: `published` (новый билд записан и активен), `activated` (ранее опубликованный билд снова активен: так
выполняется откат повторной публикацией старого билда) или `unchanged` (билд уже опубликован и активен). Если
билд с тем же идентификатором опубликован с другим содержимым архива, команда завершается ошибкой и ничего не
меняет.

### Авторизация

В CI команда входит служебной учёткой Keycloak с ролью публикации (без прав системного администратора):

```bash
export DSBUILDER_CLIENT_ID=dsbuilder-preview-publisher
export DSBUILDER_CLIENT_SECRET=...   # секрет передаётся только через окружение
dsbuilder preview-plugin publish --platform compose --from preview-compose-plugin.zip --api-url https://api.example.com --apply
```

CLI получает короткоживущий токен (`client_credentials`) через `/auth/token` и не сохраняет его на диск. Секрет
нельзя передать аргументом (`--client-secret` отклоняется). Задать нужно обе переменные: одна из двух считается
ошибкой, а не поводом перейти на сессию. Если переменных нет, используется сохранённая сессия системного
администратора (`dsbuilder auth login`), поэтому ту же команду можно выполнить вручную.

### CLI в CI

Релиз `cli-vX.Y.Z` репозитория содержит `dsbuilder-cli-jvm.zip`: распакуйте архив и запустите
`cli-jvm/bin/dsbuilder` с Java 17. Закрепите версию релиза в workflow.

## Выгрузка конфигов компонентов

```bash
dsbuilder components fetch
```

Команда записывает пакет в `.sdds/components`; `--to` задаёт другую директорию пакета.
Legacy-снимок `component-configs.json` команда больше не загружает; ранее скачанный файл
не трогается, его можно удалить. При вызове `components fetch --design-system <uri> --to <directory>`
без локальной `.sdds` все backend-запросы используют выбранный контекст и credential.

Для платформы React команда дополнительно загружает web-адаптер для локальной web-генерации —
ответ `POST /ds/component-config/web-adapter` как есть: имена и описания компонентов, дочерние
компоненты `compose` и шаблоны web-параметров по стилям — и пишет его в `.sdds/web/web-adapter.json`
рядом с найденным `config.json` (без локальной `.sdds` — в `<directory>/web` из `--to`).
Платформа выбирается как у `components generate`: `--platform`, иначе единственная
платформа из `platforms` в `config.json`. Для других платформ или если платформу выбрать нельзя,
запрос не выполняется и fetch не отказывает. Это временное решение до постоянных источников:
файл не входит в состав пакета, push его не читает, а ошибка запроса останавливает загрузку
до записи файлов.

## Генерация кода дизайн-системы

Код темы и компонентов генерирует инструмент платформы: Swift CLI для iOS, Gradle-плагин для
Android, web-генератор `js/cli` репозитория DS Builder для React. CLI выбирает его по целевой
платформе и передаёт пути рабочей копии.

```bash
dsbuilder theme generate
dsbuilder components generate
```

Платформа берётся из `.sdds/config.json`. Если она там не объявлена или платформ несколько,
её нужно назвать явно:

```bash
dsbuilder theme generate --platform swiftui
```

Куда положить результат и каким инструментом это сделать, можно задать явно:

```bash
dsbuilder theme generate --output ./Themes --tool ~/.dsbuilder/toolchains/ios/dsbuilder-ios
```

Всё после `--` уходит платформенному инструменту без изменений:

```bash
dsbuilder theme generate -- --standalone --components
```

### React

Web-генератор — npm-пакет `js/cli` внутри репозитория DS Builder, установщика у него нет. Путь к
каталогу задаётся переменной `DSBUILDER_WEB_TOOL` или `--tool`; нужны Node.js и `npm` в `PATH`.
Тема и компоненты генерируются раздельно (`npm run generate:theme` и `npm run generate:components`),
`--output` становится `--out` генератора, остальное после `--` передаётся как есть. Без `--output`
результат пишется в `output` рядом с `.sdds` проекта:

```bash
export DSBUILDER_WEB_TOOL=<путь к репозиторию>/design-system-builder/js/cli
dsbuilder theme generate --platform react --output ./web
dsbuilder components generate --platform react --output ./web
dsbuilder components generate --platform react -- --package --name base
```

Без `--package` каждая команда заменяет только свою часть `src`. С `--package` в `--output` пишется
папка пакета одной части без сборки и архива: `package.json`, конфиги сборки, `scripts` и `src`;
`src` заменяется целиком, `node_modules` и остальное содержимое каталога остаются. Собрать и
упаковать папку — `npm install && npm pack` в ней. Подробности — в README `js/cli`.

### Дизайн-система целиком

```bash
dsbuilder ds fetch
dsbuilder ds generate --platform react --output ./web
dsbuilder ds generate --platform react -- --package --name base
```

`ds fetch` выполняет `theme fetch`, затем `components fetch` с теми же опциями контекста и ключа
(`--destination` уходит загрузке темы, `--to` и `--platform` — загрузке компонентов). Если тема не
загрузилась, компоненты не загружаются, код возврата 1.

`ds generate` одним вызовом делегата генерирует дизайн-систему целиком: тему и компоненты. Для React это `npm run generate:ds` — с `--package` он
пишет папку одного пакета с темой и компонентами; имя пакета задаёт `--name` (обязательно с `--package`). Для Android запускаются таски темы и компонентов одним
вызовом `gradlew`, для iOS — `theme generate`, затем `components generate`: общей команды у
инструмента нет, при неудаче темы компоненты не запускаются.

### Какие инструменты доступны

```bash
dsbuilder toolchain list
dsbuilder toolchain doctor
dsbuilder toolchain doctor --platform compose
dsbuilder toolchain doctor --tool ~/tools/dsbuilder-ios
```

`doctor` ничего не генерирует: он спрашивает у каждого делегата, установлен ли его инструмент и
подходит ли версия. С `--tool` проверяется именно этот бинарь — тот, который потом и запустится.
Ненулевой код возврата означает, что хотя бы один инструмент непригоден.

### Установка платформенного инструмента

```bash
dsbuilder toolchain install ios
dsbuilder toolchain install ios --version release-01-09-2026
dsbuilder toolchain install ios --from ~/Downloads/dsbuilder-ios-cli-release-01-09-2026.zip
```

Инструмент кладётся в `~/.dsbuilder/toolchains/<toolchain>/<версия>`, а симлинк `current`
переставляется на неё; прежние версии остаются на диске. После установки ни `--tool`,
ни переменные окружения не нужны — `doctor` и генерация находят инструмент сами.

`--from` ставит готовый архив (путь или URL) и в сеть за релизом не ходит: так же ставят
инструмент на машине без доступа к GitHub.

Инструмент iOS — `dsbuilder-ios` из релиза plasma-ios: ассет `dsbuilder-ios-cli-<tag>.zip`,
внутри бинарь и его `ios-api-meta.json`. Поставить его можно и вручную — CLI ищет инструмент
в порядке `--tool <path>`, `DSBUILDER_IOS_TOOL`, `~/.dsbuilder/toolchains/ios/current/dsbuilder-ios`,
затем `PATH`:

```bash
DSBUILDER_IOS_TOOL=~/tools/dsbuilder-ios dsbuilder theme generate
dsbuilder theme generate --tool ~/tools/dsbuilder-ios
```

## Публикация документации

Сначала соберите documentation bundle, затем отправьте его через project-scoped gateway API:

```bash
dsbuilder docs generate
dsbuilder docs publish
```

`docs generate` сначала просит инструмент платформы насытить дерево документации примерами,
скриншотами и info-артефактами, а затем собирает из него пакет. Если для платформы инструмент
не зарегистрирован, шаг пропускается и пакет собирается из готового дерева — как раньше.

Готовое дерево задаётся явно, тогда платформенный шаг не выполняется:

```bash
dsbuilder docs generate --docs-dir ./build/docs
dsbuilder docs generate --no-aggregate
```

Платформа документации берётся из `.sdds/config.json`; `--platform` переопределяет её и
дополнительно принимает `design` — платформу без собственного инструмента. Проект, не объявивший
платформу, собирает `compose`-пакет, как и до появления делегатов.

По умолчанию публикуется `.sdds/temp/docs-bundle.tar.gz`. Другой archive можно указать явно:

```bash
dsbuilder docs publish --bundle ./build/docs-bundle.tar.gz
```

Команда читает project id и credential reference из `.sdds/config.json`. API key разрешается из
configured environment variable, затем из `DSBUILDER_API_KEY`; разовый override задаётся через
`--api-key`. Gateway URL разрешается из `DSBUILDER_API_URL` или default CLI URL:

```bash
dsbuilder docs publish \
  --api-key dev-token
```

Опция ранней placeholder-реализации `--api-base-url` больше не поддерживается; используйте `DSBUILDER_API_URL`.
