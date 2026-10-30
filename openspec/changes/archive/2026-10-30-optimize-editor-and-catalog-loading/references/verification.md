# Проверка реализации: загрузка редактора и каталога

Дата: 30 октября 2026. Ветка `bugfix/optimizations`, база `feature/backend-monolith` (`67515b2f`), planning HEAD `51ff5f34`. Реализация находится в рабочем дереве, не опубликована.

## Методика

Локальный Kotlin-монолит, реальные PostgreSQL и Keycloak, Chrome с изолированными профилями. Сравнение старого frontend из неизменённого HEAD и нового production build выполнено на одинаковых тестовых данных. Для типографики и цвета обе версии клиента работали с одним обновлённым backend. Для shapes/revert дополнительно сохранён замер исходного монолита. Отдельно проверен dev frontend с React StrictMode.

Таблица считает предметные HTTP-запросы, включая запись, и сумму размеров декодированных тел ответов. Это не размер сжатого сетевого трафика. OPTIONS, SSE и JS-модули dev-сервера не входят в предметные чтения. Один прогон не определяет p95 или производительность сервера dev-стенда.

## Измеренный эффект

**Уточнение по обратной связи о градиентах:** результат обычной правки цвета ниже не распространяется на все градиенты. На актуальном dev-клиенте воспроизведена правка угла 45 → 46 → 45 в отдельной новой теме: каждое сохранение вызвало 8 запросов и 3 158 578 Б ответов. PUT вернул X-DS-Mutation-Metadata-Truncated: true, 2 015 Б metadata. Ограничение сервера — 2 048 Б; HTTP interceptor запускает широкую theme-tokens инвалидацию, а адаптер цвета не применяет адресную сверку при truncated. Поэтому перечитываются группы, тема, палитра, определения color/gradient и все значения плюс summary. Значения восстановлены. Этот сценарий пока не оптимизирован; прежняя формулировка завершённости цветового пути была слишком широкой. Evidence: /tmp/dsbuilder-gradient-audit.json. Create/move/delete также пока используют общую сверку color/gradient; её можно дополнительно сузить, сохранив зависимости и revisions.

| Сценарий | До: запросы / байты | После: запросы / байты |
| --- | ---: | ---: |
| Каталог 1 проекта | 3 / 640 | 1 / 341 |
| Каталог 10 проектов | 12 / 6 404 | 1 / 3 412 |
| Каталог 50 проектов | 52 / 32 084 | 1 / 17 092 |
| Правка размера в прогретом разделе | 26 / 718 481 | 3 / 861 |
| Правка типографики | 21 / 842 401 | 3 / 3 065 |
| Правка цвета | 13 / 3 222 097 | 5 / 5 451 |
| Один revert при открытом журнале | 13 / около 1,35 МБ | 3 / 514–2 176 |
| Возврат в свежий неизменённый shapes/typography | — | 0 предметных HTTP-чтений |
| Accordion → Card → Accordion | — | Card: 7 недостающих чтений; возврат: 0 |
| Покой после завершения сверок | — | 0 предметных запросов за 100 секунд |

Тестовые каталоги содержали проекты без ДС; корректность ненулевых счётчиков, удалённых/технических ДС, границы 500 ID и прав отдельно проверена PostgreSQL-тестами. Каталог больше не запрашивает полный список ДС для каждой карточки. Обычный GET /projects возвращает nullable designSystemCount; подсчёт выполняется пакетно внутри монолита.

Правка размера: PUT, один summary и один token-ids. Типографика использует подтверждённые записанные значения без повторного полного чтения. Для цвета существующий ответ записи недостаточен: клиент адресно читает значения трёх изменённых токенов текущей темы и summary, сохраняя палитру и определения. Это заменяет многомегабайтное перечитывание раздела. При отказе адресного чтения успешный PUT не повторяется; остаётся согласованная сверка активного раздела.

Revert выполняет POST, один changes и один summary. Убраны дубли полного журнала и перечитывание свежего словаря определений. Возврат в раздел, действительно изменённый revert, требует сверки и не относится к сценарию возврата без изменений.

