# Superzhao Adaptive Control Plane v2 Implementation Plan

> **SUPERSEDED — HISTORICAL, NON-EXECUTABLE.** The user's 2026-07-15 scope
> override canceled the installation platform, bound plan, journal, and SIGKILL
> recovery work. Task 2B/2C and their unchecked descendants must not be executed.
> Only the already-retained timeout support, Task 2A profile-integrity work, the
> 14-Skill behavior optimization/evaluation, and final use of the repository's
> existing backup/rollback scripts remain in scope. The checkboxes below are a
> historical snapshot, not a live task list.

> **Required execution:** use `subagent-driven-development` at meaningful R3
> boundaries, keep implementation writers serialized in this checkout, and use
> `verification-before-completion` before every commit or success claim.

**Goal:** Optimize all 14 managed Superzhao Skills for capable Codex models,
add content-bound execution/evaluation/install evidence, update the active local
profile with crash recovery, and publish the verified result to the detected,
authorized ref on the user's fork.

**Risk Level:** R3 — the result changes the default behavior-shaping profile and
is installed into the user's active Codex environment.

**Approved design artifact:**
`docs/superpowers/specs/2026-07-14-superzhao-adaptive-control-plane-v2-design.md`

**Design SHA-256:**
`9bc340d0bb7100bfee6f4d7040188a7a59441514587b06464915699c64d76331`

**Approval record:**
`docs/superpowers/approvals/2026-07-14-adaptive-control-plane-v2.json`

**Approval-record SHA-256:**
`7543b80f6731829ff8556d745d33bbc20b082af43da7caca83f43557fed7b7b6`

The approval record stores the finalized design SHA-256, the user's authorizing
instruction and allowed actions, and the fact that Codex transcribed the record;
it is an audit binding, not a cryptographic user signature.

**Base commit:** `e8e5a618d7f1bfa4b88ec298c8c500e2fda42295`

**Architecture:** Use R0–R3 only for safety consequences and an independent
work-shape classification for discovery/coordination/durability. Keep Skill
entrypoints contract-oriented and progressively disclose detailed recipes.
Generate command receipts and Skill profile manifests outside the model. Bind
behavior evaluations, installation, review, and publication to exact content.

**Runtime:** Markdown Skills, Bash 3.2-compatible orchestration, Node.js standard
library utilities and tests, Git, Codex CLI JSONL events. No third-party package
is added.

## Global Constraints

- Preserve the user's unrelated files, installed personal Skills, Git changes,
  branches, worktrees, and external state.
- Do not force-push, deploy, create an upstream PR, or destroy user-owned state.
- Ordinary push is authorized only to the detected fork remote/ref for the final
  reviewed scope and must be rechecked against the final HEAD at execution time.
- Do not edit a Skill before its baseline scenario is recorded.
- For each Skill: RED contract, minimal candidate, five valid important/control
  samples, manual inspection of failures and auto-hits, review, then commit.
- Invalid/timeout/auth/parse runs remain `indeterminate`; they are never retried
  invisibly or counted as passes.
- Every candidate important scenario and over-trigger control requires 5/5 valid
  passes; one valid failure rejects it. Collect more visible runs only to replace
  indeterminate samples, never to erase a failure.
- Each directness control declares forbidden artifacts/actions and requires zero
  in every candidate run. Candidate ceremony count cannot exceed its parent.
- For per-Skill attribution, compare the candidate commit with its immediate
  parent. Also compare the original base with the final integrated profile.
- A model report, string match, checkbox, child summary, or child-created receipt
  is never the only evidence for execution, verification, installation, or
  publication. The controller/harness observes and independently checks it.
- Keep one canonical managed-Skill list and one canonical profile digest
  algorithm. Install, rollback, preview, verifier, and evaluator consume it.
- Use `apply_patch` for repository edits and run format/lint checks on changed
  executable files.

## Durable Execution Record

Maintain the SDD workspace returned by:

```bash
skills/subagent-driven-development/scripts/sdd-workspace
```

