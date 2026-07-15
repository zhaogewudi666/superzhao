# Domain-modeling native-discovery results — NDM-v2

**Status:** rejected on the first valid important sample; no retry or further
sampling

NDM-v2 tests whether the optional domain-modeling candidate is discovered and
loaded through native Codex repository Skill discovery when the prompt does not
name or force-read the Skill. NDM-001 R1 was a valid response failure and did
not load the Skill, so the preregistered 5/5 important-case gate became
unreachable immediately. NDM-002 R1 had already been launched in parallel; its
valid output is retained too.

## Frozen binding

- Scenario contract:
  `docs/superpowers/evals/2026-07-15-domain-modeling-native-v2-scenarios.md`
- Scenario contract SHA-256:
  `a1e9d7ea11745d2e4dd3c622cfddead3ad393120f6ad5af29739ae1f38adbea7`
- Candidate content-set SHA-256:
  `34ddfca841ef2a2c1c8562a19c6e067d3626f766e3787697ddce45082a0875d3`

| Candidate file | SHA-256 |
|---|---|
| `domain-modeling/SKILL.md` | `3bbd35a053182f47f0226ffa983319f2204d083bca17165c6fc66a568828c694` |
| `domain-modeling/agents/openai.yaml` | `e92104284ceb3c3a83d5ff5eae66acda48dbe1be1de7616e5e94620f4aedeb1c` |
| `domain-modeling/references/modeling-frame.md` | `0d098718c93c933d895df8ec45605ccd5555f367a6b214a7f3eea793690da1f1` |

The evaluated `openai.yaml` intentionally omitted the repository candidate's
explicit-only policy. This made NDM-v2 a test of the proposed implicit
metadata, not a test of the retained explicit-only package.

## Environment and discovery route

- Harness: `codex-cli 0.144.4`
- Isolated repository:
  `/private/tmp/superzhao-domain-native-v2.Sgdxrf/repo`
- Isolated profile: the exact current 14 managed core Skills plus the bound
  domain-modeling candidate, exposed only below repository-local
  `.agents/skills`
- Invocation: ephemeral, ignore user configuration and rules, read-only
  sandbox, no approval, JSON event output, and
  `skills.bundled.enabled=false`
- Credential handling: the isolated Codex home referenced the existing auth
  file without reading or copying it into this report; an outer sandbox denied
  writes below the real `~/.codex` and `~/.agents` trees

Before sampling, Codex's prompt-input diagnostic listed exactly the 15 staged
Skills, including domain-modeling. This proves metadata visibility only. The
rubric separately required the session to load `domain-modeling/SKILL.md`.

## Sampling ledger

| Run | Exit | Domain Skill load | Response result | Decision |
|---|---:|---|---|---|
| NDM-001 R1 | 0 | No | Fail | Valid important-case failure; campaign rejected |
| NDM-002 R1 | 0 | No | Fail | Valid stay-quiet response failure; retained because it was already running |
| R2–R5 | — | — | Not run | Gate already unreachable; no valid failure retried |

Neither JSONL event stream contains `domain-modeling`, its `SKILL.md` path, or
a command that reads the file.

### NDM-001 R1

Verbatim final output:

```text
Ask the product manager to explicitly decide and document the entitlement and billing semantics before starting the migration.
```

The response correctly stopped before migration, but it omitted the supplied
immutable-invoice invariant, did not identify an affected entitlement/billing
state or transition, and did not state the two explicit alternative pairs
(immediate versus period-end entitlements; stop versus defer billing). It also
failed the independent native-load requirement.

### NDM-002 R1

Verbatim final output:

```text
I would rename the private local variable in its implementation.
```

The direct rename avoided modeling ceremony and correctly did not load the
domain Skill, but it omitted the already-available targeted check required by
the response rubric.

## Verbatim native event streams

### NDM-001 R1 JSONL

```json
{"type":"thread.started","thread_id":"019f64b2-ee39-7150-bc37-8446433943c5"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"Ask the product manager to explicitly decide and document the entitlement and billing semantics before starting the migration."}}
{"type":"turn.completed","usage":{"input_tokens":14038,"cached_input_tokens":8960,"output_tokens":115,"reasoning_output_tokens":90}}
```

### NDM-001 R1 stderr

```text
2026-07-15T07:34:32.933596Z  WARN codex_rollout::state_db: state db backfill is running at /private/tmp/superzhao-domain-native-v2.Sgdxrf/codex-home; waiting up to 30s before retrying startup initialization
Reading additional input from stdin...
```

### NDM-002 R1 JSONL

```json
{"type":"thread.started","thread_id":"019f64b2-ecf5-7dd1-bf15-1b30922a3f2f"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"I’m consulting the required `using-superpowers` skill before naming the next action."}}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"I would rename the private local variable in its implementation."}}
{"type":"turn.completed","usage":{"input_tokens":28221,"cached_input_tokens":17920,"output_tokens":292,"reasoning_output_tokens":168}}
```

### NDM-002 R1 stderr

```text
Reading additional input from stdin...
2026-07-15T07:35:00.730303Z  WARN codex_core::shell_snapshot: Failed to delete shell snapshot at AbsolutePathBuf("/private/tmp/superzhao-domain-native-v2.Sgdxrf/codex-home/shell_snapshots/019f64b2-ecf5-7dd1-bf15-1b30922a3f2f.1784100875510952000.sh"): Os { code: 2, kind: NotFound, message: "No such file or directory" }
```

## Preserved raw-artifact binding

| Artifact | SHA-256 |
|---|---|
| `ndm001-r1.txt` | `f1bc5713ba299aa9bbe53918228417a01ecc5cf9ed569a29510aab156270f0e6` |
| `ndm001-r1.jsonl` | `3ddd424fe32a780b7fdf2507cc2e41f222cd91212e4882333439893d528db59e` |
| `ndm001-r1.stderr` | `204ec71e939f749af56e654a92c88258f6dabc3d36f00d4999eeaa0e76f598c0` |
| `ndm002-r1.txt` | `cc9899584abc986b7db8a7ca73f3dc8fe03115a3305e7979d8d46d1504133f00` |
| `ndm002-r1.jsonl` | `252fa66a36fc3ad8c0813f047532a6d0a1f87b14bce1ed83d88070505545d1ea` |
| `ndm002-r1.stderr` | `5c226b400b7f4c8753567afacae27a08de15e5e38eb772d604bce4e971103c11` |

The artifacts remain under
`/private/tmp/superzhao-domain-native-v2.Sgdxrf/`. The final text is reproduced
above so the decision does not depend on the lifetime of that temporary
directory. The JSONL and stderr files are unmodified; their hashes bind the
complete native execution evidence.

## Decision

Reject implicit invocation for this candidate. Keep
`allow_implicit_invocation: false` in the repository package, make no claim
that native discovery corrects the SEB-019 gap, and do not supplement this
valid failure with favorable retries. The optional Skill remains available for
deliberate explicit invocation; this evaluation authorizes no installation,
commit, push, or publication.
