---
name: requesting-code-review
description: Use for material R2 logic before integration, at meaningful R3 task boundaries, before merging, or when the user explicitly requests independent code review
---

# Requesting Code Review

Dispatch an independent code reviewer at risk-appropriate gates. Give the reviewer
the requirements and review artifacts it needs plus an explicit conversation
window, keeping it focused on the work product rather than your reasoning history.

**Core principle:** Independent review is strongest when its timing and scope match
the risk of the change.

## Review Gate

- R1: no implementation-time review subagent by default; inspect the diff and run
  targeted validation directly.
- R2: use one final independent review before integrating material logic.
- R3: review at meaningful task boundaries, fix Critical and Important findings,
  and run one whole-change review before integration.
- A pending merge or explicit user request requires review regardless of the
  default above.

## When to Request Review

**Mandatory:**
- For material R2 logic, once after implementation and before integration
- At meaningful R3 task boundaries selected by subagent-driven development
- For the complete R3 change after all task-boundary reviews
- Before merging
- When the user explicitly requests independent code review

## How to Request

**1. Record the complete review range:**
```bash
BASE_SHA="$RECORDED_START_SHA"  # commit recorded before the reviewed change began
HEAD_SHA=$(git rev-parse HEAD)
```

For a whole-change integration review, use the merge base with the integration
target as `BASE_SHA` (for example, `git merge-base origin/main "$HEAD_SHA"`).
Do not infer the base from the number of commits; the review range must include
the entire change.

**2. Dispatch code reviewer subagent:**

Dispatch a subagent, choose `fork_turns` explicitly, and fill the capability-neutral
template at [code-reviewer.md](code-reviewer.md).

**Placeholders:**
- `{DESCRIPTION}` - Brief summary of what you built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Re-review after Critical or Important fixes
- Push back only with concrete code, requirement, or test evidence when the reviewer is wrong

The main agent must inspect the cited code and validation evidence before accepting
either a finding or a rebuttal. A reviewer verdict is evidence to evaluate, not a
substitute for the main agent's completion check.

## Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

BASE_SHA=a7981ec  # recorded before Task 2 began
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch code reviewer subagent]
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types
  PLAN_OR_REQUIREMENTS: Task 2 from docs/superpowers/plans/deployment-plan.md
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661

[Subagent returns]:
  Strengths: Clean architecture, real tests
  Issues:
    Important: Missing progress indicators
    Minor: Magic number (100) for reporting interval
  Assessment: Needs fixes

You: [Fix progress indicators and re-run the covering tests]
[Dispatch code reviewer subagent for re-review]

[Subagent returns]:
  Issues: None
  Assessment: Approved

[Continue to Task 3]
```

## Integration with Workflows

**Subagent-Driven Development:**
- For R3, review at each meaningful task boundary and once across the whole change
- For R2, use task isolation only when it materially improves reliability; otherwise review once at the end
- Fix Critical and Important issues before moving past the gate

**Executing Plans:**
- Apply the same R1/R2/R3 review gate at natural checkpoints

**Ad-Hoc Development:**
- Review before merge or when the user explicitly requests it

## Red Flags

**Never:**
- Skip a review required by the risk gate, a pending merge, or the user
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning tied to the requirement
- Show code/tests that prove it works
- Request clarification

See template at: [code-reviewer.md](code-reviewer.md)
