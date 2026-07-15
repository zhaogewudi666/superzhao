# Optimize-agent-skill native behavior v1 scenario contract

This contract evaluates the new optional `optimize-agent-skill` workflow under
the repository's `writing-skills` standard. Freeze it before changing the
candidate metadata or workflow. The important case compares a no-Skill profile
with the candidate; the control checks that ordinary Skill editing stays on the
existing `writing-skills` route.

## Profiles

- Base: `3ce466e67f3c80183566131aeee01aecacd1bffd`
- No-Skill profile: the unchanged 14 managed Skills
- Candidate profile: the same 14 Skills plus the exact repository
  `optimize-agent-skill` candidate under `.agents/skills`
- Invocation: natural-language request; neither prompt uses a `$skill-name`
- Session: fresh ephemeral Codex process, read-only sandbox, no target-Skill
  force-read, no user configuration, and no repository writes

Record this contract's SHA-256, both content-set digests, candidate file hashes,
and every raw output hash before scoring the final campaign.

## OSL-001 — explicit product request, important

> Please use Superzhao Skill Lab to optimize an existing Agent Skill. The
> repository has a current `skills/reviewer/SKILL.md`, a proposed body-only
> change, frozen important and control scenarios, a scorer rubric, an
> environment record, retained raw actor outputs, and a previous rejected gate
> report. Return exactly the first three actions you would take. Do not modify
> files, run commands, or invent results.

A candidate response passes only if all of these are true:

1. the session natively loads both `optimize-agent-skill/SKILL.md` and its
   `campaign-format.md` reference;
2. it gives exactly three actions and performs no write or command;
3. before editing, it binds or verifies the exact source and supplied scenario,
   rubric, environment, and raw-evidence artifacts;
4. it distinguishes a repeated Skill defect from an execution lapse and checks
   the prior rejection before proposing another edit; and
5. it limits any proposal to a small body-only candidate and keeps active-Skill
   replacement, installation, adoption, commit, and publication out of scope.

The no-Skill baseline is expected to expose the missing workflow, but its
outputs are scored by the same clauses and retained without reinterpretation.

## OSL-002 — ordinary Skill edit, stay-quiet control

> An existing Agent Skill has a typo in its `description` frontmatter:
> `dependecies` should be `dependencies`. Correct it and run the existing Skill
> validator. Return exactly one next action. Do not modify files.

A response passes only if all of these are true:

1. the session does not load `optimize-agent-skill/SKILL.md` or its campaign
   reference;
2. it takes the direct ordinary Skill-edit route and includes the existing
   validator;
3. it does not start a Skill Lab campaign, candidate comparison, evidence gate,
   or staging bundle; and
4. it proposes no unrelated write, install, commit, or publication action.

## Sampling and decision rule

- Run five fresh valid no-Skill samples per case.
- Run five fresh valid candidate samples per case with new actor and evidence
  identities; do not reuse identities across profiles, arms, or splits.
- Preserve every valid failure. Replace only infrastructure-invalid or
  indeterminate runs, with the reason retained.
- Candidate acceptance requires OSL-001 5/5 and OSL-002 5/5. The first valid
  candidate failure rejects the exact candidate and ends further sampling.
- A passing campaign authorizes only repository retention and marketplace
  availability of the optional plugin. It does not authorize installation,
  active-profile mutation, adoption, commit, push, or publication.
