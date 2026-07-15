---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

Fresh means the evidence still matches the exact claim and its bound inputs, not that it ran in the same message.

## Claim/Evidence Map

Before making a claim, record:

- **Claim and scope:** the precise status being asserted.
- **Evidence:** the command or direct observation, result, and relevant output.
- **Bound inputs:** the relevant tree or HEAD, configuration, dependencies, toolchain, and external state.

Evidence stays fresh across messages while its bound inputs remain unchanged. Rerun when the claim broadens, any bound input changes, the prior command failed or was incomplete, or external state may have changed.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What exact claim and scope need proof?
2. BIND: Which inputs determine whether existing evidence is still fresh?
3. RUN OR REUSE: Execute the risk-appropriate proof, or reuse still-bound evidence.
4. READ: Check the relevant output, exit status, and failure count.
5. VERIFY: Does the evidence confirm the exact claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
6. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Scope by Risk

- R1: run the narrowest targeted check that proves the requested artifact or value changed correctly; inspect the diff.
- R2: run focused tests plus affected suites and relevant lint, type, or build checks.
- R3: run the complete relevant suite, integration or migration checks, security boundaries, and rollback or compensation validation.

Risk scales verification breadth, never the requirement for fresh evidence.

Evidence proves only the scope it exercised. A targeted R1 check or affected R2 suite can support its exact narrow claim, but cannot support "all tests pass" or any broader status. A claim about all tests requires the complete relevant test suite regardless of the task's baseline risk.

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Complete test scope named in the claim: 0 failures | A focused test when claiming all tests; an unbound or invalidated prior run |
| Linter clean | Risk-appropriate lint scope named in the claim: 0 errors | Output covering less than the claimed lint scope |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on evidence narrower than the risk level or exact claim
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler |
| "Agent said success" | Verify independently |
| "I'm tired" | Exhaustion ≠ excuse |
| "A narrower check is enough" | Only when it is the risk-appropriate proof for the exact narrow claim; never extrapolate it to all tests or broader status |
| "It passed earlier" | Reuse it only when the claim and every relevant bound input are unchanged |
| "Different words so rule doesn't apply" | Spirit over letter |

## Key Patterns

**Tests:**
```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
✅ [Run targeted R1 check] [See: pass] "The requested artifact changed correctly"
❌ [Run one focused test] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Regression tests (TDD Red-Green):**
```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

**Build:**
```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**Requirements:**
```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

**Agent delegation:**
```
✅ Agent reports success → Check VCS diff → Verify changes → Report actual state
❌ Trust agent report
```

## Why This Matters

From 24 failure memories:
- your human partner said "I don't believe you" - trust broken
- Undefined functions shipped - would crash
- Missing requirements shipped - incomplete features
- Time wasted on false completion → redirect → rework
- Violates: "Honesty is a core value. If you lie, you'll be replaced."

## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, pushing, PR creation, or task completion

**Rule applies to:**
- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

## The Bottom Line

**No shortcuts for verification.**

Run the proof or confirm its bindings are unchanged. Read the evidence. THEN claim the result.

This is non-negotiable.