The controller updates `.superpowers/sdd/progress.md` with task state, commit,
profile hash, receipts, review findings, and deviations. The directory is
self-ignored and is a derived working view, not repository truth.

---

### Task 1: Lock the Baseline and Repair the Test Launcher

**Files:**
- Create: `scripts/run-with-timeout.mjs`
- Create: `tests/codex-profile/test-run-with-timeout.mjs`
- Modify: `tests/claude-code/run-skill-tests.sh`
- Modify: `tests/claude-code/test-helpers.sh`
- Modify: `tests/claude-code/test-subagent-driven-development-integration.sh`
- Modify: `tests/explicit-skill-requests/run-test.sh`
- Modify: `tests/opencode/test-tools.sh`
- Modify: `tests/opencode/test-priority.sh`
- Create: `docs/superpowers/evals/2026-07-14-adaptive-control-plane-v2-baseline.md`

**Outputs:** portable timeout semantics and timestamped raw historical command
results. Canonical profile/receipt binding is added in Tasks 2–4; Task 1 must not
mislabel pre-tool logs as immutable receipts.

- [ ] Add Node standard-library timeout tests for exit-code preservation,
  timeout status `124`, stdout/stderr passthrough, argument boundaries, and
  termination of the child process group.
- [ ] Run the new test first and record RED because the helper does not exist.
- [ ] Implement `node scripts/run-with-timeout.mjs SECONDS -- COMMAND [ARG...]`.
- [ ] Replace every direct GNU `timeout` assumption in the listed test launchers.
- [ ] Re-run the three underlying Skill tests and distinguish external-model
  behavior failures from launcher failures.
- [ ] Record current commits, CLI versions, installed-tree equivalence, raw
  codex-profile/shell outputs, timestamps, and the exact commands in the
  historical baseline report. Task 4 will add canonical hashes and receipts.
- [ ] Review and commit this portability-only change before any Skill content.

**Verification:**

```bash
node --test tests/codex-profile/test-run-with-timeout.mjs
bash tests/claude-code/run-skill-tests.sh --timeout 120
bash tests/codex-profile/run-tests.sh
bash tests/shell-lint/test-lint-shell.sh
```

### Task 2: Add Canonical Profile Integrity and Install Preview

**Files:**
- Create: `config/codex-profile-skills.txt`
- Create: `scripts/profile-integrity.mjs`
- Create: `tests/codex-profile/test-profile-integrity.mjs`
- Create: `tests/codex-profile/test-install-preview.sh`
- Modify: `scripts/install-codex-profile.sh`
- Modify: `scripts/rollback-codex-profile.sh`
- Modify: `tests/codex-profile/test-install-rollback.sh`

**Interfaces:**

```text
node scripts/profile-integrity.mjs manifest --root DIR [--output FILE]
node scripts/profile-integrity.mjs compare --source DIR --target DIR [--output FILE]
node scripts/profile-integrity.mjs verify --root DIR --manifest FILE
bash scripts/install-codex-profile.sh --preview --plan-out FILE
bash scripts/install-codex-profile.sh --apply --plan FILE
```

- [ ] Write failing Node tests proving content, mode, empty-directory, extra,
  missing, unsupported-entry, and symlink changes alter or invalidate identity;
  unrelated personal Skills must not affect a managed profile digest.
- [ ] Write a failing shell test proving preview performs zero writes and apply
  rejects source, target, plan, path, or digest drift before mutation.
- [ ] Move the managed list to `config/codex-profile-skills.txt`; load it in Bash
  3.2 without `mapfile` and reject malformed/duplicate entries.
- [ ] Implement canonical path/type/mode/file-hash records and a root-independent
  aggregate SHA-256 with atomic JSON output.
- [ ] Add install-plan schema with source commit, dirty state, source/current
  profile hashes, per-Skill actions, canonical CODEX_HOME, and plan hash.
- [ ] Upgrade new backups to profile schema v3 while preserving rollback of v2;
  store source/installed/original profile hashes and the applied plan.
- [ ] Before the first managed-directory move, atomically publish a persistent
  recovery journal with the plan, backup, original inventory, and per-entry
  progress. On every invocation, recover or fail closed before starting new work.
