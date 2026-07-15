# Superzhao Production Plugins and Repository Release Design

**Status:** Approved by the repository owner on 2026-07-15

**Base commit:** `ec33d0833b6381eff2058dfea477e5747bcbf6e1`

**Source request:** Promote the two experimental Skills to production, confirm whether they are already on the remote, completely rewrite README from the current repository, choose the correct open-source license, and push the result to `origin/main`.

## Outcome

Release Superzhao as a Chinese-first, Codex-focused distribution with:

1. the existing 14-Skill managed profile unchanged except for a licensing-safe authoring reference;
2. `superzhao-skill-lab` rebuilt as a stable, explicit-only v3 evidence-gating plugin;
3. `superzhao-engineering` released as a stable, explicit-only domain-modeling plugin;
4. both optional plugins installable from the repository marketplace but never installed by default;
5. a README written specifically for Superzhao rather than an upstream README appended below a fork banner;
6. an MIT root license that preserves upstream ownership, plugin-specific MIT licenses, and complete notices for differently licensed or adapted files;
7. synchronized local managed Skills plus live installation of the two optional plugins in `/Users/liuxianzhao/.codex`; and
8. a verified non-force publication directly to `origin/main`, as requested.

Success is evidenced by deterministic tests, behavior samples bound to exact Skill bytes, cross-platform CI for the supported runtime, isolated plugin installation, fresh-task Skill loading, a clean independent review, and exact equality between local `HEAD` and remote `refs/heads/main`.

## Current State and Confirmed Problems

- Both optional plugin source trees are already present on remote `main`. They entered in commit `f7693b76f2b94b6a37b12a693c33a3530190282e`, which is an ancestor of remote `main` `ec33d0833b6381eff2058dfea477e5747bcbf6e1`.
- They are not production distributions: both manifests say experimental, neither appears in `.agents/plugins/marketplace.json`, neither is installed by the 14-Skill profile installer, and both are explicit-only.
- Skill Lab's 35 deterministic tests pass, but the current gate intentionally ignores held-out `test` rows. Its fixture includes a failing candidate test sample and still accepts and stages the candidate. Production publication must fix this semantic defect, not only change labels.
- Skill Lab's Skill requires rationale, supporting cases, support count, source type, and prior-rejection relationship, while its v2 schema rejects those fields and its stage bundle cannot retain them.
- Skill Lab binds arbitrary evidence bytes by path/hash, but the declared outcome is not structurally tied to an actor transcript or scorer record. The documentation correctly disclaims proof of human independence and scoring truth; v3 must at least prove which run and scoring artifact produced each declared result.
- Skill Lab has no offline bundle verifier, no producer/runtime identity in its manifest, and no input or aggregate resource limits despite reading all files into memory.
- Five fresh current-Skill domain-modeling samples all handled the simple R1 control correctly and stopped before migration. All five omitted a source/status/owner binding for critical invariants and omitted the required handoff from settled semantics to `brainstorming` for consequential design. One separate Codex pilot was invalid because the prompt prohibited even read-only Skill loading; it is retained as invalid rather than counted.
- The root README mixes Superzhao material with hundreds of lines of upstream recruiting, commercial, installation, governance, and community content. Several commands install `obra/superpowers`, not this repository.
- Root `LICENSE` contains only Jesse Vincent's upstream notice. Standalone plugin licenses copy that same line even though the plugins are Superzhao contributions.
- `skills/writing-skills/anthropic-best-practices.md` is a near-complete copy of an Anthropic platform documentation page without a local license establishing redistribution rights. A truthful MIT release cannot silently claim that file.
- `CODE_OF_CONDUCT.md` is adapted from Contributor Covenant 2.0, still points enforcement reports to an upstream maintainer, and cannot be completed truthfully because the repository owner does not want to publish a private contact address. It is copied into release archives by `scripts/package-codex-plugin.sh`, but no Skill, bootstrap, installer, or runtime loads it.

## Scope

### In scope

