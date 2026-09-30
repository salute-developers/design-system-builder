# Агентский процесс разработки DS Builder

## Назначение

Процесс связывает Git worktree, OpenSpec, реализацию, независимое review и
детерминированные проверки. Главный агент работает в текущем Codex или Claude
Code и остаётся единственной точкой общения с разработчиком. Для независимой
проверки он создаёт свежего read-only reviewer через нативный механизм среды.

Источники истины в порядке приоритета:

1. текущее рабочее дерево и Git diff;
2. утверждённый OpenSpec Change;
3. последнее сообщение разработчика;
4. локальный `.agent-workflow/<change-name>/state.md`.

Если state расходится с файлами, доверяйте файлам и исправьте state.

## Полный цикл

```text
Explore → Propose → human approval → implementation → FAST
                                      ↑              ↓
                                      └─ fix ← fresh review
                                                     ↓
                                  FULL → external checks → archive
                                                     ↓
                                             human review
                                                     ↓
                                   fix/review/FULL или commit/PR
```

Explore и создание OpenSpec artifacts выполняются до реализации. Не начинайте
изменять production-код, пока разработчик явно не подтвердил proposal, specs,
design и tasks.

Каждый OpenSpec этап выполняется нативной процедурой текущей среды: Explore,
Propose, Apply или Archive. Репозиторный skill выбирает процедуру, добавляет
правила DS Builder и возвращает управление этому процессу между этапами. После
Apply сначала выполняются FAST, review, FULL и внешние проверки, и только затем
запускается Archive.

## Ветка и worktree

Имя ветки и имя OpenSpec Change независимы. Для Git используйте:

```bash
tools/task create <branch-name> [--worktree] [--base <ref>]
tools/task list
tools/task cleanup <branch-name>
```

Если `--base` не указан, `create` использует ветку текущего checkout. Каждая
параллельная задача выполняется в отдельном worktree и в отдельной задаче
Codex/Claude. Не запускайте двух изменяющих агентов в одном checkout.

## Локальное состояние

При реализации, которая может пережить текущую сессию, создайте игнорируемый
файл `.agent-workflow/<change-name>/state.md`. Храните только актуальное:

```markdown
# Task state

Change: <change-name>
Branch: <branch>
Base: <base-ref>
Stage: implementation | review-fix | full | external | ready

## Current feedback

- Последние замечания разработчика.

## Open findings

- Blocking findings, которые ещё не исправлены.

## Verification

- FAST: not run | passed | failed: <причина>
- Review: not run | passed | changes required
- FULL: not run | passed | failed: <причина>
- External: not required | pending | passed | failed: <причина>
```

Перезаписывайте устаревшие сведения и сохраняйте только актуальный этап, открытые
замечания и краткие результаты проверок. Для короткой задачи state необязателен.

## Реализация

Перед изменениями:

1. прочитайте `AGENTS.md` по пути изменяемых файлов;
2. прочитайте все OpenSpec artifacts Change;
3. выполните `openspec validate <change> --type change --strict --no-interactive`;
4. проверьте branch, base ref и текущий diff;
5. убедитесь, что существующие изменения понятны и принадлежат этой задаче.

Главный агент запускает нативную процедуру Apply, реализует задачи
последовательно, отмечает выполненные checkbox в `tasks.md` и запускает
релевантные узкие тесты. Если реализация требует изменить product behavior,
публичный контракт или архитектурное решение за пределами утверждённого design,
остановитесь и вернитесь к OpenSpec и human review.

После реализации запустите:

```bash
tools/verify fast --change <change-name>
```

Изменение архитектурных тестов, Strictacode policy и файлов самого агентского
процесса запрещено, пока оно не названо в утверждённом OpenSpec. Явное
разрешение разработчика передаётся gate:

```bash
tools/verify fast --change <change-name> \
  --allow-protected architecture-tests
```

Имена разрешений: `architecture-tests`, `strictacode-policy` и `agent-process`.

Не используйте разрешение, чтобы скрыть нарушение production-архитектуры.

## Независимое review

После успешного FAST создайте свежего read-only reviewer через нативный механизм
текущей среды. Reviewer не наследует историю implementer и получает короткую
задачу со ссылками на фактические источники:

```text
Проведи read-only code review текущего diff относительно <base-ref>.

Прочитай:
- AGENTS.md и вложенные правила затронутых модулей;
- OpenSpec Change <change-name> (active или archive);
- текущий Git diff;
- последний feedback из .agent-workflow/<change-name>/state.md, если файл есть.

Проверь:
- соответствие требованиям, design и границам scope;
- корректность API, данных, прав доступа и обработки ошибок;
- регрессии и пограничные случаи;
- достаточность тестов;
- случайные generated/local файлы;
- изменения защищённых путей.

Не редактируй файлы, не создавай коммиты и не запускай другой implementer.
Верни только конкретные findings с severity, file:line, доказательством и
требуемым исправлением. Если blocking findings нет, явно сообщи об этом.
```

Главный агент проверяет каждый finding и не применяет ошибочные замечания
механически. После исправлений снова запускает релевантные тесты и FAST, затем
создаёт нового reviewer со свежим контекстом.

Максимум три review-итерации для одного набора feedback. Если повторяется один и
тот же finding, review требует изменить утверждённый scope или цикл не сходится,
остановитесь и объясните разработчику причину. Неблокирующее замечание само по
себе не должно создавать бесконечный цикл.

Если среда не поддерживает сабагентов или повторный запуск reviewer завершился
ошибкой, главный агент выполняет отдельный read-only review самостоятельно и
указывает это в итоговом отчёте.

## FULL и внешние проверки

Когда blocking findings закрыты и FAST проходит, выполните:

```bash
tools/verify full --change <change-name>
```

FULL включает сборку, тесты и Strictacode compare для затронутых контуров.
Baseline Strictacode не меняется ради прохождения задачи.

Затем найдите checkbox с маркером `[внешняя проверка]`. Такие проверки выполняет
главный агент через обычные разрешения текущего Codex/Claude либо передаёт
разработчику точную команду. Для каждой обязательной проверки нужен измеримый
результат. Отсутствующее окружение не считается успехом.

В state сохраните команду, exit code и краткий итог.

## Archive и human review

Архивируйте Change нативной процедурой Archive только после review, FAST, FULL
и обязательных внешних проверок. Затем выполните:

```bash
openspec validate --specs --strict --no-interactive
```

Код, тесты и архивированный Change остаются незакоммиченными. Разработчик может
просмотреть их в IDE.

Если human review требует исправление в пределах утверждённого design, главный
агент продолжает по текущему diff:

```text
feedback → fix → FAST → fresh review → FULL → затронутые external checks
```

Повторно архивировать Change не нужно. Если feedback меняет продуктовый контракт
или архитектуру, сначала создайте или обновите OpenSpec решение и получите новое
подтверждение.

## Возобновление после прерывания

После прерывания новый агент:

1. читает state, если он есть;
2. проверяет `git status` и diff относительно base;
3. читает active или archived OpenSpec Change;
4. проверяет фактический прогресс checkbox;
5. продолжает с самого раннего неподтверждённого этапа.

Существующие незакоммиченные изменения не сбрасываются и не коммитятся ради
возобновления.

## Публикация

Завершение workflow не разрешает commit, push или PR автоматически. Перед
публикацией сообщите разработчику:

- checkout и branch;
- OpenSpec Change;
- состояние FAST, review, FULL и external checks;
- что результат остаётся незакоммиченным.

Commit, push, создание или обновление PR выполняются только по явному запросу.