- [ ] Test an uncatchable `SIGKILL` after a partial move in a temporary CODEX_HOME;
  the next invocation must discover the journal and restore or finish safely.
- [ ] Before publishing the backup pointer, rebuild the actual live managed tree
  and compare the full manifest, not only file checksums.
- [ ] Preserve no-argument one-shot installation for humans, but have it print
  and consume an in-memory-equivalent bound preview.

**Verification:**

```bash
node --test tests/codex-profile/test-profile-integrity.mjs
bash tests/codex-profile/test-install-preview.sh
bash tests/codex-profile/test-install-rollback.sh
```

### Task 3: Add Tool-Generated Action Receipts

**Files:**
- Create: `scripts/action-receipt.mjs`
- Create: `tests/codex-profile/test-action-receipt.mjs`
- Create: `skills/using-superpowers/references/evidence-contract.md`

**Interface:**

```text
node scripts/action-receipt.mjs \
  --output RECEIPT.json \
  --label CLAIM \
  [--profile-manifest PROFILE.json] \
  [--redact-arg INDEX] \
  -- COMMAND [ARG...]
```

- [ ] Write failing tests for non-sensitive argv fidelity, secret-argument
  rejection/redaction, preserved exit/signal, streamed
  output, stdout/stderr digests and byte counts, atomic completion, unique IDs,
  pre/post Git state, changed paths, dirty/untracked content drift, profile
  binding, and omission of environment values/raw secret output.
- [ ] Implement direct `spawn` without a shell. Reject or redact known credential
  flags, Authorization headers, and URL user-info without storing a reversible
  value or digest. Canonicalize the receipt body, hash it for the receipt ID, and
  rename the final JSON atomically.
- [ ] Compute workspace identity from HEAD plus sorted status and changed/untracked
  bytes; do not use `git write-tree` to pretend unstaged data is represented.
- [ ] Define claim/evidence scope, freshness, invalidation, and authorization
  bindings in `evidence-contract.md`. State explicitly that a receipt is not
  cryptographic attestation against a same-privilege writer.
- [ ] Route later verification, install, and publish evidence commands through
  this wrapper from the controller/harness. Never accept a child-created receipt
  as sole proof; re-run or verify via harness-observed events and current state.

**Verification:**

```bash
node --test tests/codex-profile/test-action-receipt.mjs
```

### Task 4: Build the Lightweight GPT-5.6 Behavior Harness and Run RED

**Files:**
- Create: `tests/skill-behavior/README.md`
- Create: `tests/skill-behavior/campaign.schema.json`
- Create: `tests/skill-behavior/run.schema.json`
- Create: `tests/skill-behavior/campaigns/adaptive-control-plane-v2.json`
- Create: `tests/skill-behavior/scenarios.json`
- Create: `tests/skill-behavior/run-campaign.mjs`
- Create: `tests/skill-behavior/score-run.mjs`
- Create: `tests/skill-behavior/test-harness.mjs`
- Create: `docs/superpowers/evals/2026-07-14-adaptive-control-plane-v2.md`

**Run contract:** preflight the requested target model. Each run uses a newly
created `0700` private root, isolated HOME/CODEX_HOME, a fresh fixture Git
repository, explicit target model `gpt-5.6-sol`, medium reasoning effort,
`--ephemeral`, JSONL output, workspace-write sandbox, and the CLI-supported
config override `-c approval_policy='"never"'`. The pinned model is an evaluation
variant, not Skill behavior. If unavailable, preserve the failed preflight and
do not claim GPT-5.6 evidence.

Copy only a symlink-checked regular `auth.json` to mode `0600`; keep it outside
fixtures/results/receipt traversal. Start a separate cleanup supervisor that
deletes it when the harness pipe closes, including after parent `SIGKILL`.
Success/error/handled-signal paths also delete it, and each harness startup first
sweeps stale marker-owned roots left by process-group or host failure. Do not
retain results until the credential path is absent. Never persist raw
environment values.

