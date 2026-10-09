## 1. db-service: список платформенных имён

- [x] 1.1 В `js/services/db-service/src/db/import/apiMetaManifest.ts` заменить у свойства `platformName` на `platformNames` (непустой список), принимая прежнее `platformName` и приводя его к списку из одного имени; при наличии обоих полей использовать `platformNames`; без обоих — ошибка валидации
- [x] 1.2 В `js/services/db-service/src/db/import/apiMetaImport.ts` создавать алиас `(property, platform, name)` на каждое имя из списка; существующие алиасы не менять и не удалять; счётчик `createdAliases` считать по созданным строкам
- [x] 1.3 Обновить описание схемы запроса в `js/services/db-service/src/openapi/spec.ts` и выполнить `/sync-api-types`; убедиться, что `js/apps/admin/src/api/types.gen.ts` регенерирован

## 2. db-service: тесты

- [x] 2.1 Тесты в `apiMetaImport.test.ts`: свойство с несколькими именами создаёт по алиасу на каждое; повторный импорт даёт нули; существующий алиас не меняется; второй платформенный набор имён (`xml` после `compose`) добавляется к существующим
- [x] 2.2 Тесты манифеста и ручки: приём прежнего `platformName`, приоритет `platformNames` при двух полях, `400` без обоих полей и при пустом списке
- [x] 2.3 Тест порядка платформ на сиде в границах теста с откатом: импорт манифеста Compose затем View и наоборот даёт одинаковый набор компонентов, свойств с типами и состояний

## 3. frontend-kt: платформа и делегат

- [x] 3.1 В `platform-android/.../AndroidGradleDelegate.kt` добавить пару `API_META × ANDROID_VIEW → readUikitApiMeta` в карту задач и обновить KDoc класса
- [x] 3.2 Переписать тест `AndroidGradleDelegateTest`, проверявший `Unsupported` для `android-view`: запуск задачи с `-p` и passthrough, `Unsupported` для `--output`

## 4. frontend-kt: домен

- [x] 4.1 Выделить интерфейс `ApiMetaNormalizer` (`normalize(text, typeMap) → ApiMetaNormalizationResult`) в `feature-components/domain/apimeta` и привести к нему `ComposeApiMetaNormalizer`
- [x] 4.2 Заменить `ApiMetaProperty.platformName` на `platformNames` (список); Compose передаёт список из `id`
- [x] 4.3 Добавить в `ApiMetaNormalizationResult.Normalized` список пропущенного (категория и число)
- [x] 4.4 Реализовать `ViewApiMetaNormalizer`: модели чтения только нужных полей со значениями по умолчанию (`componentNames`, `params[].{id, type, attrName}`, `subStyle`, `stateSets[].states[].configName`), разворачивание `componentNames`, слияние записей по `(компонент, id)` с конфликтами типа, пропуск `unknown` и `subStyle` с учётом в сводке, `platformNames` из `attrName`, описание `attr: …`, состояния из `stateSets`, `--map-type`, результат `Empty` для пустой меты

## 5. frontend-kt: application, data, DI

- [x] 5.1 В `ImportApiMetaUseCase` заменить `composeNormalizer` отображением «платформа → нормализатор», расширить `SUPPORTED_PLATFORMS` до `compose` и `android-view`; перенести сводку пропущенного в `ImportApiMetaResult.Imported`
- [x] 5.2 В `PlatformApiMetaSource` добавить имя файла `uikit-api-meta.json` для `android-view`
- [x] 5.3 В `HttpApiMetaRemoteSource` отправлять `platformNames`
- [x] 5.4 Обновить Koin-wiring в `ComponentsApplicationModule` (нормализаторы по платформам)

## 6. frontend-kt: CLI

- [x] 6.1 В `ComponentsImportApiCliCommand` печатать после отчёта одну строку на категорию пропущенного и ничего при пустом списке

## 7. frontend-kt: тесты

- [x] 7.1 Корпус `ViewApiMetaCorpus.kt` из реального вывода плагина `readUikitApiMeta` (форма с опущенными значениями по умолчанию): записи с `componentNames` из нескольких имён, с повторами `id` в двух записях одного компонента, со `stateSets`, с `subStyle`, с параметрами `unknown`, со свойством с несколькими `attrName`
- [x] 7.2 Тесты `ViewApiMetaNormalizerTest`: разворачивание и слияние, пропуски и сводка, `platformNames` и описание, состояния, отсутствие состояний из `stateValues` и `sharedStates`, `--map-type`, пустая мета, чтение формы с опущенными значениями по умолчанию
- [x] 7.3 Обновить тесты `ComposeApiMetaNormalizerTest`, `ImportApiMetaUseCaseTest` и `HttpApiMetaRemoteSourceTest` под `platformNames` и выбор нормализатора по платформе; тест, что `swiftui` и `react` по-прежнему отказывают до запуска процессов
- [x] 7.4 Сквозной CLI-тест `android-view` рядом с `ComponentsImportApiCliCommandTest` (настоящий DI-граф, подмены файловой системы, процесса и HTTP): dry run, `--apply`, сводка пропущенного в выводе, запрос с `platform: xml`, отказ при пустой мете

## 8. Документация

- [x] 8.1 Обновить раздел «Импорт API компонентов» в `frontend-kt/cli/USAGE.md`: поддержанные платформы, Gradle-задача и файл меты для View, сводка пропущенного, известные особенности данных (`subStyle` и `unknown` не импортируются, один `attrName` у двух `id`)

## 9. Проверка

- [x] 9.1 `cd js && npm run build`, `cd js/services/db-service && npm test`, `/sync-api-types`; убедиться, что новых миграций нет
- [x] 9.2 `cd frontend-kt && ./gradlew build --continue` (spotless, detekt, тесты, native)
- [x] 9.3 Сквозная проверка на локальном контуре (сид, настоящий gateway и ключ проекта со scope `components:write`) с проектом `plasma-android/tokens/sdds.serv.view`: dry run, `--apply`, повтор; ожидаемые числа для базы «сид плюс Compose» на текущей мете: 359 созданных свойств, 786 без изменений, 7 расхождений типа (прежние расхождения сида с метой), 1148 новых имён `xml`, 6 новых состояний, 0 новых компонентов
- [x] 9.4 Приёмочная сверка порядка платформ на двух чистых базах с сидом: «Compose, затем View» и «View, затем Compose» (дамп `(компонент, свойство, тип)`, состояния, алиасы); наборы компонентов, свойств с типами и состояний совпадают, различаются только описание свойств и порядок строк
- [x] 9.5 Независимая сверка результата с метой своим скриптом: нет пропущенных свойств, алиасов и состояний; пропуски в сводке равны подсчёту `unknown` и `subStyle` по файлу
