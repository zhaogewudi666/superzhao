# Superzhao upstream Skill integration plan and execution ledger

**Status:** implementation, behavior decisions, integrated verification, and
independent review complete; human diff review pending; no installation,
commit, push, or pull request is authorized

**Goal:** absorb the safest reusable ideas from Microsoft SkillOpt and the
complete Matt Pocock Skills tree without weakening Superzhao's evaluated core,
scope controls, or zero-runtime-dependency policy.

**Risk:** R2. This work adds public workflow/plugin surfaces and behavior
records, but does not change an active profile or external system.

## Frozen inputs

- Superzhao base: `3ce466e67f3c80183566131aeee01aecacd1bffd`
- Microsoft SkillOpt: `57333f3406436a90a2b5feec4aad74ddb33d6e85`
- Matt Pocock Skills: `e9fcdf95b402d360f90f1db8d776d5dd450f9234`
- Original SEB-v1 scenario contract:
  `ae2480a7ce6635e29ba9b666369b327508943937bcc3f5fc77ea33b42cd78d69`

The retained core inventory is the unchanged 14-Skill profile from the base
commit. Optional candidates live in their own plugin roots.

## Non-negotiable boundaries

- No provider SDK, server, network call, credential access, conversation
  harvesting, automatic rollout, or automatic adoption in Skill Lab.
- No candidate may overwrite an active or source Skill, install itself, commit,
  push, publish, or mutate an issue tracker.
- Behavior claims require native Skill loading. Force-reading a file does not
  prove implicit discovery; fluent output without a Skill load is not Skill
  evidence.
- Raw valid failures remain failures. Invalid or indeterminate samples may be
  replaced only with the reason retained.
- Third-party adaptations carry pinned provenance, the complete applicable MIT
  notice, and each independently distributed plugin's Superzhao license.
- The working tree may contain repository-local candidates and evidence only.
  Personal marketplaces, active profiles, and credentials remain untouched.

## Task 1 — Complete source inventory and licensing

**Status:** completed

Deliverables:

- A source comparison covering all 40 Matt Pocock `SKILL.md` files: 22 stable,
  4 deprecated, 8 in-progress, 4 miscellaneous, and 2 personal.
- Supporting-file comparison for codebase design, triage, debugging, TDD, and
  domain-record templates.
- SkillOpt comparison covering bounded edits, analyst/merge/ranking prompts,
  Skill-defect versus execution-lapse reflection, meta/slow updates, staging,
  and rejected-candidate memory.
- Explicit rejection of semantic-density gaming, session harvesting,
  provider-backed rollouts, dashboards, and automatic adoption.
- Repository and plugin-local Microsoft/Matt MIT notices plus plugin-local
  Superzhao licenses.

Evidence:

- `docs/superpowers/evals/2026-07-15-upstream-skill-integration-decisions.md`
- `THIRD_PARTY_NOTICES.md`
- both plugin `PROVENANCE.md`, `THIRD_PARTY_NOTICES.md`, and `LICENSE` files

## Task 2 — Correct the original behavior evidence

**Status:** completed; original acceptance withdrawn

Independent clause-complete rescoring found:

| Campaign | Strict pass | Strict fail | Decision |
|---|---:|---:|---|
| SEB-v1 baseline | 82/140 | 58/140 | descriptive baseline only |
| SEB-v1C development candidate | 22/40 | 18/40 | rejected |
| SEB-v1F first final profile | 13/28 | 15/28 | rejected |
| SEB-v1F2 corrected final profile | 19/40 | 21/40 | rejected |

Consequences:

- The earlier `40/40` acceptance is invalid.
- The proposed `systematic-debugging` loop-closure edit failed its cross-control
  gate and was removed. Managed core Skills and profile tests match the base.
- A useful source-review idea is not automatically a new Skill. Only
  brainstorming, execution/authorization, routing, and merge-conflict pairs had
  complete strict important/control support for preserving current behavior;
  the remaining areas are recorded as unproven candidates or rejected defaults.

Authoritative evidence:

- `2026-07-15-upstream-skill-integration-review-correction.md`
- status notices at the top of the baseline/candidate/final reports

## Task 3 — Build a zero-dependency existing-Skill candidate lab

**Status:** implementation hardened; implicit candidate rejected and retained
only as explicit-only, unlisted experimental source

Scope:

- Existing Skill body candidates only. New Skill creation and frontmatter
  trigger/description changes remain `writing-skills` work outside this CLI.
- `apply` accepts at most four immutable-source operations plus explicit UTF-8
  added/removed byte budgets. It rejects BOM/CRLF, unsupported frontmatter,
  duplicate JSON keys, invalid UTF-8, ambiguous anchors, overlaps, and protected
  regions.
- `gate` reads and hashes the actual source, candidate, scenario, rubric,
  environment, and raw-evidence files. Exact balanced selection sample counts,
  actor/evidence pairing, cross-arm/split separation, and repeated failure codes
  are enforced. Actor identity and outcome scoring still require human review;
  hashes prove file identity, not truth or independence.