- [ ] Write deterministic harness tests with fake Codex events for success,
  nonzero exit, timeout, malformed/empty events, fixture drift, false text-only
  claims, deterministic failure precedence, anonymous/interleaved arms, and
  transcript/profile/fixture hashes.
- [ ] Define one important and one over-trigger control scenario for each of the
  14 Skills. Assertions use structured tool events and post-run filesystem/Git
  checks; text assertions are semantic evidence only, never sole execution proof.
- [ ] Implement isolated current/candidate/no-guidance profiles and verify each
  installed digest before starting Codex.
- [ ] Preserve every `pass`, `fail`, and `indeterminate` result. Summaries report
  raw counts, Wilson intervals, median duration/tool calls/tokens, and failure
  links; they do not use `pass@k` or a fabricated `p^k` metric.
- [ ] Run and freeze five valid samples for the global R0/R1/R2/R3 routing
  baseline against the original base profile. Raw transcripts remain private
  local artifacts referenced by digest.
- [ ] Before editing each later Skill, run its five-sample immediate-parent RED
  scenario. After its isolated candidate commit, run the corresponding GREEN;
  manually inspect all failures and every automatic match.

**Verification:**

```bash
node --test tests/skill-behavior/test-harness.mjs
node tests/skill-behavior/run-campaign.mjs \
  --campaign adaptive-control-plane-v2 \
  --arm baseline --model gpt-5.6-sol --repetitions 5
```

### Task 5: Optimize `using-superpowers` and Shared Routing

**Files:**
- Modify: `skills/using-superpowers/SKILL.md`
- Modify: `skills/using-superpowers/references/risk-levels.md`
- Create: `skills/using-superpowers/references/work-shapes.md`
- Create: `skills/using-superpowers/references/task-contract.md`
- Modify: `skills/using-superpowers/references/codex-tools.md`
- Modify: `tests/codex-profile/test-risk-routing-contract.sh`

- [ ] Add RED contracts for independent safety/work-shape routing, Task Contract,
  minimal announcements, capability detection, and execution-time authorization.
- [ ] Keep the startup entrypoint below 150 words. Move detail to references.
- [ ] Verify R0/R1 directness and R3 safety at five valid samples each; inspect
  false matches manually.
- [ ] Record baseline/candidate profile hashes and commit only after review.

### Task 6: Optimize `verification-before-completion`

**Files:**
- Modify: `skills/verification-before-completion/SKILL.md`
- Modify: `tests/codex-profile/test-risk-routing-contract.sh`

- [ ] Replace same-message freshness and repeated blanket execution with a
  claim/evidence map bound to unchanged inputs, scope, tree, and receipts.
- [ ] Preserve targeted R1, affected R2, complete R3, rollback, and remote proof.
- [ ] Pressure-test stale logs, fake child output, post-test drift, narrow tests
  supporting broad claims, and tool failure; require 5/5 safety samples.
- [ ] Review and commit independently.

### Task 7: Optimize `brainstorming`

**Files:**
- Modify: `skills/brainstorming/SKILL.md`
- Modify: `skills/brainstorming/spec-document-reviewer-prompt.md`

- [ ] Replace fixed question/option/section choreography with a design output
  contract: Task Contract, decisions, alternatives/tradeoffs, boundaries,
  failure handling, validation, and unresolved questions.
- [ ] Keep clear R1 out, allow concise ambiguous R2 design, and require a
  hash-bound approved R3 artifact before implementation.
- [ ] Test changed constraints invalidating approval and 5/5 R3 safety.
- [ ] Review and commit independently.

### Task 8: Optimize `writing-plans`

**Files:**
- Modify: `skills/writing-plans/SKILL.md`
- Modify: `skills/writing-plans/plan-document-reviewer-prompt.md`

- [ ] Define a living plan with Task Contract, source artifact/profile hashes,
  base SHA, dependency/output graph, owned scope, proof obligations, and drift
  rules. Checkboxes are derived views only.
- [ ] Keep exact code only for fragile interfaces/migrations/non-obvious commands;
  prevent plans for clear single-step R1/R2 work.
- [ ] Test symbol drift versus material intent/invariant drift at five samples.
- [ ] Review and commit independently.

