# Provenance

This plugin adapts concepts from
[`microsoft/SkillOpt`](https://github.com/microsoft/SkillOpt) at commit
`57333f3406436a90a2b5feec4aad74ddb33d6e85`.

The bounded-edit model comes from `skillopt/types.py` and
`skillopt/optimizer/skill.py`. Gate and staging ideas come from
`skillopt_sleep/gate.py`, `skillopt_sleep/consolidate.py`,
`skillopt_sleep/staging.py`, and `skillopt_sleep/cycle.py`.

Superzhao deliberately strengthens those contracts: targets and UTF-8 byte
budgets are bounded, frontmatter and protected regions are immutable, supplied
scenario/rubric/environment/raw-evidence preimages are opened and rehashed,
selection cannot fall back to train/test rows, repeated failure codes and exact
balanced valid counts are required, controls cannot regress, rejected
candidates cannot be staged, and no adoption command exists.

Apply and gate use private temporary files plus no-replace hard links. A handled
rollback removes a final path only while physical ownership is provable;
otherwise it preserves a complete orphan rather than deleting blindly. Stage
packages the full campaign and publishes `manifest.json` last. Mid-publication
failure can leave an incomplete directory without a manifest, which must be
inspected before user-directed cleanup. OS-crash atomicity and protection from
a malicious same-user concurrent directory swap are not claimed.

The CLI verifies byte identity and ledger consistency. Actor identities,
outcomes, failure codes, and the coverage quality of opaque scenario/rubric
files remain human-attested and require review.

The repository Skill includes an agent/human-facing proposer protocol adapted
from SkillOpt's analyst, merge, ranking, and skill-aware reflection ideas. The
CLI does not run those models or automatically generate, merge, or rank edits.
The OSL-v3 native campaign rejected the exact implicit candidate on its first
valid important sample, so the retained package is explicit-only, unlisted,
and is not claimed as behavior accepted.

The complete Microsoft license travels with this plugin in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). The repository root also
keeps the combined notice for source-tree consumers. The Superzhao license is
in [`LICENSE`](LICENSE).