В dev/StrictMode правки размера, типографики и цвета дали те же количества предметных запросов и корректные итоговые значения. Проверены сохранение и возврат исходных значений: размер 12 → 14 → 12, типографика 16 → 17 → 16, цвет 108E26 → 123456 → 108E26.

## Загрузка по потребности и корректность

- Основная вкладка настроек проекта не читает участников, ключи и список ДС. Основная вкладка настроек ДС не читает темы ради счётчика. Холодный GET /projects на этих страницах нужен видимой боковой навигации; свежий результат переиспользуется.
- Скрытый журнал и скрытые разделы не перечитываются из-за TTL, локальной записи или удалённой инвалидации. TTL проверяется при потреблении; фонового polling нет.
- Глобальные метаданные компонентов переиспользуются отдельно от конфигурации ДС. Для Card не повторяются свежие глобальные каталоги; scoped appearances и индекс связей ДС пока читаются. Зависимости превью остаются явными.
- В двух браузерных сессиях видимый раздел получил удалённую правку, скрытый не загружался до открытия, удалённый revert восстановил исходное значение.
- Импорт конфигурации Accordion обновил открытый компонент; восстановление при скрытом компоненте не вызвало его чтений до открытия. Исходная конфигурация восстановлена. Импорт общих метаданных API, затрагивающий другие ДС, браузером не выполнялся: его инвалидация покрыта модульными тестами, внешняя проверка этого подпункта остаётся открытой.
- После отзыва роли следующий серверный запрос отказал в доступе даже при сохранённом preflight. Chrome показал один OPTIONS для повторного URL и Access-Control-Max-Age: 600. При временной недоступности локальной DS DB GET /projects вернул 200 с count=null, без N+1; DB восстановлена.
- Задержанный ответ после ухода со страницы не заменил новый экран. Фактическая транспортная отмена в браузере с перехватом route.fetch не подтверждена: перехват уже завершил upstream-запрос. Отмена последнего потребителя, сохранение запроса другого потребителя и отбрасывание поздних ответов проверены модульными тестами. Браузерный тест transport abort остаётся открытым.

## Большой журнал

На существующем наборе с 21 795 отображаемыми изменениями, без изменения данных:

| Чтение | Статус | Размер | Локальное время |
| --- | --- | ---: | ---: |
| summary | 200, total=21795 | 15 Б | 352 мс |
| token-ids текущей темы | 200 | 8 438 Б | 119 мс |
| Полный changes | 422 JOURNAL_LIMIT_EXCEEDED | 103 Б | 298 мс |

Компактные чтения используют порции минимальных данных и общие правила подсчёта Kotlin, не полный list. Полный журнал сохраняет лимит 10 000. PostgreSQL-тест с 10 001 изменением также подтверждает независимость компактных чтений от лимита.

## Остаточные задержки и объёмы

Холодное открытие цветов всё ещё получает около 3,16 МБ: примерно 2,35 МБ значений, 539 КБ color definitions, 235 КБ палитры и прочие небольшие ответы. Уменьшение начального протокола не входит в согласованную реализацию. Холодные глобальные property variations компонентов составляют около 840 КБ; первый вход в компонент также требует конфигурации и зависимостей. Нулевой запрос при первом открытии не обещается.

Исходные 2 секунды server-side revert на dev-стенде локально не воспроизведены. Локальный обновлённый revert занимал 53–70 мс против 40–45 мс исходного: ускорение самой серверной транзакции не доказано. Основной измеренный эффект — сокращение последующей клиентской пачки запросов и объёма данных.

В диагностическом окне JFR максимальная GC-пауза — 5,37 мс, сумма 42 пауз — 89,99 мс, максимальный наблюдавшийся heap — 172,8 МиБ; один наблюдавшийся Hikari park — 24,25 мс. SQL-профиль DS DB: максимум statement 79,031 мс, максимум из 99 COMMIT — 1,498 мс; projects DB: максимум statement 1,203 мс, COMMIT 0,028 мс. Окно включает старт процесса и несколько сценариев, это не причинный бюджет одного revert. Длительные ожидания PostgreSQL notification listener не приписываются HTTP-запросам. Диагностические параметры удалены, обычный локальный контур восстановлен. Спекулятивные изменения изоляции, индексов и алгоритма revert не внесены.

