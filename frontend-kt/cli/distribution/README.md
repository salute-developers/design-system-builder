# Сборка и проверка доставки CLI

Этот каталог содержит два уровня установки: локальные `install-*-cli.*` и сетевые
`bootstrap/install.*`. Общие операции Unix-установки находятся в `install-unix-common.sh`.
`release.py` используется только в CI для валидации архивов и публикации.

Публикация использует GitHub-токен workflow с `contents: write`.
`GITHUB_REPOSITORY` предоставляется GitHub Actions автоматически и задаёт репозиторий
для публикации и встроенных адресов установщиков. AWS secrets, `CLI_S3_PREFIX`
и `CLI_DOWNLOAD_BASE_URL` процессу выпуска CLI больше не нужны.
`CLI_RELEASE_TAG=cli-vX.Y.Z` задаёт версию сборки; без него используется `0.1.0`.
Файл `ios-cli-release.txt` в Git задаёт точный тег релиза plasma-ios для данного
тега CLI. Workflow читает его после checkout тега CLI, скачивает ассет
`dsbuilder-ios-cli-<tag>.zip`, сверяет его SHA-256 с GitHub release API и включает
только в `dsbuilder-cli-macos-arm64.zip`. Локальный установщик ставит его из вложенного
архива через `dsbuilder toolchain install ios --from`; сеть для этого не нужна.
Для смены версии iOS CLI измените файл до создания нового тега `cli-vX.Y.Z`.
Повторный запуск старого тега читает прежнее значение из этого тега.
macOS x64, Windows x64 и JVM архивы iOS CLI не содержат. Web-генератор
(`@sddsjs/design-system-builder-generator`) публикуется отдельно в npm и в эти ZIP не входит:
локальные установщики после установки CLI вызывают `dsbuilder toolchain install web`. Шаг
пропускается флагом `--without-web` (`-WithoutWeb`) или переменной `DSBUILDER_WITHOUT_WEB=1`, без `npm`
в `PATH` и при ошибке npm выводит предупреждение и не меняет код возврата. Smoke-проверки релиза
ставят CLI с `--without-web`, сам шаг проверяют тесты установщиков с поддельным npm.
Локальная сборка macOS arm64 по умолчанию не включает iOS CLI; установка такого
ZIP работает без него. Для включения задайте `-PbundleIosCli=true` и положите
ассет закреплённого тега в `cli/build/ios-cli/`. Релизный workflow всегда включает
iOS CLI в arm64-архив; проверка релиза отклоняет архив без него. На Intel Mac
обычная установка CLI работает без iOS CLI; только команда `toolchain install ios`
отказывает из-за несовместимости опубликованного arm64-бинарника.
Из релизного arm64 ZIP основной CLI можно установить без iOS CLI командой
`./install.sh --without-ios`; без этого флага устанавливаются оба инструмента.

Из frontend-kt:

```sh
./gradlew :cli:distributionTests
# Чтобы включить iOS CLI, положите в cli/build/ios-cli/ ассет тега из
# cli/distribution/ios-cli-release.txt и добавьте -PbundleIosCli=true.
./gradlew :cli:packageJvmCli :cli:packageMacosArm64Cli :cli:packageMacosX64Cli :cli:packageWindowsX64Cli
# Для локального macOS arm64 ZIP с iOS CLI после размещения ассета:
./gradlew :cli:packageMacosArm64Cli -PbundleIosCli=true
python3 cli/distribution/release.py validate --tag cli-v1.2.3 --directory cli/build/distributions
```

На Windows отдельно запускается `tests/install-windows.Tests.ps1`: скрипт требует Windows,
Python в PATH и проверяет локальную установку, PATH, занятый executable и сетевую загрузку.
Эти проверки и запуск готового CLI выполняются в Windows job релизного workflow.

Старый вспомогательный инструмент `upload-installers` и его изолированные MinIO-тесты
сохранены для прежней S3-доставки. Релизный workflow их не вызывает и не обращается к S3.

## Публикация и выбор стабильной версии

