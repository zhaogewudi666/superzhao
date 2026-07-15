---
name: using-superpowers
description: Use when starting any conversation
---

# Using Superpowers

Check skills before acting. Load a skill when the user names it or its description clearly matches the request; do not load skills for merely adjacent topics.

1. Read user and project instructions first.
2. Classify the task with [risk-levels.md](references/risk-levels.md).
3. Load matching process skills before implementation skills.
4. Announce each selected skill and follow its required gates.
5. Keep R0/R1 proportional; preserve R3 safeguards.

## Goal and Scope Discipline

Finish the user's stated outcome, then stop. Completion does not authorize adjacent improvements. Add supporting work only when the outcome cannot be safely completed without it, existing mechanisms are inadequate, and a concrete failure demonstrates the gap. New subsystems, frameworks, migrations, or control planes require explicit user approval. Put optional improvements in the final handoff; do not implement them. Keep safeguards proportionate to demonstrated risk, not hypothetical extremes.

User instructions override skills. A skill overrides default behavior only within its stated trigger. Dispatched subagents skip this bootstrap unless their task explicitly requires a skill.

For Codex-specific collaboration and worktree behavior, read [codex-tools.md](references/codex-tools.md).
