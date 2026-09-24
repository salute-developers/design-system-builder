# TAKT в DS Builder

TAKT реализует уже согласованный OpenSpec Change. Исследование, создание и human
review `proposal.md`, spec deltas, `design.md` и `tasks.md` происходят до запуска
TAKT.

Основной workflow:

```text
preflight → apply → FAST → conformance_review → FULL_LOCAL
                ↑                    │              │
                └────── fix ─────────┴──────────────┤
                                                    ↓
                                      external_verification
                                         ├─ PASS → archive
                                         └─ FAIL → fix
```

Репозиторный helper разделяет имя Git branch и имя OpenSpec Change:

```bash
tools/task create <branch-name> [--worktree]
tools/task run <change-name>
tools/task follow-up <change-name> '<human-review-feedback>'
tools/task status [change-name] --json
tools/task wait [change-name] --json
tools/task external-result <change-name> <result-json-file>
tools/task resume [change-name] --instruction-file <path>
tools/task abort [change-name]
tools/task logs [change-name] --lines 80
tools/task list
tools/task cleanup <branch-name>
tools/verify fast
tools/verify full
tools/verify audit --all
```

Изменение architecture tests внутри TAKT запрещено по умолчанию. Оно разрешается,
если это явно входит в утверждённый OpenSpec Change, либо разработчик прямо просит
об этом и запуск получает флаг `--allow-architecture-tests`.

Контуры репозитория, их FAST/FULL команды и protected paths находятся в
[`verification.conf`](./verification.conf). `tools/verify` загружает manifest, а
конкретные проверки принадлежат Gradle и npm entrypoints соответствующего контура.

Тот же процесс доступен через репозиторный skill:

```text
$dsbuilder-task-workflow создай worktree для feature/PLASMA-123 от текущей ветки
$dsbuilder-task-workflow запусти согласованный Change add-theme-inheritance
$dsbuilder-task-workflow примени замечания review к add-theme-inheritance
```

Skill переводит намерение разработчика в вызовы `tools/task`; shell helper остаётся
единственным источником Git и TAKT логики.

TAKT запускается в checkout разработчика с `--skip-git` и оставляет изменения
незакоммиченными. FAST и FULL подключены как нативные TAKT command gates и
блокируют переход при ненулевом exit code. FULL также сравнивает
Strictacode-метрики изменённых контуров с версионированным baseline. `audit`
создаёт подробные локальные отчёты без изменения baseline. Полный процесс,
guardrails, параллельные задачи и cleanup описаны в [PROCESS.md](./PROCESS.md).

Полный вывод каждого TAKT запуска сохраняется в `.takt/orchestration`, а
координирующий Codex или Claude Code использует компактные `status` и `wait`.
Если обязательной проверке нужны Docker, реальная база данных, журналы сервисов
или другие внешние возможности, workflow останавливается в состоянии
`waiting_external`. Координирующий агент выполняет отдельно разрешённую проверку
и возвращает структурированный результат через `external-result`. Исправимый
дефект направляется в `fix`; успешное доказательство разрешает архивирование.
