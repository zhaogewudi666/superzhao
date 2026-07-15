# Skill Lab native behavior results — OSL-v3

**Status: implicit candidate rejected on the first valid candidate important
sample.** The corrected actor natively loaded both required files and obeyed
the five-line/read-only shape, but omitted the frozen operation/byte-budget and
adoption-boundary clause. Per the preregistered stop rule, no candidate control
or candidate R2–R5 sample was run.

OSL-v1 and OSL-v2 are invalid pilots, not predecessor scores. Their separate
invalidation record is
`2026-07-15-skill-lab-native-v1-v2-invalid-pilots.md`.

## Exact binding

- Base repository commit:
  `3ce466e67f3c80183566131aeee01aecacd1bffd`
- Frozen OSL-v3 contract SHA-256:
  `59daf284eedc51cc3e70f414d54f9cd2aacc36a351cd1848d0363afb4e781e8b`
- No-Skill 14-Skill content-set SHA-256:
  `71152f5e2be200fa6e55b10d60fe5af64dc1ef296030f2fecf4d3ec21dbb1ba5`
- Candidate 15-Skill content-set SHA-256:
  `154b7a561989720c821a3a3ab6c40ec50b6c47223b73d62ed15c70bf14a44dcc`
- Codex CLI: `0.144.4`

The content-set digest is SHA-256 over the UTF-8/C-locale-sorted
`shasum -a 256` records for every regular file below the profile's
`.agents/skills` directory, using paths relative to that directory. This is the
same algorithm whose unchanged 14-Skill result is `71152f5e…b1ba5` in the
earlier source-integration records; `.git` and run-state files are excluded.

### Evaluated candidate files

| Candidate file | SHA-256 |
|---|---|
| `optimize-agent-skill/SKILL.md` | `2fd214dcaab1975ba716491688c69c73ecd82e9950bcd7d0f3e437613522ce84` |
| `optimize-agent-skill/references/campaign-format.md` | `040cf6b49b5861eb8da1e481c4424c8f50aaf027c57f365bef5358336fa81dd0` |
| `optimize-agent-skill/agents/openai.yaml` | `9eb445e35f45de592fff3f5d30d4585ecc33de6e4210816afc3607cd6de99e16` |

The evaluated `openai.yaml` intentionally had no
`allow_implicit_invocation: false` policy: OSL-v3 tested narrow natural-language
discovery. The plugin CLI script was not part of the model profile; its bound
repository version during this campaign was
`e5153294583fe24db164ea4ee419011b9b38a2453c7e98287e23ec312f93efe1`.

After this rejection, the retained source restored the explicit-only policy
and clarified the reference's byte-budget range and `stage` exit codes. Those
post-campaign hashes are
`30b3fa33eaedd1b7bbf6f3d87137df851ca31457a32182e6227e4293bfd4d761`
for `openai.yaml` and
`793a8840ffbb401d00b8f347f8cdce26b929b1b816e7c405fd73fca0213e7329`
for `campaign-format.md`; the Skill and CLI script remain the
bound bytes above. These conservative packaging/documentation changes were not
part of the evaluated implicit profile and do not reverse its rejection or
create a behavior-acceptance claim for the retained source.

## Corrected prompt-input diagnostics

The corrected runs used `-a never`,
`-c skills.bundled.enabled=false`, `exec --ephemeral`,
`--ignore-user-config`, `--ignore-rules`, and `--sandbox read-only`. Every
sample had a separate `CODEX_HOME` and `HOME`; the Codex home referenced the
existing authentication file read-only. No credential value is reproduced in
this record.

The saved prompt-input diagnostics prove the discovered profile before
scoring:

| Diagnostic | SHA-256 | Skill count |
|---|---|---:|
| `baseline-osl3-prompt-input-corrected.json` | `6507583c92c32923dd86e570349111b4f7fc92ea0212157a399f2752f9d871ff` | 14 |
| `candidate-osl3-prompt-input-corrected.json` | `8c549ee803a146e761f608d30a99d5d8d7b1948e036199ad5b85a597634bc663` | 15 |

Baseline Skill names:

```text
brainstorming
dispatching-parallel-agents
executing-plans
finishing-a-development-branch
receiving-code-review
requesting-code-review
subagent-driven-development
systematic-debugging
test-driven-development
using-git-worktrees
using-superpowers
verification-before-completion
writing-plans
writing-skills
```

