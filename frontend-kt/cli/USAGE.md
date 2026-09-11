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

Проверить доступ к проекту можно командой:

```bash
dsbuilder status
```

Для разового запуска API key можно передать напрямую:

```bash
dsbuilder status --api-key dev-token
```

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
dsbuilder components push --api-url https://your-gateway
```

Другая директория:

```bash
dsbuilder components push --from ./configs --api-url https://your-gateway
```

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
dsbuilder components push --api-url https://your-gateway           # план, ничего не пишется
dsbuilder components push --api-url https://your-gateway --apply   # запись
```

Оба режима возвращают одинаковый отчёт, поэтому план совпадает с тем, что произойдёт при
применении. Одновременные `--apply` и `--dry-run` отклоняются.

### API URL передаётся явно

Умолчание в коде указывает на общую установку, поэтому для записи оно запрещено: нужен
`--api-url` либо переменная `DSBUILDER_API_URL`. Без них команда отказывает и не отправляет
запрос.

Перед отправкой печатаются обе стороны — что отправляется и куда:

```
Package: sdds_sbcom
Source: /path/to/.sdds/components
Configurations: 47
API URL: https://your-gateway (from --api-url)
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

## Генерация кода дизайн-системы

Код темы и компонентов генерирует инструмент платформы: Swift CLI для iOS, Gradle-плагин для
Android. CLI выбирает его по целевой платформе и передаёт пути рабочей копии.

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
`--api-key`. Gateway URL разрешается из `--api-url`, `DSBUILDER_API_URL` или default CLI URL:

```bash
dsbuilder docs publish \
  --api-key dev-token \
  --api-url http://localhost:8080
```

Опция ранней placeholder-реализации `--api-base-url` больше не поддерживается; используйте `--api-url`.