### Task 9: Optimize `executing-plans`

**Files:**
- Modify: `skills/executing-plans/SKILL.md`

- [ ] Allow safe local adaptation and evidence-backed recovery while pausing for
  goal, scope, invariant, risk, or authorization drift.
- [ ] Bind execution to plan/profile/base hashes and write receipts/progress
  events rather than trusting completion checkboxes.
- [ ] Preserve R3 isolation, task-boundary review, whole-change review, rollback,
  and point-of-execution authorization.
- [ ] Test renamed symbols, tool fallback, scope expansion, and stale push auth.
- [ ] Review and commit independently.

### Task 10: Optimize `dispatching-parallel-agents`

**Files:**
- Modify: `skills/dispatching-parallel-agents/SKILL.md`

- [ ] Replace hard-coded team topology with detected capacity and a Context
  Capsule: capability, goal, inputs, invariants, owned paths, expected artifacts,
  evidence, authorization, and context inheritance.
- [ ] Permit concurrent read-only work and genuinely isolated/non-overlapping
  writers; serialize shared checkout/branch/path/external state.
- [ ] Test real overlap, dependent work, false success without receipt, and
  integration by the controller.
- [ ] Review and commit independently.

### Task 11: Optimize `subagent-driven-development`

**Files:**
- Modify: `skills/subagent-driven-development/SKILL.md`
- Modify: `skills/subagent-driven-development/implementer-prompt.md`
- Modify: `skills/subagent-driven-development/task-reviewer-prompt.md`
- Modify: `skills/subagent-driven-development/scripts/task-brief`
- Modify: `skills/subagent-driven-development/scripts/review-package`
- Modify: `tests/claude-code/test-sdd-workspace.sh`
- Modify: `tests/claude-code/test-subagent-driven-development.sh`

- [ ] Express implement/verify/review/integrate capabilities instead of a rigid
  actor sequence while preserving independent task and final R3 review.
- [ ] Bind Context Capsules, briefs, review packages, task outputs, and receipts
  to plan/profile/base/scope hashes; make the controller-written event ledger
  append-only by convention and the progress view rebuildable.
- [ ] Reject child self-report and child-created receipt files without direct
  controller/harness observation plus independent state verification.
- [ ] Test compaction/resume, stale brief, fabricated test output, changed user
  scope, isolated writers, and final whole-change coverage at 5/5 safety.
- [ ] Review and commit independently.

### Task 12: Optimize `systematic-debugging`

**Files:**
- Modify: `skills/systematic-debugging/SKILL.md`
- Retain and selectively link existing technique references under
  `skills/systematic-debugging/`

- [ ] Replace mandatory four-phase/attempt-count choreography with an evidence
  contract: symptom, reproduction/characterization, observations, hypotheses,
  discriminating check, root cause, fix proof.
- [ ] Preserve no-guessing, one-variable tests, boundary evidence for complex
  systems, and no unrelated refactor.
- [ ] Test obvious local root cause, cross-service flake, failed hypotheses, and
  no-reproduction diagnostics.
- [ ] Review and commit independently.

### Task 13: Optimize `test-driven-development`

**Files:**
- Modify: `skills/test-driven-development/SKILL.md`
- Modify: `skills/test-driven-development/testing-anti-patterns.md` only if a
  moved reference is necessary

- [ ] Require one meaningful proof for each new/changed observable contract, not
  one test for every function. Permit characterization/property/integration
  surfaces as appropriate.
- [ ] Bind observed RED and GREEN receipts to content state. A pre-existing pass
  or wrong-reason failure cannot authorize implementation.
- [ ] Preserve strict automated proof for security/data boundaries and document
  deterministic fallback only when no practical test surface exists.
- [ ] Test tests-later pressure, old logs, legacy behavior, docs/config control,
  and mock-self verification at 5/5 safety.
- [ ] Review and commit independently.

### Task 14: Optimize Both Code-Review Skills

**Files:**
- Modify: `skills/requesting-code-review/SKILL.md`
- Modify: `skills/requesting-code-review/code-reviewer.md`
- Modify: `skills/receiving-code-review/SKILL.md`

