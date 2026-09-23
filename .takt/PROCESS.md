# Процесс разработки с OpenSpec и TAKT

## Принципы

- OpenSpec Change фиксирует согласованные product requirements, architecture и
  program design.
- TAKT реализует утверждённый Change и не принимает вместо команды крупные
  продуктовые или архитектурные решения.
- Git checkout и публикацией результата управляет разработчик или вызванный им
  агент. TAKT не создаёт clone, commit или PR.
- Детерминированные FAST и FULL gates блокируют переходы TAKT по exit code; отчёт
  агента не заменяет успешное выполнение команд.
- Перед commit разработчик может посмотреть весь незакоммиченный результат TAKT.
- Один рабочий каталог не используется одновременно разработчиком и несколькими
  процессами TAKT.

## Имена branch и OpenSpec Change

Git branch и OpenSpec Change — независимые сущности:

```text
branch-name: feature/PLASMA-123
change-name: add-theme-inheritance
```

`tools/task create` принимает полное имя Git branch. `tools/task run` и
`tools/task follow-up` принимают имя каталога OpenSpec Change. Скрипт не выводит
одно имя из другого и не переименовывает OpenSpec artifacts.

## Полный lifecycle

### 1. Создать ветку

Для одной активной задачи можно создать branch в текущем checkout:

```bash
tools/task create feature/PLASMA-123
```

По умолчанию новая branch создаётся от branch, открытой в текущем checkout. Это
позволяет создавать дочернюю задачу от `feature/*`, не повторяя имя base branch.
Если нужна другая основа, она указывается явно:

```bash
tools/task create feature/PLASMA-123 --base feature/platform-rework
```

Helper сохраняет выбранный base ref в локальной Git-конфигурации branch. Команды
`tools/task` и `tools/verify` используют его для safety checks и определения diff.

Если разработчик ведёт несколько задач одновременно, для каждой создаётся
отдельная Git worktree в `.worktrees/` текущего checkout:

```bash
tools/task create feature/PLASMA-123 --worktree
```

Так worktree остаётся внутри workspace, доступного агенту и его инструментам.
Каталог можно переопределить через `DSBUILDER_WORKTREE_DIR`. Каждая worktree
открывается как отдельный project/window в IDEA или VS Code.

### 2. Исследовать задачу и согласовать OpenSpec

Разработчик и агент начинают с OpenSpec Explore:

```text
/opsx:explore <проблема или идея>
```

Explore используется для исследования репозитория, текущего поведения,
ограничений и открытых вопросов. На этом этапе команда собирает требования,
acceptance criteria, edge cases и границы scope без преждевременной реализации.

После исследования разработчик просит агента выполнить propose, например:

```text
/opsx:propose add-theme-inheritance
```

Команда дополняет и проверяет:

- `proposal.md`;
- изменения спецификаций;
- `design.md`;
- `tasks.md`.

Читаемый человеком текст и заголовки пишутся по-русски. Английский сохраняется
только в синтаксисе, идентификаторах, официальных названиях и общепринятых
технических сокращениях, разрешённых в `openspec/config.yaml`. Английские слова
не вставляются в русские предложения, если есть понятный русский эквивалент.
Служебные ключевые слова OpenSpec, включая `MUST`, `SHALL` и `Scenario`, сохраняются
в исходном виде.

Для `design.md` агент использует `openspec/DESIGN_GUIDE.md` как адаптивное меню.
Если архитектурные связи, порядок взаимодействий, жизненный цикл или поток данных проще
проверить визуально, в соответствующий раздел добавляется компактная
Mermaid-диаграмма. Для простого локального изменения диаграмма не требуется;
текст всё равно должен объяснять решения, причины и компромиссы.

Для нетривиального изменения желательно рассмотреть необязательный раздел
`Программное проектирование`. В нём решение описывается через значимые контракты:
сигнатуры интерфейсов и классов, открытые методы, зависимости и взаимодействия.
Тела методов и внутренние детали реализации в этот раздел не включаются. Если
новые или изменяемые программные контракты отсутствуют, раздел можно опустить.