- Skill Lab CLI, Skill, reference, tests, package metadata, provenance, and production validation.
- Domain-modeling Skill, reference, tests, package metadata, provenance, and behavior validation.
- Repository marketplace and Codex-facing root plugin identity while preserving the compatibility ID `superpowers`.
- README, root/plugin licenses, third-party notices, removal of the inherited Code of Conduct with its unusable upstream contact, and package metadata.
- Replacement of the unlicensed Anthropic documentation copy with an independently written Superzhao authoring reference.
- Supported-platform CI, local isolated installation, local profile synchronization for the managed authoring reference, independent review, commit, and `origin/main` push.
- Post-push installation of the two optional plugins into the canonical local Codex profile and fresh-task load verification.

### Out of scope

- Automatic adoption of a Skill candidate.
- Automatic collection of conversations, credentials, provider state, or scorer data.
- Automatic installation of either optional plugin for repository users.
- Implicit invocation of either optional Skill in this release.
- Retrofitting production guarantees onto old v2 Skill Lab bundles.
- Rebranding every inherited non-Codex harness manifest or claiming those inherited surfaces are Superzhao-tested releases.
- Publishing to the upstream `obra/superpowers` repository, opening a PR, force-pushing, or publishing marketplace submissions outside this repository.
- Creating a release tag or maintaining a release branch; `main` remains the only Superzhao branch this workflow publishes.

## Distribution Architecture

The release uses this version matrix:

| Distribution | Release version | Rule |
|---|---:|---|
| root `superpowers` compatibility plugin and package | `6.2.0` | Superzhao's SemVer line, independent of future upstream versions |
| `superzhao-skill-lab` | `1.0.0` | independent optional-plugin SemVer |
| `superzhao-engineering` | `1.0.0` | independent optional-plugin SemVer |

The root version is synchronized through every path in `.version-bump.json`. Optional plugin versions are not added to that root bump set; their manifests and marketplace assertions are checked independently. The README records the pinned upstream base separately so `6.2.0` is never presented as an `obra/superpowers` release.

The repository marketplace becomes `superzhao` with display name `Superzhao` and three `AVAILABLE`, `ON_INSTALL` entries. Its source objects are exact repository-local contracts:

```json
{
  "name": "superzhao",
  "interface": { "displayName": "Superzhao" },
  "plugins": [
    {
      "name": "superpowers",
      "source": { "source": "local", "path": "./" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Developer Tools"
    },
    {
      "name": "superzhao-skill-lab",
      "source": { "source": "local", "path": "./plugins/superzhao-skill-lab" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Developer Tools"
    },
    {
      "name": "superzhao-engineering",
      "source": { "source": "local", "path": "./plugins/superzhao-engineering" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Developer Tools"
    }
  ]
}
```

| Plugin | Source | Role | Invocation |
|---|---|---|---|
| `superpowers` | repository root | Compatible 14-Skill core plugin | existing core routing |
| `superzhao-skill-lab` | `./plugins/superzhao-skill-lab` | candidate evidence gate and review bundle | explicit-only |
| `superzhao-engineering` | `./plugins/superzhao-engineering` | domain semantics modeling | explicit-only |

The root plugin keeps the technical ID `superpowers` because Skill names, bootstrap behavior, and installed integrations depend on it. Its Codex-facing display/publisher/repository metadata identifies Superzhao and explains the compatibility ID. Inherited manifests for other harnesses remain compatibility surfaces and are described as such rather than presented as first-class Superzhao releases.

The root and both optional `.codex-plugin/plugin.json` files contain synchronized name/version/description, `author`, `homepage`, `repository`, SPDX `license`, `keywords`, `skills`, and supported `interface` fields. User-visible capabilities use Codex capability names (`Interactive`, `Read`, and `Write` where true), not implementation nouns such as `skills` or `scripts`. Website links target this repository; privacy links target the README's no-telemetry/privacy section; open-source terms link to the applicable MIT license. The root manifest retains exactly `"hooks": {}` so Codex cannot auto-discover the inherited Claude hook file; optional manifests omit `hooks` because they ship no Codex hooks. Non-Codex harness manifests receive only the root version update required by `.version-bump.json`; their inherited author/integration metadata is intentionally not represented as a newly tested Superzhao surface.

