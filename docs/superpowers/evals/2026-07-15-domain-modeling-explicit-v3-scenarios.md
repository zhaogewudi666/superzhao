# Domain-modeling explicit-invocation v3 scenario contract

This contract evaluates the optional `domain-modeling` Skill in the form that
the repository can honestly ship after the native-discovery candidate failed:
explicit invocation only. Freeze this file before running any actor sample.

## Bound candidate

- Superzhao base: `3ce466e67f3c80183566131aeee01aecacd1bffd`
- Candidate policy: `policy.allow_implicit_invocation: false`
- Actor profile: the unchanged 14 managed Skills plus the repository candidate
  copied to `.agents/skills/domain-modeling`
- Session shape: fresh ephemeral Codex session, no target-Skill force-read,
  read-only sandbox, no repository writes

Record the candidate content hashes and the SHA-256 of this frozen contract in
the result report before scoring.

## EDM-001 — explicit important case

> Use `$domain-modeling`. A team is about to migrate existing subscriptions to
> add a paused state. Invoices are immutable once issued. It is unresolved
> whether pausing revokes entitlement immediately or at the end of the paid
> period, and whether billing stops or continues while paused. Return exactly
> one next action before migration work begins. Do not modify files.

A response passes only if all of these are true:

1. the staged `domain-modeling/SKILL.md` is natively loaded during the session;
2. the one next action explicitly preserves the supplied immutable-invoice
   invariant;
3. it names the subscription, entitlement, or billing state/transition affected
   by the pause choice; and
4. it asks the decision owner to settle both entitlement timing and billing
   behavior before migration.

Generic advice to “clarify semantics,” mentioning only the two choices, or a
lifecycle sketch that omits the supplied invariant is a valid failure.

## EDM-002 — explicit proportionality control

> Use `$domain-modeling`. A private local variable named `reslt` should be
> renamed to `result`. Its semantics are settled and the existing targeted
> check is `npm test -- result-helper.test.ts`. Return exactly one next action.
> Do not modify files.

A response passes only if all of these are true:

1. the staged `domain-modeling/SKILL.md` is natively loaded during the session;
2. it takes the direct private-rename route;
3. it includes running the supplied targeted check; and
4. it does not propose a model, workshop, glossary, ADR, issue, specification,
   plan, or broader discovery step.

## Sampling and decision rule

- Run five fresh valid samples per scenario with distinct ephemeral sessions.
- Do not reuse actor or raw-evidence identities between scenarios.
- Preserve every valid failure. Replace only an infrastructure-invalid or
  indeterminate sample, and record the replacement reason.
- EDM-001 must pass 5/5 and EDM-002 must pass 5/5.
- The first valid failure rejects the exact candidate. Do not retry or edit the
  candidate within this campaign.
- Passing authorizes only retaining the explicit optional candidate in the
  repository. It does not authorize installation, implicit invocation, active
  profile changes, commits, publication, or external writes.
