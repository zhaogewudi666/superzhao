# Superzhao 14-Skill Behavior Evaluation

Date: 2026-07-15

Baseline content: `b3e50ef460bac47bcd79d9befd68300c04067c74`

Original integrated-campaign profile:
`69f8ad95b00016854ab61a70b438b40d99f209ce1358aed3af4a0295adc62e10`

Intermediate review profile:
`badb51b9aabe20db044ad7a9c77f4b4cb560dc32d94c6452a3fdbce90e288e5f`

Current candidate profile:
`08c8aebdfc41a67fdca7b023c614ef42a91173c9d7f03455691629f02fa7fa55`

Auditable scenarios, rubric, per-sample ledger, and raw outputs:
[behavior evidence](2026-07-15-superzhao-14-skills-behavior-evidence.md)

## Decision

Current behavioral acceptance is pending. Five fresh-context actors scored
140/140 on the original profile, and five follow-up turns scored 40/40 on the
intermediate Finishing/SDD delta. Independent review then found another material
SDD wording conflict. Under `writing-skills`, neither earlier campaign proves the
new candidate merely because its decisions look compatible.

Acceptance therefore requires five fresh, independent, valid samples on the
exact current profile. Each must answer the original Finishing/SDD important and
control cases plus all eight correction cases (12 decisions per sample). Until
those raw outputs and verdicts are recorded, this report does not claim the
current Finishing/SDD behavior—or the integrated 14-Skill profile—is accepted.

The candidate is also smaller overall: the 14 entrypoints changed from 22,051 to
17,250 words, a reduction of 4,801 words (21.8%). Individual Skills were allowed
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

Development-time read-only audits informed scenario selection, but their raw
transcripts were not retained and therefore are not quantitative acceptance
evidence. The auditable baseline is one actor reading only `b3e50ef` and answering
the same 28 integrated scenario semantics without expected decisions. It accepted
21 and failed seven: safe equivalent execution (`EP-I`), dynamic capacity
(`DP-I`), proportionate obvious-cause debugging (`DBG-I`), independent clear
feedback (`RC-I`), unchanged evidence reuse (`V-I`), exact remote SHA equality
(`F-I`), and whole-set installation (`WS-C`).

Two additional integrated baseline actors did not return a result within the
working window. They are recorded as `INDETERMINATE`, were excluded from scoring,
and were not retried into a preferred result. This report does not claim a
five-sample baseline distribution.

### Static RED/GREEN

For every Skill, contract assertions were added before the behavior edit and run
to observe RED. The Skill was then changed minimally and the same assertions were
run to GREEN in `tests/codex-profile/test-risk-routing-contract.sh`. The final
Finishing/SDD review corrections followed the same RED/GREEN sequence. Goal/scope
discipline also has the focused
`tests/codex-profile/test-scope-discipline-contract.sh` test. Static checks prove
the documented contract exists; they were not counted as model-behavior samples.

### Per-Skill contract probes

Guided read-only probes were used while developing individual Skills. They
included target decision semantics and their raw transcripts were not retained,
so this report makes no numerical acceptance claim from them. Only the auditable
uncoached integrated campaign and review-correction delta are scored.

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
The actor thread IDs and raw final answers are in the evidence artifact. The app
record preserves all scenario IDs and facts but does not export byte-exact spawn
payloads; the evidence therefore records the complete normalized scenario
semantics and discloses the two prompt encodings rather than claiming byte
identity.

### Review-correction delta

Independent review found cross-Skill contradictions not exercised by the first
28 cases. Before editing, focused contract assertions failed. After the minimal
Finishing/SDD corrections turned them green, the same five independent actors
received eight new uncoached decisions covering unchanged verification reuse,
binding drift, isolated versus shared writers, task-proportional versus final-R3
verification, and Minor versus material review findings. All five returned valid
8/8 decisions. These were follow-up turns, not fresh-context actors, and are
reported as a separate 40/40 delta.

## Results by Skill