The public Codex route is:

```bash
codex plugin marketplace add zhaogewudi666/superzhao
codex plugin add superpowers@superzhao
codex plugin add superzhao-skill-lab@superzhao
codex plugin add superzhao-engineering@superzhao
```

The managed-profile installer remains available for users who prefer its content-bound backup and rollback behavior. Optional plugins are never folded into that 14-Skill transaction.

Because the marketplace itself uses local paths inside a fetched repository, the release does not claim an immutable tag. After publication, installation tests record the fetched repository commit and require it to equal the exact published `origin/main` SHA. A later `main` update is a new marketplace snapshot and must carry an appropriate version bump.

## Skill Lab v3 Contract

### Positioning

Skill Lab is a local, zero-third-party-npm-dependency evidence ledger, bounded body-patch engine, final gate, and review-bundle verifier. It is not an autonomous optimizer, scorer, installer, or deployment system. It never writes the source Skill or active profile.

### Runtime and preflight

- Supported production runtime: Node.js 20 or 22 on macOS and Linux.
- Windows remains unsupported for this release until hard-link and path behavior pass the same suite.
- `doctor` checks Node version, physical workspace containment, writable private temporary/output parents, same-device requirements, and hard-link support without modifying campaign artifacts.
- Runtime errors distinguish unsupported filesystem/runtime, schema failure, candidate rejection, final-test rejection, and publication failure.

### `apply` schema v3

The source frontmatter is treated as an immutable byte range. One pinned portable algorithm is normative in every environment: it validates UTF-8, opening/closing frontmatter delimiters, required top-level `name` and `description` scalar presence (plain, quoted, or block scalar), body presence, and immutable complete-header bytes without normalizing YAML or rejecting additional standard keys. An installed official Skill validator is an advisory release check only and never changes `apply`, `stage`, or offline-verification decisions. This keeps acceptance deterministic while allowing standard frontmatter keys.

The patch retains the four-operation hard cap and UTF-8 byte budgets. Every edit additionally requires:

- a stable edit ID;
- rationale;
- one or more supporting case IDs;
- support count;
- one or more source types from `failure`, `success`, `rejection`, or `human-constraint`.

The patch also carries a proposal-level assumption summary and zero or more prior-rejection records. Every prior rejection is a path/hash-bound report plus a short relationship classification and note. `apply` validates and reports these fields; `stage` packages them. No provenance field changes how text is applied.

### Normative v3 files and validation semantics

The implementation ships normative schemas and golden examples under `plugins/superzhao-skill-lab/schemas/v3/` for patch, case inventory, sample ledger, actor run, scorer record, apply report, gate report, and bundle manifest. The CLI's zero-dependency validators and every emitted example must agree with those schemas. Unknown keys are rejected at every schema-owned object.

The patch contract includes:

- `schema: "superzhao.skill-lab.patch/v3"`, a unique `proposal_id`, and an assumptions array whose statuses are `known`, `inferred`, or `open`;
- edits with unique `edit_id`, existing operation/target/content fields, non-empty rationale, unique `supporting_case_ids`, `support_count` equal to the number of distinct supporting case IDs, and unique `source_types` chosen from `failure`, `success`, `rejection`, or `human-constraint`; and
- prior-rejection entries with unique IDs, path/SHA-256 artifacts, non-empty notes, and relationship `supersedes`, `narrows`, `unchanged-risk`, or `not-applicable`.

The inventory contract includes `schema: "superzhao.skill-lab.cases/v3"`, a unique campaign ID, `required_valid` from 5 through 20, and unique cases. Each case has one split (`train`, `selection`, or `test`), one type (`important` or `control`), and raw-byte-hashed prompt and rubric artifacts. Selection and test must each contain at least one important and one control case; their case IDs and prompt digests are disjoint.

