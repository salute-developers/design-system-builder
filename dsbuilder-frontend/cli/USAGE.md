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
