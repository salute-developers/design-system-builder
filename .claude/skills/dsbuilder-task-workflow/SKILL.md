---
name: dsbuilder-task-workflow
description: Manage DS Builder tasks through Git worktrees, OpenSpec, implementation, independent review, verification, archive, and human follow-up.
---

Read and follow these repository-owned sources:

1. `.agents/workflows/dsbuilder-development.md` for the complete process;
2. `.agents/skills/dsbuilder-task-workflow/SKILL.md` for repository routing,
   protected paths and publication boundaries;
3. applicable `AGENTS.md` files for code rules.

When the canonical workflow delegates an OpenSpec phase to an `OPSX` skill,
read and follow the matching repository command:

- Explore: `.claude/commands/opsx/explore.md`;
- Propose: `.claude/commands/opsx/propose.md`;
- Apply: `.claude/commands/opsx/apply.md`;
- Archive: `.claude/commands/opsx/archive.md`.

This mapping applies both to explicit `/opsx:*` commands and to natural-language
requests handled through this skill. Do not reproduce the command procedure from
memory. After Apply, return to the shared workflow for verification and review;
run Archive only after its gates pass.

Use Claude Code's native fresh subagent for the read-only reviewer stage. Keep
implementation and developer interaction in the main conversation. Use
`tools/task` only for `create`, `list`, and `cleanup`; use `tools/verify` for
FAST, FULL, policy and audit gates. Continue interrupted work from the current
diff, OpenSpec artifacts and optional local task state.
