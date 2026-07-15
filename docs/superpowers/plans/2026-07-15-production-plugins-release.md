# Superzhao Production Plugins Release Implementation Plan

> **For agentic workers:** Follow the risk-specific execution route recorded in the Risk Level field below. R2 defaults to direct execution with one final review for material logic. R3 defaults to superpowers:subagent-driven-development when subagents are available; otherwise use superpowers:executing-plans with the complete R3 gates. Task checkboxes are a tracking view, never completion evidence.

**Goal:** Ship both optional plugins as evidence-backed, explicit-only production plugins; replace the repository README and unsafe/unlicensed documentation; repair distribution metadata and licensing; then, through the design's separate execution-time authorization gates, synchronize the managed profile, publish non-force to `origin/main`, and install the optional plugins into the canonical live Codex profile.

**Architecture:** Keep the root 14-Skill compatibility distribution and both optional plugins separate. Skill Lab remains a single zero-dependency Node CLI whose v3 schemas, two-phase decision engine, staged bundle, and trusted verifier are deterministic; domain-modeling remains an instruction-only explicit Skill evaluated through structured Codex app-server Skill inputs. Repository release metadata, packaging, README, licensing, and CI are finalized only after the optional-plugin bytes and behavior evidence are frozen.

**Tech Stack:** Node.js standard library and `node:test`; POSIX shell; Codex CLI/app-server 0.144.x plugin and Skill protocols; JSON Schema 2020-12 documents with zero runtime schema dependency; Markdown/YAML/JSON; GitHub Actions.

**Risk Level:** R3 — the work changes behavior-shaping Skills, a security/integrity-sensitive evidence gate, installed-plugin distribution contracts, licensing, and the public repository entry point.

**Source requirements:** `docs/superpowers/specs/2026-07-15-production-plugins-release-design.md` — content digest `f765f181d7ea43180cdddf4a573f1af2f3a6303248a127e3c92fa90310fbadaf`; base commit `ec33d0833b6381eff2058dfea477e5747bcbf6e1`.

**Owned scope:** The approved design/spec, this plan, both `plugins/superzhao-*` trees, affected optional-plugin/Skill-Lab/release/package/profile/docs tests, root Codex marketplace/manifest/package/version/license/notice/README files, the `writing-skills` authoring reference, `scripts/package-codex-plugin.sh`, `.gitignore`, `.github/workflows/optional-plugins.yml`, and—only after their exact point-of-execution approvals—the canonical live-profile synchronization, direct non-force `origin/main` publication, post-push CI observation, and live optional-plugin installation defined in Tasks 6–8. Excluded: force push, PR/tag/release creation, unrelated worktrees/branches, upstream publication, and rebranding inherited non-Codex metadata beyond the exact root version fields.

## Global Constraints

