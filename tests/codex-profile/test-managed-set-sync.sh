#!/usr/bin/env bash
# The managed skill set is declared twice: as the SKILLS array in
# scripts/install-codex-profile.sh and as config/codex-profile-skills.txt,
# which scripts/profile-integrity.mjs reads. Silent drift between them would
# let the installer and the integrity verifier manage different skill sets.
# This check fails on any drift and on managed entries without an entrypoint.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
INSTALLER="$ROOT/scripts/install-codex-profile.sh"
CONFIG="$ROOT/config/codex-profile-skills.txt"
failures=0

installer_list="$(sed -n '/^SKILLS=($/,/^)$/p' "$INSTALLER" \
  | sed '1d;$d' \
  | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' \
  | grep -v '^$' || true)"
config_list="$(grep -Ev '^[[:space:]]*(#|$)' "$CONFIG" \
  | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true)"

if [[ -z "$installer_list" ]]; then
  printf 'FAIL: could not extract the SKILLS array from %s\n' "$INSTALLER" >&2
  exit 1
fi

if [[ -z "$config_list" ]]; then
  printf 'FAIL: no managed skills listed in %s\n' "$CONFIG" >&2
  exit 1
fi

if [[ "$installer_list" != "$config_list" ]]; then
  printf 'FAIL: managed skill set drift between installer SKILLS and config/codex-profile-skills.txt\n' >&2
  diff <(printf '%s\n' "$installer_list") <(printf '%s\n' "$config_list") >&2 || true
  failures=$((failures + 1))
fi

while IFS= read -r skill; do
  if [[ ! -f "$ROOT/skills/$skill/SKILL.md" ]]; then
    printf 'FAIL: managed skill has no entrypoint: skills/%s/SKILL.md\n' "$skill" >&2
    failures=$((failures + 1))
  fi
done <<<"$config_list"

if (( failures > 0 )); then
  printf '%d managed-set sync check(s) failed\n' "$failures" >&2
  exit 1
fi

printf 'Managed-set sync checks passed\n'
