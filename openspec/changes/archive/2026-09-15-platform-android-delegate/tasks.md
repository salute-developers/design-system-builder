## 1. Адаптер

- [x] 1.1 Завести модуль `platform-android` и подключить его в `settings.gradle.kts`.
- [x] 1.2 Реализовать `AndroidGradleLocator`: подъём от `workspace.workspaceDir` до ближайшего `gradlew`;
      `--tool` override используется как явный путь без поиска.
- [x] 1.3 Реализовать `AndroidGradleDelegate`: toolchain `android`, платформы `compose`/`android-view`,
      capability `THEME` и `COMPONENTS`; выбор Gradle-таски по `(capability, platform)`; вызов `<gradlew> -p
      <workspaceDir> <task> <passthrough>`; `Unsupported` при непустом `output`.
- [x] 1.4 `doctor`: проверяет `generateComposeTheme` И `generateViewTheme` — `Ready`, если хотя бы одна
      существует (`doctor` не получает platform, поэтому не может привязаться к одной из них; иначе модуль,
      сконфигурированный только под View, ошибочно считался бы без toolchain'а — реальный баг, найденный при
      реализации design.md, где было зафиксировано только `generateComposeTheme`). `Ready` без версии, `Missing`
      с указанием проверенного каталога модуля.
- [x] 1.5 Зарегистрировать `AndroidGradleDelegate` в composition root `:cli`
      (`PlatformDelegatesModule.platformDelegates()`), заменив плейсхолдер-комментарий.

## 2. Тесты

- [x] 2.1 argv/имя таски по `(capability, platform)`, код возврата, отсутствие `gradlew`, `doctor` (включая
      fallback на `generateViewTheme`) — фейковым `ProcessRunner` (`AndroidGradleDelegateTest`, 15 тестов).
- [x] 2.2 Поиск `gradlew` (подъём по дереву, включая саму `workspaceDir`; `--tool` override) — фейковой файловой
      системой (`AndroidGradleLocatorTest`, 5 тестов).
- [x] 2.3 `--output` даёт `Unsupported` без запуска процесса.
- [x] 2.4 Composition root (`PlatformCommandsCliTest`): реестр отдаёт `android` для `compose` и `android-view`,
      `ios` — для `swiftui`; `react` остаётся без делегата (`compositionRootRegistersTheAndroidDelegateFor...`,
      новый). Два существующих теста, писавших «ничего не зарегистрировано кроме ios» и «`compose` без
      toolchain'а», обновлены — их предпосылка стала неверной ровно потому, что делегат теперь есть
      (`toolchainDoctorRejectsPlatformWithoutToolchain` переключён на `react`, добавлен
      `toolchainDoctorChecksOnlyTheAndroidToolchainForCompose`). 16/16 тестов файла зелёные.

## 3. Верификация

- [x] 3.1 `cd frontend-kt && ./gradlew build` — все таски (`jvmTest`, `macosArm64Test`, `detekt`,
      `spotlessCheck` по всем модулям) зелёные. По пути найден и исправлен реальный detekt-баг:
      `AndroidGradleDelegate.run()` имел 4 return вместо разрешённых 3 — вынесена проверка `Unsupported` в
      `unsupportedResult()` и запуск процесса в `runGradleTask()`.
- [x] 3.2 E2E на реальных `plasma-android` token-модулях, без сети — токен-модули не несут `.sdds/config.json`
      (только output-артефакты `theme-info-*.json`), так что полный `dsbuilder theme generate` через CLI
      с реальным подключением к сети не воспроизводим в этой среде; вместо этого подтверждён механизм делегата
      напрямую тем же способом, что и `gradlew help --task`, который использует `doctor`:
      `tokens/sdds.serv.compose` (только Compose) — `generateComposeTheme` резолвится сразу (`doctor` был бы
      `Ready` с первой проверки). `tokens/sdds.serv.view` (только View) — `generateComposeTheme` проваливается
      (`task not found`), `generateViewTheme` — успешен: именно на этом сценарии держится fallback-логика
      `doctor`, добавленная в 1.4, и здесь она подтверждена на реальном репозитории, а не только фейком.
- [x] 3.3 То же самое наблюдение — прямое доказательство: модуль с одной сконфигурированной платформой даёт
      Gradle-ошибку «task not found» для другой, а не тихую генерацию не того; `doctor` корректно переключается
      на существующую таску вместо того, чтобы считать toolchain отсутствующим.