Every attempted run is retained. Each sample has one arm (`current` or `candidate`) and one status (`valid`, `invalid`, or `indeterminate`). A valid sample has outcome `pass` or `fail`; `fail` requires a stable non-empty failure code. Invalid and indeterminate samples have no pass/fail outcome and require a reason plus their available artifacts. For every gated case/arm there must be exactly `required_valid` valid samples—extra valid rows are rejected rather than cherry-picked—and no more than `required_valid` invalid/indeterminate attempts. The campaign-wide 1,000-row cap still applies.

Actor profile, scorer profile, environment, prompt, rubric, transcript, and scorer-output files are hashed as raw bytes. Run ID, actor-instance ID, transcript digest, scorer-run ID, and scorer-output digest are globally unique per attempted sample; actor/scorer profile IDs may repeat. A case uses the same actor and scorer profile digests for both arms. Current/candidate and selection/test never reuse a run, actor instance, transcript, scorer run, or scorer output.

All input JSON is UTF-8 without BOM. Semantic parsing ignores object-key order, but emitted reports use recursively sorted keys, no insignificant whitespace, and one final newline. Artifact paths use normalized POSIX relative syntax and reject absolute paths, backslashes, empty/`.`/`..` segments, NULs, duplicate logical paths, symlinks, and real paths outside the campaign root. SHA-256 always covers the exact raw bytes.

The public CLI exit contract is: `0` success; `2` usage or schema error; `3` unsafe path or integrity failure; `4` selection rejection; `5` final held-out rejection; `6` output conflict or filesystem publication failure; and `7` unsupported runtime/filesystem preflight. Machine-readable reports distinguish these states without requiring stderr parsing.

### Structured campaign and evidence

The v3 campaign has a machine-readable case inventory. Every case declares a stable ID, split, type, prompt artifact, and rubric requirements. Selection and held-out test case IDs are disjoint.

Every sample binds:

- sample, run, actor, case, split, type, and arm IDs;
- exact source/candidate Skill digest selected for that arm;
- prompt, environment, harness/model profile, and transcript artifacts;
- a structured scorer record containing scorer identity/version, rubric digest, transcript digest, outcome, failure code or invalid/indeterminate reason, and the complete scorer output.

The CLI reopens and hashes all artifacts and requires the scorer record to agree with the sample row. It cannot prove that identities are independent, that a person told the truth, or that a rubric is good; the manifest and README state those limitations explicitly.

Resource limits apply before output publication:

- at most 1,000 sample rows;
- at most 8 MiB per input artifact;
- at most 64 MiB across all unique non-Skill campaign artifacts: patch, inventory, prompt, rubric, environment, actor/scorer profiles, transcripts, scorer records/outputs, prior-rejection reports, and train/selection/test ledgers;
- at most 96 MiB in the staged bundle.

The 8 MiB limit applies to every read input. The 64 MiB limit counts exactly the enumerated non-Skill artifact classes above after physical-path/digest de-duplication. Source/candidate Skill bytes are excluded from 64 MiB but included in the 96 MiB bundle limit. The 96 MiB limit counts every regular file that would appear in the bundle. Evidence reads are memoized by physical path and digest so case-row reuse does not duplicate buffers.

### Two-phase gate

`gate` returns explicit phase results rather than one ambiguous acceptance:

1. **Selection phase**
   - exactly `required_valid` for current and candidate in every selection case;
   - at least one important and one control case;
   - at least one important case has two or more current failures with the same stable failure code and zero candidate failures with that code;
   - every important case has no candidate failure and every control case has candidate failures less than or equal to current failures;
   - success is named `selection_pass`, never final acceptance.

2. **Final held-out phase**
   - at least one important and one control case whose IDs do not occur in selection;
   - fresh actors/runs/evidence, disjoint from other arms and splits;
   - exactly `required_valid` for current and candidate in every test case;
   - zero candidate failures in every important case and candidate failures less than or equal to current failures in every control case;
   - any valid candidate important test row with outcome `fail` prevents final acceptance.

