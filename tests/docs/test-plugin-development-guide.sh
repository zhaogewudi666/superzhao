#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUIDE="$ROOT/docs/plugin-development.md"

if ! grep -Eq \
  '\[plugin development docs\]\(\.\./docs/plugin-development\.md\)' \
  "$ROOT/.github/PULL_REQUEST_TEMPLATE.md"; then
  printf 'FAIL: PR template does not link to the repository plugin development guide\n' >&2
  exit 1
fi

if [[ ! -r "$GUIDE" ]]; then
  printf 'FAIL: repository plugin development guide is missing\n' >&2
  exit 1
fi

for required in \
  '.codex-plugin/plugin.json' \
  '.agents/plugins/marketplace.json' \
  'policy.allow_implicit_invocation' \
  '<plugin-name>:<skill-name>' \
  'CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"' \
  "import yaml" \
  'validate_plugin.py' \
  'quick_validate.py'; do
  if ! grep -Fq "$required" "$GUIDE"; then
    printf 'FAIL: plugin development guide does not document %s\n' "$required" >&2
    exit 1
  fi
done

find_yaml_python() {
  local candidate

  for candidate in "${PYTHON:-}" python3 python; do
    [[ -n "$candidate" ]] || continue
    if command -v "$candidate" >/dev/null 2>&1 &&
      "$candidate" -c 'import yaml' >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
  done
  return 1
}

if ! PYTHON_BIN="$(find_yaml_python)"; then
  printf 'FAIL: no Python interpreter with PyYAML is available; plugin validators cannot run\n' >&2
  exit 1
fi

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PLUGIN_VALIDATOR="$CODEX_HOME/skills/.system/plugin-creator/scripts/validate_plugin.py"
SKILL_VALIDATOR="$CODEX_HOME/skills/.system/skill-creator/scripts/quick_validate.py"

for validator in "$PLUGIN_VALIDATOR" "$SKILL_VALIDATOR"; do
  if [[ ! -r "$validator" ]]; then
    printf 'FAIL: Codex validator is not readable: %s\n' "$validator" >&2
    exit 1
  fi
done

"$PYTHON_BIN" "$PLUGIN_VALIDATOR" "$ROOT/plugins/superzhao-skill-lab"
"$PYTHON_BIN" "$SKILL_VALIDATOR" \
  "$ROOT/plugins/superzhao-skill-lab/skills/optimize-agent-skill"
"$PYTHON_BIN" "$PLUGIN_VALIDATOR" "$ROOT/plugins/superzhao-engineering"
"$PYTHON_BIN" "$SKILL_VALIDATOR" \
  "$ROOT/plugins/superzhao-engineering/skills/domain-modeling"

printf 'Plugin development guide contract looks good\n'
