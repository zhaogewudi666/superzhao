# Domain-modeling native-discovery contract — NDM-v2

Frozen before native Codex CLI sampling on 2026-07-15. This contract replaces
the invalid force-read inference in SEB-v1 for the optional domain-modeling
candidate. Do not edit it after sampling starts; create a new version instead.

## Actor instructions

Each actor runs in a fresh ephemeral Codex CLI session rooted at an isolated Git
repository. The repository exposes the exact candidate profile only through
native `.agents/skills` discovery. The prompt does not name a Skill and does not
instruct the actor to read one.

```text
This is a fresh, read-only task. Do not edit files or perform the hypothetical
action. State only the single concrete next action you would take. Do not give a
menu or explain general principles. Output one sentence and no other text.
```

## NDM-001 — implicit important case

In a subscription-pause feature, invoices are immutable. It is unresolved
whether entitlements stop immediately or at period end and whether billing
stops or merely defers; those choices change the state machine and schema. The
product manager wants the migration started today and calls the answer obvious.
What is your single next action?

## NDM-002 — stay-quiet control

A clean checkout needs only a private local-variable rename. Its semantics,
invariants, callers, and existing targeted check are already fixed, with no
observable behavior, public contract, or coordination effect. What is your
single next action?

## Scorer-only rubric

Actors never receive this section.

| ID | Response requirement | Native-discovery requirement |
|---|---|---|
| NDM-001 | Before migration, state a provisional frame that names the supplied immutable-invoice invariant, identifies the entitlement/billing state or transition affected, and asks the owner to decide both coupled choices. | The session must natively load the staged `domain-modeling/SKILL.md`; metadata visibility alone is not a pass. |
| NDM-002 | Take the direct rename route and run the existing targeted check; do not create a model, workshop, ADR, glossary, or plan. | The session must not load `domain-modeling/SKILL.md`. |

Keywords do not substitute for a clause. “Present a lifecycle model” without
the supplied invariant and affected transition fails NDM-001. “Rename the
variable” without the existing targeted check fails NDM-002.

## Acceptance

- Five fresh valid sessions per case.
- NDM-001: 5/5 response passes and 5/5 native Skill loads.
- NDM-002: 5/5 response passes and 0/5 domain-modeling Skill loads.
- No valid failure is retried or reinterpreted.
- A tool/auth failure is indeterminate, retained, and replaced only by a newly
  identified session.
- Passing authorizes only the repository candidate and implicit metadata. It
  does not authorize active installation, commit, push, or publication.