Candidate Skill names add exactly:

```text
optimize-agent-skill
```

No corrected baseline event stream contains a command that loads
`optimize-agent-skill` or its reference.

## Excluded infrastructure/profile runs

Two visibly invalid attempts are preserved and excluded rather than converted
into failures or favorable retries.

### Shared `CODEX_HOME` baseline batch

The first parallel baseline batch shared one `CODEX_HOME`. Its stderr streams
showed cross-process shell-snapshot races, including:

```text
Shell snapshot validation failed ... no such file or directory
Failed to finalize shell snapshot ... No such file or directory
failed to refresh available models: timeout waiting for child process to exit
```

Those ten runs were renamed with the
`baseline-osl3-invalid-shared-home-` prefix. They are infrastructure-invalid
and are not any of the baseline outputs below. The corrected batch used one
isolated run home per actor.

### Candidate run without the frozen profile flag

The first candidate OSL3-001 attempt omitted
`-c skills.bundled.enabled=false`, so it did not prove the exact frozen
15-Skill input even though it returned a final response. It was renamed
`candidate-osl3-invalid-profile-001-r1` and excluded.

| Excluded artifact | SHA-256 |
|---|---|
| `candidate-osl3-invalid-profile-001-r1.txt` | `d30376a7d8bf27238a453d243b6c6120da2911190fa6a1244e2c8f1eb96a527e` |
| `candidate-osl3-invalid-profile-001-r1.jsonl` | `424d1b0575a69ce35283a11877a84afe2a985fc6b5ae713df9881c9617065a3b` |
| `candidate-osl3-invalid-profile-001-r1.stderr` | `650326b754ee2c0ff76597a95527832765413be2360defd776415565b6204ad4` |

The separately named corrected candidate sample below is a new actor with a
new thread ID and the exact diagnostic/configuration.

## Corrected no-Skill baseline ledger

All ten corrected runs reached `turn.completed`, used distinct thread IDs and
run homes, and retained their final text, event stream, and stderr. OSL3-001 is
0/5 because the no-Skill profile cannot natively load the absent Skill and
reference. OSL3-002 is 2/5 under the frozen strict rubric: R2 and R3 take a
localized/direct ordinary-edit route with a validation step; the three
`Reference-only` answers do not correctly identify an Agent Skill frontmatter
edit.

| Sample | Thread ID | Strict result | Final / JSONL / stderr SHA-256 |
|---|---|---|---|
| OSL3-001 R1 | `019f64dc-0f4a-7d70-85d2-fb10b9d2bcc1` | Fail | `f7896d81…f4a191` / `4a7c6f9f…35bc3d` / `8c1bca3e…6b98f8` |
| OSL3-001 R2 | `019f64dc-0da6-7aa3-ba11-b3b3c5b7c1b6` | Fail | `bb3b2d4b…9939a7` / `522ce09d…0a7558` / `fd2de9d4…9285a2` |
| OSL3-001 R3 | `019f64dc-11b9-7393-9f90-b0e40c0932e1` | Fail | `516702e4…dd71c` / `c6d9af38…2ae227` / `fd3ab213…35df2e` |
| OSL3-001 R4 | `019f64dc-0d5e-7792-ab18-ce582940519c` | Fail | `8e165f0b…43dfe2` / `0ef9f913…c08e38` / `42d9d8c8…51ebcf` |
| OSL3-001 R5 | `019f64dc-11c7-7832-8fb4-77f288203715` | Fail | `83e0b8c9…e543a` / `26052048…9be62` / `6efd8391…9a7efb` |
| OSL3-002 R1 | `019f64dd-94d4-7843-a257-ea30c5e1024e` | Fail | `27fe66a3…f949a9` / `2c030314…ebb0681` / `9bc2cfd1…e20ef` |
| OSL3-002 R2 | `019f64dd-91cb-7dc0-8394-7ae5482841b5` | Pass | `e81678a6…56e102` / `11c0e650…ed8cd3` / `429ec4ff…25080` |
| OSL3-002 R3 | `019f64dd-8ef1-7273-a764-18918a8c3950` | Pass | `1d490b97…9093a9` / `473bc813…0119bd` / `648b9039…8a227` |
| OSL3-002 R4 | `019f64dd-8145-7dd2-950f-3cbf4431d232` | Fail | `be28db77…1fa69a` / `af409dbc…c0a1c` / `af55fa34…802fc` |
| OSL3-002 R5 | `019f64dd-94f2-7fa3-81ba-dc9b10358b73` | Fail | `87883c53…f98df` / `33086b46…1347e6` / `16efae0c…457c2` |

