---
name: using-superpowers
description: Use when starting any conversation
---

# Using Superpowers

Load a skill before acting when the user names it or its description clearly matches; never for an adjacent topic.

1. Read instructions; identify the stated outcome and boundaries.
2. Classify requested action and side effects with [risk-levels.md](references/risk-levels.md). Separately note work shape: clear, ambiguous, coordinated, or independent.
3. Load matching process skills, then implementation skills.
4. Announce a selected skill only when it changes the next action or adds a gate.
5. Keep R0/R1 proportional; preserve R3 safeguards.

For consequential work, make constraints, invariants, completion evidence, exclusions, and authorization explicit; keep them implicit for clear R0/R1.

## Goal and Scope Discipline

Finish the user's stated outcome, then stop. Completion does not authorize adjacent improvements. Add supporting work only when the goal cannot be safely completed without it, existing mechanisms are inadequate, and a concrete failure proves the gap. New subsystems, frameworks, migrations, or control planes require explicit user approval. Put optional improvements in the final handoff; do not implement them. Keep safeguards proportionate to demonstrated risk, not hypothetical extremes.

User instructions override skills. Skills change defaults only within their stated triggers; subagents load them only when assigned work matches.

Codex collaboration and worktree details: [codex-tools.md](references/codex-tools.md).
