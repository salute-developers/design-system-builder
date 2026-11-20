## 1. Подготовка

- [x] 1.1 [внешняя проверка] Сверить версию PostgreSQL на дев- и прод-стендах: нужна 14+ для `CREATE OR REPLACE TRIGGER`; результат записать в design.md (дев и прод — `postgres:17-alpine`, подтверждено пользователем)
- [x] 1.2 Перенести сценарий замера создания (10 созданий подряд, медиана, `durationMs` из `http_request`) в `backend-kt/ds-service/performance/` и записать в `performance/RESULTS.md` исходные цифры: 2,9 с, 38 047 команд, разбивку по триггерам

## 2. Миграция базы

- [x] 2.1 Вынести тела проверок в `check_resolved_revision_unique` (с явным `constraint_name`), `check_resolved_state_set_coherence` и `check_palette_revision_integrity`; `revision_integrity_keys_unchanged` и памятку `ds.revision_integrity_checked` оставить в триггерных обёртках
- [x] 2.2 Вынести правило имени в `design_system_name_taken(text, uuid)` и вызывать его из `enforce_resolved_design_system_name_unique`
- [x] 2.3 Добавить `begin_design_system_baseline_seed(uuid)`: проверка `xmin = pg_current_xact_id()::xid`, только граница `0`, нет черновика, окно не открыто; ошибки `P0001`
- [x] 2.4 Добавить `verify_design_system_baseline_seed(uuid)`: сверка настройки с id, сброс, обход `pg_trigger` по `*_revisions` (`NOT tgisinternal`, аргументы из `tgargs`), однократные вызовы `check_*`, исключение на неизвестную функцию `enforce_*`
- [x] 2.5 Запретить создание черновика при открытом окне в `enforce_design_system_version_lifecycle` и добавить отложенный constraint-триггер на `design_systems`, отклоняющий COMMIT с открытым окном
- [x] 2.6 Пересоздать пользовательские триггеры на `*_revisions`, кроме `design_system_revisions`, с условием `WHEN (COALESCE(current_setting('ds.baseline_seed', true), '') = '')`: только `INSERT` — через `CREATE OR REPLACE TRIGGER`, остальные — через `DROP`/`CREATE`; в начале миграции `SET LOCAL lock_timeout = '5s'`

## 3. Приложение и данные

- [x] 3.1 Добавить порт `BaselineSeedScope` в `core/application` и `ExposedBaselineSeedScope` в `core/data`, зарегистрировать в DI
- [x] 3.2 Добавить `DesignSystemRepository.isNameTaken` через `design_system_name_taken` в `ExposedDesignSystemRepository`
- [x] 3.3 В `CreateDesignSystemUseCase` передать проверку имени в `validateCreate`, открыть окно после `initializeBaseline` и закрыть его до `initializeDraft`
- [x] 3.4 Добавить `reWriteBatchedInserts=true` в `PostgresDatabasePool.create` через `addDataSourceProperty`
- [x] 3.5 Поправить комментарий в `ComponentSeedBatchWriter` о включённых триггерах и отложенных проверках

## 4. Тесты

- [x] 4.1 Модульный тест `CreateDesignSystemUseCase`: порядок вызовов; ранний `Conflict("constraint_conflict")` без вызова инициализаторов; повтор по ключу не вызывает проверку имени
- [x] 4.2 Интеграционный тест на PostgreSQL: состав новой ДС совпадает с ожидаемым по шаблонам, одна базовая версия и один черновик; с `track_functions = 'pl'` счётчики построчных функций не растут
- [x] 4.3 SQL-тест: `begin` отказывает для ДС из другой транзакции; черновик при открытом окне отклоняется; COMMIT с открытым окном падает; запись в базовую версию после `verify` и черновика даёт `40001`
- [x] 4.4 SQL-тест: `begin` → ручная вставка дубля и несогласованного набора состояний → `verify` даёт прежние `SQLState` и имя ограничения, после отката строк ДС нет
- [x] 4.5 Интеграционный тест: правка черновика после создания и добавление компонента из шаблона в существующую ДС попадают в журнал и создают маркер черновика
- [x] 4.6 Тест каталога: у каждого пользовательского триггера на `*_revisions`, кроме `design_system_revisions`, есть условие `WHEN`; порядок срабатывания совпадает с зафиксированным
- [x] 4.7 HTTP-тесты: занятое имя даёт `409 constraint_conflict`; имя удалённой ДС даёт `201`; повтор с тем же `Idempotency-Key` даёт сохранённый `201`; конфликт имени темы по-прежнему даёт `TENANT_NAME_CONFLICT`
- [x] 4.8 Тест одновременного создания двух ДС с одним именем: одна `201`, вторая `409 constraint_conflict`
- [x] 4.9 Тест на пуле из `PostgresDatabasePool.create`: `batchInsert` с `reWriteBatchedInserts`, включая `ignore = true`, вставляет ожидаемые строки

## 5. Проверка

- [x] 5.1 `cd backend-kt/ds-service && JAVA_TOOL_OPTIONS=-Dapi.version=1.44 ./gradlew build integrationTest` (ds-service — отдельная включённая сборка; корневой `build` её тесты не запускает) — тесты на PostgreSQL обязательны, отсутствие Docker считается провалом; бюджетные тесты числа обращений зелёные
- [x] 5.2 [внешняя проверка] Сравнить на локальном стенде образы без изменения и с ним из одного коммита на одной копии базы (A–B–B–A) и записать результаты в `performance/RESULTS.md` (создание 3,54/3,62 → 1,87/1,80 с, ×1,95; 409 ≈9 с → 0,01 с)
- [x] 5.3 [внешняя проверка] Создать ДС через локальный клиент, изменить значение компонента и убедиться, что правка видна в журнале и в превью (Playwright на копии базы: ДС из интерфейса, тема, правка Height Button 48 → 96 видна в превью и в журнале)
