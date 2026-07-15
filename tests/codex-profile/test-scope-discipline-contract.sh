#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
SKILL="$ROOT/skills/using-superpowers/SKILL.md"
failures=0

require_rule() {
  local pattern="$1"
  local label="$2"

  if ! grep -Eiq "$pattern" "$SKILL"; then
    printf 'FAIL: %s\n' "$label" >&2
    failures=$((failures + 1))
  fi
}

require_rule "stated outcome.*then stop" \
  "using-superpowers stops when the stated outcome is complete"
require_rule "completion.*does not authorize.*adjacent" \
  "completion does not authorize adjacent improvements"
require_rule "supporting work.*only when.*cannot.*safely complete.*existing mechanisms.*inadequate.*concrete failure" \
  "supporting work requires necessity, an inadequate mechanism, and failure evidence"
require_rule "new (subsystems|frameworks|migrations|control planes).*(explicit|express).*user approval" \
  "new infrastructure requires explicit user approval"
require_rule "optional improvements.*final (handoff|report).*do not implement" \
  "optional improvements are reported instead of implemented"
require_rule "safeguards.*proportionate.*demonstrated risk.*hypothetical extremes" \
  "safeguards stay proportional to demonstrated risk"

if (( failures > 0 )); then
  printf '%d scope-discipline contract check(s) failed\n' "$failures" >&2
  exit 1
fi

printf 'Scope-discipline contract checks passed\n'
