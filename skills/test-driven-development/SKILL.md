---
name: test-driven-development
description: Use before changing observable behavior, fixing a reproducible bug, modifying a public contract, or implementing security- or data-sensitive logic when an automated test surface is available
---

# Test-Driven Development (TDD)

## Overview

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

**Violating the letter of the rules is violating the spirit of the rules.**

## When to Use

Use strict RED-GREEN-REFACTOR before:
- changing observable behavior
- fixing a reproducible bug
- modifying a public contract
- implementing security- or data-sensitive logic

when an automated test surface is available. Matching work remains test-first
even when the change looks small or the surrounding code lacks tests.

Thinking "skip TDD just this once"? Stop. That's rationalization.

## When Test-First Does Not Apply

Copy, comments, generated artifacts, throwaway exploration, and configuration without a practical automated-test surface may use the best available deterministic validation. State why a failing automated test is not practical and run that validation before claiming completion.

Do not delete pre-existing user code because it predates the current test cycle. Before changing its observable behavior, add a failing regression or characterization test where practical.

## The Iron Law

For matching work with a practical automated-test surface:

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write new code for the current change before the test? Delete that new work.
Start over. This deletion rule does not apply to pre-existing user code.

**No exceptions for matching work:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

Implement fresh from tests. Period.

## Behavior Proof

Use one proof per changed observable behavior, not one test per function or helper. Choose the smallest meaningful surface: focused example, characterization, property, or integration test. Several internal functions may be covered by one behavior-level proof; split only when failures would represent different contracts.

RED/GREEN evidence records the behavior and test, exact command, expected reason for RED, relevant output, and tree or HEAD identity. If the test changes after RED, rerun RED; if implementation or bound tree changes after GREEN, rerun GREEN for the affected behavior.

## Red-Green-Refactor

RED: write one failing behavior proof and confirm the expected failure. GREEN: make the smallest implementation change and confirm the proof plus affected tests pass. REFACTOR only while green, then repeat for the next behavior.

### RED - Write Failing Test

Write one minimal test showing what should happen.

**Requirements:**
- One behavior
- Clear name
- Real code (no mocks unless unavoidable)

### Verify RED - Watch It Fail

**MANDATORY. Never skip.**

```bash
npm test path/to/test.test.ts
```

Confirm:
- Test fails (not errors)
- Failure message is expected
- Fails because feature missing (not typos)

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

### GREEN - Minimal Code

Write simplest code to pass the test.

Don't add features, refactor other code, or "improve" beyond the test.

### Verify GREEN - Watch It Pass

**MANDATORY.**

```bash
npm test path/to/test.test.ts
```

Confirm:
- Test passes
- Other tests still pass
- Output pristine (no errors, warnings)

**Test fails?** Fix code, not test.

**Other tests fail?** Fix now.

### REFACTOR - Clean Up

After green only:
- Remove duplication
- Improve names
- Extract helpers

Keep tests green. Don't add behavior.

### Repeat

Next failing test for next feature.

## Good Tests

| Quality | Good | Bad |
|---------|------|-----|
| **Minimal** | One thing. "and" in name? Split it. | `test('validates email and domain and whitespace')` |
| **Clear** | Name describes behavior | `test('test1')` |
| **Shows intent** | Demonstrates desired API | Obscures what code should do |

## Why Order Matters

**"I'll write tests after to verify it works"**

Tests written after code pass immediately. Passing immediately proves nothing:
- Might test wrong thing
- Might test implementation, not behavior
- Might miss edge cases you forgot
- You never saw it catch the bug

Test-first forces you to see the test fail, proving it actually tests something.

**"I already manually tested all the edge cases"**

Manual testing is ad-hoc. You think you tested everything but:
- No record of what you tested
- Can't re-run when code changes
- Easy to forget cases under pressure
- "It worked when I tried it" ≠ comprehensive

Automated tests are systematic. They run the same way every time.

**"Deleting X hours of new code for this change is wasteful"**

