---
name: dsbuilder-task-workflow
description: Manage DS Builder tasks through Git worktrees, OpenSpec, implementation, independent review, verification, archive, and human follow-up. Use when starting, implementing, continuing, reviewing, or cleaning up a development task in design-system-builder.
---

# DS Builder Task Workflow

Read [the shared development workflow](../../workflows/dsbuilder-development.md)
before implementing, continuing, reviewing, or archiving a task. It is the
source of truth for stages, review loop, verification and publication boundaries.
Use `tools/task` for Git branch and worktree operations. Continue interrupted
work from the current diff, OpenSpec artifacts and optional local task state.

Treat `.verification/config` as the source of truth for repository contours,
FAST/FULL/audit commands and protected paths. Keep contour-specific checks behind
their Gradle, npm or Strictacode entrypoints.

## Delegate OpenSpec phases

Before starting an OpenSpec phase, load and follow the corresponding native
OpenSpec skill:

- research and requirement exploration: `OPSX: Explore`;
- creating proposal, design, specs and tasks: `OPSX: Propose`;
- implementing tasks: `OPSX: Apply`;
- syncing specs and archiving the Change: `OPSX: Archive`.

This delegation is mandatory. Do not reproduce an OPSX procedure from memory.
While executing it, also apply the repository rules from `openspec/config.yaml`,
`openspec/DESIGN_GUIDE.md` and applicable `AGENTS.md` files. If the required OPSX
skill is unavailable, report the missing skill instead of silently substituting
another procedure.

`OPSX: Apply` owns task implementation and checkbox progress. After it completes,
return to this workflow for FAST, independent review, FULL and external checks.
Invoke `OPSX: Archive` only after those gates pass.

## Preserve the two names

Keep these independent:

- `branch-name`: full Git branch, for example `feature/PLASMA-123`;
- `change-name`: OpenSpec directory name, for example `add-theme-inheritance`.

Never derive one from the other. Infer a missing value only from an exact current
branch or OpenSpec path; otherwise ask for it when the requested operation needs
that value.

## Explore and propose

Use `OPSX: Explore` to investigate current behavior, requirements, edge cases
and scope. Use `OPSX: Propose` when the developer asks to create the Change. Do
not implement production code during Explore.

For artifacts:

- follow `openspec/config.yaml` language and structure rules;
- read `openspec/DESIGN_GUIDE.md` when `design.md` is needed;
- add only sections with a real decision, risk or trade-off;
- include a focused Mermaid diagram when architecture, data flow, interaction
  order or state transitions become clearer visually;
- consider `Программное проектирование` for non-trivial contracts and show
  interfaces, classes, signatures and interactions without method bodies.

Wait for explicit human approval of the OpenSpec artifacts before implementation.

## Branches and worktrees

Require an explicit full branch name for creation:

```bash
tools/task create <branch-name> [--base <base-ref>]
tools/task create <branch-name> --worktree [--base <base-ref>]
```

When no base is requested, omit `--base`; the helper uses the branch checked out
in the invoking checkout. Report the resulting branch and worktree path.

For inspection and cleanup:

```bash
tools/task list
tools/task cleanup <branch-name>
```

Cleanup requires an explicit request and removes only a clean linked worktree.
Do not force-delete local or remote branches without a separate explicit request.

## Implement or continue a Change

Work in the checkout containing the approved Change. Read repository rules,
OpenSpec artifacts, current diff and optional
`.agent-workflow/<change-name>/state.md`. Existing files and Git diff override
stale local state. Never discard or commit an existing implementation merely to
start or continue the workflow.

Use `OPSX: Apply` to validate the Change, read its dynamic apply instructions,
implement remaining tasks and update task checkboxes. Run focused tests during
implementation. When Apply completes, run:

```bash
tools/verify fast --change <change-name>
```

After FAST succeeds, create a fresh read-only reviewer with no inherited
conversation history. Give it only the paths and review contract from the shared
workflow. Keep implementation with the main agent. Validate findings, fix real
blocking issues, rerun FAST and create another fresh reviewer. Stop after three
iterations or earlier when the workflow's stopping conditions apply.

When review passes, run:

```bash
tools/verify full --change <change-name>
```

Perform required `[внешняя проверка]` tasks through the current agent's normal
tools and approval flow. Record compact evidence in local state. Do not treat a
missing prerequisite as a passing check.

Architecture tests, Strictacode policy and agent process files are protected. Pass
`--allow-protected <permission>` only when the current developer explicitly
allows it or the approved OpenSpec names the protected area. A request to fix a
production architecture violation does not authorize architecture-test edits.
Never update a Strictacode baseline merely to pass compare.

After review, FAST, FULL and required external checks pass, use `OPSX: Archive`.
Leave the complete result uncommitted for human review.

## Human feedback

For feedback within the archived design, continue in the same worktree and run:

```text
fix → FAST → fresh review → FULL → affected external checks
```

Do not archive again. Return to OpenSpec and human approval when feedback changes
product behavior, a public contract or architecture.

## Quality audit

Run a detailed audit when requested:

```bash
tools/verify audit --all
```

Without `--all`, audit only contours changed from the task base. Reports under
`.verification/strictacode-reports` are local artifacts.

## Publication boundary

Workflow completion does not authorize commit, push, PR creation or merge.
Perform each publication action only after an explicit request. Before
publication report the checkout, branch, Change, verification status and whether
the result is still uncommitted.
