# Domain modeling frame

Use the smallest subset that makes the current decision reviewable. This is a
thinking frame, not a mandatory repository document.

## Context and evidence

- Scope of the model:
- Product statements or decisions:
- Observable code/test/schema evidence:
- Contradictions:

## Concepts

| Canonical term | Meaning and responsibility | Distinct from | Status |
|---|---|---|---|
| | | | Known / inferred / open |

## Invariants

- Always true:
- Never allowed:
- Ownership or authority constraint:
- Historical-data constraint:

## States and transitions

| From | Event or decision | To | Preconditions | Effects | Failure/rollback |
|---|---|---|---|---|---|
| | | | | | |

List forbidden transitions explicitly when their rejection behavior matters.

## Scenario probes

- Ordinary path:
- Timing boundary:
- Retry or duplicate event:
- Partial failure and recovery:
- Existing-record migration:
- Neighboring context interaction:

## Open decisions

| Decision | Why it blocks behavior | Owner | Recommendation/evidence | Status |
|---|---|---|---|---|
| | | | | Open |

Ask one focused, possibly grouped, blocking question only after the known frame
is visible. Separate facts, inferences, and owner decisions so a suggestion
cannot silently become business policy.

## Optional durable record

Persist a glossary or decision record only on request or within an approved
write scope. A durable decision record is justified when the choice is hard to
reverse, surprising without context, and based on a real trade-off. Otherwise,
keep the settled model in the existing spec or plan that consumes it.
