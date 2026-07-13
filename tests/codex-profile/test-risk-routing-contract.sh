#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
failures=0

require_text() {
  local file="$1" pattern="$2" label="$3"
  if ! grep -Eq "$pattern" "$ROOT/$file"; then
    printf 'FAIL: %s\n' "$label" >&2
    failures=$((failures + 1))
  fi
}

reject_text() {
  local file="$1" pattern="$2" label="$3"
  if grep -Eq "$pattern" "$ROOT/$file"; then
    printf 'FAIL: %s\n' "$label" >&2
    failures=$((failures + 1))
  fi
}

require_text skills/using-superpowers/SKILL.md 'R0|R1|R2|R3' 'bootstrap routes by risk'
require_text skills/using-superpowers/SKILL.md 'explicit(ly)? named|clearly match' 'bootstrap uses explicit skill matching'
reject_text skills/using-superpowers/SKILL.md '1% chance' 'bootstrap removes one-percent trigger'

require_text skills/brainstorming/SKILL.md 'material(ly)? ambiguous|consequential trade-offs|R3' 'brainstorming has narrow trigger'
reject_text skills/brainstorming/SKILL.md 'EVERY project' 'brainstorming no longer forces every project'
require_text skills/writing-plans/SKILL.md 'three dependent|multiple components|R3' 'planning is complexity gated'
require_text skills/test-driven-development/SKILL.md 'observable behavior|regression|public contract' 'TDD targets observable behavior'
require_text skills/test-driven-development/SKILL.md 'alternative validation|best available deterministic validation' 'TDD has explicit non-behavior fallback'
require_text skills/subagent-driven-development/SKILL.md 'fork_turns' 'SDD controls inherited context'
reject_text skills/subagent-driven-development/SKILL.md 'must explicitly specify a model|general-purpose subagent' 'SDD does not require unsupported dispatch fields'
reject_text skills/subagent-driven-development/implementer-prompt.md 'Subagent \(general-purpose\)|model: \[MODEL' 'implementer prompt uses available dispatch fields'
reject_text skills/subagent-driven-development/task-reviewer-prompt.md 'Subagent \(general-purpose\)|model: \[MODEL' 'task reviewer prompt uses available dispatch fields'
reject_text skills/requesting-code-review/code-reviewer.md 'Subagent \(general-purpose\)' 'code reviewer prompt is capability-neutral'

reject_text skills/using-superpowers/references/codex-tools.md 'close_agent' 'Codex reference removes unavailable close_agent'
require_text skills/using-superpowers/references/codex-tools.md 'fork_turns' 'Codex reference documents fork_turns'
require_text skills/using-superpowers/references/codex-tools.md 'followup_task' 'Codex reference documents follow-up turns'
require_text skills/using-superpowers/references/codex-tools.md 'interrupt_agent' 'Codex reference documents interruption'

require_text skills/verification-before-completion/SKILL.md 'R1|targeted' 'verification scales low-risk checks'
require_text skills/verification-before-completion/SKILL.md 'R2|affected' 'verification scales medium-risk checks'
require_text skills/verification-before-completion/SKILL.md 'R3|full' 'verification scales high-risk checks'

for script in scripts/install-codex-profile.sh scripts/rollback-codex-profile.sh; do
  if [[ ! -x "$ROOT/$script" ]]; then
    printf 'FAIL: executable %s is missing\n' "$script" >&2
    failures=$((failures + 1))
  fi
done

if (( failures > 0 )); then
  printf '%d contract check(s) failed\n' "$failures" >&2
  exit 1
fi

printf 'Codex profile contract checks passed\n'