- Work only in `/Users/liuxianzhao/Documents/myProject/superzhao` on `main`; the owner explicitly approved this exact main-only R3 isolation waiver. Serialize writers and never touch the existing `claude/superpower-skills-optimize-2c6d86` or `codex/adaptive-control-plane-v2` worktrees.
- The implementation phase may create local commits and isolated temporary `CODEX_HOME` rehearsals. It may not mutate `/Users/liuxianzhao/.codex`, push, force-push, open a PR, publish a tag/release, or install a live plugin without the later point-of-execution approvals in the design.
- After each Task 1–4 commit, before any dependent task begins, the controller independently verifies the exact HEAD, generates the bound base/head review package, resolves and re-reviews every Critical, Important, or required spec gap, records the result in `.superpowers/sdd/progress.md`, and marks the task verified. Task review is never deferred to Task 5.
- Root distribution version is exactly `6.2.0`; `superzhao-skill-lab` and `superzhao-engineering` are exactly `1.0.0`. Root version paths remain the exact `.version-bump.json` set; optional versions stay independent.
- Root plugin technical ID remains `superpowers` and root `.codex-plugin/plugin.json` retains exactly `"hooks": {}`. Optional manifests omit `hooks`, remain explicit-only, and use `Interactive`/`Read`/`Write` capability names only where true.
- The repository marketplace is exactly `superzhao` / `Superzhao`, ordered `superpowers`, `superzhao-skill-lab`, `superzhao-engineering`, with repository-local `source: "local"`, exact paths from the design, `AVAILABLE`, `ON_INSTALL`, and `Developer Tools`.
- Optional plugins are never installed by the managed 14-Skill profile and never enable implicit invocation in this release.
- Skill Lab supports Node.js 20 and 22 on macOS/Linux, rejects unsupported runtime/filesystem preflight with exit `7`, adds no npm dependency or lockfile, imports only `node:*`, and does not claim Windows support.
- Skill Lab production `apply`, `gate`, and `stage` accept v3 only. Legacy v2 is integrity-inspectable only through `verify-bundle --legacy-v2` with status `legacy-structural-only`; it can never emit selection/final acceptance.
- Skill Lab uses exits `0` success, `2` usage/schema, `3` unsafe path/integrity, `4` selection rejection, `5` held-out rejection, `6` output/publication conflict, and `7` unsupported preflight. Reports are canonical compact recursively sorted JSON plus one newline.
- Every Skill Lab read input is capped at 8 MiB; the exact enumerated unique non-Skill artifacts are capped at 64 MiB; every staged regular file including both Skills and the manifest is capped at 96 MiB; campaigns have at most 1,000 rows and `required_valid` 5–20.
- Domain-modeling preserves Known/Inferred/Open, persistence/authorization boundaries, explicit-only selection, and the direct fixed-semantics R1 route. It adds evidence/source/status/decision-owner bindings and routes settled consequential design/R3 work to `brainstorming` without reopening settled semantics absent contradictory evidence.
- Behavior evaluation uses structured Codex app-server `turn/start` Skill inputs from isolated installed snapshots. A typed name without the structured Skill item is invalid; every counted run binds the actual Skill/reference/manifest bytes and retains reference-read evidence.
- README is completely replaced with Chinese-first Superzhao content and no upstream recruiting, sales, upstream install, `dev` governance, obsolete experimental claim, public enforcement email, or formal private reporting claim.
- MIT remains the project license. Root `LICENSE` retains Jesse Vincent 2025 plus Superzhao contributors 2026; optional plugin licenses name Superzhao contributors 2026; complete pinned upstream/Microsoft/Matt licenses and provenance remain in the correct notice files.
- Delete tracked `CODE_OF_CONDUCT.md` and the copied `skills/writing-skills/anthropic-best-practices.md`; replace the latter with independently written `authoring-conventions.md`, update its only active Skill link, and preserve historical references in old release notes/specs.
- The bundled plugin validator is authoritative for both optional manifests. For the root manifest, its current rejection of `hooks: {}` is a documented tooling mismatch; repository-specific manifest/package tests are authoritative because removing the empty guard would re-enable unintended Claude-hook discovery.
- No candidate Skill/reference/optional-manifest bytes may change after their behavior campaign passes. Any such change invalidates the evidence and requires a fresh campaign.

---

### Task 1: Skill Lab v3 schema, runtime, doctor, and apply foundation

**Status:** pending

**Depends on:** Approved design at the bound digest; baseline 35/35 Skill Lab tests on Node 22; existing `skill-lab.mjs` and no-replace/hard-link behavior.

**Produces:** Normative v3 schemas/examples; deterministic runtime/path/resource primitives; `doctor`; portable frontmatter handling; v3 patch/provenance application; an authentic immutable v2 fixture; all existing v2 behavior still available only as a temporary internal compatibility bridge until Task 2.

**Files:**
- Modify: `plugins/superzhao-skill-lab/scripts/skill-lab.mjs`
- Create: `plugins/superzhao-skill-lab/schemas/v3/patch.schema.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/cases.schema.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/samples.schema.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/actor-run.schema.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/scorer-record.schema.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/apply-report.schema.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/gate-report.schema.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/bundle-manifest.schema.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/examples/patch.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/examples/cases.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/examples/samples.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/examples/actor-run.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/examples/scorer-record.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/examples/apply-report.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/examples/gate-report.json`
- Create: `plugins/superzhao-skill-lab/schemas/v3/examples/bundle-manifest.json`
- Create: `tests/skill-lab/helpers.mjs`
- Create: `tests/skill-lab/contract-schemas.test.mjs`
- Create: `tests/skill-lab/apply-v3.test.mjs`
- Create: `tests/skill-lab/doctor.test.mjs`
- Create: `tests/skill-lab/fixtures/v2-bundle-valid/**`
- Modify: `tests/skill-lab/skill-lab.test.mjs` only to share helpers or preserve the old baseline while the temporary bridge exists

**Interfaces:**
- Consumes: current CLI option shapes and source/patch byte semantics.
- Produces: `doctor --workspace-root ROOT --output-parent DIR`; v3 `apply --workspace-root --source --edits --candidate --report`; schema strings named in the design; shared `ArtifactStore`/validation/canonical-report primitives used by Task 2.

