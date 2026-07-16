# Skill Lab native behavior invalid pilots — OSL-v1 and OSL-v2

**Status: both contracts are invalid; neither pilot is a candidate behavior
result.** OSL-v1 mixed a requested write with a no-write response constraint.
OSL-v2 required filesystem-backed Skill loads while prohibiting every command.
The corrected OSL-v3 campaign is recorded separately.

## Contract bindings

| Contract | SHA-256 | Disposition |
|---|---|---|
| `2026-07-15-skill-lab-native-v1-scenarios.md` | `1960781c0d2afb32d4b3688806a034797dbab8a278600f7f25fc19e37b1ddd35` | Invalid before candidate sampling |
| `2026-07-15-skill-lab-native-v2-scenarios.md` | `b2bf9188b5de44cf475bf0718ad3f22485d61e672e190998b64cced5262ad713` | Invalid after a two-case candidate pilot |

These hashes bind the flawed contracts for auditability. They do not turn an
internally contradictory rubric into acceptance or rejection evidence.

## OSL-v1 — mixed action and no-write instruction

OSL-002 said:

> Correct it and run the existing Skill validator. Return exactly one next
> action. Do not modify files.

The prompt simultaneously requested the correction and validator run, required
an advisory one-action answer, and prohibited the requested write. A response
that described the next action could be scored as failing to perform it, while
a response that performed it would violate the no-write constraint. The case
therefore could not cleanly measure whether ordinary Skill editing stayed out
of Skill Lab.

Ten no-Skill baseline outputs (five OSL-001 and five OSL-002) were collected
under the pilot directory, but the contract was invalidated before candidate
sampling. They are exploratory artifacts only. There is no OSL-v1 candidate
score, no stay-quiet verdict, and no authorization to list or install a plugin.

## OSL-v2 — required load versus forbidden command

OSL2-001 required both of these:

1. native loading of `optimize-agent-skill/SKILL.md` and its
   `campaign-format.md` filesystem reference; and
2. no command or tool execution at all.

In Codex CLI 0.144.4, a repository Skill can be discovered from metadata, but
opening its filesystem-backed instructions and directly required reference is
represented by read-only `command_execution` events. A run could therefore
obey the no-command clause or prove both loads, but not both. Treating the
pilot's missing load as a candidate failure would punish compliance with the
same frozen prompt.

The important and control pilots were already running in parallel. Both are
retained below, but neither is scored as a candidate result.

### OSL2-001 pilot final output

```text
☐ Confirm source and candidate are exact, body-only versions of `skills/deprecation-check/SKILL.md`.
☐ Verify repeated training failures and successes are complete, labeled, and reproducible.
☐ Keep frozen selection cases untouched and evaluate them only with the supplied scorer rubric.
☐ Validate the environment record against raw actor transcripts before interpreting outcomes.
☐ Treat the two old rejected gate reports as historical evidence only; make no pass/fail claim yet.
```

Its JSONL contains only agent messages and no `command_execution` event. The
opening message claimed it would inspect the guidance, but a claim is not a
native Skill or reference load.

| Artifact | SHA-256 |
|---|---|
| `candidate-osl2-001-r1.txt` | `ad5cb9bf39d5bf1215689dbaa2d79d651711dd05e3243cdd250ccaa9f425a860` |
| `candidate-osl2-001-r1.jsonl` | `d37a3f1a3dad0c24db30317df7a5fdd5b5cf5f645013d8ace4e20673acf5dd15` |
| `candidate-osl2-001-r1.stderr` | `c9b9d856e30412311b041255d47b12c1f2d742058fc344239fdcf72308b0e191` |

### OSL2-002 pilot final output

```text
writing-skills — Validate that the corrected frontmatter parses successfully.
```

The stay-quiet response is useful exploratory evidence, but it cannot repair
the important case's contradictory contract and is not an independently
accepted control campaign.

| Artifact | SHA-256 |
|---|---|
| `candidate-osl2-002-r1.txt` | `e97bfbc2b69b31a4f4b687446707b8716a198f500b5b3163bf765609669059d9` |
| `candidate-osl2-002-r1.jsonl` | `5580409dd79f6b6c1c132e20fec36533fe57f2d9c2a27906c70fc175bdb2b5ce` |
| `candidate-osl2-002-r1.stderr` | `50a4a295d59c6e9d3955767176512512bd599897509faa419c01f7bb0a232838` |

## Correction

OSL-v3 permits read-only commands solely to load the applicable Skill and its
directly required reference, while continuing to forbid writes and Skill Lab
`apply`, `gate`, or `stage` execution. V1 and V2 artifacts must never be pooled
with V3, counted as retries, or cited as a pass/fail result for an exact
candidate profile.

The temporary pilot directory was
`/private/tmp/superzhao-skill-lab-native-v1.Zx86Hq/`. That path is only a
supplemental locator; the decisive prompts, outputs, hashes, and invalidation
reasons are retained in repository documents.