Артефакты OpenSpec коммитятся в ветку Git и отправляются в удалённый репозиторий.
Для проверки проектного решения создаётся черновик PR. Замечания исправляются
дополнительными коммитами до согласования изменения.

### 3. Запустить основной TAKT цикл

TAKT запускается в том же checkout, где находится утверждённый OpenSpec Change.
Рабочий каталог перед запуском должен быть чистым, а согласованные artifacts —
закоммичены.

```bash
tools/task run add-theme-inheritance
```

Файлы `backend-kt/architecture-tests` и `frontend-kt/architecture-tests`
защищены от изменений внутри цикла. Они могут меняться, когда утверждённые
OpenSpec artifacts явно включают путь `backend-kt/architecture-tests`, путь
`frontend-kt/architecture-tests` или `LayerArchitectureTest`. Если разработчик
отдельно просит изменить эти тесты вне исходного scope Change, разрешение
передаётся явно:

```bash
tools/task run add-theme-inheritance --allow-architecture-tests
```

Флаг не используется для исправления обычного падения architecture gate: в этом
случае TAKT должен исправлять production-код.

Workflow выполняет:

```text
apply → FAST → conformance_review → FULL → archive
  ↑                    │             │
  └────── fix ─────────┴─────────────┘
```

Перед запуском helper проверяет полный набор OpenSpec artifacts, выполняет strict
validation, проверяет завершённость artifact graph и отсутствие уже
архивированного Change.

Если исправление укладывается в согласованный design, `fix` возвращает результат
на повторный review. Если требуется изменить product behavior, public contract
или архитектуру, TAKT останавливается. OpenSpec обновляется и повторно проходит
human review перед новым запуском.

Если workflow был остановлен или завершился ошибкой с частичными изменениями,
полный вывод остаётся в `.takt/orchestration/<change-name>/logs`. Компактное
состояние можно получить без чтения всего журнала:

```bash
tools/task status add-theme-inheritance --json
tools/task logs add-theme-inheritance --lines 80
```

`status` возвращает состояние, `runSlug`, текущий шаг, итерацию, причину
остановки и путь к отчёту. `tools/task wait` ждёт изменения шага или terminal
status и возвращает только одно компактное событие:

```bash
tools/task wait add-theme-inheritance --json --timeout 300
```

Если TAKT требуется уточнение или действие, недоступное в его sandbox,
координирующий агент задаёт вопрос разработчику через привычный интерфейс. После
ответа агент выполняет только явно разрешённое внешнее действие и записывает
короткий handoff, например:

```markdown
Предыдущий запуск остановился на шаге `full_verification`.

Разработчик разрешил прочитать журнал контейнера `dsbuilder-backend`.
Результат: backend запущен, запрос завершился с кодом 500; релевантная ошибка
сохранена в `.takt/orchestration/add-theme-inheritance/backend.log`.
```

Последний незавершённый запуск в этом checkout продолжается с сохранённой точки:

```bash
tools/task resume add-theme-inheritance \
  --instruction-file .takt/orchestration/add-theme-inheritance/resume-input.md
```

Helper временно публикует handoff как
`.takt/orchestration/<change-name>/resume.md`, запускает штатный `takt resume` в
режиме `Requeue`, а затем переносит использованную инструкцию в локальную историю
handoff. TAKT получает существующий diff, отчёты, resume point и сохранённые
сессии агентов. Разрешение внешнему агенту не расширяет sandbox TAKT.

Запущенный процесс можно аккуратно остановить из другого терминала:

```bash
tools/task abort add-theme-inheritance
```

### 4. Просмотреть результат и выполнить follow-up

После успешного основного workflow код, тесты и архивированный OpenSpec Change
остаются незакоммиченными в выбранном checkout. Разработчик проверяет diff в IDE
и при необходимости запускает дополнительные команды.

Замечания human review, которые укладываются в уже согласованный design, можно
передать в новый TAKT цикл:

```bash
tools/task follow-up add-theme-inheritance \
  'Убрать дублирование в ThemeResolver и добавить случай отсутствующего parent theme'
```