- [ ] **Freeze v2 history, then deliver deterministic v3 apply/preflight behavior**

  1. Before production edits, generate and checksum one successful current-v2 staged bundle under `tests/skill-lab/fixtures/v2-bundle-valid/`; remove any nondeterministic workspace paths while preserving authentic v2 manifest/file/hash relations.
  2. Add schema/apply/doctor tests first. Require unknown-key rejection, exact enums and cross-reference shape, block-scalar/additional-frontmatter-key acceptance without header byte changes, provenance/support-count validation, v2 diagnostic behavior reserved for Task 2, runtime/platform checks, hard-link/same-device probes, all exit classes, 8/64 MiB accounting, and no output on preflight failure.
  3. Run `/Users/liuxianzhao/.nvm/versions/node/v22.22.2/bin/node --test tests/skill-lab/contract-schemas.test.mjs tests/skill-lab/apply-v3.test.mjs tests/skill-lab/doctor.test.mjs`; confirm RED because v3 schemas/commands are absent and current frontmatter rejects block scalars/additional keys.
  4. Implement `EXIT_CODES`, schema constants, limits, `CliError` exit/status data, canonical compact JSON, `ArtifactStore`, pinned frontmatter scanner, v3 patch/provenance validation, v3 apply report, `validateRuntime`, private cleaned probe directory, and hard-link/same-device doctor checks. Preserve current four-operation caps, immutable-source targeting, no-replace publication, rollback ownership, and race behavior.
  5. Run the targeted command and the original `/Users/liuxianzhao/.nvm/versions/node/v22.22.2/bin/node --test tests/skill-lab/skill-lab.test.mjs`; require GREEN with pristine output. Validate every schema/example pair deterministically without adding a runtime JSON-schema package.

**Commit boundary:** Commit the verified v3 foundation as `feat(skill-lab): add v3 apply foundation`.

**Completion evidence:** not run

**Execution updates:** The temporary v2 command bridge is permitted only in this intermediate commit so the pre-existing gate/stage suite remains reviewable; Task 2 removes it before any release evidence or marketplace exposure.

### Task 2: Skill Lab two-phase gate, staged bundle, offline verifier, and production Skill

**Status:** pending

**Depends on:** Task 1 schemas/primitives and authentic v2 fixture.

**Produces:** Complete v3-only production CLI; actor/scorer-bound selection/final gates; final-accept-only stage; portable manifest trust anchor; offline v3 verifier; legacy v2 integrity inspection; production Skill/reference/manifest; 5 positive and 3 negative installed-tree behavior records.

**Files:**
- Modify: `plugins/superzhao-skill-lab/scripts/skill-lab.mjs`
- Modify: `plugins/superzhao-skill-lab/skills/optimize-agent-skill/SKILL.md`
- Replace: `plugins/superzhao-skill-lab/skills/optimize-agent-skill/references/campaign-format.md`
- Modify: `plugins/superzhao-skill-lab/.codex-plugin/plugin.json`
- Preserve: `plugins/superzhao-skill-lab/skills/optimize-agent-skill/agents/openai.yaml` with `allow_implicit_invocation: false`
- Modify after behavior acceptance: `plugins/superzhao-skill-lab/PROVENANCE.md`
- Modify: `.gitignore`
- Create: `tests/skill-lab/gate-v3.test.mjs`
- Create: `tests/skill-lab/stage-verify-v3.test.mjs`
- Create: `tests/skill-lab/legacy-v2.test.mjs`
- Create: `tests/skill-lab/golden/v3/**`
- Delete after every named regression is ported: `tests/skill-lab/skill-lab.test.mjs`
- Modify: `tests/optional-plugins/test-skill-lab-skill.sh`
- Create: `tests/optional-plugins/codex-skill-campaign.mjs`
- Create: `docs/superpowers/evals/2026-07-15-skill-lab-production-v1-scenarios.md`
- Create after sampling: `docs/superpowers/evals/2026-07-15-skill-lab-production-v1-results.md`

**Interfaces:**
- Consumes: Task 1 schema/primitives and current `gate`/`stage` option names.
- Produces: v3 `gate`, `stage`, `verify-bundle --bundle DIR`, `verify-bundle --bundle DIR --legacy-v2`; gate report statuses `selection_pass|selection_reject` and `not_evaluated|final_reject|final_accept`; printed manifest SHA-256.

