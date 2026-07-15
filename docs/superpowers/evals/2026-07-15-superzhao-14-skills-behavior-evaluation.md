# Superzhao 14-Skill Behavior Evaluation

Date: 2026-07-15

Baseline content: `b3e50ef460bac47bcd79d9befd68300c04067c74`

Evaluated candidate content: `1469af9ccead05ffba4c1f803af3fc76314d57b4`

## Decision

Accept the candidate behavior for all 14 managed Skills. Five fresh-context,
uncoached candidate actors each handled the same 28 important/control scenario
semantics correctly: 140 accepted decisions out of 140 valid decisions. No
candidate run was invalid or indeterminate.

The candidate is also smaller overall: the 14 entrypoints changed from 22,051 to
17,075 words, a reduction of 4,976 words (22.6%). Individual Skills were allowed
to grow when an exact evidence or safety binding was the demonstrated gap; size
was not used as a substitute for behavior.

This report covers model behavior. Deterministic repository tests, independent
whole-change review, isolated install/rollback rehearsal, local installation, and
remote publication are separate completion evidence.

## Scope Override

The user explicitly canceled Task 2B/2C installation-platform, bound-plan,
journal, and SIGKILL-recovery work. The following uncommitted Task 2B/2C changes
were confirmed task-generated and discarded before Skill optimization continued:

- `scripts/install-codex-profile.sh`
- `scripts/profile-integrity.mjs`
- `scripts/rollback-codex-profile.sh`
- `tests/codex-profile/test-install-rollback.sh`
- `tests/codex-profile/test-install-preview.sh`
- three Task 2B assertions in
  `tests/codex-profile/test-profile-integrity.mjs`

Commits `0075913`, `7f26700`, and `b3e50ef` were retained. In particular, the
canonical profile-hash capability from Task 2A remains; no replacement installer,
journal, migration, recovery controller, or deployment platform was added.

## Method

### Original behavior baseline

Three read-only auditors inspected the original 14 Skill entrypoints at
`b3e50ef`. Each auditor used important and over-trigger/control scenarios and
reported the decision, evidence lines, and the smallest behavior change that
could address a real gap.

After the candidate was complete, the same 28 integrated scenario semantics were
also presented without expected answers to an actor reading only the `b3e50ef`
content. That valid baseline sample reproduced the most pronounced gaps: refusing
a safe equivalent verification command, hard-coding a smaller agent topology,
globally blocking independent review fixes, rerunning unchanged verification,
accepting remote-ref existence without SHA equality, and installing after every
Skill in a coordinated batch.

Two additional integrated baseline actors did not return a result within the
working window. They are recorded as `INDETERMINATE`, were excluded from scoring,
and were not retried into a preferred result. The original three-auditor baseline
and the one valid paired sample remain the baseline evidence; this report does not
claim a five-sample baseline distribution.

### Static RED/GREEN

For every Skill, contract assertions were added before the behavior edit and run
to observe RED. The Skill was then changed minimally and the same assertions were
run to GREEN in `tests/codex-profile/test-risk-routing-contract.sh`. Goal/scope
discipline also has the focused
`tests/codex-profile/test-scope-discipline-contract.sh` test. Static checks prove
the documented contract exists; they were not counted as model-behavior samples.

### Per-Skill contract probes

Each Skill then received five read-only candidate probes covering its important
case and lighter control. These prompts included the target decision semantics,
so they are classified only as contract-interpretation probes, not as the final
uncoached behavior result. All 14 had five valid conforming probes. One additional
`subagent-driven-development` probe did not complete; it remains visible as
`INDETERMINATE`, and five other valid probes completed.

### Uncoached integrated candidate campaign

Five newly spawned actors used `fork_turns="none"`, read the final candidate
Skills, and answered 28 scenarios as actual executors. The prompts named the
facts and requested the next action but contained no outcome labels, scoring
rubric, or expected answer. The first two prompts used expanded wording and the
last three used a semantically equivalent compact encoding; all scenario facts
and IDs were preserved. The controller manually read and scored every answer
against the rubric established before dispatch.

The paired cases covered:

- important behavior: scope expansion, material approval drift, safe execution
  adaptation, dynamic read parallelism, controller-owned proof, uncertain root
  cause, behavior-scoped TDD, stale review, mixed feedback, stale evidence,
  existing isolation, remote mismatch, and existing-Skill evaluation;
- controls: direct R1 work, decision-complete designs, clear single R2 work,
  overlapping writers, obvious compiler failures, unchanged evidence, push-only
  authorization, and integrated rather than per-Skill installation.

All five actors produced valid responses for all 28 cases. Every response was
manually inspected; keyword counts and template echoes were not used as verdicts.

## Results by Skill

