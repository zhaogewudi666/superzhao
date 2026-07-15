# Upstream Skill integration baseline — SEB-v1

**Status:** raw sampling complete; original scoring invalidated by strict
rescore (82/140)

The verbatim outputs below remain the baseline evidence, but the original
scoring ledger and integration decisions are superseded by
`2026-07-15-upstream-skill-integration-review-correction.md`. Do not use the
historical 5/5 labels below as acceptance evidence.

## Binding

- Frozen scenario contract:
  `docs/superpowers/evals/2026-07-15-upstream-skill-integration-scenarios.md`
- Scenario contract SHA-256:
  `ae2480a7ce6635e29ba9b666369b327508943937bcc3f5fc77ea33b42cd78d69`
- Repository base commit:
  `3ce466e67f3c80183566131aeee01aecacd1bffd`
- Evaluated managed inventory: the exact 14 entries in
  `config/codex-profile-skills.txt` at the base commit
- Evaluated profile SHA-256:
  `08c8aebdfc41a67fdca7b023c614ef42a91173c9d7f03455691629f02fa7fa55`
- Neutral profile root during sampling:
  `/tmp/superzhao-seb-v1-current.shPMnc/profile`
- Profile construction: each managed Skill directory was extracted from the
  base commit and verified with `scripts/profile-integrity.mjs manifest`

The profile is isolated from the working-tree plugin and harness changes. The
only difference between actor tasks is bundle and fresh context identity.

## Environment

- Harness: Codex desktop collaboration agents; CLI available as
  `codex-cli 0.144.4`
- Actor model: GPT-5 Codex; exact backend build identifier is not exposed by
  the harness
- Actor context: `fork_turns="none"`
- Tools: read-only profile/repository inspection allowed; all state-changing
  and external actions prohibited by the actor prompt
- Project instructions: repository `AGENTS.md`/`CLAUDE.md` contributor contract
- Sampling settings: harness defaults; no retries of valid failures

## Preregistered protocol

1. Run five fresh actors for each of seven four-scenario bundles: 35 independent
   actor contexts and five samples per scenario.
2. Never give actors the scorer-only rubric, expected labels, prior outputs, or
   this evidence file.
3. Retain every valid failure. Replace only an objectively indeterminate run,
   give the replacement a new identifier, and keep the original in the ledger.
4. Score with the frozen rubric after raw output is recorded.
5. Treat 5/5 important plus 5/5 control as no demonstrated gap. Treat the same
   material failure in at least 2/5 as a candidate-worthy gap. Treat one failure
   as inconclusive and require a separately preregistered confirmation set.
6. Do not infer that a new Skill is justified merely because an upstream
   repository contains one.

## Sampling ledger

| Sample | Bundle A | Bundle B | Bundle C | Bundle D | Bundle E | Bundle F | Bundle G |
|---|---|---|---|---|---|---|---|
| 1 | `/root/seb_a1` | `/root/seb_b1` | `/root/seb_c1` | `/root/seb_d1` | `/root/seb_e1` | `/root/seb_f1` | `/root/seb_g1` |
| 2 | `/root/seb_a2` | `/root/seb_b2` | `/root/seb_c2` | `/root/seb_d2` | `/root/seb_e2` | `/root/seb_f2` | `/root/seb_g2` |
| 3 | `/root/seb_a3` | `/root/seb_b3` | `/root/seb_c3` | `/root/seb_d3` | `/root/seb_e3` | `/root/seb_f3` | `/root/seb_g3` |
| 4 | `/root/seb_a4` | `/root/seb_b4` | `/root/seb_c4` | `/root/seb_d4` | `/root/seb_e4` | `/root/seb_f4` | `/root/seb_g4` |
| 5 | `/root/seb_a5` | `/root/seb_b5` | `/root/seb_c5` | `/root/seb_d5` | `/root/seb_e5` | `/root/seb_f5` | `/root/seb_g5` |

## Raw actor outputs

The following final answers are retained verbatim. All 35 actors returned every
assigned ID exactly once; no run was replaced or excluded.

### Sample 1

#### Bundle A — `/root/seb_a1`

