---
name: executing-plans
description: Use when a written implementation plan must be executed in a separate session, or when approved R3 work cannot use subagents
---

# Executing Plans

## Overview

Execute the plan as a living contract. Preserve goal, scope, public interfaces, invariants, risk, and authorization while adapting implementation details when evidence supports an equivalent route.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** For R3 in the current session, use
superpowers:subagent-driven-development when subagents are available. This skill
is the separate-session route and the no-subagent R3 fallback; fallback does not
waive isolation, authorization, review, verification, or rollback gates.

## Risk-Specific Execution Gate

- **R2:** execute the plan directly and use one final independent review for
  material logic. Do not add task-boundary reviews unless a concrete isolation
  need makes them materially useful.
- **R3:** preserve meaningful task-boundary reviews and one whole-change review,
  plus isolation, full verification, and rollback or compensation. If no
  independent reviewer is available, stop at the review gate rather than
  treating self-review as approval.

Before the first R3 task, use superpowers:using-git-worktrees to verify or create
the required isolation. An explicitly named isolation waiver is the only route
to current-checkout execution when required isolation cannot be established.

## Point-of-Execution Authorization Gate

The gate covers any destructive action, publish or deploy action, private or production operation, and external side-effecting action. Ordinary public website and documentation read-only retrieval remains R0 and does not require point-of-execution authorization; private access or any external state change is evaluated separately.

Before a covered action, record current action-specific authorization: exact
action, target and scope, environment, authorizer, and authorizing instruction
or turn. Plan or design approval, generic urgency, and authorization for another
action do not count. If authorization is missing, stale, or too narrow, stop
before the action and request it; never infer it from permission to execute the
plan.

## The Process

### Step 1: Load and Review Plan
1. Read the plan and its bound source requirements.
2. Confirm the source digest, base commit or state, owned scope, and risk route are current.
3. Review dependencies, outputs, proof obligations, and material boundaries.
4. Resolve material gaps before starting; otherwise create task tracking and proceed.

### Step 2: Execute Tasks

For each task:
1. Check the point-of-execution authorization gate for the task's next action
2. Confirm its dependencies and bound plan state still match the current tree
3. Mark it in progress and implement its declared output
4. For non-material changes such as file paths, internal symbols, or equivalent commands, record the reason and evidence, update the living plan, and continue when all material boundaries remain intact
5. Run the task's specified verification and attach the observed completion evidence
6. For R3, obtain the meaningful task-boundary review and resolve all Critical
   and Important findings before continuing; R2 does not force this review
7. Mark verified only when the current output and evidence satisfy the task

### Step 3: Complete Development

After all tasks complete and verified:
- For material R2 logic, obtain the one final independent review
- For R3, obtain the one whole-change review and run the complete relevant
  suite, integration or migration checks, security boundaries, and rollback or
  compensation validation
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch
- Follow that skill's action-first flow: identify the action, apply its specific
  test or confirmation gate, present a menu only when appropriate, and preserve
  ownership boundaries during execution and cleanup

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker with no safe equivalent or evidence-backed recovery
- Plan has critical gaps preventing starting
- The intended behavior or a material boundary is unclear
- Verification fails and the cause is not yet understood
- Required isolation is unavailable and no explicitly named waiver exists
- Point-of-execution authorization is missing for the next gated action
- A required independent review cannot be performed
- Material drift changes the goal, scope, interfaces, invariants, risk, or authorization; stop and return for re-approval

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- New evidence changes a dependency or proof obligation
- A material boundary requires re-approval

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Preserve material boundaries; adapt implementation details transparently
- Don't skip verifications
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent

## Integration

**Required workflow skills:**
- **superpowers:using-git-worktrees** - required for R3 or another observable isolation trigger; ordinary R2 in a safe clean checkout runs in place
- **superpowers:writing-plans** - Creates the plan this skill executes
- **superpowers:finishing-a-development-branch** - Complete development after all tasks