- [ ] **Implement evidence-bound selection and final acceptance**

  1. Add RED tests for exact per-case/arm valid counts, invalid/indeterminate cap, case/profile parity, global run/actor/transcript/scorer uniqueness, actor/scorer cross-reference swaps, train non-influence, repeated stable failure improvement, important/control regression, and the known candidate held-out failure.
  2. Run `/Users/liuxianzhao/.nvm/versions/node/v22.22.2/bin/node --test tests/skill-lab/gate-v3.test.mjs`; confirm RED because current gate ignores test rows and accepts opaque evidence.
  3. Implement actor-run/scorer-record validation, `evaluateSelection`, and `evaluateFinal`. Validate the full ledger first; use exit `4` for selection rejection and `5` for final held-out rejection; emit `final_accept` only when both phases pass.
  4. Run the focused gate suite and require GREEN.

- [ ] **Implement final-only staging and trusted offline verification**

  1. Add RED tests for final-accept-only staging, proposal/prior-rejection packaging, producer metadata, manifest-last/no-self-hash behavior, 96 MiB accounting, moved-bundle verification, missing/extra/symlink/drift/forged-report rejection, producer-script tamper, and proof that verifier never imports/spawns/executes bundled producer code.
  2. Add RED legacy tests proving v3 production commands reject v2 with exit `2`, `verify-bundle --legacy-v2` checks only path/file/hash integrity, returns `legacy-structural-only`, and never emits acceptance.
  3. Run `/Users/liuxianzhao/.nvm/versions/node/v22.22.2/bin/node --test tests/skill-lab/stage-verify-v3.test.mjs tests/skill-lab/legacy-v2.test.mjs`; confirm expected missing-command/old-semantics failures.
  4. Implement bundle planning/publication, manifest trust-anchor output, trusted current-code recomputation, v2 integrity inspection, all tamper/containment checks, and exits `2/3/6` as specified. Remove the Task 1 temporary v2 command bridge.
  5. Port every valuable original immutable-header, byte-budget, containment, no-replace, rollback, manifest-last, concurrency, and cache-like-path regression into the new complete suite; do not drop coverage merely because the monolith is retired.
  6. Run `/Users/liuxianzhao/.nvm/versions/node/v22.22.2/bin/node --test tests/skill-lab/*.test.mjs` and require GREEN.

- [ ] **Finalize production instructions and behavior evidence**

  1. Add static assertions first to `tests/optional-plugins/test-skill-lab-skill.sh` for v3 schema, doctor, both phases, final-only stage, verifier, limits/exits, legacy boundary, sensitive evidence, explicit-only policy, and exact `1.0.0` production metadata; run it and confirm RED on experimental/v2 prose.
  2. Rewrite `SKILL.md` and `campaign-format.md` around the production v3 contract; set the optional manifest to exact `1.0.0` with repository/license/URLs, production descriptions, capabilities `Interactive`, `Read`, `Write`, and no `hooks`; add `.skill-lab/` to `.gitignore`; run static and plugin/Skill validators to GREEN.
  3. Create the shared `tests/optional-plugins/codex-skill-campaign.mjs` runner. In isolated temporary `CODEX_HOME` roots, it installs immutable local snapshots, uses Codex app-server `skills/list` plus structured `turn/start` Skill input, validates Skill/reference load evidence, hashes every bound artifact, and stores raw exports only under git-ignored `.skill-lab/evals/production-v1/`. Retain five positive fresh tasks covering explain/apply/gate/stage/verify selection plus three negative fresh tasks covering autonomous adoption, missing evidence, and v2-as-final requests. Bind Skill/reference/CLI/manifest bytes and actual Skill/reference load events.
  4. Record scenarios, all valid/invalid results, exact digests/environment, and limitations in the two eval documents. If any valid candidate task fails, revise the exact Skill and repeat the whole candidate campaign. Only after acceptance, update `PROVENANCE.md`; do not touch bound bytes afterward.

**Commit boundary:** Commit the complete evaluated plugin as `feat(skill-lab): ship production v3 evidence gate`.

**Completion evidence:** not run

**Execution updates:** none

### Task 3: Productionize and evaluate explicit domain modeling

**Status:** pending

**Depends on:** Approved current-Skill RED summary; official Codex app-server structured Skill input protocol; Task 2's generic installed-Skill campaign runner, but no dependency on Skill Lab plugin implementation code.

**Produces:** Evidence/source/status/owner-bound domain model; explicit `brainstorming` handoff; preserved R1 control; exact `1.0.0` production plugin; 20 valid installed-tree current/candidate samples.