Если само замечание прямо требует изменить architecture tests, команда получает
`--allow-architecture-tests`. Просьба исправить нарушение архитектуры сама по
себе такого разрешения не даёт.

Follow-up workflow читает архивированный OpenSpec Change, применяет замечания и
запускает собственный цикл
`apply_feedback → FAST → conformance_review → FULL ↔ fix`. Он не архивирует
Change повторно и также оставляет результат незакоммиченным. Follow-up можно
запускать несколько раз.

Если замечание меняет согласованное поведение, public contract или архитектуру,
нужно принять новое OpenSpec решение, а не исправлять design внутри follow-up.

### 5. Обновить PR

После принятия результата разработчик или агент:

1. коммитит реализацию вместе с архивированным OpenSpec Change;
2. пушит Git branch;
3. переводит существующий draft PR в code review, когда он готов.

Human review и CI проходят в этом же PR. Небольшие правки можно добавлять
обычными commits или проводить через новый `tools/task follow-up` цикл.

## Validation и guardrails

Единый локальный интерфейс:

```bash
tools/verify fast
tools/verify full
tools/verify audit --all
```

По умолчанию команды сравнивают checkout с base ref задачи и выбирают только
изменённые контуры; `--all` отключает этот фильтр. Структура контуров, команды и
protected paths описаны декларативно в
`.takt/verification.conf`. `tools/verify` читает этот shell manifest и не содержит
списков сервисов или Gradle-модулей.

Каждый контур предоставляет собственный entrypoint:

```text
backend-kt  → ./gradlew verifyFast / verifyFull
frontend-kt → ./gradlew verifyFast / verifyFull
js          → npm run verify:fast / verify:full
```

`audit` запускает подробный Strictacode-анализ выбранных изменениями контуров;
`--all` проверяет все три контура. Текущие отчёты записываются в
`.takt/strictacode-reports` и не попадают в Git.

Добавление модуля внутри существующего контура настраивается в его Gradle или npm
build logic. Новый top-level контур добавляется в manifest без изменения runner.

FAST запускается command gate после `apply`, `apply_feedback` и каждого `fix`.
Он включает:

- strict validation изменённых OpenSpec Changes;
- syntax и TAKT workflow validation для process tooling;
- запрет изменений architecture tests без явного scope OpenSpec или разрешения
  разработчика, сохранённого в контексте запуска;
- Konsist architecture tests для затронутых Kotlin-контуров;
- Detekt, Spotless и тесты для затронутых Kotlin-контуров;
- build и имеющиеся тесты для затронутого JS-контура.

FULL повторяет общие guardrails, запускает полный `build` затронутого Kotlin или
JS-контура, формирует подробный Strictacode audit и сравнивает его с baseline.
Compare блокирует новые ухудшения project score, complexity density и refactoring
pressure относительно версионированного baseline в `.takt/strictacode-baseline`.
Для целочисленного graph-based overengineering pressure допускается изменение на
один пункт, чтобы округление метрики не блокировало изменение при неизменных или
улучшившихся остальных показателях. FULL выполняется после успешного conformance
review. Archive разрешён только после FULL PASS.

Для воспроизводимого локального запуска используется Strictacode `0.0.12`:

```bash
pipx install strictacode==0.0.12
cd js && npm ci
```

Версия также записана в `tools/strictacode-requirements.txt`. JavaScript-анализатор
Strictacode использует `@babel/parser` и `@babel/traverse` из `js/node_modules`.
Язык каждого контура задан явно в его `.strictacode.yml`; это не позволяет
generated JavaScript из Kotlin build-каталогов повлиять на определение языка.
В legacy JS Strictacode проверяет только `apps/client`, `cli` и
`services/db-service`. Для них используются независимые baseline: расчёт метрик
связности на одном общем графе занимает неприемлемое для gate время. `apps/admin`,
`services/documentation-generator`, `services/generator` и `services/publisher`
в Strictacode scope не входят.

Baseline обновляется отдельным осознанным изменением после анализа причины:

