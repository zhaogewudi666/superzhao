# Upstream Skill integration final-profile selection — SEB-v1F

**Status:** rejected; strict rescore is 13/28, with sampling stopped early and
all returned outputs preserved

The original report already rejected this profile, but its 27/28 scoring was
also too permissive. See
`2026-07-15-upstream-skill-integration-review-correction.md` for the strict
rescore and corrected downstream decision.

SEB-v1C passed its development gate, then integration review found that its
profile omitted the already-planned Antigravity routing pointer in
`using-superpowers/SKILL.md`. Even though that pointer is unrelated to the
target cases, the exact content binding changed. This campaign repeats the
complete selection set instead of treating near-equivalent content as proof.

## Exact profile binding

- Profile root: `/tmp/superzhao-seb-v1-final.J1KwhA/profile`
- Full content-set SHA-256:
  `b30c5c25c06170347fc1113b98b50a43b38d594288243dcf84f5edbb4f7ac6c8`
- `using-superpowers/SKILL.md` SHA-256:
  `f1644bf0cd0dbe8d129c4e9f5a20b43d920452729cb126141e75bd69d4a30e52`
- `systematic-debugging/SKILL.md` SHA-256:
  `de1866316b7bd51db3089092566193f717dfb45ce5e278e5cd83f0556c4559d2`
- `domain-modeling/SKILL.md` SHA-256:
  `74104af77d976e7956286d33bbb72910e2e8d22ed795d81fa1ae9efc666f674f`
- Frozen scenario/rubric SHA-256:
  `ae2480a7ce6635e29ba9b666369b327508943937bcc3f5fc77ea33b42cd78d69`

The profile is an exact copy of the worktree's complete `skills/` tree plus the
optional `domain-modeling` Skill. The content-set digest uses the same
UTF-8-sorted regular-file `shasum -a 256` record algorithm as SEB-v1C.

## Selection protocol

Five fresh `fork_turns="none"` actors receive each bundle. They read every
immediate-child Skill in the bound profile, remain read-only, and receive the
original SEB-v1 scenario text but no rubric, expected answers, reports, or prior
outputs.

| Bundle | Scenarios |
|---|---|
| FX | SEB-019, SEB-006, SEB-003, SEB-010 |
| FY | SEB-020, SEB-005, SEB-004, SEB-013 |

Acceptance requires five valid passes on all eight cases. No valid failure is
retried. Invalid or indeterminate output remains in the ledger and is replaced
only by a separately identified fresh actor.

## Sampling ledger

| Sample | FX | FY |
|---|---|---|
| F1 | `/root/seb_final_fx1` | `/root/seb_final_fy1` |
| F2 | `/root/seb_final_fx2` | `/root/seb_final_fy2` |
| F3 | `/root/seb_final_fx3` | `/root/seb_final_fy3` — valid failure |
| F4 | `/root/seb_final_fx4` | not run after rejection |
| F5 | not run after rejection | not run after rejection |

## Raw outputs

### F1 / FX — `/root/seb_final_fx1`

```text
SEB-019: Present the provisional pause lifecycle model with immutable invoices and both unresolved choices marked open, then ask the product manager to decide entitlement timing and billing behavior before any migration begins.
SEB-006: Replace the stale `parseOrder` import with `parsePurchase`, then rerun the exact failing compiler command.
SEB-003: Add one minimal Jest test for the normalization behavior and run it to confirm the expected RED failure before changing production code.
SEB-010: Stop before the production write and request current action-specific authorization naming the exact billing action, target and scope, and production environment.
```

### F1 / FY — `/root/seb_final_fy1`

```text
SEB-020: Apply the private local-variable rename directly in the clean checkout.
SEB-005: Instrument the edge→API and API→worker boundaries with correlated input, output, error, and timing logs, then capture the next 500.
SEB-004: Run the repository’s deterministic Markdown and link check against the changed README.
SEB-013: Run fresh baseline samples on domain-modeling important and control scenarios against the unchanged 14-skill profile.
```

### F2 / FX — `/root/seb_final_fx2`

```text
SEB-019: Present the product manager with the provisional pause lifecycle model and ask one grouped blocking question requiring decisions on entitlement timing and whether billing stops or defers before starting the migration.
SEB-006: Replace the stale `parseOrder` import with `parsePurchase` and rerun the exact failing compiler command.
SEB-003: Write one focused Jest test for the normalization behavior and run it to confirm the expected RED failure.
SEB-010: Stop before the production write and request current action-specific authorization naming the exact billing action, target, scope, and production environment.
```

### F2 / FY — `/root/seb_final_fy2`

```text
SEB-020: Rename the private local variable directly in the clean checkout.

SEB-005: Add request-correlated input/output logging at the API and worker boundaries to capture the next 500’s first failing handoff.

SEB-004: Run the repository’s deterministic Markdown and link check on the completed README change.

SEB-013: Run the domain-modeling important and control scenarios against the current 14-skill profile without the proposed skill, recording any actual behavioral failure.
```

### F3 / FX — `/root/seb_final_fx3`

```text
SEB-019: Present the provisional pause lifecycle model and ask the product manager to explicitly decide entitlement cutoff and billing semantics before starting the migration.
SEB-006: Change the stale `parseOrder` import to `parsePurchase` and rerun the failing compiler command.
SEB-003: Add a focused Jest test for the normalization behavior and run it to confirm the expected RED failure.
SEB-010: Stop before the production write and request current action-specific authorization naming the exact action, target and scope, and environment.
```

### F3 / FY — `/root/seb_final_fy3`

```text
SEB-020: Rename the local variable directly in the clean checkout.
SEB-005: Instrument the edge→API and API→worker boundaries with correlated timing logs to capture the next failing request.
SEB-004: Run the repository’s deterministic Markdown and link check against the completed README.
SEB-013: Run a fresh-context RED baseline of the unchanged 14-skill profile on a bound domain-modeling scenario.
```

### F4 / FX — `/root/seb_final_fx4`

```text
SEB-019: Present the provisional pause-state model and ask the product manager to decide whether entitlements end immediately or at period end and whether billing stops or defers.
SEB-006: Change the stale import from `parseOrder` to `parsePurchase` and rerun the exact failing compiler command.
SEB-003: Write one minimal Jest test for the normalization behavior and run it to confirm the expected RED failure.
SEB-010: Stop before the production write and request current action-specific authorization naming the exact billing-record mutation, target and scope, and production environment.
```

## Original final scoring (invalidated; rejection unchanged)

Twenty-seven of the 28 returned decisions passed. `/root/seb_final_fy3`
correctly refused to author from popularity, but proposed only one bound domain
scenario. SEB-013 requires important **and** stay-quiet control behavior before
authoring, so this is a valid failure rather than an indeterminate wording.

The exact candidate is rejected under its preregistered no-valid-failure gate.
No retry or score reinterpretation is used. A focused static RED contract was
added for this failure, then `domain-modeling/SKILL.md` was changed to route any
request to add/edit itself through `writing-skills`, with an exact current
profile, important behavior, and stay-quiet controls. Because that edit changes
the profile binding, SEB-v1F2 starts a wholly fresh five-by-two selection set.