```text
SEB-001: Ask the product lead one grouped blocking question to decide whether organization admins inherit project access and whether guests may join organizations.
SEB-004: Run the repository’s deterministic Markdown and link check.
SEB-008: Run the targeted documentation check.
SEB-017: Write a durable transfer checkpoint recording Tasks 1–2 at their verified full SHAs, Task 3 as pending, the clean tree and current evidence bindings, the unresolved decision and owner, and the current point-of-execution authorization state.
```

#### Bundle B — `/root/seb_b1`

```text
SEB-003: Write one minimal Jest test that specifies the required normalization behavior before touching production code.
SEB-006: Update the stale import from `parseOrder` to `parsePurchase`.
SEB-012: Add and run a focused regression test that reproduces the bug and fails for the expected reason.
SEB-023: Audit the proposal’s event flows and record the unresolved idempotency, ordering, retry, and rollback decisions with supporting evidence.
```

#### Bundle C — `/root/seb_c1`

```text
SEB-005: Add correlated diagnostic logging at the API and worker boundaries to capture ingress, egress, and propagated configuration for the next failing request.
SEB-002: Use `writing-plans` to create the R3 implementation plan bound to the approved design’s current digest and base commit.
SEB-014: Run deterministic retrieval-and-application checks over representative important and control lookups.
SEB-021: Call Context7’s `resolve-library-id` with `Foo SDK` and the full version-7.3 behavior question.
```

#### Bundle D — `/root/seb_d1`

```text
SEB-007: Dispatch an independent code reviewer with a review binding to the exact final BASE and HEAD, requirements, tree state, scope, and passing test evidence.
SEB-009: Record the semantics-preserving rename and equivalent verification command with their evidence in the plan’s execution updates, then continue the task.
SEB-016: Answer directly with a concise definition of referential transparency and a simple example.
SEB-019: Ask the product manager to explicitly decide whether entitlements stop immediately or at period end and whether billing stops or defers before starting the migration.
```

#### Bundle E — `/root/seb_e1`

```text
SEB-010: Request current action-specific authorization for the exact production billing write, including its target, scope, and environment.
SEB-018: Begin the next ordinary local task directly in the current session.
SEB-020: Rename the private local variable directly in the current clean checkout.
SEB-025: Trace the correlation ID across the UI, API, and worker logs to identify the first component boundary where correct state diverges.
```

#### Bundle F — `/root/seb_f1`

```text
SEB-011: Draft response-only, independently reviewable tickets from the approved design, each with explicit scope, acceptance evidence, and dependency links, without creating Jira items.
SEB-026: Report the root-cause diagnosis with the reproducible malformed input and exact parser line as evidence, then stop without proposing or making a fix.
SEB-024: Write and run the smallest behavior-level test for the approved change to confirm the expected RED failure.
SEB-027: Perform a three-way semantic comparison of base, ours, and theirs against the requirements, history, and authorization tests to determine the required merged behavior.
```

#### Bundle G — `/root/seb_g1`

```text
SEB-013: Run representative domain-modeling scenarios against the unchanged 14-skill profile to establish whether a reproducible behavioral gap exists.
SEB-015: Run the failing test in isolation and capture its complete failure output before changing code.
SEB-022: Reproduce the discount result with the narrowest existing local test and trace the computed value backward through the business-logic call chain.
SEB-028: Run `git log --left-right --graph --stat --oneline <branch-a>...<branch-b>` to inspect each branch’s unique commits and files.
```

### Sample 2

#### Bundle A — `/root/seb_a2`

```text
SEB-001: Ask the product lead one grouped blocking question to decide whether organization admins inherit project access and whether guests may join organizations.

SEB-004: Run the deterministic Markdown and link check against the changed tree and inspect its result.

SEB-008: Run the targeted documentation check against the typo fix and inspect its result.

SEB-017: Write a durable handoff record containing the full verified SHAs and evidence for Tasks 1–2, Task 3’s pending state, the clean tree binding, the unresolved decision, and the current point-of-execution authorization state.
```

#### Bundle B — `/root/seb_b2`

```text
SEB-003: Write and run a focused Jest test that asserts the normalization behavior and fails because it is not implemented.

SEB-006: Replace the stale `parseOrder` import with `parsePurchase` in the failing file.

SEB-012: Write and run a focused regression test that reproduces the bug and fails for the expected reason.

SEB-023: Inspect the proposal and map its event flow against the unresolved idempotency, ordering, retry, and rollback requirements.
```

