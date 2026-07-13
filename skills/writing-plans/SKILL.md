---
name: writing-plans
description: Use when approved high-risk work (R3), three or more dependent implementation steps, or multiple coordinated components require a written implementation plan before coding
---

# Writing Plans

## Overview

Write implementation plans assuming the engineer has zero context for our codebase. Document which files each task touches, the behavior it delivers, dependencies and interfaces between tasks, and how to verify it. Organize the work into coherent, independently verifiable tasks. DRY. YAGNI. TDD.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

## Plan Gate

Write a plan for R3 work and for R2 work with at least three dependent steps or multiple coordinated components. Do not create a plan for R0/R1 or a clear single-step R2 fix.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** If working in an isolated worktree, it should have been created via the `superpowers:using-git-worktrees` skill at execution time.

**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
- (User preferences for plan location override this default)

## Scope Check

If the source requirements (an approved written spec for R3 or a brief or inline design for R2) cover multiple independent subsystems, they should have been broken into sub-projects during brainstorming. If they weren't, suggest separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Task Right-Sizing

A task is the smallest coherent unit that carries its own verification cycle.
For R3, each meaningful task boundary is worth a fresh reviewer's gate. R2 task boundaries support coherent delivery and one final review, not a mandatory task-level review gate. When drawing task boundaries: fold setup, configuration, scaffolding, and documentation steps into the task whose deliverable needs them; split only where separate verification or, for R3, review could meaningfully reject one task while approving its neighbor. Each task ends with an independently verifiable deliverable and clear evidence that it works.

## Coherent Task Granularity

Plan at the level of coherent, independently verifiable tasks, not mandatory 2-5 minute mechanical steps. Within each task, describe the test cycle and implementation actions needed to reach one reviewable outcome. Keep tightly coupled setup, test, implementation, documentation, and verification work together; split work when the resulting deliverables can be understood, verified, and reviewed independently.

## Precision by Risk and Ambiguity

Give exact file paths, affected symbols, observable behavior, and verification evidence. Include exact code only when an interface, migration, fragile algorithm, or non-obvious command would otherwise be ambiguous. For routine implementation, concrete intent and named symbols are enough; do not bury the plan in boilerplate the implementer can derive safely.

## Commit Boundaries

Commit at coherent, reviewable boundaries. A commit may contain the tightly coupled mechanical actions needed to produce one independently verifiable outcome; do not create a commit after every mechanical action or combine unrelated reviewable outcomes.

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** Follow the risk-specific execution route recorded in the Risk Level field below. R2 defaults to direct execution with one final review for material logic. R3 defaults to superpowers:subagent-driven-development when subagents are available; otherwise use superpowers:executing-plans with the complete R3 gates. Tasks use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

**Risk Level:** [R2 | R3] — [one-sentence justification based on the requested action and its consequences]

## Global Constraints

[The source requirements' project-wide constraints — version floors, dependency limits,
naming and copy rules, platform requirements — one line each, with exact
values copied verbatim. Every task's requirements implicitly
include this section.]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

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

Commit the named files with `[specific commit message]` once the task's verification passes. If this outcome is inseparable from an adjacent task, state the shared boundary and commit them together.
````

## No Placeholders

Every task must contain the actual content an engineer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without concrete cases, assertions, and expected behavior)
- "Similar to Task N" (state the needed behavior and interfaces because the engineer may be reading tasks out of order)
- Tasks that omit affected symbols, observable behavior, or verification evidence
- References to types, functions, or methods not defined in any task

## Remember
- Exact file paths always
- Exact cross-task interfaces and migration details where ambiguity would create rework
- Exact code only for an otherwise ambiguous interface, migration, fragile algorithm, or non-obvious command
- Exact verification commands with expected output or other deterministic evidence
- DRY, YAGNI, TDD, and commits at coherent reviewable boundaries

## Self-Review

After writing the complete plan, look at the source requirements with fresh eyes and check the plan against them. For R3, the source is the approved written spec; for R2, it may be a brief or inline design. This is a checklist you run yourself — not a subagent dispatch.

**1. Requirements coverage:** Skim each source requirement. Can you point to a task that implements it? List any gaps.

**2. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

If you find issues, fix them inline. No need to re-review — just fix and move on. If you find a source requirement with no task, add the task.

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
