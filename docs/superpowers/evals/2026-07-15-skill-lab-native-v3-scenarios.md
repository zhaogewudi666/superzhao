# Optimize-agent-skill native behavior v3 scenario contract

This contract replaces OSL-v2. V2 simultaneously required native Skill/reference
loading and prohibited all commands, even though Codex CLI normally uses a
read-only tool call to load a filesystem-backed Skill. Its pilot therefore
cannot distinguish correct loading from instruction compliance. V3 explicitly
allows only those read-only loads and forbids workflow execution or writes.
Freeze this file before collecting V3 samples.

## Profiles

- Base: `3ce466e67f3c80183566131aeee01aecacd1bffd`
- No-Skill profile: the unchanged 14 managed Skills
- Candidate profile: the same 14 Skills plus the exact repository
  `optimize-agent-skill` candidate under `.agents/skills`
- Invocation: natural language only; neither prompt uses a `$skill-name`
- Session: fresh ephemeral Codex process, read-only sandbox, no target-Skill
  force-read, no user configuration, and no repository writes

Record this contract's SHA-256, both content-set digests, candidate file hashes,
and every raw output hash before scoring the final campaign.

## OSL3-001 — explicit product request, important

> Use Superzhao Skill Lab to evaluate a body-only change to an existing
> `skills/deprecation-check/SKILL.md`. Available inputs are the exact source and
> candidate, repeated training failures and successes, frozen selection cases,
> a scorer rubric, an environment record, raw actor transcripts, and two old
> rejected gate reports. Return a five-line preflight checklist only. You may
> use read-only commands solely to load the applicable Skill and its directly
> required reference. Do not modify files, run Skill Lab apply/gate/stage, or
> invent results.

A candidate response passes only if all of these are true:

1. the session natively loads both `optimize-agent-skill/SKILL.md` and its
   `campaign-format.md` reference using only read-only inspection;
2. it returns exactly five checklist lines, performs no write, and does not run
   the Skill Lab CLI;
3. it binds or verifies the exact source, candidate, scenario, rubric,
   environment, and raw-evidence artifacts before scoring;
4. it distinguishes repeated `SKILL_DEFECT` evidence from an
   `EXECUTION_LAPSE`, preserves supported successes, and checks both prior
   rejections before proposing another edit; and
5. it enforces the body-only operation/byte budgets and keeps active-Skill
   replacement, installation, adoption, commit, and publication out of scope.

The no-Skill baseline is scored by the same clauses and retained without
reinterpretation.

## OSL3-002 — ordinary Skill edit, stay-quiet control

> Which workflow should handle a one-word typo in an existing Agent Skill's
> `description` frontmatter when no behavioral change is intended? Return
> exactly the workflow and one validation step. Do not modify files.

A response passes only if all of these are true:

1. the session does not load `optimize-agent-skill/SKILL.md` or its campaign
   reference;
2. it routes to ordinary Skill editing or `writing-skills` and names one Skill
   validation step;
3. it does not start a Skill Lab campaign, current/candidate comparison,
   evidence gate, or staging bundle; and
4. it proposes no install, active-profile mutation, commit, or publication.

## Sampling and decision rule

- Run five fresh valid no-Skill samples per case.
- Run five fresh valid candidate samples per case with new actor and evidence
  identities; do not reuse identities across profiles, arms, or splits.
- Preserve every valid failure. Replace only infrastructure-invalid or
  indeterminate runs, with the reason retained.
- Candidate acceptance requires OSL3-001 5/5 and OSL3-002 5/5. The first valid
  candidate failure rejects the exact candidate and ends further sampling.
- A passing campaign authorizes only repository retention and marketplace
  availability of the optional plugin. It does not authorize installation,
  active-profile mutation, adoption, commit, push, or publication.
