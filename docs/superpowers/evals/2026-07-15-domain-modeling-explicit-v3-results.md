# Domain-modeling explicit-invocation v3 result

**Status: rejected as a Codex CLI invocation profile.** Both pilot responses
were valid model responses, but neither session loaded the staged Skill. Plain
text containing `$domain-modeling` did not emulate a Codex UI Skill attachment.
The campaign stopped after the pilot and makes no claim about manual picker
behavior.

## Binding

- frozen contract SHA-256:
  `01b10a0d4f4a896e534429a8ac7aad08323adff1f9c8ddeefb152134827e8497`
- 14-Skill-plus-candidate content-set SHA-256:
  `6cdab6c0292266f130e62d4d65f04da9dce0b4d361f912bf30148511ef0e43d1`
- candidate `SKILL.md` SHA-256:
  `275e36946c2851a7f7a3afb1f2a4e9e5d7697fa0807fb377febbf4638f5359e7`
- explicit `agents/openai.yaml` SHA-256:
  `b8a23b35e71f7f56589633fc68f3e860a71d2d1b1ff26885ba16e1cf9896bc0b`
- reference SHA-256:
  `0d098718c93c933d895df8ec45605ccd5555f367a6b214a7f3eea793690da1f1`
- Codex CLI: `0.144.4`

The isolated `CODEX_HOME` used a read-only symlink to the existing auth file;
an outer macOS sandbox denied writes to the real Codex and Agents homes. No
credential contents were read or copied.

## Pilot results

| Case | Exit | Native Skill load | Response verdict |
|---|---:|---:|---|
| EDM-001 R1 | 0 | no | Response text met the content clauses, but the required Skill-load clause failed. |
| EDM-002 R1 | 0 | no | Response took the direct rename and targeted-check route, but the required Skill-load clause failed. |

EDM-001 final response:

> Before migration, have the domain owner decide the provisional `active →
> paused` transition: issued invoices remain immutable, while they must specify
> whether entitlement ends immediately or after the paid period and whether
> billing stops or continues during pause.

EDM-002 final response:

> Rename private local `reslt` to `result`, then validate with `npm test --
> result-helper.test.ts`.

No JSONL or stderr record contains a read of the staged
`domain-modeling/SKILL.md`.

## Raw-artifact digests

| Artifact | SHA-256 |
|---|---|
| `edm001-r1.txt` | `d7309dc6bdf63059e0d22c205351780940b9a260040a9ef9e3d708bbff18dec1` |
| `edm001-r1.jsonl` | `adb60d5e749e9cd6b2027412425ad194ac88841045702e350136b6adefe24e44` |
| `edm001-r1.stderr` | `1aa26269eb1cc57f86b235a03cda53c004edb5b1e9fc99d4da4f00843293d721` |
| `edm002-r1.txt` | `40e7f7f2644c0bcc9332fd4d53e119ff461beea34f113e75b9aaec6c90a4a95d` |
| `edm002-r1.jsonl` | `2ed64886881551bb328130ebf162a1676e3c41d834a2c6970d8bfcac16a071a7` |
| `edm002-r1.stderr` | `1aa26269eb1cc57f86b235a03cda53c004edb5b1e9fc99d4da4f00843293d721` |

## Decision

Do not count fluent content as Skill evidence when the Skill never loaded. This
profile does not authorize repository release, installation, or an implicit
invocation claim. A manual Codex UI picker campaign would be a separate profile
and needs its own native attachment evidence.