Train rows remain hash-bound ledger context but never affect either decision. The final decision is `final_accept` only when both phases pass.

### Stage and offline verification

`stage` runs only on `final_accept`. It recomputes apply and both gate phases, then packages:

- source/candidate Skills and complete diff inputs;
- proposal/edit provenance and prior rejection reports;
- case inventory, prompts, rubric, environment, profiles;
- actor transcripts and scorer records;
- apply/gate reports;
- plugin version, CLI script digest, Node/platform producer data; and
- a manifest published last.

The command prints the manifest SHA-256 as the portable trust anchor.

`verify-bundle` works without the original workspace. It rejects a missing manifest, missing or extra file, symlink, unsafe path, byte drift, inconsistent cross-reference, forged report, or recomputation mismatch. It re-applies the patch and recomputes both gate phases from packaged artifacts.

The bundle contains the exact producer CLI bytes and digest for provenance, but `verify-bundle` never executes code from the bundle. The installed verifier accepts only schema/report semantic versions it implements, recomputes with its own trusted code, and reports the producer identity separately. The printed manifest digest is only a portable trust anchor when compared through an independent channel; a digest does not establish author or scorer honesty.

### v2 compatibility

- v3 is intentionally breaking: production `apply`, `gate`, and `stage` reject v2 inputs with exit `2` and an actionable schema diagnostic.
- Existing v2 source, reports, and bundles remain immutable historical artifacts.
- `verify-bundle --legacy-v2` verifies only v2 path/file/hash integrity and returns status `legacy-structural-only`; it never emits `selection_pass` or `final_accept`.
- No migration command ships in `1.0.0`, and no v2 artifact is automatically upgraded because missing scorer, test, proposal, and rejection evidence cannot be reconstructed.
- Golden v2 fixtures pin successful legacy integrity inspection, tamper rejection, production-command rejection, status, and exit codes.

### Sensitive evidence boundary

Skill Lab never harvests transcripts. Users supply artifacts deliberately. Documentation requires campaigns and staged bundles to be git-ignored by default, reviewed for secrets/personal data before sharing, and retained or deleted only by an authorized human decision.

## Domain Modeling Production Contract

`domain-modeling` stays explicit-only for v1.0.0. Production readiness means reliable manual selection, not speculative implicit discovery.

The existing Known/Inferred/Open model is retained. The smallest behavior change adds:

- a status and evidence/source binding for every critical invariant and transition;
- a decision owner for unresolved statements;
- an explicit distinction between domain semantics and architecture/design choices;
- a handoff rule: once semantics are settled, consequential design or R3 work receives the model as input to `brainstorming`; settled decisions are not reopened without contradictory evidence;
- the existing direct R1 route for fixed-semantics edits.

The frozen important/control scenarios are evaluated on both current and candidate arms. Acceptance requires all candidate important outputs to bind evidence/status/owner, stop on material open decisions, avoid persistent writes, and hand consequential design to `brainstorming`; all controls must continue choosing the direct R1 route.

The actual acceptance count is five valid samples **per arm per case**: current-important, candidate-important, current-control, and candidate-control, for 20 valid samples total. Invalid/indeterminate attempts are preserved but do not replace valid samples. Scenario, rubric, Skill bytes, linked-reference bytes, plugin manifest, Codex version, model/harness profile, task transcript, and scorer output are all digest-bound.

Attachment is proven through the installed Codex plugin, not by telling an agent to read a repository path. In a clean task for each run, the evaluator opens the Codex Skills picker, attaches the fully qualified installed Skill, then sends the frozen prompt without file-loading instructions. The retained task event/export must identify the installed plugin/version and the selected Skill; the task trace must show both `SKILL.md` and its linked `references/modeling-frame.md` bytes loaded. A typed name that produces no selection/load event is invalid. The current and candidate arms use separate isolated plugin snapshots, and the candidate is not called stable or exposed in the marketplace until this campaign passes.