Sunk cost fallacy. The time is already gone. Your choice now:
- Delete the new production code written for this matching change before its
  failing test and rewrite with TDD (X more hours, high confidence)
- Keep it and add tests after (30 min, low confidence, likely bugs)

The "waste" is keeping new code for the current matching change that you can't
trust. This does not authorize deleting pre-existing user code.

**"TDD is dogmatic, being pragmatic means adapting"**

TDD IS pragmatic:
- Finds bugs before commit (faster than debugging after)
- Prevents regressions (tests catch breaks immediately)
- Documents behavior (tests show how to use code)
- Enables refactoring (change freely, tests catch breaks)

"Pragmatic" shortcuts = debugging in production = slower.

**"Tests after achieve the same goals - it's spirit not ritual"**

No. Tests-after answer "What does this do?" Tests-first answer "What should this do?"

Tests-after are biased by your implementation. You test what you built, not what's required. You verify remembered edge cases, not discovered ones.

Tests-first force edge case discovery before implementing. Tests-after verify you remembered everything (you didn't).

30 minutes of tests after ≠ TDD. You get coverage, lose proof tests work.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Tests after achieve same goals" | Tests-after = "what does this do?" Tests-first = "what should this do?" |
| "Already manually tested" | Ad-hoc ≠ systematic. No record, can't re-run. |
| "Deleting X hours of new work is wasteful" | Sunk cost fallacy. Keeping newly written, unverified code for this matching change is technical debt. |
| "Keep the new code as reference, write tests first" | You'll adapt it. That's testing after. Delete the new code and start the matching change test-first. |
| "Need to explore first" | Fine. Throw away exploration, start with TDD. |
| "Test hard = design unclear" | Listen to test. Hard to test = hard to use. |
| "TDD will slow me down" | TDD faster than debugging. Pragmatic = test-first. |
| "Manual test faster" | Manual doesn't prove edge cases. You'll re-test every change. |
| "Existing code has no tests" | You're improving it. Add tests for existing code. |

## Red Flags - STOP and Start Over

- New production code for the current matching change before its failing test
- Test after implementation
- Test passes immediately
- Can't explain why test failed
- Tests added "later"
- Rationalizing "just this once"
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about spirit not ritual"
- "Keep new untested code as reference" or "adapt that new code while writing tests"
- "Already spent X hours on this new code; deleting it is wasteful"
- "TDD is dogmatic, I'm being pragmatic"
- "This is different because..."

**For matching work, all of these mean: delete only the new production code
written for the current change before its failing test, then start over with
TDD. Never delete pre-existing user code merely because it predates this cycle;
characterize its current behavior first where practical.**

## Verification Checklist

Before marking matching work complete:

- [ ] Every changed observable behavior has one meaningful proof at the right test surface
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output pristine (no errors, warnings)
- [ ] Tests use real code (mocks only if unavoidable)
- [ ] Edge cases and errors covered

Can't check all boxes? You skipped TDD. Start over.

## When Stuck

| Problem | Solution |
|---------|----------|
| Don't know how to test | Write wished-for API. Write assertion first. Ask your human partner. |
| Test too complicated | Design too complicated. Simplify interface. |
| Must mock everything | Code too coupled. Use dependency injection. |
| Test setup huge | Extract helpers. Still complex? Simplify design. |

## Debugging Integration

Bug found? Write failing test reproducing it. Follow TDD cycle. Test proves fix and prevents regression.

When the trigger matches and an automated test surface is available, never fix bugs without a test.

## Testing Anti-Patterns

When adding mocks or test utilities, read [testing-anti-patterns.md](testing-anti-patterns.md) to avoid common pitfalls:
- Testing mock behavior instead of real behavior
- Adding test-only methods to production classes
- Mocking without understanding dependencies

## Final Rule

```
Production code → test exists and failed first
Otherwise → not TDD
```

For matching work with a practical automated-test surface, there are no exceptions without your human partner's permission.