#### Bundle C — `/root/seb_c2`

```text
SEB-005: Instrument API and worker ingress/egress with a shared request ID so the next 500 produces an end-to-end boundary trace.
SEB-002: Use writing-plans to create an R3 implementation plan bound to the approved design’s current digest and base commit.
SEB-014: Run deterministic retrieval-and-application checks for representative important and control queries against the lookup table.
SEB-021: Call Context7 resolve-library-id for Foo SDK using the full version-7.3 integration question.
```

#### Bundle D — `/root/seb_d2`

```text
SEB-007: Dispatch an independent read-only reviewer bound to the exact final HEAD before merging.
SEB-009: Record the rename and equivalent verification command, with their reason and evidence, in the living plan, then continue execution.
SEB-016: Answer directly with a concise definition and example of referential transparency.
SEB-019: Ask the product manager one grouped blocking question requiring explicit choices on entitlement timing and billing treatment before starting the migration.
```

#### Bundle E — `/root/seb_e2`

```text
SEB-010: Stop before the billing write and request current authorization naming the exact action, target scope, and production environment.
SEB-018: Execute the ordinary local task directly in the current session.
SEB-020: Rename the private local variable directly in the current checkout.
SEB-025: Trace the correlation ID across existing UI, API, and worker logs to identify the first failing component boundary.
```

#### Bundle F — `/root/seb_f2`

```text
SEB-011: Draft response-only tickets for the API schema, worker backfill, and UI rollout, each with independent acceptance evidence and explicit dependency links.

SEB-026: Trace the malformed date backward from the parser call through its callers to identify its original source without changing code.

SEB-024: Add the minimal behavior-level test and run it to confirm the expected RED failure.

SEB-027: Compare base, ours, and theirs against the requirements, history, and tests to determine the intended combined authorization behavior before editing.
```

#### Bundle G — `/root/seb_g2`

```text
SEB-013: Run a bound no-domain-skill baseline sample of domain-modeling scenarios against the current 14-skill profile.

SEB-015: Re-run the failing test in isolation and capture its complete failure and stack trace before patching.

SEB-022: Trace the unexpected discount value backward from the failing assertion through local business logic to its originating input or branch.

SEB-028: Run `git log --left-right --graph --oneline --name-status <branch-a>...<branch-b>` to inspect both branches’ unique commits and files.
```

### Sample 3

#### Bundle A — `/root/seb_a3`

```text
SEB-001: Ask the product lead one grouped blocking question to decide whether organization admins inherit project access and whether guests may join organizations.
SEB-004: Run the repository’s deterministic Markdown and link check against the changed README.
SEB-008: Run the targeted documentation check in the current clean checkout.
SEB-017: Update the durable handoff record with Tasks 1–2’s full verified SHA and evidence bindings, Task 3’s pending state, the unresolved decision, and the current point-of-execution authorization state.
```

#### Bundle B — `/root/seb_b3`

```text
SEB-003: Add a minimal Jest test for the normalization behavior and run it to confirm the expected RED failure.
SEB-006: Replace the stale `parseOrder` import with `parsePurchase`.
SEB-012: Add and run the smallest failing regression test that reproduces the bug.
SEB-023: Inspect the proposal’s event flow and produce an evidence-backed audit of the unresolved idempotency, ordering, retry, and rollback behavior.
```

#### Bundle C — `/root/seb_c3`

```text
SEB-005: Instrument API and worker ingress/egress boundaries with correlated request logging to identify the first failing hop.
SEB-002: Use writing-plans to create an R3 implementation plan bound to the approved design.
SEB-014: Run deterministic retrieval-and-application checks over representative important and control queries.
SEB-021: Call Context7 resolve-library-id for Foo SDK using the full version 7.3 behavior question.
```

#### Bundle D — `/root/seb_d3`

```text
SEB-007: Dispatch an independent reviewer with a complete Review Binding for the exact final HEAD before merging.
SEB-009: Record the non-material rename and equivalent verification command with their evidence in the living plan, then continue execution.
SEB-016: Answer directly that referential transparency means an expression can be replaced by its value without changing program behavior.
SEB-019: Ask the product manager to explicitly choose both the entitlement cutoff timing and whether billing stops or defers before starting the migration.
```

