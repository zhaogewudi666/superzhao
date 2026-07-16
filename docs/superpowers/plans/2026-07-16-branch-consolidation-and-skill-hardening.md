# Branch Consolidation and Skill Hardening Implementation Plan

> **For agentic workers:** Follow the risk-specific execution route recorded in the Risk Level field below. R2 defaults to direct execution with one final review for material logic. R3 defaults to superpowers:subagent-driven-development when subagents are available; otherwise use superpowers:executing-plans with the complete R3 gates. Task checkboxes are a tracking view, never completion evidence.

**Goal:** Consolidate every relevant local branch into one verified local `main` candidate and complete the already approved evidence-driven Skill improvements without changing or publishing live state.

**Architecture:** Keep the in-progress Skill Lab v3 work isolated on `codex/skill-lab-v3-task2`, integrate Claude's validation commits on `codex/branch-consolidation`, and merge only reviewed task commits into the consolidation branch. Reuse the approved production-plugin design and implementation plan for Skill behavior, packaging, and evaluation; do not bulk-merge cached upstream topic refs or rewrite the accepted 14-Skill profile without evidence.

**Tech Stack:** Git worktrees; Node.js 22 standard library and `node:test`; POSIX shell; Codex app-server structured Skill inputs; Markdown, JSON, and JSON Schema.

**Risk Level:** R3 — the coordinated work includes a security/integrity-sensitive offline verifier, behavior-shaping optional Skills, distribution contracts, and a final multi-branch integration.

**Source requirements:** user request `2026-07-16-branch-consolidation-and-skill-hardening` — content digest `a21060b325d2b4705d5ef84440af29cb595af93a6ae97fbd23e8f7d832d8e561`; approved design `docs/superpowers/specs/2026-07-15-production-plugins-release-design.md` — content digest `f765f181d7ea43180cdddf4a573f1af2f3a6303248a127e3c92fa90310fbadaf`; base state local `main` `f92a04efb294e8726219d6a17ff075a0729c1b08`, Claude tip `5f2703b7fc6aa8b74a1027a58d3c5fd3ada8d63f`, managed profile digest `08c8aebdfc41a67fdca7b023c614ef42a91173c9d7f03455691629f02fa7fa55`.

**Owned scope:** `codex/branch-consolidation`; `codex/skill-lab-v3-task2`; the unique Claude commits; Tasks 2–5 of `docs/superpowers/plans/2026-07-15-production-plugins-release.md`; aggregate deterministic runner/docs contracts; task review evidence. Excluded: cached `upstream/*` topic branches, already-merged `codex/adaptive-control-plane-v2`, live `/Users/liuxianzhao/.codex` mutation, fetch/push/PR/tag/release, marketplace publication, force operations, and deletion of unrelated branches/worktrees.

## Global Constraints

- Preserve the seven existing Skill Lab Task 2 working-tree paths as one owned unit until they reach the approved Task 2 commit boundary.
- Only one writer may use each mutable worktree. Reviewers and auditors are read-only.
- Integrate Claude by history merge, never by replacing `main` with the Claude tip; the Claude branch predates four `main` Skill Lab commits.
- `codex/adaptive-control-plane-v2` is already an ancestor of `main` and must not be merged again.
- Treat the 77 cached upstream topic refs as upstream research, not fork integration candidates.
- The accepted core profile remains unchanged until the approved Task 4 authoring-reference replacement; any other `skills/**` behavior change requires a separate current-versus-candidate contract and fresh evidence.
- Use `/Users/liuxianzhao/.nvm/versions/node/v22.22.2/bin/node` for Skill Lab commands; the default Node 18 runtime is unsupported.
- Never claim a long-running test is passing until it exits successfully. Record per-suite duration or timeout evidence when silence could be mistaken for a hang.
- Do not mutate the live Codex profile, publish, or push. Stop after a clean, reviewed local integration candidate and present the action-specific handoff.

---

### Task 1: Integrate and repair the Claude validation branch

**Status:** in progress

**Depends on:** clean `codex/branch-consolidation` at `f92a04e`; clean Claude worktree at `5f2703b`; branch topology audit.

**Produces:** Claude's four unique patch commits integrated without losing `main`; aggregate runner truthfully executes or names every deterministic suite; exact Node 22 verification and independent review.

**Files:**
- Merge: `claude/superpower-skills-optimize-2c6d86`
- Modify: `tests/run-all.sh`
- Modify: `docs/testing.md`
- Modify: `tests/docs/test-testing-guide.sh`

**Interfaces:**
- Consumes: Claude commits `3b5db0a`, `f6bfbd2`, `a299882`, `5f2703b` and current `main` tree.
- Produces: `bash tests/run-all.sh` as the exhaustive documented deterministic entry point, including `tests/hooks/test-session-start.sh` or an explicit documented exclusion.

- [ ] **Merge the exact Claude tip and close the remaining runner gap**

  1. Merge `5f2703b7fc6aa8b74a1027a58d3c5fd3ada8d63f` into `codex/branch-consolidation` with a merge commit; verify the changed-path set and `git diff --check`.
  2. Add a failing docs/runner contract proving `tests/hooks/test-session-start.sh` is executed or explicitly excluded. Run `bash tests/docs/test-testing-guide.sh` and confirm RED because the suite is currently silent.
  3. Add the hook suite as a required runner entry and document it in the per-area table. Run the focused hook and docs tests to GREEN.
  4. Run the exact aggregate command with Node 22 in `PATH`; record every declared skip and require exit `0`.
  5. Obtain independent whole-branch review against `f92a04e`; resolve and re-review every Critical or Important finding.

**Commit boundary:** The Claude history merge plus one coherent follow-up commit `test: make deterministic runner exhaustive`.

**Completion evidence:** not run

