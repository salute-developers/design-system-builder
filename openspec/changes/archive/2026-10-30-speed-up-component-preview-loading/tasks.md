## 1. ds-service: модель и порт

- [x] 1.1 Добавить доменную модель `ComponentEditorBundle` в `backend-kt/ds-service/feature-components/.../domain`
- [x] 1.2 Добавить порт `ComponentEditorBundleRepository` и `GetComponentEditorBundleUseCase` в `application`: право `components:variations:read`, проверка платформы, `NotFound` при `null`
- [x] 1.3 Unit-тест use case: отказ без права, `NotFound`, передача платформы и `versionId`

## 2. ds-service: чтение данных

- [x] 2.1 Добавить в репозитории фильтры по компоненту: платформенные параметры и вариации свойств по `propertyId`, оформления по `componentId` и `designSystemId`, стили по вариациям компонента и ДС — с теми же проверками владения и разрешением версии, что у существующих списков
- [x] 2.2 Реализовать `ExposedComponentEditorBundleRepository`: один read-only запуск транзакции; экспорт через `ComponentConfigRepository.export` с одним компонентом; зависимости через `ComponentRepository.dependencies` с отбором компонентов, привязанных к ДС и платформе; web-адаптер — запись компонента, только для `web`; `null` для непривязанного компонента и чужой платформы
- [x] 2.3 Зарегистрировать репозиторий и use case в `ComponentModelModule`

## 3. ds-service: маршрут и контракт

- [x] 3.1 Добавить `ComponentEditorBundleResponse` и маршрут `GET /api/ds/design-systems/{designSystemId}/components/{componentId}/editor-bundle` (`platform`, `versionId`; `400` при неверной платформе, `404`, `403`), подключить в `registerComponentsFeature` (`Application.kt`)
- [x] 3.2 Описать маршрут в `app/src/main/resources/openapi/documentation.yaml` (`x-permission: components:variations:read`, параметры, схемы, ответы 200/400/403/404) и в `contracts/route-manifest.json`; обновить счётчик операций в `OpenApiDocumentResourceTest`
- [x] 3.3 HTTP-тест на Postgres по образцу `AppearanceEditorHttpPostgresIntegrationTest`: Web- и Compose-компонент — каждое поле совпадает с существующими маршрутами, отфильтрованными до компонента; `404` для непривязанного компонента и чужой платформы; `400` для неверной платформы; чтение опубликованной версии через `versionId`

## 4. Клиент: загрузка через editor-bundle

- [x] 4.1 Добавить `ComponentEditorBundleDto` в `js/apps/client/src/api/editorContracts.ts`
- [x] 4.2 В `componentRepository.loadComponentData` при заданном компоненте выполнять один `readEditor` к `editor-bundle` (с `readRequest` и платформой) и заполнять из ответа те же переменные, что сейчас дают отдельные чтения; путь без компонента не менять
- [x] 4.3 Передавать `componentId` из записи индекса (`serverBinding.componentId`) в `readComponentDependencies` для выбранного и связанных компонентов
- [x] 4.4 Тест: `Meta` из `editor-bundle` совпадает с `Meta` из старого пути на одном фикстурном наборе (Web и Compose); при выборе компонента выполняется ровно один HTTP-запрос

## 5. Клиент: параллельная загрузка

- [x] 5.1 Перевести `readComponentDependencies` на обход по уровням: `Promise.all` в пределах уровня, последовательное слияние в порядке ссылок, без повторной загрузки посещённых
- [x] 5.2 Читать разделы токенов, нужные компоненту, одновременно; чтение оболочки выполнять до их запуска
- [x] 5.3 Тесты `EditorSectionData`: загрузки одного уровня стартуют до завершения первой; компонент, на который ссылаются двое, загружается один раз; итоговый снимок совпадает с прежним последовательным результатом; разделы токенов запускаются одновременно
- [x] 5.4 Для выбранного Web-компонента загружать на первом уровне его зависимости и родителей по `compose` (`composeParents` в модели компонента); раздел цветов читать для любого компонента

