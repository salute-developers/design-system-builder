## 1. Миграция

- [x] 1.1 Добавить в V22 функцию `reject_baseline_seed_foreign_write()` и сторожевые триггеры на `INSERT` и `UPDATE OR DELETE` для каждой таблицы `*_revisions`, кроме `design_system_revisions`, после пересоздания предметных триггеров
- [x] 1.2 Уточнить комментарии V22: правило имени (точно, с учётом регистра), ограничение проверки `xmin` (без savepoint и вложенных транзакций) — вне тел функций

## 2. Комментарии в коде

- [x] 2.1 `BaselineSeedScope.begin`: в окне пишутся только редакции целевой ДС на границе `0`, остальное база отклоняет
- [x] 2.2 `PostgresDatabasePool`: при `reWriteBatchedInserts` драйвер возвращает `SUCCESS_NO_INFO`, на счётчики `batchInsert` не полагаться

## 3. Тесты

- [x] 3.1 SQL-тест: вставка редакции другой ДС и редакции целевой ДС с границей не `0` в окне даёт `P0001 baseline_seed_foreign_write`, строк создаваемой ДС не остаётся
- [x] 3.2 SQL-тест: удаление и изменение редакции в окне дают `P0001 baseline_seed_foreign_write`; функция сторожа не вызывается при раскладке
- [x] 3.3 Тест каталога: на каждой таблице `*_revisions` из `pg_class`, кроме `design_system_revisions`, есть оба сторожа; имена и порядок предметных триггеров прежние
- [x] 3.4 Обновить `FINAL_FINGERPRINT` в `FlywayAdoptionIntegrationTest`

## 4. Проверка

- [x] 4.1 `cd backend-kt/ds-service && JAVA_TOOL_OPTIONS=-Dapi.version=1.44 ./gradlew build integrationTest`
- [x] 4.2 [внешняя проверка] Замер на одной копии локальной базы: образы `origin/dev`, PR без сторожа и PR со сторожем, порядок A–B–C–C–B–A; результаты в `performance/RESULTS.md`