The abbreviated digests above are expanded in the raw-artifact table after the
verbatim outputs.

### OSL3-001 baseline R1

```text
- [ ] Confirm only the `SKILL.md` body changed; frontmatter and exact source/candidate identities match.
- [ ] Use the current Skill—not a no-Skill arm—as the baseline for every matched scenario.
- [ ] Bind repeated failures and successes to valid, fresh, uncoached raw actor transcripts.
- [ ] Score frozen selection and control cases with the supplied rubric; reject any candidate regression.
- [ ] Verify the environment record matches all evidence; treat old rejected gate reports as non-authoritative context.
```

### OSL3-001 baseline R2

```text
- [ ] Bind the exact current and candidate bodies; confirm frontmatter and supporting files are unchanged.
- [ ] Verify repeated valid baseline failures and candidate successes directly from raw actor transcripts.
- [ ] Confirm frozen selection cases include important and control scenarios with no candidate regression.
- [ ] Apply the frozen scorer rubric under the recorded environment; exclude invalid, coached, retried, or indeterminate runs.
- [ ] Treat old rejected gate reports as context only; proceed only on complete, content-bound evidence without invented results.
```

### OSL3-001 baseline R3

```text
- [ ] Bind the evaluation to the exact source and candidate bodies; confirm this is a body-only change.
- [ ] Verify repeated failures and successes are valid, independent, uncoached samples matched to the recorded environment.
- [ ] Apply the scorer rubric consistently to raw actor transcripts; do not infer outcomes from summaries alone.
- [ ] Check every frozen selection case for target improvement and regressions in existing successful control behavior.
- [ ] Treat old rejected gate reports as non-authoritative context; report no result without a newly authorized gate run.
```

### OSL3-001 baseline R4

```text
- [ ] Bind the exact current source and body-only candidate; confirm frontmatter and supporting artifacts are unchanged.
- [ ] Use the current Skill—not a no-Skill arm—as baseline, preserving repeated failures and successful controls.
- [ ] Freeze selection cases before scoring; apply the supplied rubric consistently to important and control cases.
- [ ] Bind every result to the environment record and manually audit raw transcripts for coaching, retries, invalid runs, and regressions.
- [ ] Treat both rejected gate reports as historical context only; claim no pass or readiness without fresh authorized gate evidence.
```

### OSL3-001 baseline R5

```text
- [ ] Bind the evaluation to the exact source and body-only candidate identities.
- [ ] Confirm repeated training runs include fresh, valid samples and report failures, successes, retries, and indeterminates.
- [ ] Keep frozen selection cases unchanged and separate from training evidence.
- [ ] Verify scores against the supplied rubric, environment record, and raw actor transcripts.
- [ ] Treat old rejected gate reports as context only; claim no apply, gate, stage, or unevidenced result.
```

### OSL3-002 baseline R1

```text
Reference-only change workflow; validate with a deterministic retrieval/application check.
```

### OSL3-002 baseline R2

```text
R1 localized-change workflow — inspect the diff to confirm only the typo changed.
```

### OSL3-002 baseline R3

```text
R1 direct-edit workflow; validate with a targeted frontmatter/schema check.
```

### OSL3-002 baseline R4

```text
Reference-only change workflow; run a deterministic retrieval/application check.
```

### OSL3-002 baseline R5

```text
Reference-only change workflow — validate with a deterministic frontmatter/schema check.
```

## Corrected candidate result

The corrected OSL3-001 R1 actor used thread
`019f64da-dc03-7d53-af4f-c74e01efa45b`. Its JSONL contains exactly two
completed command executions, both read-only and both exit `0`:

```text
/bin/zsh -lc "sed -n '1,240p' .agents/skills/optimize-agent-skill/SKILL.md"
/bin/zsh -lc "sed -n '1,320p' .agents/skills/optimize-agent-skill/references/campaign-format.md"
```

