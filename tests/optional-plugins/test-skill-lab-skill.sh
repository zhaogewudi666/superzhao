#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL_ROOT="$ROOT/plugins/superzhao-skill-lab/skills/optimize-agent-skill"
SKILL="$SKILL_ROOT/SKILL.md"
OPENAI="$SKILL_ROOT/agents/openai.yaml"
REFERENCE="$SKILL_ROOT/references/campaign-format.md"

for file in "$SKILL" "$OPENAI" "$REFERENCE"; do
  if [[ ! -r "$file" ]]; then
    printf 'FAIL: required Skill file is missing: %s\n' "$file" >&2
    exit 1
  fi
done

for required in \
  'source Skill' \
  'current.*candidate' \
  'important.*control' \
  'five fresh' \
  'selection' \
  'test' \
  'SKILL_DEFECT.*EXECUTION_LAPSE' \
  'body-only' \
  'added/removed byte budgets' \
  'manifest.json.*completion marker' \
  'cannot prove actor independence or scoring truth' \
  'human review' \
  'never.*active|does not.*active'; do
  if ! grep -Eqi "$required" "$SKILL"; then
    printf 'FAIL: optimize-agent-skill is missing contract: %s\n' "$required" >&2
    exit 1
  fi
done

if ! grep -Eq '^  allow_implicit_invocation: false$' "$OPENAI"; then
  printf 'FAIL: behavior-rejected Skill Lab candidate must remain explicit-only\n' >&2
  exit 1
fi
if ! grep -Fq '$superzhao-skill-lab:optimize-agent-skill' "$OPENAI"; then
  printf 'FAIL: installed plugin prompt must use the namespaced Skill name\n' >&2
  exit 1
fi

for command in \
  '"$SKILL_LAB_CLI" apply' \
  '"$SKILL_LAB_CLI" gate' \
  '"$SKILL_LAB_CLI" stage' \
  '"$SKILL_LAB_CLI" verify-bundle'; do
  if ! grep -Fq "$command" "$REFERENCE"; then
    printf 'FAIL: campaign reference does not document %s\n' "$command" >&2
    exit 1
  fi
done

for required in \
  '# Skill Lab v3 campaign format' \
  'superzhao.skill-lab.patch/v3' \
  'superzhao.skill-lab.cases/v3' \
  'superzhao.skill-lab.samples/v3' \
  'superzhao.skill-lab.bundle-manifest/v3' \
  'no more than `required_valid` invalid or indeterminate attempts' \
  'campaign-wide limit of 1,000 attempted rows' \
  'globally unique across all attempted samples' \
  'Rejected proposals have no valid bundle manifest'; do
  if ! grep -Fq "$required" "$REFERENCE"; then
    printf 'FAIL: campaign reference is not bound to the production v3 contract: %s\n' "$required" >&2
    exit 1
  fi
done

for stale in \
  '# Skill Lab v2 campaign format' \
  '"schema_version": 2' \
  'All JSON schemas below are version 2' \
  'cannot affect the decision' \
  'containment, ownership,'; do
  if grep -Fqi "$stale" "$REFERENCE"; then
    printf 'FAIL: campaign reference retains an incompatible v2 contract: %s\n' "$stale" >&2
    exit 1
  fi
done

if ! grep -Fq 'SKILL_LAB_CLI' "$REFERENCE"; then
  printf 'FAIL: campaign reference does not resolve the CLI from the installed plugin root\n' >&2
  exit 1
fi
if ! grep -Fq 'from 1 through 8192, inclusive' "$REFERENCE"; then
  printf 'FAIL: campaign reference does not document the exact byte-budget range\n' >&2
  exit 1
fi
if ! grep -Fq 'Exit `4`' "$REFERENCE"; then
  printf 'FAIL: campaign reference does not document stage rejection/inconsistency\n' >&2
  exit 1
fi
if grep -Fq 'node plugins/superzhao-skill-lab/scripts/skill-lab.mjs' "$REFERENCE"; then
  printf 'FAIL: campaign reference hardcodes the source-checkout CLI path\n' >&2
  exit 1
fi

for forbidden in 'OPENAI_API_KEY' 'ANTHROPIC_API_KEY' 'adopt the candidate' 'archived conversation'; do
  if grep -Fq "$forbidden" "$SKILL" "$REFERENCE"; then
    printf 'FAIL: Skill Lab workflow crosses excluded boundary: %s\n' "$forbidden" >&2
    exit 1
  fi
done

printf 'Skill Lab workflow contract looks good\n'