**Execution updates:** none

### Task 2: Finish Skill Lab production Task 2

**Status:** in progress

**Depends on:** isolated `codex/skill-lab-v3-task2` at base `f92a04e`; approved production design; existing seven-path gate/stage slice; Task 1 may proceed independently in another worktree.

**Produces:** The exact complete output of Task 2 in `docs/superpowers/plans/2026-07-15-production-plugins-release.md`: v3-only apply/gate/stage, trusted offline verifier, legacy-v2 structural inspection, production Skill/reference/manifest, and bound installed-tree behavior evidence.

**Files:**
- Modify/create/delete exactly the Task 2 paths listed in `docs/superpowers/plans/2026-07-15-production-plugins-release.md:91`
- Preserve together: the current seven modified/untracked gate/stage paths

**Interfaces:**
- Consumes: Task 1 v3 schemas/primitives and the authentic v2 fixture.
- Produces: `verify-bundle --bundle DIR`, `verify-bundle --bundle DIR --legacy-v2`, v3-only production commands, canonical reports, exit contract `0/2/3/4/5/6/7`, explicit-only plugin `1.0.0`.

- [ ] **Complete the missing offline-verification and production boundary**

  1. Preserve the current passing gate behavior. Run gate and stage files separately with Node 22 so the approximately 30-second first stage case is not misclassified as a hang.
  2. Add RED verifier tests for moved bundle, missing/extra/symlink/drifted files, forged reports, producer tamper/non-execution, 96 MiB limit, v2 structural-only verification, and v2 rejection by production apply/gate/stage.
  3. Implement trusted current-code recomputation and legacy structural verification; remove every temporary v2 production bridge. Run focused verifier/legacy tests to GREEN.
  4. Port the remaining valuable monolithic regressions, then run all `tests/skill-lab/*.test.mjs` with Node 22 and require exit `0`.
  5. Add static RED contracts, productionize `optimize-agent-skill` and its reference/manifest, add `.skill-lab/` ignore, run validators, and complete the exact installed-tree five-positive/three-negative campaign from the approved plan.
  6. Freeze the accepted bytes, update provenance/eval records, independently review the exact Task 2 diff, and commit only after all blocking findings are closed.

**Commit boundary:** `feat(skill-lab): ship production v3 evidence gate` only when the complete evaluated Task 2 boundary is satisfied.

**Completion evidence:** not run

**Execution updates:** Existing gate assertions passed through 52 reported top-level cases before an intentionally interrupted combined run; an isolated first stage case passed in approximately 30.1 seconds, proving slow execution rather than a deadlock. Full exact evidence remains pending.

### Task 3: Complete evidence-driven optional Skill improvements and release-local cleanup

**Status:** pending

**Depends on:** verified Task 2 commit; approved Tasks 3 and 4 in the production plan.

**Produces:** Evaluated `domain-modeling` `1.0.0`; licensing-safe `writing-skills` authoring reference; exact marketplace/version/README/license/CI contracts; no speculative core-profile rewrite.

**Files:**
- Modify/create/delete exactly the Task 3 and Task 4 paths in `docs/superpowers/plans/2026-07-15-production-plugins-release.md:150` and `:194`

**Interfaces:**
- Consumes: Task 2 installed-Skill campaign runner; frozen current/candidate scenarios; approved release matrix.
- Produces: evidence/status/owner-bound domain modeling with direct-R1 control; independently authored `authoring-conventions.md`; root `6.2.0`; optional plugins `1.0.0`.

- [ ] **Execute approved Tasks 3 and 4 without broadening core behavior**

  1. Run domain-modeling static RED, apply the minimum candidate wording, and collect the exact 20 valid installed-tree current/candidate samples with invalid attempts retained.
  2. Freeze accepted optional Skill bytes and complete independent review before release metadata work.
  3. Run Task 4 release RED contracts, replace the unlicensed Anthropic copy with independently authored guidance, and implement the exact approved distribution/README/license/CI changes.
  4. Verify Task 4 and independently review it. Any change to frozen optional Skill bytes invalidates its campaign and must repeat it.

**Commit boundary:** Preserve the approved commits `feat(engineering): ship production domain modeling` and `docs(release): finalize Superzhao production distribution`.

**Completion evidence:** not run

**Execution updates:** none

### Task 4: Integrate, verify, and prepare local main

**Status:** pending

**Depends on:** Tasks 1–3 committed, clean, independently reviewed, and unchanged since their evidence.

**Produces:** one clean local integration candidate containing every relevant local commit and all approved Skill improvements, with no external side effect.

**Files:**
- Merge task branches into: `codex/branch-consolidation`
- Update completion evidence in this plan and the approved production plan

**Interfaces:**
- Consumes: reviewed task HEADs and content-bound behavior/deterministic evidence.
- Produces: exact final local SHA, profile/optional-plugin digests, complete test/review evidence, and a safe handoff for later main/live/push authorization.

- [ ] **Perform final integration and verification**

  1. Merge the verified Skill Lab, domain-modeling, and release task commits into `codex/branch-consolidation`; require no unreviewed dirty content.
  2. Run the complete Task 5 matrix from the approved production plan with Node 22, including aggregate deterministic tests, isolated installs, validators, package checks, profile integrity, behavior bindings, and `git diff --check`.
  3. Generate one exact merge-base-to-HEAD review package and obtain an independent whole-change review. Fix and re-review all blocking findings, then rerun affected evidence.
  4. Present the full diff, final SHA, branch/worktree state, test/review results, and remaining authorization gates. Do not update local `main`, the live profile, or any remote until the corresponding action is explicitly authorized against this exact state.

**Commit boundary:** Only verified review fixes or evidence updates; otherwise no synthetic final commit.

**Completion evidence:** not run

**Execution updates:** none