- [ ] First optimize `requesting-code-review`: create a review manifest bound to
  full BASE..HEAD, dirty tree, Task Contract/spec/profile hashes, changed paths,
  open questions, and verification receipts. Run and review its own five-sample
  scenario before touching the receiving Skill.
- [ ] Then optimize `receiving-code-review`: use a finding decision record
  `claim/evidence/applicability/decision/action/verification`; only dependent
  work pauses for an unrelated unclear finding; remove tone policing.
- [ ] Preserve reviewer independence, full-scope review, evidence-backed
  disagreement, and re-review of material fixes.
- [ ] Commit each Skill separately after its own RED/GREEN/review gate.

### Task 15: Optimize `using-git-worktrees`

**Files:**
- Modify: `skills/using-git-worktrees/SKILL.md`
- Modify: `tests/claude-code/test-worktree-path-policy.sh`

- [ ] Record owner, base SHA, path, branch, planned scope, and isolation mechanism.
- [ ] Detect existing/native isolation and use a safe default when authorization
  already covers creation; require user input only for material choices.
- [ ] Preview dependency setup and avoid automatic network installation; select
  baseline verification by risk and affected surface.
- [ ] Preserve mandatory isolation for R3, overlapping dirty changes, parallel
  writers, and long-running work; never remove harness/user-owned worktrees.
- [ ] Test linked-worktree reuse, R1 control, dirty overlap, no-lockfile setup,
  and native-tool preference.
- [ ] Review and commit independently.

### Task 16: Optimize `finishing-a-development-branch`

**Files:**
- Modify: `skills/finishing-a-development-branch/SKILL.md`

- [ ] Replace the fixed menu/process with a detected state-by-requested-action
  contract. Ask for a menu only when the user has not named the action.
- [ ] Bind merge/push/PR/discard authorization and evidence to target, remote,
  branch/ref, HEAD, workspace/profile hash, scope, authorizer, and time.
- [ ] Preserve no-force-push, push/PR separation, remote-ref verification,
  clean-current-content proof, and ownership-safe cleanup.
- [ ] Test stale authorization, post-test drift, detached conflict, unknown
  ownership, explicit push-only, and dirty task-owned discard.
- [ ] Review and commit independently.

### Task 17: Optimize `writing-skills`

**Files:**
- Modify: `skills/writing-skills/SKILL.md`
- Create: `skills/writing-skills/references/authoring-contract.md`
- Create: `skills/writing-skills/references/behavior-evaluation.md`
- Modify existing references only to remove duplication or incorrect statistics.

- [ ] Keep the entrypoint focused on authoring/evaluation gates and progressively
  disclose detailed guidance. Remove its contradiction with its own token target.
- [ ] Define new-Skill no-guidance control versus existing-Skill current/candidate
  comparison, hash/provenance recording, 5+ valid samples, manual inspection,
  absolute 5/5 candidate gates, and one crash-recoverable profile deployment.
- [ ] Remove automatic push from deployment; require current action-specific
  authorization. Allow a related profile migration to finish per-Skill evidence
  before one crash-recoverable install; publication is a separate authorized
  action after install and verification.
- [ ] Test deadline/batch pressure, N=1 claims, current version already passing,
  R3 regression, and unauthorized publish.
- [ ] Review and commit independently.

### Task 18: Integrated Candidate Evaluation and Whole-Change Review

**Files:**
- Update: `docs/superpowers/evals/2026-07-14-adaptive-control-plane-v2.md`
- Update: `docs/superpowers/plans/2026-07-14-superzhao-adaptive-control-plane-v2.md`

- [ ] Run the final candidate arm for every important/control scenario with five
  valid samples and zero forbidden directness actions. Preserve all
  indeterminate runs; never rerun away a valid failure.
- [ ] Compare each Skill commit with its immediate parent for attribution, then
  compare the original base profile with the final integrated profile for
  interactions.
- [ ] Manually inspect every failure, automatic hit, and baseline/candidate
  disagreement; link transcript digests and receipts in the report.
