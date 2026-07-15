---
name: writing-plans
description: Use when approved high-risk work (R3), three or more dependent implementation steps, or multiple coordinated components require a written implementation plan before coding
---

# Writing Plans

## Overview

Write a living plan that carries the context an implementer cannot safely derive: intended behavior, dependencies, outputs, boundaries, and proof obligations. Organize work into coherent, independently verifiable tasks. DRY. YAGNI. TDD.

## Plan Gate

Write a plan for R3 work and for R2 work with at least three dependent steps or multiple coordinated components. Do not create a plan for R0/R1 or a clear single-step R2 fix.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** If working in an isolated worktree, it should have been created via the `superpowers:using-git-worktrees` skill at execution time.

**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
- (User preferences for plan location override this default)

## Scope and Structure

If the source requirements span independent subsystems, use separate plans that each deliver working, testable behavior. Map expected files, responsibilities, and interfaces before defining tasks, but treat the map as the best current decomposition rather than a frozen detail. Follow established codebase patterns; include structural cleanup only when it directly enables the planned outcome.

## Task Boundaries

A task is the smallest coherent outcome with its own verification cycle. Fold tightly coupled setup, tests, implementation, documentation, and verification together; split only when neighboring outputs can be understood and rejected independently. R2 task boundaries support coherent delivery and one final review, not a task-level review gate. R3 keeps meaningful task-boundary review.

## Precision by Risk and Ambiguity

Give exact file paths, affected symbols, observable behavior, and verification evidence. Include exact code only when an interface, migration, fragile algorithm, or non-obvious command would otherwise be ambiguous. For routine implementation, concrete intent and named symbols are enough; do not bury the plan in boilerplate the implementer can derive safely.

## Commit Boundaries

Commit each coherent, independently verifiable outcome; neither commit every mechanical action nor combine unrelated outcomes.

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** Follow the risk-specific execution route recorded in the Risk Level field below. R2 defaults to direct execution with one final review for material logic. R3 defaults to superpowers:subagent-driven-development when subagents are available; otherwise use superpowers:executing-plans with the complete R3 gates. Task checkboxes are a tracking view, never completion evidence.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

**Risk Level:** [R2 | R3] — [one-sentence justification based on the requested action and its consequences]

**Source requirements:** [path or inline-design identifier] — content digest [digest]; base commit or state [identifier]

**Owned scope:** [files, components, and explicit exclusions]

## Global Constraints

[The source requirements' project-wide constraints — version floors, dependency limits,
naming and copy rules, platform requirements — one line each, with exact
values copied verbatim. Every task's requirements implicitly
include this section.]

---
```

## Task Structure

Every task records `Depends on`, `Produces`, and `Completion evidence`; the latter is filled from observed results during execution, not predicted at planning time.

````markdown
### Task N: [Component Name]

**Status:** pending | in progress | verified

**Depends on:** [task outputs or source state required before this task]

**Produces:** [observable behavior and artifacts made available to later tasks]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Interfaces:**
- Consumes: [what this task uses from earlier tasks — exact signatures]
- Produces: [what later tasks rely on — exact function names, parameter
  and return types. A task's implementer sees only their own task; this
  block is how they learn the names and types neighboring tasks use.]

- [ ] **Deliver and verify [specific behavior]**

  1. Add a failing test that exercises [observable behavior and edge case]. Include exact test code when the contract or fragile case would otherwise be ambiguous.
  2. Run `[exact targeted test command]` and confirm it fails for `[expected reason]`.
  3. Implement the behavior in `[named symbols]`. Include exact implementation code only when the interface, migration, or algorithm would otherwise be ambiguous.
  4. Run `[exact targeted and affected verification commands]` and confirm `[expected success evidence]`.

**Commit boundary:** This task produces [independently reviewable outcome].

**Completion evidence:** [commit or tree state plus the exact verification command and observed result; leave as `not run` while pending]

**Execution updates:** [record any non-material adjustment with its reason and evidence]

Commit the named files with `[specific commit message]` once the task's verification passes. If this outcome is inseparable from an adjacent task, state the shared boundary and commit them together.
````

## Living Updates

Update the plan when repository facts differ from planning assumptions. Renamed internal symbols, equivalent commands, or adjusted file paths are non-material adaptations when they preserve goal, scope, interfaces, invariants, risk, and authorization; record the adjustment, reason, and evidence, then continue. Stop and return to the appropriate approval gate when any of those boundaries changes materially.

Checkboxes summarize task tracking; they are not evidence. A task is verified only when its declared output and completion evidence match the current tree and dependencies.

## No Placeholders

Every task must contain the actual content an engineer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without concrete cases, assertions, and expected behavior)
- "Similar to Task N" (state the needed behavior and interfaces because the engineer may be reading tasks out of order)
- Tasks that omit affected symbols, observable behavior, or verification evidence
- References to types, functions, or methods not defined in any task

## Remember
- Expected file paths and affected symbols; make them exact where ambiguity would create rework
- Exact cross-task interfaces and migration details where ambiguity would create rework
- Exact code only for an otherwise ambiguous interface, migration, fragile algorithm, or non-obvious command
- Exact verification commands with expected output or other deterministic evidence
- DRY, YAGNI, TDD, and commits at coherent reviewable boundaries

## Self-Review

Compare the complete plan with its bound source and fix gaps before handoff:

1. Every source requirement maps to a task and no task adds unrequested scope.
2. No placeholders or undefined cross-task interfaces remain.
3. Dependencies, produced names, types, and verification commands agree across tasks.
4. Risk route, owned scope, base state, and source digest are present and current.

## Execution Handoff

After saving the plan, select the route from the plan's risk level rather than
offering the same menu for every plan.

**R2 defaults to direct execution in the current session with one final review
for material logic.** Do not recommend task-by-task subagents by default. Use
superpowers:executing-plans only when execution will genuinely occur in a
separate session. If the user requested only a plan, report the saved plan and
stop rather than beginning implementation.

**R3 uses Subagent-Driven Development as the default when subagents are
available.** Use superpowers:subagent-driven-development for fresh implementers,
meaningful task-boundary review, and one whole-change review. If execution must
occur in a separate session or subagents are unavailable, use
superpowers:executing-plans; that route still preserves isolation,
point-of-execution authorization, meaningful task-boundary reviews, one
whole-change review, and full R3 verification.
