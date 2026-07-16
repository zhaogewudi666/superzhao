#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
failures=0
TEST_ROOT="$(mktemp -d)"

cleanup() {
  rm -rf "$TEST_ROOT"
}
trap cleanup EXIT

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
require_text 'tests/hooks/test-session-start\.sh' \
  'testing guide documents the session-start hook suite entry point'
require_text 'tests/claude-code/test-sdd-workspace\.sh' \
  'testing guide documents the deterministic SDD workspace suite'
require_text 'tests/claude-code/test-worktree-path-policy\.sh' \
  'testing guide discloses the worktree path-policy contract failure'
require_text 'Known local contract mismatch' \
  'testing guide classifies the path-policy failure as a local contract mismatch'
require_text 'tests/brainstorm-server/windows-lifecycle\.test\.sh' \
  'testing guide discloses the slow Windows lifecycle suite'
require_text 'docs/superpowers/evals/' \
  'testing guide identifies committed behavior evidence'
require_text 'evals/' \
  'testing guide identifies the external behavior harness checkout'

mkdir -p "$TEST_ROOT/bin"
cat >"$TEST_ROOT/bin/command-stub" <<'STUB'
#!/bin/bash
printf '%s' "${0##*/}" >>"$CALLS_FILE"
for argument in "$@"; do
  printf '\t%s' "$argument" >>"$CALLS_FILE"
done
printf '\n' >>"$CALLS_FILE"
STUB
chmod +x "$TEST_ROOT/bin/command-stub"
for command_name in bash node npm; do
  ln -s command-stub "$TEST_ROOT/bin/$command_name"
done

require_call() {
  local calls_file="$1" expected="$2" label="$3"

  if ! grep -Fxq "$expected" "$calls_file"; then
    printf 'FAIL: %s\n' "$label" >&2
    failures=$((failures + 1))
  fi
}

runner_calls="$TEST_ROOT/runner-calls.tsv"
runner_output="$TEST_ROOT/runner-output.txt"
: >"$runner_calls"
if ! CALLS_FILE="$runner_calls" \
  PATH="$TEST_ROOT/bin:/usr/bin:/bin" \
  /bin/bash "$ROOT/tests/run-all.sh" >"$runner_output" 2>&1; then
  printf 'FAIL: aggregate runner cannot be exercised with command stubs\n' >&2
  failures=$((failures + 1))
fi

for required_script in \
  tests/codex-profile/run-tests.sh \
  tests/codex/test-marketplace-manifest.sh \
  tests/codex/test-package-codex-plugin.sh \
  tests/codex-plugin-sync/test-sync-to-codex-plugin.sh \
  tests/kimi/run-tests.sh \
  tests/opencode/run-tests.sh \
  tests/optional-plugins/test-plugin-layout.sh \
  tests/optional-plugins/test-skill-lab-skill.sh \
  tests/optional-plugins/test-engineering-skills.sh \
  tests/hooks/test-session-start.sh \
  tests/claude-code/test-sdd-workspace.sh \
  tests/docs/test-testing-guide.sh \
  tests/docs/test-plugin-development-guide.sh \
  tests/shell-lint/test-lint-shell.sh; do
  require_call "$runner_calls" $'bash\t'"$required_script" \
    "aggregate runner does not execute required suite $required_script"
done

skill_lab_call="$(grep -F $'node\t--test\t' "$runner_calls" || true)"
for skill_lab_test in "$ROOT"/tests/skill-lab/*.test.mjs; do
  if [[ "$skill_lab_call" != *$'\t'"$skill_lab_test"* ]]; then
    printf 'FAIL: aggregate runner does not execute Skill Lab suite %s\n' \
      "$skill_lab_test" >&2
    failures=$((failures + 1))
  fi
done

for excluded_suite in \
  'tests/pi' \
  'tests/antigravity' \
  'tests/claude-code/test-worktree-path-policy.sh' \
  'tests/brainstorm-server/windows-lifecycle.test.sh'; do
  if ! grep -Fq "$excluded_suite" "$runner_output"; then
    printf 'FAIL: aggregate runner does not name excluded suite %s\n' \
      "$excluded_suite" >&2
    failures=$((failures + 1))
  fi
done

if ! grep -Fq \
  'NOT RUN (known local contract mismatch; see docs/testing.md): tests/claude-code/test-worktree-path-policy.sh' \
  "$runner_output"; then
  printf 'FAIL: aggregate runner misclassifies the local path-policy mismatch\n' >&2
  failures=$((failures + 1))
fi

if [[ -d "$ROOT/tests/brainstorm-server/node_modules" ]]; then
  require_call "$runner_calls" $'npm\ttest\t--prefix\ttests/brainstorm-server' \
    'aggregate runner does not execute the available brainstorm server suite'
elif ! grep -Fq 'SKIPPED: brainstorm server' "$runner_output"; then
  printf 'FAIL: aggregate runner does not explain the missing brainstorm dependencies\n' >&2
  failures=$((failures + 1))
fi

profile_calls="$TEST_ROOT/profile-calls.tsv"
: >"$profile_calls"
if ! CALLS_FILE="$profile_calls" \
  PATH="$TEST_ROOT/bin:/usr/bin:/bin" \
  /bin/bash "$ROOT/tests/codex-profile/run-tests.sh" >/dev/null 2>&1; then
  printf 'FAIL: Codex profile runner cannot be exercised with command stubs\n' >&2
  failures=$((failures + 1))
fi

profile_node_call="$(grep -F $'node\t--test\t' "$profile_calls" || true)"
if [[ "$profile_node_call" != *$'\t--test-concurrency=1\t'* ]]; then
  printf 'FAIL: Codex profile runner does not isolate process-timing suites from integrity load\n' >&2
  failures=$((failures + 1))
fi

if (( failures > 0 )); then
  exit 1
fi

printf 'Testing guide contract looks good\n'
