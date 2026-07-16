#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
failures=0

require_text() {
  local pattern="$1" label="$2"

  if ! grep -Eq "$pattern" "$ROOT/docs/testing.md"; then
    printf 'FAIL: %s\n' "$label" >&2
    failures=$((failures + 1))
  fi
}

require_text 'tests/codex-profile/run-tests\.sh' \
  'testing guide documents the Codex profile suite entry point'
require_text 'tests/docs/test-testing-guide\.sh' \
  'testing guide documents its own contract test'
require_text 'tests/optional-plugins/test-plugin-layout\.sh' \
  'testing guide documents optional plugin validation'
require_text 'tests/skill-lab/\*\.test\.mjs' \
  'testing guide documents all Skill Lab CLI suites'
require_text 'tests/shell-lint/test-lint-shell\.sh' \
  'testing guide documents the shell lint suite entry point'
require_text 'docs/superpowers/evals/' \
  'testing guide identifies committed behavior evidence'
require_text 'evals/' \
  'testing guide identifies the external behavior harness checkout'

if ! grep -Fq 'skill_lab_tests=("$ROOT"/tests/skill-lab/*.test.mjs)' \
  "$ROOT/tests/run-all.sh" ||
  ! grep -Fq 'node --test "${skill_lab_tests[@]}"' \
    "$ROOT/tests/run-all.sh"; then
  printf 'FAIL: aggregate runner does not discover every Skill Lab Node suite\n' >&2
  failures=$((failures + 1))
fi

if (( failures > 0 )); then
  exit 1
fi

printf 'Testing guide contract looks good\n'
