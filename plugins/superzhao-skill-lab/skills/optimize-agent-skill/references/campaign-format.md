# Skill Lab v3 campaign format

Run the CLI from the target repository root in a trusted single-writer
workspace. The source must be an existing valid Skill and remains immutable.
New Skill creation, a no-Skill arm, frontmatter edits, installation, adoption,
and publication are outside this CLI.

Resolve the CLI from the **currently loaded plugin**, not from the target
repository. The host Skill listing exposes this Skill's absolute `SKILL.md`
path; its plugin root is two directories above the Skill directory. Set
`SKILL_LAB_CLI` to the physical `scripts/skill-lab.mjs` below that root. A
marketplace installation does not create a
`plugins/superzhao-skill-lab` directory in the target project.

The normative contracts and complete golden examples are shipped beside the
CLI under `schemas/v3/`:

- `superzhao.skill-lab.patch/v3`
- `superzhao.skill-lab.cases/v3`
- `superzhao.skill-lab.samples/v3`
- `superzhao.skill-lab.actor-run/v3`
- `superzhao.skill-lab.scorer-record/v3`
- `superzhao.skill-lab.apply-report/v3`
- `superzhao.skill-lab.gate-report/v3`
- `superzhao.skill-lab.bundle-manifest/v3`

Treat those schemas and examples as normative. Do not translate historical v2
fixtures into production inputs by renaming fields. Production `apply`,
`gate`, and `stage` reject v2 documents.

A typical workspace layout is:

```text
.skill-lab/example/
├── patch.json
├── candidate_SKILL.md
├── apply-report.json
├── campaign/
│   ├── cases.json
│   ├── samples.json
│   ├── prompts/
│   ├── rubrics/
│   ├── runs/
│   ├── scores/
│   ├── profiles/
│   └── evidence/
├── gate-report.json
└── published/                    # private output parent, mode 0700
    └── bundle/                   # complete only when manifest.json verifies
```

All JSON is UTF-8 without a BOM. Schema-owned objects reject duplicate and
unknown keys. Artifact paths use normalized forward-slash, workspace-relative
syntax. Absolute paths, drive prefixes, traversal, empty segments, backslashes,
control characters, symlinks, missing files, and digest mismatches are
rejected.

## Source and concurrency boundary

The zero-dependency source validator preserves the complete frontmatter bytes.
It accepts standard top-level metadata while requiring `name`,
`description`, a closing delimiter, valid UTF-8, and a non-empty body. The
candidate may change only body bytes.

The implementation reopens and revalidates physical artifacts, uses private
temporary files and no-replace hard links, and binds published files by
identity and digest. Node's standard library still cannot provide
`openat`-style protection from a malicious same-user process replacing a
parent directory. Do not run a campaign with an untrusted concurrent writer.
Windows is not a supported production runtime for v3.

## 0. Preflight the workspace

Create the intended output parent as a private physical directory on the same
filesystem as the campaign, then run:

```bash
node "$SKILL_LAB_CLI" doctor \
  --workspace-root "$PWD" \
  --output-parent "$PWD/.skill-lab/example/published"
```

`doctor` checks the supported Node runtime, workspace containment, private
mode, same-device publication, and hard-link support. The later `stage`
preflight also enforces output-parent ownership. `doctor` does not modify
campaign artifacts.

## 1. Bind and apply a body patch

Start from the shipped `schemas/v3/examples/patch.json`. A minimal patch has
this shape:

```json
{
  "schema": "superzhao.skill-lab.patch/v3",
  "proposal_id": "proposal-example-v3",
  "source_sha256": "1111111111111111111111111111111111111111111111111111111111111111",
  "max_edits": 1,
  "max_added_bytes": 1024,
  "max_removed_bytes": 1024,
  "assumptions": [
    {
      "assumption_id": "assumption-body-gap",
      "status": "known",
      "summary": "The observed gap is confined to body guidance."
    }
  ],
  "prior_rejections": [],
  "edits": [
    {
      "edit_id": "edit-workflow-gap",
      "op": "replace",
      "target": "one exact old passage",
      "content": "one reviewed replacement",
      "rationale": "Close the repeated gap without weakening controls.",
      "supporting_case_ids": ["selection-important-1"],
      "support_count": 1,
      "source_types": ["failure"]
    }
  ]
}
```

Replace example hashes with hashes of the exact raw bytes. Assumption status is
`known`, `inferred`, or `open`. A prior rejection binds its report path
and hash and declares `supersedes`, `narrows`, `unchanged-risk`, or
`not-applicable`.

Allowed operations are `append`, `insert_after`, `replace`, and
`delete`. `max_edits` cannot exceed 4. Every target and content field is
capped at 4096 UTF-8 bytes; `max_added_bytes` and `max_removed_bytes` must
each be an integer from 1 through 8192, inclusive. The support count must equal
the number of distinct supporting case IDs.

Targets are matched against the immutable original. A missing or repeated
target, overlapping edit, frontmatter touch, protected-region touch, protected
marker injection, budget overflow, or invalid resulting Skill rejects the
whole patch.

```bash
node "$SKILL_LAB_CLI" apply \
  --workspace-root "$PWD" \
  --source skills/example/SKILL.md \
  --edits .skill-lab/example/patch.json \
  --candidate .skill-lab/example/candidate_SKILL.md \
  --report .skill-lab/example/apply-report.json
```

The report uses `superzhao.skill-lab.apply-report/v3` and records the exact
source, patch, candidate, provenance, operation order, and actual byte deltas.
A handled failure removes an output only while retained physical identity
proves ownership; inspect any reported orphan instead of deleting a guessed
path.