Нужно повторить трассировку исходного медленного revert на dev после выпуска на тех же данных, используя correlation ID и раздельное время gateway/application/SQL.

## Статус обязательных проверок

OpenSpec strict и FAST пройдены. Независимые read-only review завершены без оставшихся блокирующих findings; отдельное review последней оптимизации цвета также без findings. Kotlin backend verifyFull, production build и CLI (62 теста) пройдены. Полный клиентский прогон: 114 файлов, 978/978 тестов; точечные 44 hook-теста и 27 тестов цветового пути также пройдены.

**FULL не пройден:** Strictacode javascript-client отклоняет complexity density 9,97 против tracked baseline 9,58 и refactoring pressure 62 против 61. Score 48 не изменился; overengineering pressure 17 против 16 находится в разрешённом допуске +1. Аудит неизменённого исходного frontend даёт density 9,86 и pressure 62: часть расхождения уже существовала до change, реализация дополнительно увеличила density примерно на 0,11. Baseline и защищённые правила не изменялись.

Change не архивирован: FULL и перечисленные остаточные внешние подпункты ещё не закрыты. Коммит и push реализации не выполнялись.

## Воспроизводимость и данные

Локальные диагностические результаты сохранены без JWT в /tmp/dsbuilder-{catalog-baseline,catalog-optimized,acceptance-production,acceptance-dev-strict,typed-edits-baseline,typed-edits,typed-edits-strict,two-sessions,components-matrix,import-check,access-failure,late-read,compact-live}.json. Итоговые логи: /tmp/dsbuilder-client-final.log и /tmp/dsbuilder-verify-full-final.log. Эти временные файлы не являются переносимыми CI-артефактами; численные результаты и ограничения зафиксированы в этом отчёте.

Правки значений и конфигурации выполнялись в изолированной тестовой ДС и восстановлены. Общие существующие данные большого журнала использовались только для чтения. 61 проект локальных тестовых каталогов 1/10/50 после замеров обратимо архивирован, чтобы не засорять активный каталог. Изолированная тестовая ДС сохранена для повторной проверки.

## Дополнение: локальный seed

Обычные setup-local.sh/setup-local.ps1 больше не создают base/base_default и sdds_serv_local и не импортируют значения/конфигурации пользовательской ДС. Сохраняются проект, Web API и публикация Compose-плагина вместе с Compose API. Явный пакет компонентов или COMPOSE_COMPONENTS_PACKAGE включает прежний демонстрационный импорт; skip имеет приоритет. Отдельный seed-helper сохранён. Существующие данные не очищались.

Начальное создание ДС использует backend-ресурсы token-definitions.json и component-seeds.json; создание темы — token-initial-values.json и палитру. Helper сначала создаёт те же сущности через API, затем дополнительно заменяет Android-значения и Compose-конфигурации пакетами local-dev. Штатная инициализация и baseline не изменены.

Временная проверка /tmp/dsbuilder-seed-check.py: default, explicit package, environment package, skip, ошибка theme-only до запуска и отказ явного seed — PASS. Bootstrap на временном HTTP-стенде дважды: один POST проекта, два импорта Web API, ни одного запроса ДС/тем — PASS. Публикация плагина остаётся в цепочке setup, её скрипт не менялся. Это mock-проверка, а не полный запуск Docker-контура с нуля. Bash syntax, OpenSpec strict, git diff --check и FAST (/tmp/dsbuilder-seed-fast.log) — PASS. Свежий независимый seed_review_1 — без блокирующих findings. PowerShell проверен статически; Windows runtime отсутствует, реальный запуск не выполнялся.

Повтор FULL после review (/tmp/dsbuilder-seed-full.log) завершился прежним отказом client Strictacode: density 9,97/9,58, pressure 62/61. Backend verifyFull, его Strictacode, production build и CLI 62/62 пройдены. Защищённые правила и baseline не изменены; change остаётся активным.

## Исправление подтверждений семейства после обратной связи

Новый JSON ACK проверен на актуальном dev-клиенте из worktree и пересобранном локальном монолите. Это заменяет прежний fallback при truncated metadata; транспортный лимит заголовка сохранён.

