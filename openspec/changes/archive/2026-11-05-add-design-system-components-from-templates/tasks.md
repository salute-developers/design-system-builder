## 1. Бэкенд: шаблоны

- [x] 1.1 Граница версий в `ComponentSeedBatchWriter` (`baseline`/`draft`), `templates()` и `seedIntoDraft` в инициализаторе без изменения результата создания ДС
- [x] 1.2 Тест: новая ДС получает тот же состав и конфигурацию компонентов, что до переработки (`GeneratedComponentInitializationPostgresIntegrationTest`)
- [x] 1.3 Запись шаблонов в текущий черновик с токенами из разрешённого состояния

## 2. Бэкенд: добавление

- [x] 2.1 `ComponentTemplateRepository.addOwned`: зависимости, восстановление связи скрытого, проверка метаданных и токенов, раскладка шаблонов в черновик; флаг `fromTemplate` в `CreateDesignSystemComponentUseCase`
- [x] 2.2 Маршрут `GET /api/ds/component-templates`, поле `fromTemplate` у `POST /api/ds/design-system-components`, `openapi/documentation.yaml` и `contracts/route-manifest.json`
- [x] 2.3 Интеграционные тесты: новый компонент, добавление с зависимостью, скрытый компонент сохраняет конфигурацию, компонент уже в составе, отсутствующий шаблон, недостающий токен без записи, откат добавления в журнале, список шаблонов

## 3. Клиент

- [x] 3.1 `componentRepository`: `loadComponentTemplates`, `addComponent`; состав диалога из скрытых и новых
- [x] 3.2 Диалог «Добавить компоненты»: группы «Скрытые» и «Новые» с чекбоксом группы, зависимости из шаблонов, пустое состояние
- [x] 3.3 Раздел «Компоненты» доступен в ДС без компонентов, если есть шаблоны
- [x] 3.4 Тесты диалога, панели и оболочки

## 4. Проверка

- [x] 4.1 `cd backend-kt && JAVA_TOOL_OPTIONS=-Dapi.version=1.44 ./gradlew build`
- [x] 4.2 `cd js && npm run build` и тесты клиента
- [x] 4.3 [внешняя проверка] Локальный стенд (`MINIO_PUBLIC_PORT=9010 ./start-local.sh --detach`): ДС без компонентов, добавить компонент и компонент с зависимостью, превью рисуется, откат добавления в журнале