```bash
tools/strictacode baseline backend backend-kt
tools/strictacode baseline frontend frontend-kt
cd js
../tools/strictacode baseline-set \
  javascript-client:apps/client \
  javascript-cli:cli \
  javascript-db-service:services/db-service
```

Конфигурация Strictacode, wrapper и baseline защищены от изменений внутри TAKT.
Разрешение возможно, только если изменение явно входит в согласованный OpenSpec
scope. Не следует обновлять baseline только ради прохождения compare.

Архитектурный gate запускает Konsist по production-коду затронутого Kotlin-контура.
Первые правила запрещают обратные зависимости из `domain` и `application`, а
также доступ `presentation` к `data` и `di`. Известные backend-нарушения временно
перечислены в тесте точными путями; после исправления соответствующее исключение
нужно удалить.

Protected paths также задаются в `.takt/verification.conf`. Перед запуском TAKT
`tools/task` просит runner сформировать их snapshot. Поэтому helper не знает, где
физически находятся architecture tests или Strictacode policy, а список можно
расширить другими защищёнными путями через manifest.

После успешного workflow `tools/task` проверяет постусловия:

- TAKT не создал и не переключил commit;
- index остался чистым;
- активный Change исчез и появился ровно один archive;
- в архивированном `tasks.md` нет незавершённых задач;
- результат остался незакоммиченным для human review;
- среди изменённых путей нет локальных или generated artifacts.
- основные OpenSpec specs проходят strict validation после archive.

### 6. Завершить задачу

Если задача выполнялась в основном checkout, после merge разработчик переходит
на нужную ему следующую ветку и при необходимости удаляет локальную task branch.
Процесс не предполагает, что base branch обязательно называется `main` или `dev`.

Для дополнительной worktree из любого другого checkout этого репозитория:

```bash
tools/task cleanup feature/PLASMA-123
```

`cleanup` удаляет только чистую linked worktree. Затем он выполняет безопасный
`git branch -d`. Если Git не считает branch влитой, например после squash merge,
worktree уже будет удалена, а локальная branch останется. После проверки её можно
удалить отдельно:

```bash
git branch -D feature/PLASMA-123
```

## Параллельные задачи

У каждой параллельной задачи должны быть собственные:

```text
OpenSpec Change
Git branch
Git worktree
IDE window
TAKT execution
PR
```

Один checkout можно оставить на выбранной командой base branch, а задачи держать
в его игнорируемом каталоге `.worktrees/`:

```text
design-system-builder/                                  <base-branch>
design-system-builder/.worktrees/feature-PLASMA-123/    feature/PLASMA-123
design-system-builder/.worktrees/bugfix-PLASMA-456/     bugfix/PLASMA-456
```

TAKT запускается отдельно внутри каждой worktree. Независимые задачи можно
выполнять параллельно. Зависимые изменения и задачи, обновляющие один и тот же
основной OpenSpec spec, лучше выполнять последовательно из-за merge conflicts.

## Владение рабочим каталогом

Перед запуском TAKT разработчик сохраняет нужные изменения и прекращает ручное
редактирование в этом checkout. Во время выполнения каталог принадлежит TAKT.
После завершения или остановки TAKT управление возвращается разработчику.

TAKT-managed clone в этом процессе не используется: его post-processing создаёт
commit до того, как разработчик сможет просмотреть незакоммиченный diff.

## Взаимодействие с агентом во время TAKT

Разработчик общается с координирующим Codex или Claude Code. TAKT выполняет
workflow внутри выбранной Git worktree и не является пользовательским чатом.

Контекст передаётся тремя слоями:

1. OpenSpec, исходный код, Git diff, `AGENTS.md` и `.takt/task-run-context`
   содержат постоянный контекст задачи.
2. `.takt/runs` содержит состояние TAKT: шаги, отчёты, resume point и сессии
   агентов.
3. `.takt/orchestration/<change-name>` содержит полный журнал, компактный статус
   и handoff от координирующего агента.

Координирующий агент обычно вызывает `wait` и `status`. Полный журнал читается
через `logs` только при ошибке или когда краткого отчёта недостаточно. Это не
засоряет его контекст повторяющимся выводом сборки и промежуточных циклов review.