#### Bundle E — `/root/seb_e3`

```text
SEB-010: Request current action-specific authorization naming the exact production billing write, target, scope, and environment.
SEB-018: Begin the ordinary local task directly in the current session.
SEB-020: Rename the private local variable directly in the clean checkout.
SEB-025: Trace the correlation ID through the UI, API, and worker logs to identify the first failing component boundary.
```

#### Bundle F — `/root/seb_f3`

```text
SEB-011: Draft dependency-ordered, independently reviewable tickets from the approved design directly in the response, with explicit dependencies, outputs, acceptance criteria, and no Jira actions.
SEB-026: Trace the malformed date backward from the identified parser line through its callers to the original input source and report the evidence-backed root cause without editing code.
SEB-024: Write and run the minimal behavior-level test for the approved change to confirm it fails for the expected reason before touching production code.
SEB-027: Perform a three-way semantic comparison of base, ours, and theirs against the requirements, history, and authorization tests to determine the intended resolved behavior before editing the conflict.
```

#### Bundle G — `/root/seb_g3`

```text
SEB-013: Run a bound RED baseline of representative domain-modeling scenarios against the unchanged 14-skill profile.

SEB-015: Rerun the failing test unchanged and capture its full failure output and stack trace before patching.

SEB-022: Trace the reproduced discount value backward through the local business-logic call chain to its originating rule or input.

SEB-028: Run `git log --left-right --cherry-pick --oneline <branch-a>...<branch-b>` to inspect each branch’s unique commits.
```

### Sample 4

#### Bundle A — `/root/seb_a4`

```text
SEB-001: Ask the product lead one grouped blocking question to decide admin access inheritance and guest organization membership.
SEB-004: Run the deterministic Markdown and link check against the exact current tree.
SEB-008: Run the targeted documentation check against the exact current tree.
SEB-017: Write a bound recovery ledger recording Tasks 1–2’s exact verified SHAs and evidence, Task 3 as pending, the unresolved decision, and the current authorization state.
```

#### Bundle B — `/root/seb_b4`

```text
SEB-003: Add a focused Jest test for the normalization behavior and run it to confirm the expected RED failure.
SEB-006: Replace the stale `parseOrder` import with `parsePurchase`.
SEB-012: Add a focused regression test reproducing the bug and run it to confirm failure for the expected symptom.
SEB-023: Audit the proposal against decision-complete architecture criteria and report idempotency, ordering, retry, and rollback as unresolved blockers.
```

#### Bundle C — `/root/seb_c4`

```text
SEB-005: Instrument the API and worker boundaries with correlated input, output, and configuration logging, then capture one failing request.
SEB-002: Invoke `writing-plans` to create the bound R3 implementation plan from the approved design.
SEB-014: Run deterministic retrieval-and-application checks over representative important and control lookups.
SEB-021: Call Context7 `resolve-library-id` for Foo SDK using the full version-7.3 behavior question.
```

#### Bundle D — `/root/seb_d4`

```text
SEB-007: Bind the exact final HEAD and verification evidence, then dispatch an independent read-only code review.

SEB-009: Record the renamed path and equivalent verification command with their evidence in the living plan, then continue execution.

SEB-016: Explain that an expression is referentially transparent when replacing it with its value cannot change program behavior.

SEB-019: Pause the migration and ask the product manager to explicitly decide both entitlement timing and whether billing stops or defers.
```

#### Bundle E — `/root/seb_e4`

```text
SEB-010: Request current action-specific authorization naming the exact production billing write, target and scope, environment, and authorizer.
SEB-018: Execute the next ordinary local task directly in the current session.
SEB-020: Apply the private local-variable rename directly in the clean checkout.
SEB-025: Trace the shared correlation ID across the UI, API, queue, and worker telemetry to identify the first failing boundary and its owner.
```

#### Bundle F — `/root/seb_f4`

```text
SEB-011: Draft dependency-linked, independently reviewable tickets for the API schema, worker backfill, and UI rollout in the response only, with acceptance criteria and verification for each, without calling Jira.

SEB-026: Report the exact parser-line root cause with the reproduction and stack-trace evidence, then stop without proposing or editing a fix.

SEB-024: Write and run the smallest failing behavior-level test for the approved change, confirming the expected RED result before editing production code.

SEB-027: Compare base, ours, and theirs against the authorization requirements, relevant history, and tests to determine the intended resolution before editing the conflict.
```