## 2. Build the case inventory and sample ledger

Copy the shipped v3 `cases.json` and `samples.json` examples, then replace
every path, digest, ID, and placeholder with exact campaign data.

`cases.json` uses `superzhao.skill-lab.cases/v3` and contains:

- one stable campaign ID and `required_valid` from 5 through 20;
- unique `train`, `selection`, or `test` cases;
- `important` or `control` type on every case; and
- raw-byte-hashed prompt and rubric artifacts.

Selection and held-out test must each include at least one important and one
control case. Their case IDs and prompt digests are disjoint.

`samples.json` uses `superzhao.skill-lab.samples/v3` and binds the exact
source, candidate, and case inventory. Every attempted row records its sample,
run, actor instance/profile, case, split, type, arm, selected Skill digest, and
available actor/scorer artifacts. Actor runs and scorer records use their own
v3 schemas and bind environment, model/harness profiles, transcripts, and
scorer output by raw-byte digest.

Retain invalid and indeterminate attempts with a reason and no outcome. A valid
row has outcome `pass` or `fail`; a valid failure requires a stable failure
code. Every selection and test case/arm has exactly `required_valid` valid
rows and no more than `required_valid` invalid or indeterminate attempts.
The campaign-wide limit of 1,000 attempted rows includes valid, invalid, and
indeterminate rows. Extra valid rows or excess retained attempts reject the
campaign; do not hide or discard rows to force acceptance.

Sample, run, actor-instance, scorer-run, transcript, and scorer-output
identities are globally unique across all attempted samples, including attempts
inside the same split and arm. Actor and scorer profile identities may repeat;
matching current/candidate cases use the same profile-digest multisets. Hashes
prove byte identity; they do not prove that identities are independent or
scores are truthful.

## 3. Gate selection and held-out evidence

```bash
node "$SKILL_LAB_CLI" gate \
  --workspace-root "$PWD" \
  --results .skill-lab/example/campaign/samples.json \
  --report .skill-lab/example/gate-report.json
```

The CLI reopens every declared artifact and emits
`superzhao.skill-lab.gate-report/v3`.

Selection passes only when an important case shows a stable repeated current
failure and strict candidate improvement, no candidate important failure
exists, and controls do not regress. Held-out test rows are a separate final
decision: they are not merely counted or ignored. Final acceptance requires
the selected candidate to pass the held-out important and control rules.

Exit `0` means `selection_pass` and `final_accept`. Exit `4` is a
structurally valid selection rejection. Exit `5` is a held-out final
rejection. Rejection reports are complete evidence and should be retained.

## 4. Stage a self-contained accepted bundle

```bash
node "$SKILL_LAB_CLI" stage \
  --workspace-root "$PWD" \
  --source skills/example/SKILL.md \
  --candidate .skill-lab/example/candidate_SKILL.md \
  --edits .skill-lab/example/patch.json \
  --apply-report .skill-lab/example/apply-report.json \
  --results .skill-lab/example/campaign/samples.json \
  --gate-report .skill-lab/example/gate-report.json \
  --output-dir .skill-lab/example/published/bundle
```

Staging reapplies the patch, reopens the campaign graph, reevaluates both gate
phases, compares supplied reports with canonical recomputation, and packages
the producer CLI. Core entrypoints are:

```text
skills/source/SKILL.md
skills/candidate/SKILL.md
proposal/patch.json
campaign/cases.json
campaign/samples.json
reports/apply.json
reports/gate.json
producer/skill-lab.mjs
manifest.json
```

Additional prompt, rubric, environment, profile, run, score, transcript,
scorer-output, and prior-rejection bytes are deduplicated into the artifact
graph. Every non-`producer-cli` artifact mapping has a normalized
`source_path`; the `producer-cli` mapping intentionally has none because
its installed bytes are bound by producer identity. `manifest.json` uses
`superzhao.skill-lab.bundle-manifest/v3`, lists every payload's size and
SHA-256, and is published last.

A directory without `manifest.json` is incomplete. Do not review, adopt, or
delete it automatically; inspect it first and let the user decide whether to
remove it or choose a new output directory.

## 5. Verify the moved bundle and hand it off

Verification depends only on the moved bundle and the currently installed
verifier, not on the producer workspace:

```bash
node "$SKILL_LAB_CLI" verify-bundle \
  --bundle "$PWD/.skill-lab/example/published/bundle"
```

Do not use `--legacy-v2` for a production v3 campaign. That flag exists only
to inspect authentic historical v2 bundles.

The public exit contract is: `0` success; `2` usage or schema failure; `3`
unsafe path or integrity failure; `4` selection rejection; `5` held-out
final rejection; `6` output conflict or filesystem publication failure; and
`7` unsupported runtime or filesystem preflight.

For every proposal, hand off:

- source, patch, candidate, cases, samples, and available report digests;
- the complete candidate diff and operation/byte budgets;
- the full campaign artifact location and held-out result;
- human-attested actor, scorer, coverage, and independence limitations;
- the relationship to every prior rejection; and
- any orphan or incomplete path requiring a user decision.

For an accepted and staged proposal, additionally hand off the manifest,
packaged producer digest, complete bundle location, and successful
`verify-bundle` result. Rejected proposals have no valid bundle manifest:
hand off the rejection report and state that staging and bundle verification
did not occur.

No `apply`, `gate`, `stage`, or `verify-bundle` success authorizes
replacing the source, changing an active profile, installing a plugin,
committing, pushing, or publishing.
