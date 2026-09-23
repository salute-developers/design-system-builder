# Процесс разработки с OpenSpec и TAKT

## Принципы

- OpenSpec Change фиксирует согласованные product requirements, architecture и
  program design.
- TAKT реализует утверждённый Change и не принимает вместо команды крупные
  продуктовые или архитектурные решения.
- Git checkout и публикацией результата управляет разработчик или вызванный им
  агент. TAKT не создаёт clone, commit или PR.
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

Base ref определяется автоматически. Для задачи от другой долгоживущей ветки он
указывается явно:

```bash
tools/task create feature/PLASMA-123 --base feature/platform-rework
```

Если разработчик ведёт несколько задач одновременно, для каждой создаётся
отдельная Git worktree за пределами основной директории репозитория:

```bash
tools/task create feature/PLASMA-123 --worktree
```

Каждая worktree открывается как отдельный project/window в IDEA или VS Code.

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
- spec deltas;
- `design.md`;
- `tasks.md`.

OpenSpec artifacts коммитятся в Git branch и отправляются в remote. Для design
review создаётся draft PR. Замечания исправляются дополнительными commits до
согласования Change.

### 3. Запустить основной TAKT цикл

TAKT запускается в том же checkout, где находится утверждённый OpenSpec Change.
Рабочий каталог перед запуском должен быть чистым, а согласованные artifacts —
закоммичены.

```bash
tools/task run add-theme-inheritance
```

Workflow выполняет:

```text
apply → conformance_review → archive
           ↑        │
           └── fix ←┘
```

Если исправление укладывается в согласованный design, `fix` возвращает результат
на повторный review. Если требуется изменить product behavior, public contract
или архитектуру, TAKT останавливается. OpenSpec обновляется и повторно проходит
human review перед новым запуском.

Если workflow был остановлен или завершился ошибкой с частичными изменениями,
последний незавершённый запуск в этом checkout продолжается командой:

```bash
tools/task resume
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

Follow-up workflow читает архивированный OpenSpec Change, применяет замечания и
запускает собственный цикл `apply_feedback → conformance_review ↔ fix`. Он не
архивирует Change повторно и также оставляет результат незакоммиченным. Follow-up
можно запускать несколько раз.

Если замечание меняет согласованное поведение, public contract или архитектуру,
нужно принять новое OpenSpec решение, а не исправлять design внутри follow-up.

### 5. Обновить PR

После принятия результата разработчик или агент:

1. коммитит реализацию вместе с архивированным OpenSpec Change;
2. пушит Git branch;
3. переводит существующий draft PR в code review, когда он готов.

Human review и CI проходят в этом же PR. Небольшие правки можно добавлять
обычными commits или проводить через новый `tools/task follow-up` цикл.

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
в соседнем каталоге:

```text
design-system-builder/                        <base-branch>
dsbuilder-worktrees/feature-PLASMA-123/       feature/PLASMA-123
dsbuilder-worktrees/bugfix-PLASMA-456/        bugfix/PLASMA-456
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
