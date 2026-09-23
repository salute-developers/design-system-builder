---
name: dsbuilder-task-workflow
description: Manage DS Builder development tasks through Git branches and worktrees, OpenSpec research and proposals, and TAKT implementation cycles. Use in the design-system-builder repository when the user asks to start, run, resume, review, list, or clean up a task in this process. Do not use for ordinary Git operations unrelated to this workflow.
---

# DS Builder Task Workflow

Use the repository's `tools/task` helper as the executable source of truth. Do
not recreate its Git or TAKT logic in ad hoc shell commands. If the helper rejects
an operation, report the reason instead of bypassing its safety checks.

Treat `.takt/verification.conf` as the source of truth for repository contours,
FAST/FULL/audit/compare commands, and protected paths. Do not add repository
module lists back to `tools/verify`; put contour-specific verification behind its
Gradle, npm, or Strictacode entrypoint.

Read `.takt/PROCESS.md` when the user asks for the full process, when the current
stage is unclear, or before changing the workflow itself. Use `tools/task --help`
when exact command syntax is needed.

## Preserve the two names

Keep these identifiers independent:

- `branch-name` is an explicit full Git branch such as `feature/PLASMA-123`.
- `change-name` is an OpenSpec directory name such as `add-theme-inheritance`.

Never derive one from the other. Ask for the missing identifier only when the
requested operation requires it and it cannot be inferred from the current
checkout or an exact path supplied by the user.

## Route the request

### Explore and propose

Use OpenSpec Explore (`/opsx:explore`) to investigate the repository, current
behavior, requirements, edge cases, and scope. Then use the OpenSpec propose
workflow when the user asks to create the Change. When the Change needs a
`design.md`, read `openspec/DESIGN_GUIDE.md` and select only the additional
sections relevant to its decisions. Keep local changes compact; do not create
empty sections to imitate the guide. Treat a request for an expanded design as
a request to consider every dimension in the guide, while still omitting
dimensions that have no material decision, risk, or trade-off. Do not start TAKT
until the user says the OpenSpec artifacts have been reviewed and approved.

### Create a branch or worktree

Require an explicit full branch name. For one task in the current checkout, run:

```bash
tools/task create <branch-name> [--base <base-ref>]
```

When the user asks for parallel work, isolation, or a worktree, run:

```bash
tools/task create <branch-name> --worktree [--base <base-ref>]
```

Report the resulting branch and directory. Do not invent a base ref when the user
names one; otherwise allow the helper to detect it.

### Run the approved implementation

Run this only after explicit OpenSpec approval:

```bash
tools/task run <change-name>
```

Architecture tests are protected. Pass `--allow-architecture-tests` only when
the user explicitly asks to change them. Do not infer that permission from a
request to fix an architecture violation or make verification pass. The helper
automatically permits architecture-test changes when the approved OpenSpec
artifacts explicitly name `backend-kt/architecture-tests`,
`frontend-kt/architecture-tests`, or `LayerArchitectureTest` as part of the
Change.

Execute it inside the checkout that contains the approved Change. The helper
requires a clean feature checkout, validates the complete Change strictly, and
leaves the implementation and archived OpenSpec Change uncommitted for human
review. FAST and FULL command gates must pass before archive. Do not bypass a
failed gate; report its exact command and failure class.

FULL includes Strictacode compare for each changed contour. Apply the tolerances
defined by the Strictacode wrapper: project score, complexity density, and
refactoring pressure may not increase; graph-based overengineering pressure may
increase by at most one integer point to absorb rounding noise. Do not update a
Strictacode baseline to make an implementation pass. Strictacode config, wrapper,
requirements, and baselines are protected paths and may change during TAKT only
when the approved OpenSpec Change explicitly includes them.

### Recover an interrupted run

For the latest failed or aborted TAKT run in the same checkout, run:

```bash
tools/task resume
```

Use `resume` only for an unfinished run. A completed run with new human feedback
uses `follow-up`.

### Apply human review feedback

For feedback after the main workflow successfully archived the Change, run:

```bash
tools/task follow-up <change-name> '<review-feedback>'
```

Add `--allow-architecture-tests` only when the current user feedback explicitly
requests changes to architecture tests. Preserve that request in the feedback
argument as well.

Preserve the user's feedback in the argument. The checkout may intentionally be
dirty with the previous TAKT result. The follow-up workflow reads the archived
Change, fixes issues within its approved design, reviews conformance, and leaves
the result uncommitted. FAST and FULL gates run again. The cycle may be repeated.

If feedback changes product behavior, a public contract, or architecture, stop
the follow-up path and return to an OpenSpec decision and human review.

### Inspect parallel work

Run `tools/task list` and report each worktree's path, branch, and state. Treat
different worktrees as independent execution directories. Never run two mutating
TAKT processes in the same checkout.

### Run a code quality audit

For a detailed Strictacode report across every contour, run:

```bash
tools/verify audit --all
```

Without `--all`, audit only the contours changed against the task base ref.
Reports under `.takt/strictacode-reports` are local artifacts. Summarize the
largest findings from the reports without changing the versioned baseline.

### Clean up after merge

Require an explicit full branch name and an explicit request to clean it up:

```bash
tools/task cleanup <branch-name>
```

The helper removes only a clean linked worktree. It attempts safe local branch
deletion and keeps the branch when Git does not consider it merged. Do not force
delete the remaining branch or delete a remote branch unless the user explicitly
asks for that separate action.

## Publication boundary

Do not commit, push, create a PR, mark a PR ready, merge, or delete a remote branch
merely because a TAKT cycle completed. Perform each publication action only when
the user explicitly requests it. Before publication, summarize the checkout path,
Git branch, OpenSpec Change, FAST/FULL status, and whether the result is still
uncommitted.
