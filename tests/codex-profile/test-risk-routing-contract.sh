#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
failures=0

require_text() {
  local file="$1" pattern="$2" label="$3"
  local path="$ROOT/$file"
  local status

  if [[ ! -f "$path" || ! -r "$path" ]]; then
    printf 'FAIL: %s (target is not a readable regular file: %s)\n' "$label" "$file" >&2
    failures=$((failures + 1))
    return
  fi

  if grep -Eq "$pattern" "$path"; then
    return
  else
    status=$?
  fi

  if (( status == 1 )); then
    printf 'FAIL: %s\n' "$label" >&2
  else
    printf 'FAIL: %s (grep error %d while reading %s)\n' "$label" "$status" "$file" >&2
  fi
  failures=$((failures + 1))
}

reject_text() {
  local file="$1" pattern="$2" label="$3"
  local path="$ROOT/$file"
  local status

  if [[ ! -f "$path" || ! -r "$path" ]]; then
    printf 'FAIL: %s (target is not a readable regular file: %s)\n' "$label" "$file" >&2
    failures=$((failures + 1))
    return
  fi

  if grep -Eq "$pattern" "$path"; then
    printf 'FAIL: %s\n' "$label" >&2
    failures=$((failures + 1))
  else
    status=$?
    if (( status > 1 )); then
      printf 'FAIL: %s (grep error %d while reading %s)\n' "$label" "$status" "$file" >&2
      failures=$((failures + 1))
    fi
  fi
}

require_text skills/using-superpowers/references/risk-levels.md 'R0.*Read-only.*without requested edits' 'risk reference defines R0 from observable conditions'
require_text skills/using-superpowers/references/risk-levels.md 'R1.*Localized.*reversible.*no runtime behavior.*data contract.*security.*deployment.*external integration.*production-critical' 'risk reference defines R1 from observable conditions'
require_text skills/using-superpowers/references/risk-levels.md 'R2.*Bug.*observable behavior.*public API.*coordinated multi-file.*without R3 consequences' 'risk reference defines R2 from observable conditions'
require_text skills/using-superpowers/references/risk-levels.md 'R3.*Security.*auth.*money.*migration.*concurrency.*destructive.*production deployment.*external side effect.*cross-system' 'risk reference defines R3 from observable conditions'
require_text skills/using-superpowers/SKILL.md 'risk-levels\.md' 'bootstrap routes through the shared risk reference'
require_text skills/using-superpowers/SKILL.md 'user names it' 'bootstrap loads explicitly named skills'
require_text skills/using-superpowers/SKILL.md 'description clearly matches' 'bootstrap loads clearly matching skills'
reject_text skills/using-superpowers/SKILL.md '1% chance' 'bootstrap removes one-percent trigger'

require_text skills/brainstorming/SKILL.md 'material(ly)? ambiguous' 'brainstorming triggers on material ambiguity'
require_text skills/brainstorming/SKILL.md 'consequential (design )?trade-offs' 'brainstorming triggers on consequential trade-offs'
require_text skills/brainstorming/SKILL.md 'R3' 'brainstorming retains the R3 gate'
reject_text skills/brainstorming/SKILL.md 'EVERY project' 'brainstorming no longer forces every project'
require_text skills/writing-plans/SKILL.md 'R3' 'planning retains the R3 gate'
require_text skills/writing-plans/SKILL.md '(three or more|at least three) dependent (implementation )?steps' 'planning gates on dependent steps'
require_text skills/writing-plans/SKILL.md 'multiple (coordinated )?components' 'planning gates on multiple components'
require_text skills/test-driven-development/SKILL.md 'observable behavior' 'TDD targets observable behavior'
require_text skills/test-driven-development/SKILL.md '(failing )?regression' 'TDD covers regressions'
require_text skills/test-driven-development/SKILL.md 'public contract' 'TDD covers public contracts'
require_text skills/test-driven-development/SKILL.md 'best available deterministic validation' 'TDD has explicit non-behavior fallback'
require_text skills/subagent-driven-development/SKILL.md 'fork_turns' 'SDD controls inherited context'
reject_text skills/subagent-driven-development/SKILL.md 'must explicitly specify a model|general-purpose subagent' 'SDD does not require unsupported dispatch fields'
reject_text skills/subagent-driven-development/implementer-prompt.md 'Subagent \(general-purpose\)|model: \[MODEL' 'implementer prompt uses available dispatch fields'
reject_text skills/subagent-driven-development/task-reviewer-prompt.md 'Subagent \(general-purpose\)|model: \[MODEL' 'task reviewer prompt uses available dispatch fields'
reject_text skills/requesting-code-review/code-reviewer.md 'Subagent \(general-purpose\)' 'code reviewer prompt is capability-neutral'

reject_text skills/using-superpowers/references/codex-tools.md 'close_agent' 'Codex reference removes unavailable close_agent'
require_text skills/using-superpowers/references/codex-tools.md 'fork_turns' 'Codex reference documents fork_turns'
require_text skills/using-superpowers/references/codex-tools.md 'followup_task' 'Codex reference documents follow-up turns'
require_text skills/using-superpowers/references/codex-tools.md 'interrupt_agent' 'Codex reference documents interruption'

require_text skills/verification-before-completion/SKILL.md '(R1.*targeted|targeted.*R1)' 'verification couples R1 with targeted checks'
require_text skills/verification-before-completion/SKILL.md '(R2.*affected|affected.*R2)' 'verification couples R2 with affected checks'
require_text skills/verification-before-completion/SKILL.md '(R3.*full|full.*R3)' 'verification couples R3 with full checks'

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
