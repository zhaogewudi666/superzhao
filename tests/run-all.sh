#!/usr/bin/env bash
# Aggregate deterministic test entry point.
#
# The per-area commands in docs/testing.md remain the right tool while
# iterating on one area; this runner exists so "run everything deterministic"
# is one command instead of a hand-maintained list that can drift from
# reality. Coverage drifted from such lists twice before (a runner glob that
# missed Node suites, then a doc table that overstated runner coverage).
#
# Policy:
# - REQUIRED suites gate this runner; any failure fails the run.
# - CONDITIONAL suites gate only when their environment prerequisite exists;
#   otherwise the runner names what it skipped and why.
# - Known inherited failures (suites that fail identically on pristine
#   upstream superpowers v6.1.1) are NOT run here. They are listed in
#   docs/testing.md under "Known inherited failures" with their open
#   disposition; running them would make this gate permanently red.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
failures=0

shopt -s nullglob
skill_lab_tests=("$ROOT"/tests/skill-lab/*.test.mjs)
shopt -u nullglob

run_required() {
  local label="$1"
  shift
  printf '=== %s\n' "$label"
  if (cd "$ROOT" && "$@"); then
    printf 'PASS: %s\n' "$label"
  else
    printf 'FAIL: %s\n' "$label" >&2
    failures=$((failures + 1))
  fi
}

run_required "codex profile (contracts, installer/rollback, integrity)" \
  bash tests/codex-profile/run-tests.sh
run_required "codex marketplace manifest" \
  bash tests/codex/test-marketplace-manifest.sh
run_required "codex plugin packaging" \
  bash tests/codex/test-package-codex-plugin.sh
run_required "codex plugin sync" \
  bash tests/codex-plugin-sync/test-sync-to-codex-plugin.sh
run_required "kimi plugin" \
  bash tests/kimi/run-tests.sh
run_required "opencode plugin" \
  bash tests/opencode/run-tests.sh
run_required "optional plugin layout" \
  bash tests/optional-plugins/test-plugin-layout.sh
run_required "skill lab skill contract" \
  bash tests/optional-plugins/test-skill-lab-skill.sh
run_required "engineering skill contract" \
  bash tests/optional-plugins/test-engineering-skills.sh
if (( ${#skill_lab_tests[@]} == 0 )); then
  printf 'FAIL: skill lab CLI (no tests/skill-lab/*.test.mjs suites found)\n' >&2
  failures=$((failures + 1))
else
  run_required "skill lab CLI" \
    node --test "${skill_lab_tests[@]}"
fi
run_required "testing guide contract" \
  bash tests/docs/test-testing-guide.sh
run_required "plugin development guide contract" \
  bash tests/docs/test-plugin-development-guide.sh
run_required "shell lint script" \
  bash tests/shell-lint/test-lint-shell.sh

if [[ -d "$ROOT/tests/brainstorm-server/node_modules" ]]; then
  run_required "brainstorm server" \
    npm test --prefix tests/brainstorm-server
else
  printf 'SKIPPED: brainstorm server (dependencies not installed; run: npm ci --prefix tests/brainstorm-server)\n'
fi

printf 'NOT RUN (known inherited failures; see docs/testing.md): tests/pi, tests/antigravity\n'

if (( failures > 0 )); then
  printf '%d aggregate suite(s) failed\n' "$failures" >&2
  exit 1
fi

printf 'All aggregate deterministic suites passed\n'