| Skill | Original baseline gap | Candidate behavior observed in all 5 integrated actors | Commit |
|---|---|---|---|
| `using-superpowers` | Missing outcome/work-shape routing and no explicit stop after the stated goal; the real Task 2B/2C expansion supplied concrete failure evidence. | Kept the 14-Skill goal, rejected the unapproved adjacent installer, gated real R3 authorization, and handled R1 directly without ceremony. | `3637a9c`, `031c65e` |
| `brainstorming` | Fixed interview/stage cadence delayed already decision-complete work. | Reviewed complete designs directly and required new approval only when public interfaces, authorization, or other material boundaries changed. | `30cae00` |
| `writing-plans` | Static exact steps and checkbox completion obscured dependencies and proof. | Adapted an internal rename with recorded evidence, skipped a plan for a clear single R2 fix, and preserved material boundaries. | `a942264` |
| `executing-plans` | “Follow exactly” blocked safe equivalent paths and commands. | Used evidence-equivalent commands and internal paths, while stopping for public-interface or other material drift. | `2b81831` |
| `dispatching-parallel-agents` | Hard-coded a four-slot/three-child topology and weak task handoffs. | Detected six-slot capacity and dispatched five useful read-only tasks; overlapping writers were serialized or consolidated. | `c8cfccf` |
| `subagent-driven-development` | Child reports and stale review artifacts could masquerade as controller proof; later review also found blanket bans on isolated writers, Minor advice, and task-proportional verification. | Required controller proof on exact HEAD, allowed only isolated/disjoint writer batches, kept Minor advice non-blocking, and reserved complete suites for cross-cutting/final R3 gates. | `6012e21` plus final review correction |
| `systematic-debugging` | Complex diagnosis was sound, but an obvious compiler cause still triggered fixed phases and attempt ceremony. | Used a minimal proof path for the unambiguous compiler error and boundary evidence for the intermittent multi-service failure. | `4f77fc7` |
| `test-driven-development` | Per-function checklists over-tested internal structure and did not bind RED/GREEN to changed test content. | Used one integration proof for one observable behavior across three helpers and reran RED after the test input changed. | `e9cc27a` |
| `requesting-code-review` | Review covered a range but not final tree state, requirements/profile digests, open questions, or verification evidence. | Invalidated approval after commit B, rebuilt the final binding, and kept an R1 typo on the direct path. | `1160fa4` |
| `receiving-code-review` | One unclear finding globally blocked unrelated clear findings. | Continued two independent accepted fixes, paused only the ambiguous API branch, and rejected an incorrect legacy deletion with compatibility evidence. | `961ebe2` |
| `verification-before-completion` | Freshness was tied to message timing and child reports rather than stable bound inputs. | Reused exact unchanged evidence and required controller-observed verification after inputs changed. | `9fdc49b` |
| `using-git-worktrees` | Missing ownership/base/scope record; filename heuristics auto-ran setup and blanket baselines. | Reused and recorded an existing host worktree, kept clean R1 work in place, previewed consequential setup, and scaled baseline evidence. | `cbde9c5` |
| `finishing-a-development-branch` | Publication authorization was not bound to final HEAD/URL/ref, remote existence was treated as success, and its fresh-test rule contradicted content-bound verification reuse. | Rejected a mismatched remote SHA, reused still-bound evidence while immediately rechecking clean state/Action Binding, and reran only after binding drift. | `eac10de` plus final review correction |
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
- The valid full candidate campaign used five fresh actors. The correction delta
  reused those five actor threads in follow-up turns, so its 40 decisions are
  disclosed separately and are not called fresh-context samples.
- The auditable baseline has one valid paired actor, not five; two attempts are
  visible as `INDETERMINATE`.
- The original candidate actors used two semantically equivalent prompt
  encodings. The app read API retained facts, IDs, thread provenance, and raw
  answers but not byte-exact spawn payloads.
- Development-time guided probes and audits lack retained raw transcripts and
  are excluded from quantitative claims.
- The CLI incompatibility and both incomplete baseline actors remain visible as
  invalid/indeterminate evidence rather than being converted into passing runs.

Within those limits, the earlier bound candidates consistently removed
unnecessary ceremony while preserving approval, isolation, evidence,
publication, and destructive-action boundaries. The current profile remains
unaccepted until the fresh rerun contract above is satisfied.
