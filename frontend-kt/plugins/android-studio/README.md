# DS Builder для Android Studio / IntelliJ IDEA

Плагин показывает токены и Compose-компоненты выбранной дизайн-системы. В разделе «Компоненты»
можно открыть превью, выбрать конфигурацию и вариацию, переключить режим темы и скопировать
выражение стиля из опубликованной документации с вызовом `.style()`, например `Switch.L.style()`.
Изменения выбора остаются в окне плагина.

## Установка

1. Скачайте `dsbuilder-ide-plugin-<версия>.zip` и `SHA256SUMS` из GitHub Release с тегом
   `idea-plugin-v<версия>`.
2. Проверьте сумму: `shasum -a 256 -c SHA256SUMS`. В PowerShell выполните
   `Get-FileHash .\dsbuilder-ide-plugin-<версия>.zip -Algorithm SHA256` и сравните результат
   со строкой архива в `SHA256SUMS`.
3. Откройте Settings → Plugins → меню настроек → Install Plugin from Disk и выберите ZIP.
4. После перезапуска откройте панель `SDDS`, войдите в DS Builder и выберите проект,
   дизайн-систему и tenant.

Поддерживаются сборки IDE **243.*** (`sinceBuild=243`, `untilBuild=243.*`), сборка проверяется
на Android Studio 2024.3.2.15. Плагин содержит нативные библиотеки Compose для macOS arm64/x64,
Windows x64 и Linux x64.

Для превью нужен JBR с **JCEF**. Некоторые поставки Android Studio не содержат JCEF; тогда
плагин показывает «Превью недоступно в этой IDE», а просмотр компонентов, выбор вариации
и копирование стиля остаются доступны. Проверка осуществимости выполнена на macOS arm64
в IDE 243 с официальным JBR JCEF 21.0.6-b895.109.

Копирование использует последнюю публикацию документации платформы `compose` и выбранные
оформление и вариацию. Если они ещё не опубликованы или совпадение неоднозначно, показывается
«Нет ссылки». Для статики превью требуется анонимная раздача; токены авторизации в JCEF
не передаются.

## Запуск в песочнице

Команды выполняются из `frontend-kt` нужного worktree. Для сборки используется JDK 17.

```bash
./gradlew :plugins:android-studio:runIde
```

`runIde` собирает плагин и открывает отдельную Android Studio 2024.3.2.15 с ним в песочнице.
В запущенной IDE откройте View → Tool Windows → SDDS и войдите в DS Builder.

Для песочницы Gradle автоматически загружает JBR с JCEF (`21.0.6b895.109`),
уже указанный в зависимостях модуля. Дополнительная настройка runtime не требуется;
при первом запуске нужен доступ к сети для его загрузки. Этот runtime используется
песочницей и тестами, а установленный из ZIP плагин использует runtime своей IDE.
Подробности: [JetBrains Runtime](https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-jetbrains-runtime.html).

Песочница `runIde` по умолчанию подключается к локальному backend `http://localhost:8080`.
Поднимите локальный контур из корня репозитория командой `./setup-local.sh`, затем запускайте
`runIde` как показано выше. Установленный из ZIP плагин по умолчанию подключается к
`https://gateway.design-system-builder.ru`.

Чтобы направить песочницу на другой контур, задайте `DSBUILDER_API_URL`, например для dev:

```bash
DSBUILDER_API_URL=https://gateway-dev.design-system-builder.ru ./gradlew :plugins:android-studio:runIde
```

## Сборка и выпуск

Из `frontend-kt`:

```bash
./gradlew :plugins:android-studio:test :plugins:android-studio:buildPlugin -PidePluginVersion=0.1.1
```

Архив появится в `plugins/android-studio/build/distributions`. Workflow
`.github/workflows/publish-ide-plugin-release.yml` запускается по тегу `idea-plugin-vMAJOR.MINOR.PATCH`
или вручную на том же существующем теге. Он проверяет версию внутри архива, создаёт `SHA256SUMS`,
загружает файлы в черновик и публикует выпуск после проверки контрольных сумм на GitHub.
При существующем выпуске workflow завершается ошибкой и не меняет его файлы; исправленный архив
выпускается под новым тегом. Выпуск плагина не меняет общий `Latest` репозитория.
