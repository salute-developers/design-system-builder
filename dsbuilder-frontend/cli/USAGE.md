# DS Builder CLI

`dsbuilder` — CLI для локальной работы с проектом дизайн-системы DS Builder.

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