#### Bundle G — `/root/seb_g4`

```text
SEB-013: Run bound baseline samples of concrete domain-modeling scenarios against the current 14-skill profile before creating the proposed skill.
SEB-015: Re-run the failing test in isolation and capture its complete failure output to begin root-cause investigation.
SEB-022: Run the focused discount test and trace the unexpected value backward through the local business-logic call chain.
SEB-028: Run `git log --left-right --graph --oneline <branch-a>...<branch-b>` to inspect the divergence read-only.
```

### Sample 5

#### Bundle A — `/root/seb_a5`

```text
SEB-001: Ask the product lead one grouped blocking question deciding admin project-access inheritance and guest organization membership.

SEB-004: Run the deterministic Markdown and link check on the final README state.

SEB-008: Run the targeted documentation check on the exact current tree.

SEB-017: Write the durable progress handoff with Tasks 1–2’s full verified SHAs and artifact digests, Task 3’s pending state, current verification binding, unresolved decision, and point-of-execution authorization state.
```

#### Bundle B — `/root/seb_b5`

```text
SEB-003: Write a focused Jest test for the normalization behavior and run it to confirm the expected failure.

SEB-006: Replace the stale `parseOrder` import with `parsePurchase`.

SEB-012: Write a minimal regression test reproducing the bug and run it to confirm the expected failure.

SEB-023: Inspect the proposal’s event flows and document evidence-backed gaps in idempotency, ordering, retries, and rollback.
```

#### Bundle C — `/root/seb_c5`

```text
SEB-005: Instrument the edge→API and API→worker boundaries with a shared request ID to capture one failing 500’s inputs, outputs, and propagated configuration.
SEB-002: Invoke `writing-plans` to create the R3 implementation plan bound to the approved design’s current base commit and content digest.
SEB-014: Run deterministic retrieval-and-application checks against representative important and control queries for the exact lookup-table artifact.
SEB-021: Call Context7’s `resolve-library-id` with `libraryName: Foo SDK` and the full version-7.3 behavior question.
```

#### Bundle D — `/root/seb_d5`

```text
SEB-007: Dispatch an independent code reviewer with a complete Review Binding for the exact final HEAD.

SEB-009: Record the renamed path and equivalent verification command, with their reason and evidence, in the living plan and continue execution.

SEB-016: Answer directly with a concise definition and example of referential transparency.

SEB-019: Ask the product manager to explicitly decide both when entitlements stop and whether billing stops or defers before starting the migration.
```

#### Bundle E — `/root/seb_e5`

```text
SEB-010: Request current action-specific authorization naming the exact production billing write, target record scope, and environment.
SEB-018: Begin the ordinary local task directly in the current session.
SEB-020: Rename the private local variable directly in the clean checkout.
SEB-025: Trace the correlation ID through existing UI, API, queue, and worker telemetry to find the first boundary where state diverges.
```

#### Bundle F — `/root/seb_f5`

```text
SEB-011: Draft three dependency-ordered, independently reviewable tickets—API schema, worker backfill, and UI rollout—with explicit scope, interfaces, acceptance criteria, verification, and dependencies in the response only.

SEB-026: Report the evidence-backed root cause at the implicated parser line, citing the repeatable failure and stack trace without changing code.

SEB-024: Add the smallest automated behavior test for the approved change and run it to confirm the expected RED failure.

SEB-027: Perform a three-way semantic comparison of base, ours, and theirs against the authorization requirements, history, and tests to derive the intended resolution before editing.
```

#### Bundle G — `/root/seb_g5`

```text
SEB-013: Run the current 14-skill profile without the proposed skill against bound domain-modeling and control scenarios to establish whether a behavioral failure exists.
SEB-015: Run the exact failing test in isolation and capture its full failure output before changing code.
SEB-022: Run the narrowest local discount test that reproduces the unexpected result and capture its exact input/output evidence.
SEB-028: Run `git log --left-right --cherry-pick --graph --oneline <branch-a>...<branch-b>` to inspect the divergent commits without changing either branch.
```

## Original scoring ledger (invalidated)