**Files:**
- Modify: `tests/optional-plugins/test-engineering-skills.sh`
- Modify: `plugins/superzhao-engineering/skills/domain-modeling/SKILL.md`
- Modify: `plugins/superzhao-engineering/skills/domain-modeling/references/modeling-frame.md`
- Preserve: `plugins/superzhao-engineering/skills/domain-modeling/agents/openai.yaml` with explicit-only policy
- Modify: `plugins/superzhao-engineering/.codex-plugin/plugin.json`
- Modify after behavior acceptance: `plugins/superzhao-engineering/PROVENANCE.md`
- Modify: `tests/optional-plugins/codex-skill-campaign.mjs` only if the generic runner needs a domain-modeling scenario adapter
- Create: `docs/superpowers/evals/2026-07-15-domain-modeling-production-v1-scenarios.md`
- Create after sampling: `docs/superpowers/evals/2026-07-15-domain-modeling-production-v1-results.md`

**Interfaces:**
- Consumes: frozen important multi-turn subscription scenario and fixed-semantics private-rename control.
- Produces: reference tables `Invariant | Status | Evidence/source | Decision owner` and transition rows with the same three bindings; explicit next route `direct R1` or `brainstorming`.

- [ ] **Add the smallest behavior-shaping contract with strict static RED/GREEN**

  1. Add assertions for per-critical invariant/transition status, evidence/source, decision owner; domain-semantics versus architecture/design distinction; stop while material semantics are Open; settled-model handoff to `brainstorming`; no reopening absent contradictory evidence; unchanged fixed-semantics R1 and `allow_implicit_invocation: false`.
  2. Run `bash tests/optional-plugins/test-engineering-skills.sh`; confirm RED on the missing table fields and handoff.
  3. Make the minimal Skill/reference edit: Open rows name a real owner, settled rows may say `not applicable — settled`, material Open semantics stop encoding work, settled consequential/R3 design receives the model through `brainstorming`, and the direct R1 route remains.
  4. Finalize the optional manifest at exact `1.0.0` with production/repository/license metadata, capabilities `Interactive` and `Read`, fully qualified explicit prompt, and no `hooks`; run the static test and optional plugin/Skill validators to GREEN.

- [ ] **Run the installed current-versus-candidate campaign**

  1. Freeze scenario/rubric/environment before sampling. Important is one fresh multi-turn subscription task: unresolved cancellation/entitlement semantics first, then owner decisions; control is one private rename with a targeted test.
  2. Define current as `plugins/superzhao-engineering` extracted from base commit `ec33d0833b6381eff2058dfea477e5747bcbf6e1`; define candidate as an immutable content-addressed snapshot of the exact Task 3 pre-sampling Skill/reference/manifest bytes. Install those snapshots into separate isolated `CODEX_HOME` roots, record their tree/file digests, and never sample from the mutable checkout. Run an app-server instrumentation pilot: `skills/list` resolves the intended installed path, `turn/start` carries a structured Skill item, and trace/export records the linked `references/modeling-frame.md` read. A typed `$name` without the structured item is invalid.
  3. Collect exactly five valid samples per arm per case: current-important, candidate-important, current-control, candidate-control (20 total). Preserve invalid/indeterminate attempts but never substitute them. Bind scenario, rubric, Skill, reference, manifest, Codex version, model/harness profile, transcript, scorer output, selection event, and reference read.
  4. Manually score every output. Candidate important passes only when it binds evidence/status/owner, stops on Open semantics without persistence, then hands the settled model to `brainstorming`; candidate control passes only when it takes direct R1 without modeling/planning/ADR/brainstorming ceremony.
  5. If any valid candidate sample fails, revise candidate bytes and repeat all candidate samples. When accepted, write the results document and production provenance; do not change the bound Skill/reference/manifest afterward.

**Commit boundary:** Commit the evaluated plugin as `feat(engineering): ship production domain modeling`.

**Completion evidence:** not run

**Execution updates:** none

### Task 4: Finalize Superzhao distribution, README, licensing, packaging, and CI

**Status:** pending

**Depends on:** Tasks 2 and 3 have frozen accepted optional-plugin Skill/reference/manifest bytes.

**Produces:** Exact marketplace and version matrix; corrected MIT/provenance inventory; licensing-safe writing reference; reproducible plugin archives without the inherited Code of Conduct; complete Chinese-first README; Node 20/22 macOS/Linux workflow.

