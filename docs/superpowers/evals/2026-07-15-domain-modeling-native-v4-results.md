# Domain-modeling native-discovery v4 result

**Status: rejected on the first valid important sample.** The revised trigger
metadata was visible in the native Skill list, but the actor did not load the
Skill. The parallel control pilot also missed its targeted-validation clause.
No retry or candidate edit was performed inside the frozen campaign.

## Binding

- frozen contract SHA-256:
  `dd895fd9d5fdfe5eb0a97303ac3de2dce6419b3017e9fce79945992e61539c01`
- 14-Skill-plus-candidate content-set SHA-256:
  `2704a82c2f403d6bc85e0289a1d15b64a2bb13a500fce673a02621a5d13c96ef`
- candidate `SKILL.md` SHA-256:
  `6ba24975ff24507ba4a5a6ab57472c740829d52c977f593d50eaeb82bb492f53`
- implicit `agents/openai.yaml` SHA-256:
  `e92104284ceb3c3a83d5ff5eae66acda48dbe1be1de7616e5e94620f4aedeb1c`
- reference SHA-256:
  `0d098718c93c933d895df8ec45605ccd5555f367a6b214a7f3eea793690da1f1`
- Codex CLI: `0.144.4`

The isolated `CODEX_HOME` used a read-only symlink to the existing auth file;
an outer macOS sandbox denied writes to the real Codex and Agents homes. No
credential contents were read or copied.

## Pilot results

| Case | Exit | Native Skill load | Response verdict |
|---|---:|---:|---|
| NDM4-001 R1 | 0 | no | Fail: omitted the immutable-receipt invariant and did not load the Skill. |
| NDM4-002 R1 | 0 | no | Fail: direct rename was correct, but the supplied targeted check was omitted. |

NDM4-001 final response:

> Convene the product owner to decide and record the frozen-state access cutoff
> and billing/term behavior as explicit lifecycle invariants before designing
> the migration.

NDM4-002 final response:

> Rename the private formatter parameter `seperator` to `separator` and update
> its internal references.

No JSONL or stderr record contains a read of the staged
`domain-modeling/SKILL.md`.

## Raw-artifact digests

| Artifact | SHA-256 |
|---|---|
| `ndm4-001-r1.txt` | `97a5bc1e9d30948d7fd1443a1bcba63400e9cb22ae81ab75f728fb4900cb9113` |
| `ndm4-001-r1.jsonl` | `486192ed8e78837120228bcd1b59c926979707d89ed72f055adb1c72d793a919` |
| `ndm4-001-r1.stderr` | `1aa26269eb1cc57f86b235a03cda53c004edb5b1e9fc99d4da4f00843293d721` |
| `ndm4-002-r1.txt` | `efe6e633de28e544f199ad61d0ee0c950c945e215a5280c0a2e2c212822b3f3d` |
| `ndm4-002-r1.jsonl` | `31e4fada5fa73ed3918457d4ece21763a54d435a2a0f21332917a53e9167224a` |
| `ndm4-002-r1.stderr` | `1aa26269eb1cc57f86b235a03cda53c004edb5b1e9fc99d4da4f00843293d721` |

## Decision

The exact implicit candidate is rejected. Restore explicit-only metadata and
do not list the engineering plugin as an evidence-accepted marketplace entry.
The source may remain as an experimental, manually selectable plugin candidate
only if its unverified status is prominent. Release requires a separate native
UI attachment campaign or a new independently frozen discovery candidate.