Skill Lab receives the same installed-tree attachment proof. Its release evidence contains five positive fresh tasks covering explain/apply/gate/stage/verify workflow selection and three negative fresh tasks showing it refuses autonomous adoption, missing evidence, and v2-as-final-acceptance requests. Each task binds the installed Skill/reference/CLI/manifest bytes and records the actual Skill selection/load event.

## README Contract

`README.md` is replaced completely. It is Chinese-first, concise, and contains only Superzhao-relevant content:

1. identity, fork relationship, and non-endorsement statement;
2. Superzhao's R0–R3 proportional workflow and difference from upstream;
3. the exact 14 managed Skills;
4. core installation, update, backup, rollback, and new-task reload;
5. repository marketplace installation for all three plugins;
6. production use cases, explicit invocation, and limitations of the two optional plugins;
7. supported platforms/runtime and privacy/telemetry disclosure;
8. deterministic tests versus behavior evaluations;
9. repository layout and upstream maintenance model;
10. contribution expectations for this fork;
11. license, third-party provenance, and acknowledgments.

Commands are tested as literal contracts and checked against current Codex documentation and repository scripts. Upstream recruiting, commercial services, upstream-only installation commands, `dev`-branch governance, and upstream community ownership text are removed.

## License and Attribution

MIT remains the primary project license because the substantial upstream Superpowers code, Microsoft SkillOpt adaptation, and Matt Pocock adaptation are all MIT-compatible, and the repository's goal favors permissive reuse.

The release inventory is normative:

| Distributed material | Pinned source | License/required action |
|---|---|---|
| inherited Superpowers files | `obra/superpowers@d884ae04edebef577e82ff7c4e143debd0bbec99` | MIT; preserve Jesse Vincent's notice in root `LICENSE` and identify modifications |
| Skill Lab concepts/adaptations | `microsoft/SkillOpt@57333f3406436a90a2b5feec4aad74ddb33d6e85` | MIT; retain Microsoft's complete license in root and plugin notice files |
| domain-modeling concepts/adaptations | `mattpocock/skills@e9fcdf95b402d360f90f1db8d776d5dd450f9234` | MIT; retain Matt Pocock's complete license in root and plugin notice files |
| Superzhao-original changes | this repository | MIT under `Copyright (c) 2026 Superzhao contributors` |

- Root `LICENSE`: unmodified OSI MIT grant text with both `Copyright (c) 2025 Jesse Vincent` and `Copyright (c) 2026 Superzhao contributors`.
- Skill Lab and Engineering plugin `LICENSE` files: MIT with `Copyright (c) 2026 Superzhao contributors`; their full Microsoft/Matt licenses remain in plugin-local `THIRD_PARTY_NOTICES.md`.
- Root `THIRD_PARTY_NOTICES.md`: pinned Superpowers, SkillOpt, and Matt source/license notices.
- Delete the inherited `CODE_OF_CONDUCT.md`. The repository owner explicitly declined to publish an enforcement email, and public issues, discussions, or security advisories are not truthful substitutes for a private reporting channel. Update `scripts/package-codex-plugin.sh` and its packaging assertions so release archives intentionally omit the file without affecting Skill/runtime contents. Historical release-note references remain historical. README may ask contributors to collaborate respectfully, but it must not claim a formal private enforcement process. A future Code of Conduct requires a separately approved design and a real monitored private contact.
- Delete `anthropic-best-practices.md`. Replace it with a short, independently authored `authoring-conventions.md` and update `writing-skills` to reference it. The new file links to Anthropic's official page for optional further reading but does not reproduce its wording or structure.
- Root/plugin manifests and `package.json` use SPDX `MIT` and the Superzhao repository/publisher metadata where those files represent this distribution.

Acceptance verifies the Anthropic copy is absent from the Git index, plugin/package file inventories, generated bundles, and all 14 installed managed Skill trees. It verifies that `writing-skills` links to the independently authored replacement and that the replacement's bytes match the committed source.

This is an engineering license selection and attribution plan, not legal advice. The repository makes no trademark or upstream-endorsement claim.

## Validation and CI

Implementation follows RED/GREEN for every changed observable contract.

