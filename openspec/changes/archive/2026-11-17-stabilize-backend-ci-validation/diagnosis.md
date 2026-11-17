# Доказательства причины тайм-аута

## Исторический CI

Run: https://github.com/salute-developers/design-system-builder/actions/runs/43903395866
Job Build (ds-service): 133425699479. Checkout — PR merge
`4ce21ee83b9890aa366a611602b13a36ae09f120` (77ad3c8a + dev 0cca1ebc).
Из 227 runtime-тестов один завершился UncompletedCoroutinesError/TestBuilders.kt:353:
`literal batch preserves stale errors rollback and replay`.
Предыдущий run 43439785422 имел восемь тайм-аутов в разных интеграционных тестах.
Исходник ColorTokenGradientHttpPostgresIntegrationTest из CI полностью совпал с веткой.
Локальный прежний FULL имел 215 тестов, поэтому он не был прогоном того же merge-дерева.
В историческом CI нет загруженных артефактов/полного сообщения; его SQL-план неизвестен.

## Диагностические прогоны 17.11.2026

Git archive точного merge-коммита помещён в отдельный временный каталог; исходники
не менялись. Скомпилирован только test classpath. Один JUnit-метод выполнялся в Linux
JDK17 с -Xmx512m и отдельным PostgreSQL17.11. Сохранены полные исключения, JFR, GC,
снимки потоков и pg_stat_activity. Пользовательская БД не использовалась.

На всех 18 CPU и на общих двух CPU выбранный метод прошёл за 48,842/48,907 с.
Полный минутный тайм-аут теста в этих двух запусках не повторился.
Но один SELECT entity_edit_states JOIN token_values выполнялся около 40 с;
поток приложения находился в BatchJdbc/selectedValueEditRevisions, ожидая JDBC.
У активного запроса не было blocking PID или ожидания lock.

Ktor 3.3.0 testApplication вызывает runTestWithRealTime с жёстким default 60.seconds.
В coroutines1.10.2 строка353 создаёт UncompletedCoroutinesError именно при срабатывании
withTimeout. Это подтверждает механизм исторической ошибки, но её полный текст
(тело теста или оставшиеся дочерние jobs) исходный workflow не сохранил.

## SQL-план и контролируемое сравнение

Снят синтетический снимок в момент медленного SELECT. В нём 7 413 token_values,
107 429 entity_edit_states; у обеих таблиц reltuples=-1/relpages=0.
Воспроизведение на копии сохраняло такую же холодную статистику: схема/индексы создавались
до восстановления данных, autovacuum для диагностического сервера был выключен.
Временное --disable-triggers использовалось только штатным pg_restore для загрузки
ранее валидного снимка; в неизменённом тесте все реальные constraints/triggers работали.

| Запрос/условия | Execution Time | Результат |
| --- | ---: | --- |
| Исходный JOIN, холодная статистика | 61 112,394 мс | 6 строк |
| Адресные UUID[], literal plan, холодная статистика | 7,115 мс | те же 6 UUID/revision |
| Исходный JOIN после ANALYZE | 11,363 мс | 6 строк |
| Адресные UUID[] + owner, force_generic_plan | 891,581 мс | 6 строк |
| Полный первичный ключ + UUID[], force_generic_plan | 4,802 мс | те же 6 UUID/revision |

В исходном Nested Loop внешние 100 007 строк оценены как 1, внутренние 7 413 — как 1.
Внутренний Bitmap Heap Scan выполнен 100 007 раз; Rows Removed by Join Filter = 741 351 870.
Это реальная зависимость от неверных оценок, а не ожидание пула или доказанная утечка
корутин. Сам SQL способен превысить весь 60-секундный бюджет testApplication.
После ANALYZE выбирается Hash Join. Подготовленный запрос по полному первичному ключу
не требует JOIN или сканирования всех редакций владельца; выбран entity_edit_states_pkey.

Первичная буквальная UUID-проба не выдаётся за окончательный prepared-путь: generic plan
проверен отдельно. Отдельно сравнены полные пары entity_id/revision, а не только число строк.

## Артефакты вне Git

`/tmp/ds-ci-timeout-artifacts-20261117/`: unlimited/, two-cpu/, plan-proof/, generic-proof/.
Исходный снимок: `/tmp/ds-ci-timeout-20261117-l_wgmjm4`.
Скрипты: `/tmp/run-ci-timeout-diagnostic.py`, `/tmp/analyze-ci-timeout-plan.py`,
`/tmp/verify-ci-timeout-generic-plan.py`; исходные CI-логи: `/tmp/pr164-ci-*.log`.
В репозиторий не переносятся env, credentials, дампы и многомегабайтные JFR/JSON.

## Граф CI

Существующий backend workflow: Analysis + 6 Tests + 6 Build. Dry-run показал,
что test запускает unit, build повторяет unit и дополнительно integration/check/packaging.
app build не выполняет тесты библиотек; общий verifyFull включает их и архитектурные
проверки. Python Keycloak bootstrap остаётся отдельной явной проверкой.
GitHub API: classic required_status_checks dev не включены; rules/branches/dev вернул [].
Настройки защиты веток не менялись.