There was no write command and no Skill Lab CLI execution. This is direct
native-load evidence for the Skill and its required reference, not an inference
from fluent output.

The exact final output was:

```text
- [ ] Bind exact source/candidate bytes; confirm unchanged frontmatter and body-only scope.
- [ ] Classify repeated failures versus execution lapses; preserve repeated successes.
- [ ] Compare both rejected gate reports; require new evidence or changed assumptions.
- [ ] Freeze cases, rubric, environment, and raw transcripts; verify coverage and identity pairing.
- [ ] Require ≥5 valid samples per arm/case; do not apply, gate, stage, modify, or invent outcomes.
```

Clause-by-clause scoring:

| Clause | Result | Evidence |
|---|---|---|
| 1. Native Skill and reference load | Pass | The two completed `sed` events above read the exact bound files. |
| 2. Five lines, read-only, no Skill Lab CLI | Pass | The final has exactly five checklist lines; the only commands were the two reads. |
| 3. Bind source/candidate/scenario/rubric/environment/raw evidence | Pass | Lines 1 and 4 require exact source/candidate bytes, frozen cases, rubric, environment, and raw transcripts. |
| 4. Defect/lapse, successes, prior rejections | Pass | Lines 2 and 3 cover all three requirements and both rejected reports. |
| 5. Operation/byte budgets and adoption boundary | **Fail** | It names body-only scope and sample count, but omits the operation cap, per-edit/total added/removed byte budgets, and the explicit source/active replacement, installation, adoption, commit, and publication exclusions. `Do not apply, gate, stage, modify` is not equivalent to those frozen requirements. |

This is a valid response failure, not an infrastructure failure or an
indeterminate result. The exact implicit candidate is therefore rejected on
its first valid important sample. The frozen rule required sampling to stop, so
OSL3-002 candidate R1 and all candidate R2–R5 cells are intentionally **not
run**, not missing evidence.

Candidate artifact hashes:

| Artifact | SHA-256 |
|---|---|
| `candidate-osl3-001-r1.txt` | `de460e69223d3ed06138ea3b578da9675fb1a9fd972a71754c8bf036207dc1c3` |
| `candidate-osl3-001-r1.jsonl` | `54a7c94f1a33960ec6b4637d7cb8b998895bda2e0333273863e1275af191c742` |
| `candidate-osl3-001-r1.stderr` | `31397ed34b6ca0ded1fa89698cbaa1cbadb78389d3f29aa6c099c7338bd4d26d` |

## Corrected baseline raw-artifact hashes