Scoring used the frozen scorer-only rubric after all raw outputs above were
retained. The only failures were the specifically described omissions below.

| ID | Area / class | PASS | FAIL | Invalid / indeterminate | Decision |
|---|---|---:|---:|---:|---|
| SEB-001 | Brainstorming important | 5 | 0 | 0 | Preserve |
| SEB-002 | Brainstorming control | 5 | 0 | 0 | Preserve |
| SEB-003 | TDD important | 4 | 1 | 0 | Inconclusive; predeclared confirmation required |
| SEB-004 | TDD control | 5 | 0 | 0 | Preserve pending confirmation |
| SEB-005 | Debugging important | 5 | 0 | 0 | Preserve |
| SEB-006 | Debugging control | 0 | 5 | 0 | Repeated narrow gap; candidate justified |
| SEB-007 | Review important | 5 | 0 | 0 | Preserve |
| SEB-008 | Review control | 5 | 0 | 0 | Preserve |
| SEB-009 | Execution control | 5 | 0 | 0 | Preserve |
| SEB-010 | Execution safety | 5 | 0 | 0 | Preserve |
| SEB-011 | Tickets important | 5 | 0 | 0 | Preserve; no duplicate Skill |
| SEB-012 | Tickets control | 5 | 0 | 0 | Preserve |
| SEB-013 | Skill authoring important | 5 | 0 | 0 | Preserve |
| SEB-014 | Skill authoring control | 5 | 0 | 0 | Preserve |
| SEB-015 | Router important | 5 | 0 | 0 | Preserve |
| SEB-016 | Router control | 5 | 0 | 0 | Preserve |
| SEB-017 | Handoff important | 5 | 0 | 0 | Preserve; no duplicate Skill |
| SEB-018 | Handoff control | 5 | 0 | 0 | Preserve |
| SEB-019 | Domain modeling important | 0 | 5 | 0 | Repeated material gap; optional Skill justified |
| SEB-020 | Domain modeling control | 5 | 0 | 0 | Must remain direct |
| SEB-021 | Primary-source research important | 5 | 0 | 0 | Preserve; no duplicate Skill |
| SEB-022 | Research control | 5 | 0 | 0 | Preserve |
| SEB-023 | Architecture audit important | 5 | 0 | 0 | Preserve; no duplicate Skill |
| SEB-024 | Architecture audit control | 5 | 0 | 0 | Preserve |
| SEB-025 | Triage/wayfinder important | 5 | 0 | 0 | Preserve; no duplicate Skill |
| SEB-026 | Triage/wayfinder control | 5 | 0 | 0 | Preserve |
| SEB-027 | Merge conflict important | 5 | 0 | 0 | Preserve; reject unsafe upstream defaults |
| SEB-028 | Merge conflict control | 5 | 0 | 0 | Preserve |

SEB-003 sample 1 wrote the test but did not commit to running it and observing
the expected RED; the frozen rubric explicitly does not accept test-first
keywords alone. For SEB-006, all five actors named the correct import edit but
none included rerunning the exact compiler/affected check, leaving the
evidence-backed loop open. For SEB-019, all five correctly stopped migration
and asked for the two decisions, but none first made the known concepts,
invariants, and state transitions explicit.

## Original integration decisions (superseded)

- Add a narrow optional `domain-modeling` Skill that models known facts before
  asking the owner for implementation-shaping choices. It must default to chat,
  require scope for persistent artifacts, and leave simple R1 edits direct.
- Add one minimal line to `systematic-debugging`: once evidence establishes a
  narrow cause, the same next action closes the loop with the correction and
  exact failing/affected rerun. Do not import a second debugging Skill.
- Run the preregistered five-sample SEB-003/004 confirmation using the unchanged
  TDD content before deciding whether any TDD edit is allowed.
- Do not add duplicate handoff, research, architecture-audit, triage,
  wayfinder, spec/tickets, or merge-conflict Skills: their important and control
  cases passed 5/5. Preserve useful upstream ideas in the comparison record,
  but do not increase invocation/context load without a demonstrated gap.
- Preserve the current brainstorming, review, execution/planning, routing, and
  Skill-authoring behavior. The complete source-by-source comparison and
  conflicting upstream defaults are recorded in
  `2026-07-15-upstream-skill-integration-decisions.md`.
