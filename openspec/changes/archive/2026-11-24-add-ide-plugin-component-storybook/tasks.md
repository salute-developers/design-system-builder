## 1. Проверка осуществимости

- [x] 1.1 Загрузить production-плагин превью Compose в `JBCefBrowser` Android Studio 243 и получить `sdds.preview.ready` и `success` на тестовом payload; при провале остановиться и вернуться к обсуждению рендерера
- [x] 1.2 [внешняя проверка] Повторить 1.1 на macOS (проверка Windows исключена по решению разработчика); результат (версия IDE, ОС, команда/действие, код завершения, успех или причина) записать в `.agent-workflow/add-ide-plugin-component-storybook/state.md`, раздел `Verification`

## 2. Данные и сборка payload (`frontend-kt/plugins/android-studio`)

- [x] 2.1 Добавить модель и клиент `GET /api/design-systems/{designSystemId}/components/{componentId}/editor-bundle?platform=compose` и список `GET /api/design-systems/{designSystemId}/components?platform=compose` с учётом пагинации, с тестами на `MockEngine`
- [x] 2.2 Добавить клиент `GET /api/design-systems/catalog/compose-preview/plugin` и разбор `preview-plugin.json` с проверкой манифеста по правилам `compose-preview-plugin-loading`
- [x] 2.3 Реализовать построение `ComponentPreviewDraft` из основного `editor-bundle`, значений токенов tenant и догруженных конфигураций ссылочных компонентов: транзитивный обход, значения по умолчанию, обнаружение циклов и ограничение глубины `MAX_STYLE_REFERENCE_DEPTH = 5` по правилам `js/apps/client/src/composePreview/draft.ts`; кеш успешных ответов и запросов в полёте с разделением контекстов, сбросом при повторе и защитой от устаревшего выбора
- [x] 2.4 Добавить чтение определений `GET /api/design-systems/{designSystemId}/tokens` и значений `GET /api/design-systems/{designSystemId}/tenants/{tenantId}/token-values?platforms=android` для превью с учётом `versionId` и режима темы; тесты выбранных tenant/версии/режима, исключения других платформ и паритета с `themeValuePlatform=android` веб-клиента
- [x] 2.5 Реализовать `PayloadAssembler` (чистая функция, без Compose и IDE) и диагностики
- [x] 2.6 Экспортировать из тестов `js/apps/client` golden-пары «черновик → payload» без изменения поведения TypeScript-ассемблера
- [x] 2.7 Тесты `PayloadAssembler`: паритет с golden-парами и проверка по каноничной JSON Schema v1, ошибочные входы; полный путь HTTP-ответы → черновик → payload для ссылки на другой компонент, транзитивных и повторных ссылок, цикла, превышения глубины, отсутствующей/неоднозначной цели, отказа доступа и ошибки с повтором; изоляция кеша и устаревших ответов
- [x] 2.8 Добавить сценарий копирования кода вариации (публикация `compose`, биндинг `components.<key>`, `styles[].styleName` выбранной конфигурации → `variations[].props` полного набора осей → `composeReference`) с нормализацией имён и отказом при неоднозначности; тесты двух оформлений с одинаковыми осями и разными ссылками, перестановки пар, значений по умолчанию, нормализации и коллизий, отсутствующего оформления, пустой ссылки, ошибки запроса и смены выбора до ответа

## 3. Хост превью

- [x] 3.1 Реализовать `PreviewHost` на `JBCefBrowser` и `JBCefJSQuery`: ready, payload, result, describe, таймауты, освобождение ресурсов
- [x] 3.2 Добавить проверку `JBCefApp.isSupported()` и состояние «Превью недоступно в этой IDE»
- [x] 3.3 Тесты корреляции `requestId`, таймаутов и вытеснения (`superseded`) на фиктивном транспорте без JCEF
- [x] 3.4 Изолировать удалённый `iframe` от `JBCefJSQuery` доверенной локальной обёртки, ограничить навигацию/редиректы/внешние окна через `CefRequestHandler` и ресурсы через `CefResourceRequestHandler`, проверять origin/source, схему, направление и сессию сообщений; тесты отклонения чужого origin и некорректных сообщений
- [x] 3.5 Обеспечить анонимную загрузку статики без токенов, cookie OAuth и профиля авторизации IDE; тесты ошибки `401`/`403` и редиректа на вход без передачи секретов в JCEF

## 4. Интерфейс

- [x] 4.1 Раздел «Компоненты»: список с поиском, пустое состояние, переключение между токенами и компонентами
- [x] 4.2 Окно компонента: превью через `SwingPanel`, выбор значений осей вариаций и конфигурации, состояния загрузки и ошибки с повтором
- [x] 4.3 Кнопка «Копировать код» со статусами, в том числе при недоступном превью
- [x] 4.4 Сохранение навигации (раздел, компонент, поиск, выбор вариации и конфигурации) и сброс при выходе
- [x] 4.5 Тесты состояния окна: смена вариации и конфигурации не вызывает запросов записи; интерфейсные тесты списка по образцу `TokenListTest`

## 5. Релиз

- [x] 5.1 Подставлять версию плагина из тега в `plugin.xml` и Gradle, обновить `description` и `sinceBuild/untilBuild`
- [x] 5.2 Добавить `.github/workflows/publish-ide-plugin-release.yml`: проверка тега `idea-plugin-v<semver>`, `buildPlugin`, `SHA256SUMS`, создание GitHub Release, сериализация запусков одного тега и отказ при существующем выпуске без изменения его файлов; тесты повторного запуска и неизменности архива/`SHA256SUMS`
- [x] 5.3 Добавить сборку плагина в `validate-frontend-kt.yml`
- [x] 5.4 README плагина: установка из архива, поддерживаемые версии IDE, проверка суммы

## 6. Спецификации и проверки

- [x] 6.1 Обновить `openspec/specs` описанием по дельтам и описание плагина в `frontend-kt/AGENTS.md`, если меняется модульный граф
- [x] 6.2 `cd frontend-kt && ./gradlew detektAll spotlessCheckAll` и `./gradlew build`
- [x] 6.3 `cd js && npm run build` и тесты `js/apps/client` после экспорта golden-пар
- [x] 6.4 `tools/verify fast --change add-ide-plugin-component-storybook`
- [x] 6.5 `tools/verify full --change add-ide-plugin-component-storybook`
- [x] 6.6 [внешняя проверка] Собрать архив `buildPlugin`, установить в Android Studio, открыть реальную дизайн-систему и убедиться: список компонентов, превью, смена вариации и конфигурации, копирование кода
- [x] 6.7 [внешняя проверка] Подтвердить анонимные ответы `200` для манифеста, точки входа и Wasm/JS-ресурсов проверяемой сборки, работу JCEF без секретов и блокировку чужого origin/некорректного сообщения; адрес сборки, IDE, ОС, команды/действия, коды завершения и результат записать в `.agent-workflow/add-ide-plugin-component-storybook/state.md`, раздел `Verification`
- [x] 6.8 [внешняя проверка] Опубликовать тестовый тег в репозитории `salute-developers/design-system-builder` и убедиться: выпуск содержит архив и `SHA256SUMS`, сумма совпадает