| Действие | Предметных запросов после действия | Декодированные ответы |
| --- | ---: | ---: |
| Угол градиента, включая связанные значения | 2 (PUT + summary) вместо 8 | 28 200 Б вместо 3 158 578 Б |
| Обычный цвет со связанными значениями | 2 (PUT + summary) | 24 899 Б |
| Создание через кнопки UI, полное семейство | 2 (POST + summary) | 40 313 Б |
| Переименование через кнопки UI | 2 (POST move + summary) | 16 576 Б |
| Удаление через кнопки UI | 2 (DELETE + summary) | 10 932 Б |
| Revert при открытом журнале | 2 (POST + GET changes) вместо 3 | Нет отдельного summary |

Полные палитра, определения и значения в этих действиях не перечитываются. В сценарии UI проверены одна строка после создания/переименования и исчезновение после удаления. Более маленькое тестовое семейство из трёх определений отдельно проверено через реальный клиентский адаптер и активный UI: create/move/delete — по 2 запроса, 7 620/1 639/214 Б. Эти размеры зависят от числа членов семейства и соседей группы, а не являются универсальной верхней границей.

Проверены разные пользователи admin@example.com и user@example.com в отдельных браузерных контекстах. Ответ первой записи удерживался после выполнения на сервере; второй пользователь получил SSE, записал новое значение, затем был выпущен старый ACK первого. Более новая чужая правка сохранилась. При скрытом цветном разделе — 0 его GET, после открытия данные актуальны. Поле исходного цвета восстановлено, временное членство удалено. Данные всех тестов принадлежат отдельной audit-ДС; восстановление видимого поля не означает побайтового восстановления всех производных значений и исходного формата — для пользовательского контура такие тесты не проводились.

SSE-контракт сохраняется широким (scopes, без ID). Чужая инвалидация и восстановление связи по-прежнему сверяют активный раздел; оптимизация собственного ACK не отключает этот путь. Новые ID/миграции/параллельный канал событий не вводились. Более старая редакция и уже установленная удалённая инвалидация не принимаются как свежий ACK. Смена ссылок палитры помечает её устаревшей для следующего открытия; изменение HEX без смены ссылок сохраняет свежую палитру.

Журнал отдаёт точный X-DS-Journal-Total из того же снимка и по уже прочитанным изменениям; массив ответа сохранён для CLI и совместимых модельных чтений. Для 422/старого сервера остаётся независимый compact summary. Новый заголовок описан в OpenAPI и открыт в CORS. На реальном контуре total полного журнала и независимого summary совпали: 29/29.

Evidence: /tmp/dsbuilder-gradient-confirmed.json, /tmp/dsbuilder-confirmed-typed-edits.json, /tmp/dsbuilder-color-structure.json, /tmp/dsbuilder-color-ui.json, /tmp/dsbuilder-confirmation-sse.json, /tmp/dsbuilder-acceptance-confirmed-journal.json. Последний прогон журнала не повторяет 100-секундный idle из основной матрицы (проверен 1 с); исходная 100-секундная проверка сохранена выше. Холодный протокол и серверная двухсекундная задержка dev не изменены этим исправлением.

Клиент: 988/988 тестов в 114 файлах. Feature-themes unit, точечные HTTP/PostgreSQL color/gradient и OpenAPI проверки прошли (совместимое editRevision=0 сохранено); архитектурное правило отдельных файлов исправлено и проверено отдельно. FAST пройден (/tmp/dsbuilder-confirmation-fast.log). Свежий независимый family_ack_review_1 завершён без доказанных blocking findings. Повторный FULL (/tmp/dsbuilder-confirmation-full.log) не пройден: client Strictacode score 49/48, density 10,02/9,58, refactoring pressure 62/61; overengineering 17/16 в разрешённом допуске. По сравнению с предыдущей реализацией density выросла с 9,97 до 10,02 и score с 48 до 49. Backend verifyFull и его Strictacode, production build и CLI 62/62 прошли. Baseline и защищённые проверки не изменялись. Это незакрытая приёмка, а не успешное завершение change.