**Files:**
- Create: `tests/release/test-release-contract.mjs`
- Modify: `tests/codex/test-marketplace-manifest.sh`
- Modify: `tests/codex/test-package-codex-plugin.sh`
- Modify: `tests/optional-plugins/test-plugin-layout.sh`
- Modify: `tests/docs/test-testing-guide.sh`
- Modify: `.agents/plugins/marketplace.json`
- Modify: `.codex-plugin/plugin.json`
- Modify root version and distribution metadata: `package.json`
- Modify exact version fields only: `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `.kimi-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `gemini-extension.json`
- Replace: `README.md`
- Modify: `LICENSE`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `plugins/superzhao-skill-lab/LICENSE`
- Modify: `plugins/superzhao-engineering/LICENSE`
- Preserve complete pinned texts: both plugin-local `THIRD_PARTY_NOTICES.md`
- Delete: `CODE_OF_CONDUCT.md`
- Delete: `skills/writing-skills/anthropic-best-practices.md`
- Create: `skills/writing-skills/authoring-conventions.md`
- Modify: `skills/writing-skills/SKILL.md`
- Modify: `scripts/package-codex-plugin.sh`
- Modify: `docs/testing.md`
- Create: `.github/workflows/optional-plugins.yml`

**Interfaces:**
- Consumes: frozen optional plugin bytes, exact 14-Skill installer contract, design marketplace JSON, OSI MIT text/provenance pins, current Codex CLI commands.
- Produces: public install/update/rollback documentation; exact root `6.2.0`; installable three-entry repository marketplace; reproducible archive inventory; CI matrix.

- [ ] **Write release RED contracts before distribution changes**

  1. Create `tests/release/test-release-contract.mjs` asserting the exact version matrix, `.version-bump.json` set, three marketplace objects/order/policy/category, root `hooks: {}`, optional no-hooks, SPDX/repository metadata, root/plugin notices, deleted/replacement files, complete README sections/14 Skills/literal commands, inherited-harness metadata boundary, and forbidden obsolete content.
  2. Extend marketplace/package/layout/docs tests first. Package assertions require `THIRD_PARTY_NOTICES.md`, omit `CODE_OF_CONDUCT.md` and the copied Anthropic file, include `authoring-conventions.md`, and preserve the same 14 Skill/runtime payload.
  3. Run Node 22 release test plus `bash tests/codex/test-marketplace-manifest.sh`, `bash tests/codex/test-package-codex-plugin.sh`, `bash tests/optional-plugins/test-plugin-layout.sh`, and `bash tests/docs/test-testing-guide.sh`; confirm expected RED on current metadata/content. Record the pre-existing package timestamp RED: zip local-time drift and tar display-time assumption under Asia/Taipei.

- [ ] **Implement exact release metadata and licensing**

  1. Set root version `6.2.0` through `scripts/bump-version.sh` so every `.version-bump.json` path stays synchronized; set root Codex/package Superzhao repository/publisher/license metadata without rebranding excluded harness fields.
  2. Write the exact three-entry `superzhao` marketplace. Do not alter frozen optional manifests.
  3. Replace root/plugin MIT notices and root/plugin notice inventories exactly. Delete `CODE_OF_CONDUCT.md`; remove it from package help/inventory. Keep historical mentions untouched.
  4. Delete the copied Anthropic file, independently author concise `authoring-conventions.md`, update `writing-skills/SKILL.md`, and verify no active/install/package reference points to the deleted file.
  5. Make archive timestamps timezone-independent: create zip entries under UTC and assert tar numeric epoch rather than locale-rendered dates. Preserve modes, checksums, rootless layout, metadata overlay, and dirty-tree refusal.

- [ ] **Rewrite README and add CI**

  1. Replace README completely with the 11 Chinese-first contract sections, exact 14 Skills, core installer/backup/rollback/new-task instructions, three official Codex marketplace commands, explicit-only optional use, Node/platform support, deterministic-versus-behavior evidence, privacy/telemetry disclosure, maintenance/provenance, contribution scope, and MIT acknowledgments/non-endorsement.
  2. Add `.github/workflows/optional-plugins.yml` for `ubuntu-latest`/`macos-latest` × Node `20`/`22`, running the full Skill Lab suite, optional plugin/static/release/marketplace/package/docs tests and validators that are valid on each runner.
  3. Update `docs/testing.md` and its contract test with the new release/Skill Lab commands and the known root-validator `hooks: {}` exception.
  4. Run all Task 4 targeted tests and `bash scripts/bump-version.sh --check`; require GREEN with pristine output.

**Commit boundary:** Commit the distribution as `docs(release): finalize Superzhao production distribution`.

**Completion evidence:** not run

**Execution updates:** none

### Task 5: Integrated isolated installation, full verification, and whole-change review

**Status:** pending