- `stage` recomputes apply/gate results and packages source, candidate, edits,
  results, campaign artifacts, and deduplicated raw evidence. `manifest.json` is
  published last. A directory without it is incomplete and cannot be reviewed
  or adopted.
- Publication uses no-replace links or a no-replace directory reservation.
  Temp cleanup is best effort; a file is rolled back only when physical
  ownership is provable. The standard-library implementation reduces but does
  not claim protection from a malicious concurrent parent-directory swap, so
  the workflow requires a trusted single writer.

Evidence and decision:

- Full Node regression suite, including fault injection and containment cases.
- Plugin and Skill validators plus static workflow contract.
- OSL-v1 and OSL-v2 pilots were contract-invalid and are retained only as such.
- Corrected OSL-v3 used prompt-input diagnostics for exact 14-Skill and
  15-Skill profiles. Five fresh no-Skill samples were retained per case. The
  first valid candidate important sample natively loaded the Skill and its
  reference but omitted the full operation/byte budgets and deployment
  exclusions, so the exact candidate failed and later candidate samples were
  not run.
- Restore `policy.allow_implicit_invocation: false`, remove the plugin from the
  repository marketplace, and make no behavior-acceptance claim.

## Task 4 — Evaluate domain modeling as a standalone optional plugin

**Status:** implicit candidates rejected; explicit source retained as an
experimental, unlisted candidate

What was retained in source:

- precise terms and code/glossary contradiction checks;
- known/inferred/open facts;
- explicit invariants, states, transitions, owners, scenario probes, and
  blocking decisions;
- chat-first output and no automatic `CONTEXT.md`, ADR, issue, or glossary
  write.

What the evidence says:

- Strict current SEB-019/020 baseline was 0/5 and 0/5, so a real gap remains.
- Force-read SEB candidates did not pass the frozen gate and cannot prove native
  integration.
- NDM-v2 and fresh NDM-v4 both rejected implicit discovery on their first valid
  important sample.
- EDM-v3 content responses were fluent but the explicit-only Skill never loaded
  from plain CLI `$name` text, so that profile was also rejected. A real Codex
  UI picker campaign remains unrun.

Decision:

- Keep `policy.allow_implicit_invocation: false`.
- Use the installed namespace
  `$superzhao-engineering:domain-modeling` in metadata.
- Keep the source for review and future manual attachment evaluation, but do not
  list `superzhao-engineering` in the repository marketplace or describe it as
  behavior accepted.

## Task 5 — Packaging and maintainer documentation

**Status:** implemented and verified; both behavior-unaccepted plugin sources
are unlisted and explicit-only

Deliverables:

- Standalone plugin layout/provenance/license tests.
- Marketplace retains only the existing `superpowers` entry; neither
  experimental candidate installs or appears as available.
- Runnable plugin and Skill validator guide with `CODEX_HOME` fallback and
  Python/PyYAML preflight.
- Installed plugin names use `<plugin>:<skill>` in default prompts.
- Testing guide separates deterministic repository tests from native behavior
  campaigns.

## Task 6 — Integrated validation and handoff

**Status:** integrated verification and independent review complete; human diff
review pending

Before claiming completion:

1. Bind the OSL-v3 rejected profile and update all
   README/Skill/reference/provenance claims to the exact retained explicit-only
   sources.
2. Run the full Skill Lab suite, optional-plugin/docs tests, bundled plugin and
   Skill validators, affected profile tests, shell lint, and `git diff --check`.
3. Recompute the managed profile comparison and prove core is unchanged.
4. Obtain an independent final review of the exact diff and resolve material
   findings.
5. Show the complete diff and test/eval ledger to the human partner. Do not
   install, commit, push, or open a PR.

Verification ledger:

- Skill Lab regression suite: 35/35 passed.
- Optional-plugin contracts, maintainer-doc contracts, both bundled plugin
  validators, and both bundled Skill validators: passed.
- Managed Codex profile suite, shell lint, Codex marketplace manifest, Codex
  sync, brainstorm server, Kimi, and OpenCode deterministic suites: passed.
- `git diff --check`: passed. The managed `skills/` and
  `tests/codex-profile/` paths are byte-identical to the frozen base.
- Independent exact-diff review: no P0, P1, P2, or material finding.
- Two broader base-suite limitations were reproduced on unchanged paths and
  not folded into this change: Pi's mapping document misses the test's
  lowercase `write` token (5/6), and Codex packaging rejects a linked worktree
  before reaching its separate timezone-sensitive timestamp assertions.

If publication is later requested, split unrelated review units. Skill Lab and
the engineering candidate are both experimental sources, not accepted
features. Neither should be listed or published as behavior accepted until its
own fresh native UI/manual-selection campaign passes; they should not be
bundled merely to reduce PR count.
