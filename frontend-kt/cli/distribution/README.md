# Сборка и проверка доставки CLI

Этот каталог содержит два уровня установки: локальные `install-*-cli.*` и сетевые
`bootstrap/install.*`. Общие операции Unix-установки находятся в `install-unix-common.sh`.
`release.py` используется только в CI для валидации архивов и публикации.

Окружение workflow переиспользует secrets `AWS_ENDPOINT`, `AWS_S3_BUCKET_2`, `AWS_REGION`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. Новые vars: `CLI_S3_PREFIX` и
`CLI_DOWNLOAD_BASE_URL` (публичный HTTPS-корень, без credentials).
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

Для интеграционного теста доставки нужны только Python 3 и запущенный Docker
(Docker Desktop на macOS либо Docker Engine на Linux). Из frontend-kt:

```sh
./gradlew :cli:distributionS3Test
```

Без Gradle можно запустить тот же сценарий:

```sh
python3 cli/distribution/tests/run_s3_integration.py
```

Сценарий сам собирает тестовые образы, запускает временный MinIO, ждёт его готовности,
создаёт bucket с тестовыми credentials и проверяет запись двух установщиков по постоянным ключам, перезапись, прерывание и повтор через s3cmd 2.4.0.
Образ MinIO собирается из существующего Dockerfile репозитория с проверкой закреплённого
коммита исходников. Docker переиспользует слои при повторных запусках; первая сборка требует сети.
Рабочие контейнеры не имеют внешней сети и открытых host ports. Сценарий не читает реальные
AWS-настройки, не требует ручного создания bucket и удаляет свои контейнеры с данными в finally.
Образы остаются в обычном Docker cache.

В CI проверка запускается отдельной Ubuntu job `CLI delivery / MinIO` в
`validate-frontend-kt.yml` для PR и push в dev/master, затрагивающих frontend,
релизный workflow или Dockerfile MinIO. В обычные FAST и macOS jobs Docker не добавляется.
Отсутствие Docker, ошибка сборки или таймаут MinIO завершают тест ошибкой, без пропусков.

## Публикация и выбор стабильной версии

`Publish CLI release` запускается по `cli-vX.Y.Z` или вручную на том же существующем
теге. Выпуск проходит сборку и проверки macOS arm64/x64, Windows x64 и JVM, затем
полный комплект (четыре ZIP, `SHA256SUMS`, `release.json`) загружается в черновик
GitHub Release и проверяется повторным скачиванием. Далее процесс перезаписывает
`install.sh` и `install.ps1` в S3 по прежним ключам и проверяет байты. Только после
этого публикует выпуск и назначает Latest, если версия выше текущей или Latest ещё нет.
AWS credentials доступны только шагу публикации скриптов. Архивы в S3 не записываются.

Скрипты берутся из выбранного тега; повтор старого тега тоже перезаписывает их.
Версионные копии скриптов не создаются. Повтор черновика восстанавливает полный комплект.
У опубликованного релиза проверяются существующие файлы без замены, а Latest при повторе
не изменяется. При ошибке S3 процесс завершается ошибкой до изменения Latest; повтор
восстанавливает оба установщика. Обновление двух объектов S3 не атомарно.

`stable.json` и его синхронизация удалены. Источник стабильной версии — GitHub Latest,
зарезервированный для CLI этого репозитория. Другие продукты должны публиковаться с
`--latest=false`. Для отката откройте нужный ранее опубликованный CLI-релиз в
интерфейсе GitHub Releases и назначьте его Latest. Полный комплект этого релиза уже
проверен процессом публикации. При ручном переключении дополнительная автоматическая
проверка не выполняется; оператор выбирает известный исправный выпуск. Отдельного
workflow или команды доставки CLI для ручного переключения нет.

Откат Latest не пересобирает выпуск и не меняет S3. Старые объекты S3 автоматически
не удаляются и остаются для ранее скачанных установщиков.

## Сетевая установка

Публичные адреса скриптов сохраняются: `$CLI_DOWNLOAD_BASE_URL/install.sh` и
`$CLI_DOWNLOAD_BASE_URL/install.ps1`. Значение — прежний публичный HTTPS-корень CLI
из конфигурации окружения; новый адрес для перехода не нужен.

```sh
curl -fsSL "$CLI_DOWNLOAD_BASE_URL/install.sh" -o install.sh
sh install.sh
sh install.sh --version 1.2.3 --without-web
```

```powershell
Invoke-WebRequest "$env:CLI_DOWNLOAD_BASE_URL/install.ps1" -OutFile install.ps1
./install.ps1
./install.ps1 -Version 1.2.3 -WithoutWeb
```

Скрипт получает `release.json` через GitHub Latest один раз и закрепляет тег для
контрольных сумм и ZIP. Явная версия не обращается к Latest. macOS выбирает arm64
(включая Rosetta) либо x64, Windows поддерживает x64, Linux автоматически выбирает
JVM и требует Java 17+. На macOS/Linux можно явно передать `--target jvm`.
SHA-256 манифеста, `SHA256SUMS` и ZIP должны совпадать; безопасная распаковка и
локальная установка выполняются только после проверок. Нужны curl или wget,
unzip/zipinfo и shasum или sha256sum; gh, jq и Python не требуются.

GitHub-загрузки поддерживают до пяти HTTPS-перенаправлений без перехода на HTTP.
`CLI_DOWNLOAD_BASE_URL` задаёт только S3-корень доставки скриптов; архивы из него
больше не читаются. Для локальных HTTP-проверок используйте `CLI_RELEASE_BASE_URL`
с корнем тестового сервера на loopback; в production встроен корень репозитория
`https://github.com/salute-developers/design-system-builder`.

Перед первым выпуском проверить комплект в черновике, затем S3-скрипты и публикацию
Latest в одном процессе. До первого Latest новые скрипты могут временно сообщать об
отсутствии стабильного выпуска. После выпуска проверить прежние URL двух скриптов,
Latest, явную версию и установку на всех платформах. Реальную публикацию и наблюдения
в CI выполняют после отдельного разрешения на выпуск.
