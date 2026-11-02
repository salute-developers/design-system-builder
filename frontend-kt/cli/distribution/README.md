# Сборка и проверка доставки CLI

Этот каталог содержит два уровня установки: локальные `install-*-cli.*` и сетевые
`bootstrap/install.*`. Общие операции Unix-установки находятся в `install-unix-common.sh`.
`release.py` используется только в CI для валидации архивов и публикации.

Окружение workflow переиспользует secrets `AWS_ENDPOINT`, `AWS_S3_BUCKET_2`, `AWS_REGION`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. Новые vars: `CLI_S3_PREFIX` и
`CLI_DOWNLOAD_BASE_URL` (публичный HTTPS-корень, без credentials).
`CLI_RELEASE_TAG=cli-vX.Y.Z` задаёт версию сборки; без него используется `0.1.0`.
GitHub variable `IOS_CLI_RELEASE_TAG` задаёт точный тег релиза plasma-ios. Workflow скачивает
ассет `dsbuilder-ios-cli-<tag>.zip`, сверяет его SHA-256 с GitHub release API и включает
только в `dsbuilder-cli-macos-arm64.zip`. Локальный установщик ставит его из вложенного
архива через `dsbuilder toolchain install ios --from`; сеть для этого не нужна.
macOS x64, Windows x64 и JVM архивы iOS CLI не содержат. Web-генератор `js/cli`
публикуется отдельно в npm и в эти ZIP не входит.

Из frontend-kt:

```sh
./gradlew :cli:distributionTests
# Для packageMacosArm64Cli сначала положите ассет в cli/build/ios-cli/:
# dsbuilder-ios-cli-$IOS_CLI_RELEASE_TAG.zip
./gradlew :cli:packageJvmCli :cli:packageMacosArm64Cli :cli:packageMacosX64Cli :cli:packageWindowsX64Cli
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
создаёт bucket с тестовыми credentials и проверяет реальный release.py через s3cmd 2.4.0.
Образ MinIO собирается из существующего Dockerfile репозитория с проверкой закреплённого
коммита исходников. Docker переиспользует слои при повторных запусках; первая сборка требует сети.
Рабочие контейнеры не имеют внешней сети и открытых host ports. Сценарий не читает реальные
AWS-настройки, не требует ручного создания bucket и удаляет свои контейнеры с данными в finally.
Образы остаются в обычном Docker cache.

В CI проверка запускается отдельной Ubuntu job `CLI delivery / MinIO` в
`validate-frontend-kt.yml` для PR и push в dev/master, затрагивающих frontend,
релизный workflow или Dockerfile MinIO. В обычные FAST и macOS jobs Docker не добавляется.
Отсутствие Docker, ошибка сборки или таймаут MinIO завершают тест ошибкой, без пропусков.

Исходник стабильной версии находится в `cli/distribution/stable.json`. До первого выпуска
в нём `"version": null`; перед первым релизом нужно заменить значение на номер
`X.Y.Z` и влить изменение в `master`. Тег `cli-vX.Y.Z` создаётся от `master`.
Релизный workflow читает актуальный `stable.json` из `master`, даже при повторном
запуске старого тега. Если версия в файле совпадает с версией выпуска, workflow
обновляет публичный `stable.json` в S3. Если не совпадает, версионные артефакты
перезагружаются, а stable остаётся на выбранной в Git версии.

Публикация разделена на `prepare`, `upload`, GitHub JVM asset и `promote`.
Команды upload/promote изменяют удалённое хранилище и не входят в локальную сборку.
Ручной повторный запуск workflow выбирает существующий `cli-vX.Y.Z` тег как ref и
передаёт тот же тег во входном параметре. GitHub разрешает такой запуск только
пользователям с правом записи в репозиторий. Каждый запуск заново загружает все
четыре архива, контрольные суммы и манифест версии, проверяет содержимое в S3,
заменяет JVM asset в GitHub Release и только затем, при совпадении с Git-исходником,
обновляет `stable.json` в S3. Для отката или смены stable на уже опубликованную
версию нужно изменить `cli/distribution/stable.json`, влить в `master` и запустить
`Sync CLI stable` с ref `master` (например, `gh workflow run sync-cli-stable.yml --ref master`).
Синхронизация отвергает отсутствующий или неполный выпуск. Она не пересобирает
архивы и не меняет сетевые установщики.
При загрузке файлы одной версии могут кратковременно различаться по ревизии;
сетевые установщики отклоняют архив, если его SHA-256 не совпадает с манифестом.