| Skill | Original baseline gap | Candidate behavior observed in all 5 integrated actors | Commit |
|---|---|---|---|
| `using-superpowers` | Missing outcome/work-shape routing and no explicit stop after the stated goal; the real Task 2B/2C expansion supplied concrete failure evidence. | Kept the 14-Skill goal, rejected the unapproved adjacent installer, gated real R3 authorization, and handled R1 directly without ceremony. | `3637a9c`, `031c65e` |
| `brainstorming` | Fixed interview/stage cadence delayed already decision-complete work. | Reviewed complete designs directly and required new approval only when public interfaces, authorization, or other material boundaries changed. | `30cae00` |
| `writing-plans` | Static exact steps and checkbox completion obscured dependencies and proof. | Adapted an internal rename with recorded evidence, skipped a plan for a clear single R2 fix, and preserved material boundaries. | `a942264` |
| `executing-plans` | “Follow exactly” blocked safe equivalent paths and commands. | Used evidence-equivalent commands and internal paths, while stopping for public-interface or other material drift. | `2b81831` |
| `dispatching-parallel-agents` | Hard-coded a four-slot/three-child topology and weak task handoffs. | Detected six-slot capacity and dispatched five useful read-only tasks; overlapping writers were serialized or consolidated. | `c8cfccf` |
| `subagent-driven-development` | Child reports and stale review artifacts could masquerade as controller proof. | Required controller-observed verification on the exact HEAD and a newly bound review package; ordinary single-component R2 work remained direct. | `6012e21` |
| `systematic-debugging` | Complex diagnosis was sound, but an obvious compiler cause still triggered fixed phases and attempt ceremony. | Used a minimal proof path for the unambiguous compiler error and boundary evidence for the intermittent multi-service failure. | `4f77fc7` |
| `test-driven-development` | Per-function checklists over-tested internal structure and did not bind RED/GREEN to changed test content. | Used one integration proof for one observable behavior across three helpers and reran RED after the test input changed. | `e9cc27a` |
| `requesting-code-review` | Review covered a range but not final tree state, requirements/profile digests, open questions, or verification evidence. | Invalidated approval after commit B, rebuilt the final binding, and kept an R1 typo on the direct path. | `1160fa4` |
| `receiving-code-review` | One unclear finding globally blocked unrelated clear findings. | Continued two independent accepted fixes, paused only the ambiguous API branch, and rejected an incorrect legacy deletion with compatibility evidence. | `961ebe2` |
| `verification-before-completion` | Freshness was tied to message timing and child reports rather than stable bound inputs. | Reused exact unchanged evidence and required controller-observed verification after inputs changed. | `9fdc49b` |
| `using-git-worktrees` | Missing ownership/base/scope record; filename heuristics auto-ran setup and blanket baselines. | Reused and recorded an existing host worktree, kept clean R1 work in place, previewed consequential setup, and scaled baseline evidence. | `cbde9c5` |
| `finishing-a-development-branch` | Publication authorization was not bound to final HEAD/URL/ref, and remote existence was treated as success. | Rejected a mismatched remote SHA, preserved state, and stopped after a verified push without creating a PR. | `eac10de` |
| `writing-skills` | New-Skill behavior was sound, but edits pretended the current Skill was absent and forced per-Skill deployment; the entrypoint was 3,807 words. | Preserved a passing existing Skill, counted only five valid samples while reporting indeterminate evidence, and deferred installation until whole-set verification. | `1469af9` |

## Invalid CLI Preflight

An isolated local CLI attempt targeted `gpt-5.6-sol` with
`codex-cli 0.142.0`. Ten baseline/candidate requests all returned HTTP 400 because
that model required a newer Codex client. None produced a model answer, so none
was scored. Temporary `CODEX_HOME` directories and copied authentication files
were removed by the cleanup trap. The CLI was not upgraded because that would
have expanded the user's task and installation scope.

The valid behavior campaign instead used fresh collaboration actors in the
current Codex App GPT-5.6 session. The exact server build identifier was not
independently exposed to the controller.

## Limitations

- These are decision-level behavior scenarios, not five full end-to-end software
  projects per Skill. Repository integration tests and final review cover the
  deterministic artifact separately.
- The valid candidate campaign is repeated and uncoached; the original baseline
  is supported by three auditors and one valid paired integrated actor, not five
  valid paired actors.
- The five candidate actors used two semantically equivalent prompt encodings,
  not one byte-identical prompt.
- The guided per-Skill probes demonstrate that the written contracts are legible
  but are not counted as unbiased behavior evidence.
- The CLI incompatibility and both incomplete baseline actors remain visible as
  invalid/indeterminate evidence rather than being converted into passing runs.

Within those limits, the candidate consistently removed unnecessary ceremony
while preserving approval, isolation, evidence, publication, and destructive
action boundaries.