- [ ] Run structural/frontmatter/link/tool-name/word-count checks and compare all
  14 Skill entrypoints with base.
- [ ] Dispatch an independent whole-change reviewer with the approved design,
  BASE/HEAD, profile manifest, behavior report, receipts, and known limitations.
- [ ] Resolve every Critical/Important finding and re-run invalidated evidence.

**Verification:**

```bash
node --test tests/codex-profile/*.mjs tests/skill-behavior/test-harness.mjs
bash tests/codex-profile/run-tests.sh
bash tests/shell-lint/test-lint-shell.sh
git diff --check
```

If `claude` is available, run
`bash tests/claude-code/run-skill-tests.sh --timeout 120` as a compatibility
diagnostic. It is not the GPT-5.6 acceptance gate and any semantic mismatch must
be reported rather than silently ignored.

### Task 19: Rehearse, Install, Verify, Commit, and Publish

**Files:**
- Update: `docs/superpowers/evals/2026-07-14-adaptive-control-plane-v2.md`
- Update: `README.md` only if the verified install/evidence interface would
  otherwise be undocumented or the current description becomes false

- [ ] In a temporary CODEX_HOME, run preview → apply → full manifest verify →
  mutate a managed file → detect drift → rollback → verify restored profile.
- [ ] Inspect the complete diff and confirm it remains within the user's approved
  Superzhao optimization/local-install/publish scope.
- [ ] Recompute the final profile manifest and recheck point-of-execution install
  authorization. Preview the real `~/.codex` target and record its plan hash.
- [ ] Apply the bound plan with its persistent recovery journal; verify all
  managed files, modes, directories, profile hash, backup metadata, cleared
  journal, and preservation of personal Skills.
- [ ] Run a fresh installed-profile smoke task; record that a new Codex task is
  required for this current session to rediscover Skills.
- [ ] Commit final evidence, merge the isolated branch into local `main` only
  after merged-result tests pass, and retain the worktree until remote proof.
- [ ] Detect the fork remote, integration branch, destination ref, and remote URL;
  bind them with final HEAD/scope to the existing authorization. Push without
  force through a controller-observed ActionReceipt.
- [ ] Assert the detected remote ref SHA equals the local pushed SHA. Only then
  clean task-owned isolation and mark the goal complete.

**Final proof commands:**

```bash
test -z "$(git status --porcelain=v1)"
node scripts/profile-integrity.mjs manifest --root skills --output /tmp/final-profile.json
node scripts/profile-integrity.mjs verify --root "$HOME/.codex/skills" --manifest /tmp/final-profile.json
LOCAL_SHA="$(git rev-parse HEAD)"
APPROVAL_FILE="docs/superpowers/approvals/2026-07-14-adaptive-control-plane-v2.json"
AUTHORIZED_REMOTE_URL="$(node -e 'const x=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(x.authorized_publish_target.repository_url)' "$APPROVAL_FILE")"
AUTHORIZED_REF="$(node -e 'const x=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(x.authorized_publish_target.destination_ref)' "$APPROVAL_FILE")"
PUBLISH_REMOTE="$(git remote | while IFS= read -r candidate; do
  test "$(git remote get-url --push "$candidate")" = "$AUTHORIZED_REMOTE_URL" && {
    printf '%s\n' "$candidate"
    break
  }
done)"
test -n "$PUBLISH_REMOTE"
test "$(git remote get-url --push "$PUBLISH_REMOTE")" = "$AUTHORIZED_REMOTE_URL"
REMOTE_SHA="$(git ls-remote --exit-code "$PUBLISH_REMOTE" "$AUTHORIZED_REF" | awk 'NR == 1 { print $1 }')"
test "$LOCAL_SHA" = "$REMOTE_SHA"
```

## Stop Conditions

Stop and request direction only when the change would expand beyond this approved
design, require production/private-system access, require destructive cleanup of
user-owned state, reveal or move credentials outside private temporary storage,
or require force-push/upstream publication. Test or tool failures are not stop
conditions until safe diagnostics and alternatives are exhausted.
