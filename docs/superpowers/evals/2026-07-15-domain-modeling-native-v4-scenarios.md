# Domain-modeling native-discovery v4 scenario contract

This is a fresh confirmation campaign after NDM-v2 rejected the first implicit
candidate and EDM-v3 showed that plain-text `$domain-modeling` does not emulate
an explicit Skill attachment in Codex CLI. Freeze this contract before editing
the candidate. Its wording and domain nouns differ from the development cases.

## Candidate boundary

- Superzhao base: `3ce466e67f3c80183566131aeee01aecacd1bffd`
- Actor profile: unchanged 14 managed Skills plus one revised
  `.agents/skills/domain-modeling` candidate
- Invocation: natural language only; neither prompt names the Skill
- Session shape: fresh ephemeral Codex session, read-only sandbox, no
  target-Skill force-read and no repository writes

Record the frozen-contract hash, exact candidate hashes, and content-set digest
before the first actor sample.

## NDM4-001 — native important case

> A membership platform is about to migrate existing plans to add a frozen
> state. Receipts are immutable after issuance. The product owner has not
> decided whether freezing removes class access immediately or at the next
> billing boundary, and whether the frozen interval extends the paid term or
> billing continues on the original schedule. Return exactly one next action
> before migration work begins. Do not modify files.

A response passes only if all of these are true:

1. the session natively loads the staged `domain-modeling/SKILL.md`;
2. the one action names the immutable-receipt invariant;
3. it identifies a membership, access, paid-term, or billing state/transition
   constrained by that invariant and the freeze decision; and
4. it asks the owner to settle both access timing and paid-term/billing
   behavior before migration.

Generic clarification advice, only repeating the choices, or omitting the
known invariant is a valid failure.

## NDM4-002 — stay-quiet control

> A private formatter parameter named `seperator` should be renamed to
> `separator`. Its semantics are settled and the existing targeted check is
> `pytest tests/unit/test_formatter.py -q`. Return exactly one next action. Do
> not modify files.

A response passes only if all of these are true:

1. the session does not load `domain-modeling/SKILL.md`;
2. it takes the direct private-rename route;
3. it includes the supplied targeted check; and
4. it does not propose domain modeling, a workshop, glossary, ADR, issue,
   specification, plan, or broader discovery.

## Sampling and decision rule

- Run five fresh valid samples per scenario with distinct ephemeral sessions.
- Do not reuse actor or raw-evidence identities between arms.
- Preserve every valid failure. Replace only infrastructure-invalid or
  indeterminate samples and record why.
- NDM4-001 must pass 5/5 and NDM4-002 must pass 5/5.
- The first valid failure rejects this exact candidate. Do not retry or edit it
  within the campaign.
- Passing authorizes only repository retention of this optional candidate and
  its implicit metadata. It does not authorize installation, active-profile
  changes, commits, publication, or external writes.
