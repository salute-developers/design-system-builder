# TAKT в DS Builder

TAKT реализует уже согласованный OpenSpec Change. Исследование, создание и human
review `proposal.md`, spec deltas, `design.md` и `tasks.md` происходят до запуска
TAKT.

Основной workflow:

```text
apply → conformance_review → archive
           ↑        │
           └── fix ←┘
```

Репозиторный helper разделяет имя Git branch и имя OpenSpec Change:

```bash
tools/task create <branch-name> [--worktree]
tools/task run <change-name>
tools/task follow-up <change-name> '<human-review-feedback>'
tools/task resume
tools/task list
tools/task cleanup <branch-name>
```

Тот же процесс доступен через репозиторный skill:

```text
$dsbuilder-task-workflow создай worktree для feature/PLASMA-123 от dev
$dsbuilder-task-workflow запусти согласованный Change add-theme-inheritance
$dsbuilder-task-workflow примени замечания review к add-theme-inheritance
```

Skill переводит намерение разработчика в вызовы `tools/task`; shell helper остаётся
единственным источником Git и TAKT логики.

TAKT запускается в checkout разработчика с `--skip-git` и оставляет изменения
незакоммиченными. Полный процесс, параллельные задачи и cleanup описаны в
[PROCESS.md](./PROCESS.md).

Command gates и общая verification-команда пока не входят в workflow.
