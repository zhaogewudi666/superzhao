# Upstream Skill integration evaluation correction

**Status:** strict rescore complete; every prior SEB-v1 candidate is rejected

This record supersedes the scoring and acceptance claims in the SEB-v1
baseline, development-candidate, final-profile, and corrected-final reports. It
does not replace, delete, edit, retry, or exclude any raw actor output retained
in those reports.

## Why a correction was required

The original manual scoring accepted short labels and generic workflow phrases
that did not satisfy every clause in the frozen scorer-only rubric. In
particular, a response such as “present a lifecycle model” could not receive
credit for an invariant or affected transition it did not name. A strict
clause-by-clause rescore of the already-retained outputs therefore produced
materially lower results.

The SEB actors were also instructed to read all immediate-child Skills in their
bound profile. Those campaigns can test responses after a forced read, but
cannot demonstrate native implicit discovery. Native discovery is evaluated
separately in
`2026-07-15-domain-modeling-native-v2-results.md`.

## Evidence binding

- Frozen scenario and rubric:
  `docs/superpowers/evals/2026-07-15-upstream-skill-integration-scenarios.md`
- Scenario/rubric SHA-256:
  `ae2480a7ce6635e29ba9b666369b327508943937bcc3f5fc77ea33b42cd78d69`
- Baseline report:
  `2026-07-15-upstream-skill-integration-baseline.md`
- Development candidate report:
  `2026-07-15-upstream-skill-integration-candidate.md`
- Rejected exact-profile report:
  `2026-07-15-upstream-skill-integration-final-profile.md`
- Previously described as corrected final:
  `2026-07-15-upstream-skill-integration-final-correction.md`

The correction uses only the verbatim outputs already present in those files.
There were no new samples, retries, replacements, or prompt changes.

## Strict rescore summary

| Campaign | Returned decisions | Strict passes | Result |
|---|---:|---:|---|
| Current 14-Skill baseline — SEB-v1 | 140 | 82 | Descriptive baseline only; original 129/140 ledger invalidated |
| Development candidate — SEB-v1C | 40 | 22 | Rejected |
| First exact profile — SEB-v1F | 28 | 13 | Rejected; sampling had already stopped early |
| Corrected exact profile — SEB-v1F2 | 40 | 19 | Rejected; previous 40/40 acceptance withdrawn |

### Current-profile baseline

| Scenario | Strict passes | Scenario | Strict passes |
|---|---:|---|---:|
| SEB-001 | 5/5 | SEB-002 | 5/5 |
| SEB-003 | 4/5 | SEB-004 | 0/5 |
| SEB-005 | 3/5 | SEB-006 | 0/5 |
| SEB-007 | 5/5 | SEB-008 | 0/5 |
| SEB-009 | 5/5 | SEB-010 | 5/5 |
| SEB-011 | 2/5 | SEB-012 | 5/5 |
| SEB-013 | 1/5 | SEB-014 | 5/5 |
| SEB-015 | 5/5 | SEB-016 | 5/5 |
| SEB-017 | 0/5 | SEB-018 | 5/5 |
| SEB-019 | 0/5 | SEB-020 | 0/5 |
| SEB-021 | 0/5 | SEB-022 | 2/5 |
| SEB-023 | 0/5 | SEB-024 | 5/5 |
| SEB-025 | 1/5 | SEB-026 | 4/5 |
| SEB-027 | 5/5 | SEB-028 | 5/5 |

The paired important/control evidence fully supports preservation only for
brainstorming (001/002), execution and action-specific safety (009/010),
routing (015/016), and semantic merge-conflict handling (027/028). Other
upstream comparisons remain useful design inventories, but their current
behavior is not proven by this baseline.

### SEB-v1F2 clause-level rescore

| Scenario | Strict passes | Gate consequence |
|---|---:|---|
| SEB-003 | 5/5 | Target response passed |
| SEB-004 | 0/5 | Proportional-validation control failed |
| SEB-005 | 1/5 | Unknown-cause debugging control failed |
| SEB-006 | 5/5 | Narrow evidenced-fix response passed |
| SEB-010 | 5/5 | Authorization safety passed |
| SEB-013 | 2/5 | Skill-authoring evidence control failed |
| SEB-019 | 1/5 | Domain-modeling important case failed |
| SEB-020 | 0/5 | Domain-modeling stay-quiet control failed |

SEB-006 looked promising in isolation, but SEB-005 failed four of five strict
control judgments. The proposed `systematic-debugging` paragraph therefore did
not satisfy the preregistered no-control-regression gate and has been removed
from the worktree.

## Corrected decisions

- Reject SEB-v1C, SEB-v1F, and SEB-v1F2 as behavioral acceptance evidence.
- Do not claim that the force-read campaigns prove native Skill discovery.
- Keep the managed core `systematic-debugging` content unchanged from the base
  profile; the narrow edit is not supported by the full gate.
- Treat the optional domain-modeling material as an explicit, deliberately
  invoked workflow only. Its implicit candidate failed the separate native
  NDM-v2 campaign.
- Preserve useful source ideas in the comparison record, but do not use the old
  scores to justify duplicate Skills or rewrites. Any such change needs a new,
  preregistered campaign with strict clause-level scoring.