| Artifact | SHA-256 |
|---|---|
| `baseline-osl3-001-r1.txt` | `f7896d81a30c1285b8364a0d71feca1242dcb836c2f18bafcc079607faf4a191` |
| `baseline-osl3-001-r1.jsonl` | `4a7c6f9f83398104f4ea44afc0b09711ba39d18e216faf807e0d621b8d35bc3d` |
| `baseline-osl3-001-r1.stderr` | `8c1bca3e942f4e2be0f9697d45667cd666537f881d0a4018b7c78c49ca6b98f8` |
| `baseline-osl3-001-r2.txt` | `bb3b2d4bb6c8d3b737aa6d19ad65f68cd7fb8a0ed459607caa2d88950d9939a7` |
| `baseline-osl3-001-r2.jsonl` | `522ce09dcf2f3dab1da26707c4f3d7563dcbb4e9089dd6c8193389dc560a7558` |
| `baseline-osl3-001-r2.stderr` | `fd2de9d405280372e480c2bd9694b5d7d38c9e525528465a03f73a10549285a2` |
| `baseline-osl3-001-r3.txt` | `516702e43ddcc04291af4c72b320768ba6e546ff6cd60791bf0768ca597dd71c` |
| `baseline-osl3-001-r3.jsonl` | `c6d9af38f01acc3c30e7e3c459c4ba09a508e119e0ae59914bc8a2867e2ae227` |
| `baseline-osl3-001-r3.stderr` | `fd3ab2137ce7cc63dcf3f05511e49b3e1b459cdb91746e7f58da7b3a5c35df2e` |
| `baseline-osl3-001-r4.txt` | `8e165f0b52b64c81546dd12ec17b25d95d6c39291691c545264a1337de43dfe2` |
| `baseline-osl3-001-r4.jsonl` | `0ef9f91305a66c08443b72727afde3a33b6eaac0308410e82fa9230190c08e38` |
| `baseline-osl3-001-r4.stderr` | `42d9d8c871148976220007be351bbf282e3a1b6460c1a95266d728ddc851ebcf` |
| `baseline-osl3-001-r5.txt` | `83e0b8c926577f858aa04ddc1881f5005078837ddb7f13263891362fda6e543a` |
| `baseline-osl3-001-r5.jsonl` | `26052048d9db903da97b8675c1c644558a2e68125cd8db244a8ba3b6e969be62` |
| `baseline-osl3-001-r5.stderr` | `6efd839155abe0d684bd0d0e6c08cb6b7f2c17f0ef8e9e598afe96db039a7efb` |
| `baseline-osl3-002-r1.txt` | `27fe66a32cd9dd33c41860fda71827ccbc083491e13d8c94336119a6e0f949a9` |
| `baseline-osl3-002-r1.jsonl` | `2c03031419175586f25549216039bca32a2e741323c536a9700f28520ebb0681` |
| `baseline-osl3-002-r1.stderr` | `9bc2cfd1af06ec49408be77ff6526f9ea7aa8d1c3d111bcb8849a115509e20ef` |
| `baseline-osl3-002-r2.txt` | `e81678a63c87c33c6a00cc2d42e3cab1d1ebbe92d03aee64d04448a3b256e102` |
| `baseline-osl3-002-r2.jsonl` | `11c0e650ce2c8378456b77d00830971708fea71fd6c846cb246b3eb7d1ed8cd3` |
| `baseline-osl3-002-r2.stderr` | `429ec4ff71fcdaa42ca4b2cb5f4f50be38c34e4fad0946dd19cd737dd6125080` |
| `baseline-osl3-002-r3.txt` | `1d490b97b24e440c9577a1d0283203cd24c9af591ac8fdb9fc6980393c9093a9` |
| `baseline-osl3-002-r3.jsonl` | `473bc813887d3855a1858cc27dacb294e9dccfd35475c8434d9fcd1eb60119bd` |
| `baseline-osl3-002-r3.stderr` | `648b9039d4c682ae7b0db130bd10ac51043dac1c272b893146b3b6980b28a227` |
| `baseline-osl3-002-r4.txt` | `be28db7756a7d9ace69f00c94f4313ea98f53885e8125d31ca3c279ff01fa69a` |
| `baseline-osl3-002-r4.jsonl` | `af409dbc3cb93467a574df2ce365fa38bf2702b75c41fea3fbef85a2314c0a1c` |
| `baseline-osl3-002-r4.stderr` | `af55fa34dede4e8ed8605663435fdd72090feb1f8ad14709b670c99bf2f802fc` |
| `baseline-osl3-002-r5.txt` | `87883c5377d4597b70dcdc3907fc2d73c6661b2724edf6c605987c2ae7ff98df` |
| `baseline-osl3-002-r5.jsonl` | `33086b46cb9c0e0b4fc245eda8355d968f262263391b55656de5d9b2c31347e6` |
| `baseline-osl3-002-r5.stderr` | `16efae0cf63e3edf084d40e988e26ed75ae870a05dbb54e8afe86145638457c2` |

The temporary evidence root was
`/private/tmp/superzhao-skill-lab-native-v1.Zx86Hq/`. It is only a supplemental
locator. Every final response, decisive load event, scoring reason, and
artifact digest needed for the rejection is embedded above.

## Decision and retained-source status

- Reject the exact implicit candidate bound above.
- Remove `superzhao-skill-lab` from the repository marketplace; deterministic
  CLI tests do not override a failed native behavior gate.
- Restore `policy.allow_implicit_invocation: false` in the retained source as a
  conservative packaging boundary.
- The restored explicit-only source is **not** the evaluated profile. It may
  remain as an experimental, manually selected candidate, but this campaign
  makes no claim that explicit UI attachment, its response behavior, or
  marketplace fitness passed.
- No result authorizes installation, active-profile mutation, candidate
  adoption, commit, push, or publication.
