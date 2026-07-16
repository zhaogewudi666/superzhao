# Skill Lab v2 campaign format

Run the CLI from the target repository root in a trusted single-writer
workspace. The source must be an existing valid Skill and remains immutable.
New Skill creation, a no-Skill arm, and frontmatter edits are outside this CLI.

Resolve the CLI from the **currently loaded plugin**, not from the target
repository. The host Skill listing exposes this Skill's absolute `SKILL.md`
path; its plugin root is two directories above the Skill directory. Set
`SKILL_LAB_CLI` to the physical `scripts/skill-lab.mjs` below that root. A
marketplace installation does not create a `plugins/superzhao-skill-lab`
directory in the target project.

```text
.skill-lab/example/
├── edits.json
├── candidate_SKILL.md
├── apply-report.json
├── campaign/
│   ├── scenarios.md
│   ├── rubric.md
│   ├── environment.json
│   └── evidence/
│       ├── important-current-1.jsonl
│       └── ...
├── results.json
├── gate-report.json
└── staged/                       # valid only when manifest.json exists
```

All JSON schemas below are version 2. JSON objects reject duplicate and unknown
keys. Artifact paths in `results.json` are forward-slash, workspace-relative
paths to physical regular files; absolute paths, traversal, backslashes,
symlinks, missing files, and digest mismatches are rejected.

## Source format and concurrency boundary

The zero-dependency Skill validator intentionally supports a portable subset:

- LF line endings with no UTF-8 BOM;
- exactly flat `name` and `description` frontmatter keys;
- lowercase hyphen-case name of at most 64 characters;
- non-empty description of at most 1024 characters, without angle brackets or
  unsupported YAML control/separator characters.

Frontmatter and recognized protected regions are immutable. Skills with other
metadata must be handled in a separate reviewed workflow; do not normalize them
silently to make this CLI accept them.

The implementation rejects static path escapes and rechecks physical
artifacts, but Node's standard library cannot provide `openat`-style protection
from a malicious same-user process swapping a parent directory between checks.
Do not run a campaign with an untrusted concurrent writer. OS-crash atomicity is
also not claimed.

## 1. Bind and apply a body patch

`edits.json`:

```json
{
  "schema_version": 2,
  "source_sha256": "7c2ddb8fe5687f7a926fee6d0a663c04ceeebcb0c8f03f21283195e68cfb228a",
  "max_edits": 2,
  "max_added_bytes": 1024,
  "max_removed_bytes": 1024,
  "edits": [
    {
      "op": "replace",
      "target": "one exact old passage",
      "content": "one reviewed replacement"
    },
    {
      "op": "insert_after",
      "target": "one exact immutable-source anchor",
      "content": "\nOne added instruction."
    }
  ]
}
```

Allowed operations are `append`, `insert_after`, `replace`, and `delete`.
`max_edits` cannot exceed 4. Every target and content field is capped at 4096
UTF-8 bytes; `max_added_bytes` and `max_removed_bytes` must each be an integer
from 1 through 8192, inclusive. The report records actual added/removed bytes.

Targets are matched against the immutable original. A missing or repeated
target, overlapping edit, frontmatter touch, protected-region touch, protected
marker injection, budget overflow, or invalid resulting Skill rejects the whole
patch. Recognized protected pairs are `SLOW_UPDATE_START/END`,
`APPENDIX_START/END`, and `SKILL_LAB_PROTECTED_START/END` HTML comments.

```bash
node "$SKILL_LAB_CLI" apply \
  --workspace-root "$PWD" \
  --source skills/example/SKILL.md \
  --edits .skill-lab/example/edits.json \
  --candidate .skill-lab/example/candidate_SKILL.md \
  --report .skill-lab/example/apply-report.json
```

Exit `0` means both reported final artifacts were published. Exit `2` means a
usage, schema, integrity, edit, or publication failure. Handled rollback removes
a published output only while its retained hard link proves physical ownership.
On filesystems without reliable inode identity, or after a concurrent
replacement, the CLI fails closed and may leave a complete orphan instead of
blindly deleting a path. Inspect the reported output and private-temp names
before deciding whether to remove anything.

## 2. Bind campaign evidence and gate

Freeze scenario, rubric, and environment files before selection sampling.
Retain every raw actor transcript as a physical file. Calculate each digest
from the exact bytes; the CLI opens every supplied preimage and recomputes it.

`results.json`:

```json
{
  "schema_version": 2,
  "campaign_id": "reviewer-body-v2",
  "artifacts": {
    "source": {
      "path": "skills/example/SKILL.md",
      "sha256": "7c2ddb8fe5687f7a926fee6d0a663c04ceeebcb0c8f03f21283195e68cfb228a"
    },
    "candidate": {
      "path": ".skill-lab/example/candidate_SKILL.md",
      "sha256": "de1866316b7bd51db3089092566193f717dfb45ce5e278e5cd83f0556c4559d2"
    },
    "scenario": {
      "path": ".skill-lab/example/campaign/scenarios.md",
      "sha256": "ae2480a7ce6635e29ba9b666369b327508943937bcc3f5fc77ea33b42cd78d69"
    },
    "rubric": {
      "path": ".skill-lab/example/campaign/rubric.md",
      "sha256": "e0a8c80deef84bc3344aa68a547e0a3e32e4b28c27e2361ab7fb55ee77983fda"
    },
    "environment": {
      "path": ".skill-lab/example/campaign/environment.json",
      "sha256": "1e5ce711a47c4a102fc52c88c783c2ed78065e9af6ad936bf55bd3c27f6c6c90"
    }
  },
  "required_valid": 5,
  "samples": [
    {
      "id": "important-current-1",
      "actor_id": "current-actor-1",
      "evidence_path": ".skill-lab/example/campaign/evidence/important-current-1.jsonl",
      "evidence_sha256": "e625d8f40c98aba514f7c2611af638b5029d6a4b9e0bb7ecc20254c6655741de",
      "split": "selection",
      "case_id": "important-1",
      "case_type": "important",
      "arm": "current",
      "outcome": "fail",
      "failure_code": "missing-loop-closure"
    },
    {
      "id": "control-candidate-1",
      "actor_id": "candidate-actor-1",
      "evidence_path": ".skill-lab/example/campaign/evidence/control-candidate-1.jsonl",
      "evidence_sha256": "f8a2e5768adcd6e9be573777865b93394f951b4a3b09e29fd2c1049ddcc30ba1",
      "split": "selection",
      "case_id": "control-1",
      "case_type": "control",
      "arm": "candidate",
      "outcome": "indeterminate",
      "reason": "actor output was truncated"
    }
  ]
}
```

The rows illustrate shape only. A gateable selection case has exactly
`required_valid` current and candidate outcomes, with `required_valid` between
5 and 100. Extra invalid/indeterminate attempts remain in the ledger but do not
count. A valid `fail` requires a stable ASCII `failure_code`; a pass must not
have one. A strict important improvement counts only when at least two current
failures in that case share a failure code, the candidate has no important
failure, and paired controls do not regress.

`train` and `test` rows are validated, hash-bound, and counted but cannot affect
the decision. An actor and evidence bundle may cover multiple cases only inside
one split/arm and only as the same one-to-one pair. Reuse across arms/splits,
pair changes, duplicates within a case arm, or unbalanced valid counts reject
the campaign.

```bash
node "$SKILL_LAB_CLI" gate \
  --workspace-root "$PWD" \
  --results .skill-lab/example/results.json \
  --report .skill-lab/example/gate-report.json
```

Exit `0` means the structural gate accepted. Exit `3` is a valid candidate
rejection and still writes the complete report. Exit `2` is a schema,
containment, hash, or publication failure.

The CLI proves that named files match their digests and that the declared
ledger is internally consistent. It does **not** prove that actor IDs represent
independent people/sessions, outcomes or failure codes were scored correctly,
or the opaque scenario/rubric files cover every intended case. A human reviewer
must inspect those facts.

## 3. Stage a self-contained accepted bundle

```bash
node "$SKILL_LAB_CLI" stage \
  --workspace-root "$PWD" \
  --source skills/example/SKILL.md \
  --candidate .skill-lab/example/candidate_SKILL.md \
  --edits .skill-lab/example/edits.json \
  --apply-report .skill-lab/example/apply-report.json \
  --results .skill-lab/example/results.json \
  --gate-report .skill-lab/example/gate-report.json \
  --output-dir .skill-lab/example/staged
```

Staging requires the `source` and `candidate` artifact paths in results to
identify the exact files passed on the command line. It reapplies the edit,
reopens every campaign/evidence preimage, reevaluates the gate, and compares
both supplied reports with freshly computed reports.

A completed directory contains:

```text
staged/
├── source_SKILL.md
├── proposed_SKILL.md
├── edits.json
├── results.json
├── apply/report.json
├── gate/report.json
├── campaign/{scenario,rubric,environment}.bin
├── evidence/<sha256>.bin              # deduplicated raw preimages
└── manifest.json                      # published last
```

`mkdir` reserves a new output directory without replacing a concurrent one.
Files are linked into it, then `manifest.json` is linked last. Only a directory
with a valid manifest is complete. A publication failure may intentionally
leave a partial directory **without** a manifest so the CLI never deletes a
concurrent party's path. Do not review or adopt it; inspect it first and then
ask the user whether to remove it or select another output directory.

The manifest binds every packaged file and maps original workspace evidence
paths and sample IDs to deduplicated evidence bytes. It supports independent
byte verification of the bundle, not independent proof of actor freshness,
scoring correctness, scenario coverage, or adoption fitness.

Exit `0` means a complete, freshly recomputed bundle was published. Exit `4`
means the recomputed gate rejected the candidate or disagreed with the supplied
accepted report. Exit `2` means a usage, schema, containment, integrity, or
publication failure; a publication failure may leave the incomplete,
manifest-less directory described above.

## 4. Rejection memory and human handoff

Keep rejected gate reports under a discoverable campaign-owned location such
as `.skill-lab/rejected-candidates/`. Before proposing another edit, compare its
rationale, source cases, assumptions, and immutable-source targets with earlier
rejections. This is a reviewer convention, not an automatic CLI history store.

For every accepted or rejected candidate, hand off:

- source and candidate digests plus the complete diff;
- operation and byte budgets versus actual bytes;
- scenario/rubric/environment and raw-evidence locations;
- human-attested actor, outcome, and failure-code limitations;
- prior rejection relationship;
- the gate decision and reasons; and
- any orphan or incomplete path requiring a user decision.

No `apply`, `gate`, or `stage` success authorizes replacing the source, changing
an active profile, installing a plugin, committing, pushing, or publishing.