### Skill Lab

- Retain all existing path, byte-budget, immutable-header, no-replace, rollback, manifest-last, and concurrency tests.
- Add failing tests for the normative v3 schemas, exact keys/enums/uniqueness/cross-references, canonical reports, path/hash rules, exact valid/invalid accounting, edit support counts, prior-rejection enums, selection/final phase separation, per-case improvement/regression, held-out candidate failure, actor/scorer/transcript swaps, size limits, exit codes, v3 staging, and offline verification.
- Add tamper tests for missing/extra/symlinked/drifted bundle files and portable verification after moving a bundle.
- Add `doctor` runtime/filesystem fault tests.
- Add golden report/manifest files and prove that an installed verifier never executes the producer CLI copied into a bundle.

### Domain modeling

- Add static contract tests for evidence/status/owner and core-workflow handoff.
- Preserve the five current exploratory samples as RED evidence, but do not count them toward the installed-tree acceptance campaign.
- Run the exact 20-valid-sample installed-plugin campaign and verify picker attachment plus the Skill and linked reference load events.

### Packaging and documentation

- Validate root and optional manifests with Codex's bundled validators.
- Test exact marketplace JSON/source types, policy, category, the `6.2.0`/`1.0.0`/`1.0.0` version matrix, `.version-bump.json` synchronization, manifest metadata, explicit invocation, license/notice inventory, README sections and commands, intentional absence of the inherited Code of Conduct/upstream enforcement email from both the Git index and generated archives, unchanged packaged Skill/runtime inventories, and absence of obsolete experimental claims.
- Install the repository marketplace and both optional plugins into an isolated `CODEX_HOME`; verify version/path/discovery and uninstall/rollback behavior.
- In isolated profiles, execute the picker/attachment protocol and all Skill Lab positive/negative fresh tasks before any marketplace exposure.

### Canonical local synchronization

The canonical live profile is `/Users/liuxianzhao/.codex`; no other home is inferred. Synchronization order is fixed:

1. rehearse the managed-profile installer and optional plugin installation in isolated `CODEX_HOME` directories;
2. create the final scoped commit, require a clean repository tree, and record its SHA;
3. run `scripts/install-codex-profile.sh` from that exact commit against `/Users/liuxianzhao/.codex`, never from uncommitted working-tree bytes;
4. verify a private backup exists and check `source-commit.txt`, type, mode, path, and SHA-256 identity for all 14 managed Skill trees, including the replacement authoring reference;
5. prove the managed `writing-skills` replacement loads in a fresh task;
6. if any pre-push live-profile check fails, run the validated rollback path and do not push;
7. after remote SHA verification, capture `codex plugin marketplace list` and `codex plugin list` plus a private byte-for-byte backup of the affected Codex marketplace/plugin config and cache roots;
8. if marketplace `superzhao` is absent, run `codex plugin marketplace add zhaogewudi666/superzhao`; if it already points to that Git repository, run `codex plugin marketplace upgrade superzhao --json`; if the name points anywhere else, stop without mutation and request direction;
9. for each exact selector `superzhao-skill-lab@superzhao` and `superzhao-engineering@superzhao`, run `codex plugin add ... --json` when absent, or `codex plugin remove ... --json` followed by `codex plugin add ... --json` when already installed; never touch a same-named plugin from another marketplace;
10. verify marketplace/plugin listings, cached repository SHA, versions, paths, explicit discovery, and fresh-task load events; if a live update fails, remove only newly added selectors and atomically restore the backed-up affected config/cache roots before reporting failure; and
11. do not install the root marketplace plugin into the live profile because the same 14 core Skills are already managed transactionally there.

### CI and final verification