## 6. Клиент: Compose-плагин на уровне раздела

- [x] 6.1 Вынести хост плагина (сессия и iframe) из `ComponentEditorPreview` на уровень страницы раздела компонентов: монтирование при входе в раздел с Compose-компонентами и доступным адресом плагина, уничтожение при уходе, смене адреса или контекста ДС
- [x] 6.2 `ComponentEditorPreview` использует хост раздела: отдаёт область превью, отправляет `describe` и payload в общую сессию, показывает состояние загрузки до `success` нового payload, скрывает iframe для Web-компонента; перезапуск после сбоя сохраняется
- [x] 6.3 Тесты: смена Compose-компонента не создаёт новую сессию и iframe; переход на Web и обратно сохраняет сессию; уход из раздела уничтожает сессию; после `render_crashed` плагин перезапускается

## 6а. Клиент: смена компонента без перезагрузки раздела

- [x] 6а.1 Разделить в `hooks/useDesignSystem.ts` загрузку раздела и компонента: `sectionLoading` по ключу без компонента, новые `componentLoading` и `componentError` для смены компонента внутри загруженного раздела; поздние ответы по-прежнему отбрасываются по ключу
- [x] 6а.2 `pages/Main.tsx`: спиннер на всю область только для `isSectionSwitching`, `isEditorLoading` и `sectionLoading`; `componentLoading` и `componentError` передаются через контекст `Outlet`
- [x] 6а.3 `pages/components/Components.tsx`: при `componentLoading` меню, шапка и хост Compose-плагина остаются смонтированными, загрузка показывается в областях настройки и превью; при `componentError` — ошибка с повтором в области настройки
- [x] 6а.4 Тесты: смена компонента не размонтирует страницу раздела, меню и хост плагина (тест через `Main` с маршрутом раздела); загрузка видна только в областях настройки и превью; ошибка компонента не скрывает меню; вход в раздел по-прежнему показывает общую загрузку

## 7. Gateway: сжатие

- [x] 7.1 Добавить директивы `gzip` (`gzip_types application/json`, `gzip_min_length 1024`, `gzip_comp_level 5`, `gzip_proxied any`, `gzip_vary on`) в `location ~ ^/api/projects/([^/]+)/ds(/.*)?$` файлов `backend-kt/identity-gateway/gateway/nginx.local.conf` и `nginx.prod.conf.template`
- [x] 7.2 Скрипт проверки рядом с `test-route-namespaces.sh`: JSON `ds`-маршрута с `Accept-Encoding: gzip` сжат, без него — нет; `text/event-stream` и `/auth/` не сжаты

## 8. Локальные проверки

- [x] 8.1 `JAVA_TOOL_OPTIONS=-Dapi.version=1.44 TESTCONTAINERS_RYUK_DISABLED=true ./gradlew :ds-service:buildAll :architecture-tests:test` в `backend-kt` (корневой `./gradlew build` ds-service не собирает; включая HTTP-тест на Postgres и `OpenApiDocumentResourceTest`)
- [x] 8.2 `npm test`, `npx tsc --noEmit` и `npm run build` в `js/apps/client`
- [x] 8.3 Пересобрать ds-service и gateway на локальном контуре, `nginx -t` для обоих конфигов, скрипт из 7.2
- [x] 8.4 `openspec validate speed-up-component-preview-loading --strict`

## 9. Проверки до архивирования

- [x] 9.1 [внешняя проверка] Во вкладке Network на локальном контуре: выбор Web `Button`, затем Web `Avatar` — по одному запросу `editor-bundle` на компонент; записать время до и после
- [x] 9.2 [внешняя проверка] Выбор Compose `Avatar` в `sdds_serv_local`: 4 запроса `editor-bundle` за два раунда, превью рисуется как до изменения; смена на Compose `ButtonGroup` не загружает `.wasm` повторно, меню и шапка раздела не мигают, загрузка видна только в настройке и превью; записать время до и после