**Depends on:** Tasks 1–4 committed, controller-verified, independently task-reviewed, and marked verified; optional behavior evidence bound to unchanged bytes; marketplace and package complete.

**Produces:** Isolated install/discovery/rollback evidence, full locally available matrix evidence, independent task and whole-change review closure, and a clean reviewed local `main` HEAD ready for the next authorization gate.

**Files:**
- Modify only if verification/review finds an in-scope defect: files already owned by Tasks 1–4
- Update completion evidence in: `docs/superpowers/plans/2026-07-15-production-plugins-release.md`
- Update recovery ledger: `.superpowers/sdd/progress.md` (git-ignored scratch, not release content)

**Interfaces:**
- Consumes: final local repository marketplace and all three plugin manifests.
- Produces: exact installed paths/versions/discovery in isolated `CODEX_HOME`, uninstall/rollback proof, complete local test log, final diff review, clean HEAD SHA.

- [ ] **Verify isolated distribution behavior**

  1. Create a disposable isolated `CODEX_HOME`; add the repository marketplace locally, install all three selectors, list Skills with `forceReload`, and verify exact versions/paths/explicit discovery. Remove/reinstall both optional selectors and validate rollback/uninstall behavior without touching `/Users/liuxianzhao/.codex`.
  2. Run one fresh structured Skill load for `writing-skills`, `optimize-agent-skill`, and `domain-modeling`; verify the replacement authoring reference and each linked optional reference load from the installed tree.
  3. Compare installed plugin/Skill bytes to committed source and confirm the copied Anthropic document and Code of Conduct are absent from install/package inventories.

- [ ] **Run the R3 verification matrix**

  1. On local Node 22, run `/Users/liuxianzhao/.nvm/versions/node/v22.22.2/bin/node --test tests/skill-lab/*.test.mjs` and `node --test tests/release/test-release-contract.mjs`.
  2. Run `bash tests/optional-plugins/test-plugin-layout.sh`, `bash tests/optional-plugins/test-engineering-skills.sh`, `bash tests/optional-plugins/test-skill-lab-skill.sh`, `bash tests/codex/test-marketplace-manifest.sh`, `bash tests/codex/test-package-codex-plugin.sh`, `bash tests/codex-profile/run-tests.sh`, `bash tests/docs/test-plugin-development-guide.sh`, `bash tests/docs/test-testing-guide.sh`, `bash tests/shell-lint/test-lint-shell.sh`, `npm test --prefix tests/brainstorm-server`, the bundled validator against each optional plugin manifest, `bash scripts/bump-version.sh --check`, and `git diff --check`. Validate README through `tests/release/test-release-contract.mjs`; validate the root through its repository marketplace/package tests and record the known bundled-validator `hooks: {}` mismatch; never remove the guard to satisfy that validator.
  3. Record that Node 20/Linux evidence is pending the newly introduced post-push GitHub matrix; do not claim it locally.

- [ ] **Close every review gate and prepare the action-specific handoff**

  1. Confirm the recovery ledger contains valid bound task-review records for Tasks 1–4; do not defer any task review to Task 5.
  2. Generate one whole-change review package from `ec33d0833b6381eff2058dfea477e5747bcbf6e1` to final HEAD; obtain independent whole-change review and fix/re-review all blocking findings.
  3. Re-run affected verification after any fix. Require clean `main`, exact commit SHAs, no unrelated path changes, and no uncommitted generated/private evidence.
  4. Present the full diff, final SHA, target `/Users/liuxianzhao/.codex`, current backup/rollback state, and test/review evidence; stop for Task 6's exact managed-profile synchronization authorization. Do not synchronize live Skills or push in this task.

**Commit boundary:** Commit only verified in-scope review fixes or final repository evidence, with a precise subject; otherwise Task 5 creates no extra production commit.

**Completion evidence:** not run

**Execution updates:** none

### Task 6: Authorization-gated canonical managed-profile synchronization

**Status:** pending authorization

**Depends on:** Task 5 verified; repository clean at the reviewed final local SHA; the owner explicitly approves the exact write to `/Users/liuxianzhao/.codex` after seeing Task 5 evidence.

**Produces:** A private content-bound backup, a verified 14-Skill live managed profile sourced from the reviewed commit, a fresh-task `writing-skills` replacement-reference load, or a completed rollback with no publication.

**Files/state:**
- Read from the reviewed repository commit only; no repository source edit is expected
- Mutate only through: `scripts/install-codex-profile.sh` against `/Users/liuxianzhao/.codex`
- Verify/rollback only through the repository's tested profile scripts and private backup metadata
- Update recovery ledger: `.superpowers/sdd/progress.md`

