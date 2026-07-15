---
name: requesting-code-review
description: Use for material R2 logic before integration, at meaningful R3 task boundaries, before merging, or when the user explicitly requests independent code review
---

# Requesting Code Review

Dispatch an independent reviewer at risk-appropriate gates. A verdict is useful
only when it is bound to the exact content, requirements, questions, and evidence
that the reviewer inspected.

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

## Review Binding

Record one Review Binding before dispatch: full BASE and HEAD SHAs, working-tree state and content digest, changed-path scope, requirements content digest, relevant profile or tree digest, open questions, and controller-observed verification commands/results.

- Use the merge base with the integration target as `BASE` for a whole-change
  review. Do not infer the base from a commit count.
- Prefer a clean committed tree. If the authorized review scope includes dirty or
  untracked content, identify it explicitly and bind a digest of that exact patch
  and file set; `BASE..HEAD` alone does not include it.
- Use `not applicable` only when a field genuinely has no bearing on the change.
  Do not silently omit unresolved compatibility, migration, or requirement
  questions.
- Verification evidence is a report of commands the controller actually observed,
  not a child summary or an expectation that the reviewer will run the tests.

For example, record full commit identities rather than short display SHAs:

```bash
BASE_SHA="$RECORDED_START_SHA"  # commit recorded before the reviewed change began
HEAD_SHA=$(git rev-parse HEAD)
```

## Request and Use the Review

1. Dispatch a subagent, choose `fork_turns` explicitly, and fill every field in
   [code-reviewer.md](code-reviewer.md).
2. Require the reviewer to echo the reviewed binding and flag any mismatch before
   judging the implementation.
3. Inspect the cited code and evidence yourself. A reviewer verdict is evidence to
   evaluate, not a substitute for the controller's completion check.
4. Act on feedback:
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note optional Minor improvements for the final handoff unless they are in scope
- Re-review after Critical or Important fixes
- Push back only with concrete code, requirement, or test evidence when the reviewer is wrong

When the review returns, recheck the binding; if content, HEAD, working tree, requirements, profile, scope, open questions, or verification inputs drifted, refresh the evidence and re-review the final content.

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
- Treat approval of an earlier commit or patch as approval of later content
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning tied to the requirement
- Show code/tests that prove it works
- Request clarification

See template at: [code-reviewer.md](code-reviewer.md)
