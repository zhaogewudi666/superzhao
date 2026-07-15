#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL_ROOT="$ROOT/plugins/superzhao-engineering/skills/domain-modeling"
SKILL="$SKILL_ROOT/SKILL.md"
OPENAI="$SKILL_ROOT/agents/openai.yaml"
REFERENCE="$SKILL_ROOT/references/modeling-frame.md"

for file in "$SKILL" "$OPENAI" "$REFERENCE"; do
  if [[ ! -r "$file" ]]; then
    printf 'FAIL: required domain-modeling file is missing: %s\n' "$file" >&2
    exit 1
  fi
done

for required in \
  '^name: domain-modeling$' \
  'unresolved.*(business|domain).*(semantics|meaning)|state transitions.*unresolved' \
  'concepts' \
  'invariants' \
  'states.*transitions' \
  'open decisions' \
  'model.*before.*(schema|migration|code)' \
  '(focused|grouped).*blocking question' \
  '(simple|private).*(rename|R1).*direct' \
  '(chat|response).*(default|first)' \
  '(request|authoriz).*(write|persist|artifact)' \
  'supplied.*known invariants' \
  'state, transition, or boundary' \
  '(generic|vague).*(lifecycle|model)' \
  '(insufficient|does not count|not a substitute)'; do
  if ! grep -Eqi "$required" "$SKILL" "$REFERENCE"; then
    printf 'FAIL: domain-modeling is missing contract: %s\n' "$required" >&2
    exit 1
  fi
done

if ! grep -Eq '^  allow_implicit_invocation: false$' "$OPENAI"; then
  printf 'FAIL: rejected native candidate must remain explicit-only\n' >&2
  exit 1
fi

if ! grep -Fq '$superzhao-engineering:domain-modeling' "$OPENAI"; then
  printf 'FAIL: installed plugin prompt must use the namespaced Skill name\n' >&2
  exit 1
fi

for forbidden in \
  'update `?CONTEXT\.md`? inline' \
  'always (create|write|update).*ADR' \
  'always (commit|push)' \
  'never .*--abort' \
  'Tailwind via CDN' \
  'Mermaid via CDN'; do
  if grep -Eqi -- "$forbidden" "$SKILL" "$REFERENCE"; then
    printf 'FAIL: domain-modeling retained unsafe upstream default: %s\n' "$forbidden" >&2
    exit 1
  fi
done

printf 'Engineering Skill contracts look good\n'