## Результат реализации

Исходный тест ColorTokenGradientHttpPostgresIntegrationTest оставлен побайтно неизменным
относительно merge-коммита 4ce21ee. В Linux-снимке заменён только production-файл
TenantValueReadProjection.kt; хеши классов/JAR до и после запуска совпали.

| Полный исходный сценарий | До исправления | После | Результат после |
| --- | ---: | ---: | --- |
| 18 CPU | 48,842 с | 11,089 с | 1 тест, 0 ошибок |
| JVM и PostgreSQL вместе на 2 CPU | 48,907 с | 11,436 с | 1 тест, 0 ошибок |

Это отдельные диагностические запуски, не статистика длительности CI. Минутный бюджет
Ktor не менялся. Дополнительные артефакты: fixed-unlimited/, two-fixed/ и
/tmp/backend-ci-fixed-source-proof.json. Планы и точные UUID/revision сравнивались
на одном сохранённом снимке (таблица выше); здесь подтверждён полный исходный сценарий.

Новая PostgreSQL-регрессия проверяет 6 003 значения, 100 001 постороннее состояние,
отсутствующую редакцию (=0), чужую тему, иной entity_type и адресный срез. Включены
force_generic_plan, prepareThreshold=1 и statement_timeout=5 000 мс; autovacuum
выключен только у двух таблиц изолированной тестовой БД, reltuples остаётся <1.
На новом чтении тест проходит; на старом production-коде того же merge-снимка
падает с PostgreSQL statement timeout (HTTP 500 вместо 200). Существующий тест
EditorSectionReadsPostgresIntegrationTest также прошёл: типы, платформы, история,
адресные фильтры и отказы чужой теме.

Сравнение dry-run графов: все 154 прежние проверочные/упаковочные задачи сохранены;
771 задача нового графа уникальна. Python-контракт Keycloak: 6 тестов успешно.
Контрольный отдельный Gradle composite с намеренными ошибками выполнил unit,
integration и included-build тесты; все 3 дали XML, полные сообщения/вложенные причины
в журнале и итоговый exit=1. YAML проверен: Gradle выполняется после ошибки Python,
ошибки не игнорируются, upload отчётов имеет always(). Реальный GitHub upload
можно подтвердить только после публикации; локальная проверка не выдаётся за CI-run.

## Дополнительное падение общего локального прогона

Первый FULL после исправления: ds-service runtime 216 тестов, один timeout
JournalProjectionHttpPostgresIntegrationTest — compact HTTP matches legacy across new
and published themes and keeps access checks (62,123 с). Это другой сценарий;
первоначальный целевой literal batch прошёл.

Отдельный Linux-прогон неизменённого journal-сценария прошёл за 48,110 с.
Стек на 25-й секунде ожидал ThemeJournalCandidateProjection.visit/CompactJournalReader.tokenIds;
pg_stat_activity фиксировал запросы кандидатов token_value_revisions без блокировок.
Это не изменяемый selectedValueEditRevisions. Единственная выборка стека не доказывает
полное распределение времени между запросами. Узкий повтор обоих journal-тестов
на локальной JVM тоже прошёл (Gradle 49 с). Код/тесты/тайм-ауты не менялись.
Артефакты: /tmp/backend-ci-full.log, /tmp/backend-ci-full-failure.txt,
/tmp/ds-ci-journal-artifacts-20261117/journal-fixed-retry/,
/tmp/backend-ci-journal-narrow.log. Падение не скрывается успешным узким повтором;
для общего gate запущен отдельный повтор FULL.

Повтор общего FULL без изменения исходников снова дал тот же timeout журнала.
Разработчик явно согласовал разделение по двум типам темы (см. дополнение design).
Сравнение тел подтвердило сохранение всех прежних statements/assertions в том же
порядке; обе чужие ДС по-прежнему создаются. После разделения узкий прогон 3/3:
новая тема 45,989 с, опубликованная 11,276 с, лимит журнала 6,191 с. Минутный
лимит каждого testApplication не менялся. FAST после разделения прошёл.

Итоговый FULL после разделения прошёл за 9 мин 18 с: 217 runtime-тестов,
0 ошибок. В общем прогоне journal-сценарии: compact HTTP matches legacy for a new theme and keeps access checks: 12.519 s; compact HTTP remains exact when full journal exceeds its limit: 6.466 s; compact HTTP matches legacy for a published theme and keeps access checks: 11.464 s.
FAST и свежее независимое review после разделения также прошли, blocking findings нет.
Прежние два неуспешных FULL сохранены как диагностическое свидетельство, не удалены.

После архивации общая strict-валидация основных спек: 82 passed, 33 failed
(прежние замечания). openspec/specs не изменялись относительно 77ad3c8a;
валидация текущего Change прошла. Эти замечания не исправляются в SQL/CI Change.