Финальный монолит пересобран и запущен без сброса БД. После пересборки угол 45 → 46 → 45 повторно подтвердил 2 запроса / 28 200 Б на запись; UI revert восстановил 12 после правки до 14, без отдельного summary. OpenSpec strict и git diff --check прошли. Созданный audit-проект a1bc7594-fccc-4a32-98ec-e06b02b9e691 после проверок обратимо архивирован; основной checkout dev чистый. Реализация остаётся в worktree bugfix/optimizations, без коммита, push и архивации change.

## Новый baseline по явному запросу пользователя

Пользователь разрешил зафиксировать текущий Strictacode baseline. Штатная команда `tools/strictacode baseline javascript-client js/apps/client` заново проанализировала код и обновила только `.verification/strictacode-baseline/javascript-client.json`: score 49, density 10,02, refactoring pressure 62, overengineering pressure 17. Baseline совпадает с project свежего анализа. Пороги, policy и другие baseline не менялись. Приведённые выше отказы остаются историческими результатами до этого разрешения.

Повтор `tools/verify full --base feature/backend-monolith --change optimize-editor-and-catalog-loading --allow-protected strictacode-policy` — PASS (exit 0), лог `/tmp/dsbuilder-baseline-full.log`. Backend, production build, CLI 62/62 и оба JS Strictacode compare прошли. `git diff --check` — PASS. Задачи 7.3/9.4 закрыты; обязательные незавершённые внешние подпункты 3.4/7.5 остаются открытыми, поэтому change пока не архивирован. Baseline изменён в рабочем дереве без коммита и push.

## Additional full independent review

Fresh reviewer `full_journal_multiuser_review` (no implementer history) reviewed the whole tracked diff and new source against `feature/backend-monolith`. No proved blocking findings or confirmed regressions. Source was not changed.

Existing specs checked: design-system-change-journal, design-system-version-journal-ui, multi-user-design-system-editing, tenant-aware-theme-editor, design-system-model-api; intersections with design-system-version-history, versioned-palette-integration, token-groups-api, theme-palette-api/editor, color-token-operations-api/editor, frontend-client-authentication; all change delta specs.

Checked: shared semantic count/policies and full-journal limit; grouped/partial/dependent revert and unknown COMMIT; pending autosave with remote SSE and stale ACK; actor+client filtering and reconnect cursor; version/tenant/platform/mode/override isolation; permissions, logout/401/403, late responses and cache keys; hidden sections; unchanged Components/Palette/revert/size/typography callers. A suspected missing cross-section invalidation was disproved by tracing existing callers.

Independent test run: EditorSectionData.test.ts, useJournal.test.tsx, editorReads.test.ts, useLoad.test.tsx, incompleteMutationMetadata.test.ts, httpColorTokenRepository.test.ts, VersionJournalPages.test.tsx. 7 suites, 88/88 PASS, 2.51s, Vitest 4.1.11/jsdom/mock HTTP.

Limits: PostgreSQL concurrency/rollback tests, real two-browser sessions and network reconnect were not rerun in this review. Prior execution evidence remains separate. Real transport abort and runtime global metadata import remain open external checks; no-findings does not replace them.

## Publication and archive request

User explicitly requested archive, commit and PR update after the successful FULL and additional independent review. Archive retains incomplete tasks 3.4/7.5 and their documented external verification limitations; these are not marked passed. Delta specifications are synchronized by the native OpenSpec archive command. Publication targets bugfix/optimizations -> feature/backend-monolith (PR142).

## Post-archive specification validation

Native archive synchronized 10 capabilities and moved the change to `2026-10-30-optimize-editor-and-catalog-loading` (31/33 tasks, two documented external tasks retained). `openspec validate --specs --strict --no-interactive`: 80 passed, 7 failed due to pre-existing warnings in color-token-operations-api, color-token-value-validation, color-tokens-editor, design-system-version-journal-ui, theme-palette-api, theme-palette-editor and token-groups-api. All long requirement blocks causing warnings were compared with feature/backend-monolith and are unchanged; token-groups-api including its placeholder is unchanged. No new validation warning introduced by sync. Log: /tmp/dsbuilder-archive-spec-validation.log. Earlier successful FULL was run before archive; the archived-change FULL path now encounters this repository-wide spec validation failure.