- Add an optional-plugin workflow for Ubuntu and macOS with Node 20 and 22.
- Before commit/push, run every locally available Node 20/22 matrix job, the full affected deterministic suites, shell lint, plugin/Skill validators, `git diff --check`, and an independent whole-change review.
- Immediately before each push, fetch `origin`, require URL `https://github.com/zhaogewudi666/superzhao.git`, branch `main`, a clean tree, and unchanged `origin/main == ec33d0833b6381eff2058dfea477e5747bcbf6e1` for the first publication. Any unexpected drift aborts publication; no automatic merge or rebase occurs.
- Push only scoped commits to `refs/heads/main` without force, read the remote SHA back, and compare it with local `HEAD`.
- Because the workflow is introduced by the same direct-main publication, GitHub's Ubuntu/macOS matrix is explicitly post-push verification. Monitor the run for the exact SHA. Failure blocks the completion claim, not the already completed push; diagnose and report the block. No automatic revert or second push occurs without a new user instruction, and any later push must require `origin/main` to equal the last verified published SHA.
- After CI passes, verify the remote marketplace cache and perform the canonical live optional-plugin installation described above. Final success requires remote/local/cached SHA agreement and a clean tree.

## Failure Handling and Rollback

- No failed or incomplete v3 gate can stage a final bundle.
- No marketplace entry or local plugin installation occurs until the exact package passes its validators and tests.
- A failed local plugin rehearsal is removed from the isolated `CODEX_HOME`; it does not mutate the user's live configuration.
- The live 14-Skill profile uses the repository's existing private backup, integrity manifest, transaction lock, and rollback scripts.
- Pre-push test, behavior, review, license, isolated-installation, or live managed-profile failure blocks publication. Post-push GitHub CI or remote-plugin installation failure blocks the completion claim and is diagnosed/reported without a second push, force push, or destructive Git cleanup.
- After publication, rollback is a normal revert commit on `main`, not history rewriting.

## Alternatives Considered

### Rename the manifests to stable and list them without changing behavior

Rejected. It would knowingly ship a gate that accepts held-out failures and a bundle that cannot retain its own required proposal evidence.

### Merge both Skills into the 14-Skill core profile

Rejected. Skill optimization and domain modeling are optional, specialized workflows. Keeping them standalone reduces default context and avoids surprising activation.

### Enable implicit domain-modeling invocation immediately

Rejected for v1. Existing native campaigns did not prove real Skill loading, and the cost of over-triggering is repeated discovery work. Explicit manual selection is a valid production interface.

### Switch the whole repository to Apache-2.0 or GPL

Rejected. Both would complicate a fork whose incorporated software is already permissively MIT-licensed, without solving the unlicensed documentation copy. MIT plus precise notices is clearer.

### Keep the Anthropic platform-document copy and add a guessed notice

Rejected. A notice cannot create redistribution permission. Independent concise guidance plus a link removes the ambiguity.

## Approval Boundary

Approval authorizes implementation of this exact design on local `main`, isolated plugin/profile rehearsals, and creation of the reviewed local release commit. It does not yet authorize live-profile mutation or publication. Those actions have three execution-time gates:

1. before live 14-Skill synchronization, present the exact commit SHA, target `/Users/liuxianzhao/.codex`, current/backup state, rollback behavior, full diff, and successful checks, then obtain explicit approval for that synchronization and automatic failure rollback;
2. after successful synchronization, present the exact new SHA, expected old remote SHA, remote URL, `refs/heads/main`, clean-tree result, full diff, and checks, then obtain explicit approval for one non-force push; and
3. after the pushed SHA and post-push CI are verified, present the exact cached remote SHA, two selectors, current live plugin state, backup, and rollback behavior, then obtain explicit approval for the live optional-plugin installation/update.

None of those approvals authorizes a second/fix-forward push, force-push, PR creation, upstream publication, marketplace submission outside this repository, public release tags, creation/maintenance/deletion of unrelated branches/worktrees, or any other live profile.

The repository owner explicitly chose not to publish an email. This design therefore removes the inherited `CODE_OF_CONDUCT.md`; no contact address or formal private reporting channel is claimed.

A material change to the outcome, Skill Lab v3 schemas/gates, implicit-invocation policy, license family, external publication target, or supported runtime requires renewed approval. Implementation details that preserve these contracts may be recorded in the implementation plan and proceed without another design gate.
