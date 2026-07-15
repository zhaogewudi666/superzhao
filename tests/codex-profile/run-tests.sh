#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for test_file in "$SCRIPT_DIR"/test-*.sh; do
  bash "$test_file"
done

shopt -s nullglob
mjs_tests=("$SCRIPT_DIR"/test-*.mjs)
shopt -u nullglob
if (( ${#mjs_tests[@]} > 0 )); then
  if ! command -v node >/dev/null 2>&1; then
    printf 'FAIL: node is required to run %d Node test file(s) in %s\n' \
      "${#mjs_tests[@]}" "$SCRIPT_DIR" >&2
    exit 1
  fi
  node --test "${mjs_tests[@]}"
fi