- [ ] **Synchronize only after the exact approval**

  1. Reconfirm clean `main`, exact reviewed HEAD, canonical target `/Users/liuxianzhao/.codex`, and installer/rollback test evidence; present the exact command and wait for approval if it has not already been granted at this gate.
  2. Run `scripts/install-codex-profile.sh` from the exact reviewed commit. Verify a private backup exists; verify `source-commit.txt`, path, type, mode, and SHA-256 identity for all 14 managed Skill trees, including `skills/writing-skills/authoring-conventions.md` and the absence of the deleted Anthropic copy.
  3. Start a fresh Codex task and prove the managed `writing-skills` Skill loads the committed replacement reference. If any check fails, run the validated rollback path, verify restoration, stop, and do not publish.
  4. Record only non-sensitive verification facts in the recovery ledger; do not commit private backup paths or contents. Present the exact push preflight and stop for Task 7 authorization.

**Commit boundary:** No repository commit expected.

**Completion evidence:** not run

**Execution updates:** none

### Task 7: Authorization-gated non-force publication and post-push CI

**Status:** pending authorization

**Depends on:** Task 6 succeeded without rollback; the owner explicitly approves the exact non-force push to `origin/main` after seeing the final SHA and preflight.

**Produces:** `origin/main` equal to the reviewed local HEAD, read-back SHA evidence, and the four-job GitHub Actions result for that exact SHA.

**Files/state:**
- Remote: `origin` must be exactly `https://github.com/zhaogewudi666/superzhao.git`
- Branch/ref: local `main` to `refs/heads/main`, non-force only
- Expected first-publication remote base: `ec33d0833b6381eff2058dfea477e5747bcbf6e1`
- Update recovery ledger: `.superpowers/sdd/progress.md`

- [ ] **Publish only after the exact approval**

  1. Fetch `origin`; require the exact URL, branch `main`, clean tree, unchanged reviewed HEAD, and `origin/main` equal to the recorded expected base. Any drift aborts without merge, rebase, or push and returns to the owner.
  2. Push local `main` to `refs/heads/main` without force. Read `refs/heads/main` back from the remote and require exact equality with local HEAD.
  3. Locate and monitor the `optional-plugins.yml` Ubuntu/macOS × Node 20/22 run for the exact published SHA. A failure blocks the completion claim; diagnose and report it without automatic revert, fix-forward commit, or second push.
  4. After all four jobs pass, present remote/local SHA evidence and stop for Task 8's exact live optional-plugin installation authorization.

**Commit boundary:** No new commit; publication uses only the reviewed Task 5 HEAD.

**Completion evidence:** not run

**Execution updates:** none

### Task 8: Authorization-gated live optional-plugin installation

**Status:** pending authorization

**Depends on:** Task 7 remote SHA and post-push matrix verified; the owner explicitly approves mutation of the affected live Codex marketplace/plugin state.

**Produces:** Live marketplace `superzhao` at the published SHA; live `superzhao-skill-lab@superzhao` and `superzhao-engineering@superzhao` at `1.0.0`; exact path/version/cache/load evidence; or complete scoped restoration on failure.

**Files/state:**
- Mutate only the affected marketplace/plugin config and cache state under `/Users/liuxianzhao/.codex`
- Never install `superpowers@superzhao` live because the 14 core Skills are already managed transactionally
- Never touch a same-named plugin or marketplace owned by a different source
- Update recovery ledger: `.superpowers/sdd/progress.md`

- [ ] **Install the two optional selectors only after the exact approval**

  1. Capture `codex plugin marketplace list` and `codex plugin list` plus a private byte-for-byte backup of the affected live config/cache roots. If marketplace `superzhao` points anywhere other than the exact Git repository, stop without mutation.
  2. If absent, run `codex plugin marketplace add zhaogewudi666/superzhao`; if already correct, run `codex plugin marketplace upgrade superzhao --json`. For each exact optional selector, add when absent or remove then re-add only that same selector when already installed.
  3. Verify marketplace/plugin listings, cached repository SHA, versions, installed paths, explicit discovery, and fresh structured Skill/reference load events for both optional Skills. Do not install the root selector.
  4. On failure, remove only newly added selectors and atomically restore the backed-up affected config/cache roots; verify restoration before reporting. On success, verify the repository remains clean and report final local/remote/cached SHA equality.

**Commit boundary:** No repository commit expected.

**Completion evidence:** not run

**Execution updates:** none