`Publish CLI release` запускается по `cli-vX.Y.Z` или вручную на том же существующем
теге. Выпуск проходит сборку и проверки macOS arm64/x64, Windows x64 и JVM, затем
полный комплект (четыре ZIP, `SHA256SUMS`, `release.json`, `install.sh`, `install.ps1`)
загружается в черновик GitHub Release и проверяется повторным скачиванием.
Байты установщиков должны точно совпадать с подготовленными из исходников выбранного тега.
Только после проверки выпуск публикуется и назначается Latest, если версия выше текущей
или Latest ещё нет. Для прежнего Latest сравнивается только тег;
повреждённые старые файлы не блокируют новый выпуск, комплект которого проверяется полностью.

Повтор черновика восстанавливает весь комплект. Для уже опубликованного релиза сначала
проверяются архивы и метаданные без замены. Затем добавляются только отсутствующие
`install.sh` и `install.ps1`, что позволяет дополнить прежний `cli-v0.1.0`.
Существующие установщики проверяются без замены; несовпадение байтов прерывает процесс.
Повтор после частичного добавления загружает оставшийся скрипт. Latest при повторе не меняется.

`stable.json` и его синхронизация удалены. Источник стабильной версии — GitHub Latest,
зарезервированный для CLI этого репозитория. Другие продукты должны публиковаться с
`--latest=false`. Для отката откройте нужный ранее опубликованный CLI-релиз в
интерфейсе GitHub Releases и назначьте его Latest. Полный комплект этого релиза уже
проверен процессом публикации. При ручном переключении дополнительная автоматическая
проверка не выполняется; оператор выбирает известный исправный выпуск. Отдельного
workflow или команды доставки CLI для ручного переключения нет.

Откат Latest не пересобирает выпуск. Для отката выбирайте релиз, в который уже загружены
оба установщика. Старые объекты S3 не удаляются и новым процессом не обновляются.

## Сетевая установка

Скачайте установщик из GitHub Latest:

```sh
curl -fsSL https://github.com/salute-developers/design-system-builder/releases/latest/download/install.sh -o install-dsbuilder.sh && sh install-dsbuilder.sh
```

```powershell
Invoke-WebRequest https://github.com/salute-developers/design-system-builder/releases/latest/download/install.ps1 -OutFile install-dsbuilder.ps1
./install-dsbuilder.ps1
```

Для скачивания скрипта конкретного тега замените `/releases/latest/download/` на
`/releases/download/cli-vX.Y.Z/`. Сам скрипт по умолчанию всё равно устанавливает Latest;
для закрепления CLI передайте `sh install-dsbuilder.sh --version X.Y.Z` либо
`./install-dsbuilder.ps1 -Version X.Y.Z`. Флаги `--without-web` и `-WithoutWeb` сохраняются.
Ссылки Plasma больше не используются: внешний nginx возвращает по ним HTML приложения.

Скрипт получает `release.json` через GitHub Latest один раз и закрепляет тег для
контрольных сумм и ZIP. Явная версия не обращается к Latest. macOS выбирает arm64
(включая Rosetta) либо x64, Windows поддерживает x64, Linux автоматически выбирает
JVM и требует Java 17+. На macOS/Linux можно явно передать `--target jvm`.
SHA-256 манифеста, `SHA256SUMS` и ZIP должны совпадать; безопасная распаковка и
локальная установка выполняются только после проверок. Нужны curl или wget,
unzip/zipinfo и shasum или sha256sum; gh, jq и Python не требуются.

GitHub-загрузки поддерживают до пяти HTTPS-перенаправлений без перехода на HTTP.
Для локальных HTTP-проверок используйте `CLI_RELEASE_BASE_URL`
с корнем тестового сервера на loopback; в подготовленные скрипты встроен корень `https://github.com/$GITHUB_REPOSITORY`
(по умолчанию `https://github.com/salute-developers/design-system-builder`).

После слияния и выпуска проверьте оба публичных `/releases/latest/download/install.*`,
ссылки конкретного тега, выбор Latest, явную версию и установку на всех платформах.
Публичные файлы можно получить только после публикации релиза; проверки черновика выполняются
в CI с GitHub-токеном. Реальный выпуск выполняется по отдельному запросу.
