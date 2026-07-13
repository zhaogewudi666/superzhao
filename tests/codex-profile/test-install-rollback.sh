#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
REAL_MV="$(command -v mv)"
trap 'rm -rf "$TMP"' EXIT

SKILLS=(
  brainstorming
  dispatching-parallel-agents
  executing-plans
  finishing-a-development-branch
  receiving-code-review
  requesting-code-review
  subagent-driven-development
  systematic-debugging
  test-driven-development
  using-git-worktrees
  using-superpowers
  verification-before-completion
  writing-plans
  writing-skills
)

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_eq() {
  local expected="$1"
  local actual="$2"
  local label="$3"

  if [[ "$actual" != "$expected" ]]; then
    printf 'FAIL: %s\nexpected: %s\nactual:   %s\n' "$label" "$expected" "$actual" >&2
    exit 1
  fi
}

assert_file_line() {
  local expected="$1"
  local path="$2"
  local label="$3"
  local actual

  [[ -f "$path" ]] || fail "$label (missing file: $path)"
  actual="$(cat "$path")"
  assert_eq "$expected" "$actual" "$label"
}

snapshot_files() {
  local root="$1"

  (
    cd "$root"
    find . -type f -print | LC_ALL=C sort | while IFS= read -r path; do
      shasum -a 256 "$path"
    done
  )
}

list_matching_directories() {
  local pattern="$1"
  local path

  for path in $pattern; do
    [[ -d "$path" ]] || continue
    printf '%s\n' "$path"
  done
}

write_managed_profile() {
  local codex_home="$1"

  mkdir -p \
    "$codex_home/skills/using-superpowers" \
    "$codex_home/skills/personal-sentinel"
  printf 'original-superpowers\n' >"$codex_home/skills/using-superpowers/SKILL.md"
  printf 'keep-personal\n' >"$codex_home/skills/personal-sentinel/SKILL.md"
}

printf 'Install and rollback happy path\n'
CODEX_HOME="$TMP/happy-home"
export CODEX_HOME
write_managed_profile "$CODEX_HOME"

bash "$ROOT/scripts/install-codex-profile.sh"

for skill in "${SKILLS[@]}"; do
  [[ -f "$CODEX_HOME/skills/$skill/SKILL.md" ]] \
    || fail "installer did not deploy $skill"
done
assert_file_line 'keep-personal' "$CODEX_HOME/skills/personal-sentinel/SKILL.md" \
  'installer preserves an unrelated personal skill'
if grep -qx 'original-superpowers' "$CODEX_HOME/skills/using-superpowers/SKILL.md"; then
  fail 'installer did not replace the managed using-superpowers skill'
fi

BACKUP_ONE="$(cat "$CODEX_HOME/superzhao-last-backup")"
[[ -d "$BACKUP_ONE" ]] || fail 'installer did not create the first backup'
assert_file_line 'original-superpowers' "$BACKUP_ONE/skills/using-superpowers/SKILL.md" \
  'first backup contains the original managed skill'
assert_file_line 'superzhao-codex-profile-v1' "$BACKUP_ONE/format-version.txt" \
  'backup records its format version'
assert_file_line "$(git -C "$ROOT" rev-parse HEAD)" "$BACKUP_ONE/source-commit.txt" \
  'backup records the source commit'

EXPECTED_SKILLS="$TMP/expected-managed-skills.txt"
EXPECTED_INVENTORY="$TMP/expected-managed-inventory.tsv"
: >"$EXPECTED_SKILLS"
: >"$EXPECTED_INVENTORY"
for skill in "${SKILLS[@]}"; do
  printf '%s\n' "$skill" >>"$EXPECTED_SKILLS"
  if [[ "$skill" == using-superpowers ]]; then
    printf '%s\tpresent\n' "$skill" >>"$EXPECTED_INVENTORY"
  else
    printf '%s\tabsent\n' "$skill" >>"$EXPECTED_INVENTORY"
  fi
done
cmp -s "$EXPECTED_SKILLS" "$BACKUP_ONE/managed-skills.txt" \
  || fail 'backup managed-skills manifest is not deterministic'
cmp -s "$EXPECTED_INVENTORY" "$BACKUP_ONE/managed-inventory.tsv" \
  || fail 'backup original-presence inventory is incorrect'

CHECKSUM_PATHS="$TMP/checksum-paths.txt"
SORTED_CHECKSUM_PATHS="$TMP/sorted-checksum-paths.txt"
sed 's/^[^ ]*  //' "$BACKUP_ONE/installed-sha256.txt" >"$CHECKSUM_PATHS"
LC_ALL=C sort "$CHECKSUM_PATHS" >"$SORTED_CHECKSUM_PATHS"
cmp -s "$CHECKSUM_PATHS" "$SORTED_CHECKSUM_PATHS" \
  || fail 'installed checksum manifest is not path-sorted'
for skill in "${SKILLS[@]}"; do
  grep -Eq "^[0-9a-f]{64}  $skill/SKILL\\.md$" "$BACKUP_ONE/installed-sha256.txt" \
    || fail "checksum manifest does not include $skill/SKILL.md"
done
(
  cd "$CODEX_HOME/skills"
  shasum -a 256 -c "$BACKUP_ONE/installed-sha256.txt" >/dev/null
) || fail 'installed checksum manifest does not match the deployed files'

bash "$ROOT/scripts/install-codex-profile.sh"
BACKUP_TWO="$(cat "$CODEX_HOME/superzhao-last-backup")"
[[ "$BACKUP_TWO" != "$BACKUP_ONE" ]] || fail 'repeated installs reused a backup path'
[[ -d "$BACKUP_ONE" && -d "$BACKUP_TWO" ]] \
  || fail 'repeated install did not preserve both backups'
cmp -s "$BACKUP_ONE/installed-sha256.txt" "$BACKUP_TWO/installed-sha256.txt" \
  || fail 'identical installs did not record deterministic checksums'
assert_file_line 'keep-personal' "$CODEX_HOME/skills/personal-sentinel/SKILL.md" \
  'repeated installer preserves an unrelated personal skill'

printf 'mutated-installed-copy\n' >"$CODEX_HOME/skills/using-superpowers/SKILL.md"
bash "$ROOT/scripts/rollback-codex-profile.sh" "$BACKUP_ONE"

assert_file_line 'original-superpowers' "$CODEX_HOME/skills/using-superpowers/SKILL.md" \
  'rollback restores the original managed skill'
assert_file_line 'keep-personal' "$CODEX_HOME/skills/personal-sentinel/SKILL.md" \
  'rollback preserves an unrelated personal skill'
for skill in "${SKILLS[@]}"; do
  if [[ "$skill" != using-superpowers && -e "$CODEX_HOME/skills/$skill" ]]; then
    fail "rollback left originally absent managed skill $skill installed"
  fi
done

bash "$ROOT/scripts/rollback-codex-profile.sh" "$BACKUP_ONE"
ARCHIVES="$(list_matching_directories "$CODEX_HOME/backups/superzhao-current-before-rollback-*")"
ARCHIVE_COUNT="$(printf '%s\n' "$ARCHIVES" | sed '/^$/d' | wc -l | tr -d ' ')"
assert_eq '2' "$ARCHIVE_COUNT" 'repeated rollbacks use unique archive paths'
assert_file_line 'keep-personal' "$CODEX_HOME/skills/personal-sentinel/SKILL.md" \
  'repeated rollback preserves an unrelated personal skill'

printf 'Invalid backup preflight\n'
INVALID_HOME="$TMP/invalid-home"
mkdir -p \
  "$INVALID_HOME/skills/using-superpowers" \
  "$INVALID_HOME/skills/brainstorming" \
  "$INVALID_HOME/skills/personal-sentinel" \
  "$INVALID_HOME/backups/corrupt"
printf 'invalid-live-superpowers\n' >"$INVALID_HOME/skills/using-superpowers/SKILL.md"
printf 'invalid-live-brainstorming\n' >"$INVALID_HOME/skills/brainstorming/SKILL.md"
printf 'invalid-personal\n' >"$INVALID_HOME/skills/personal-sentinel/SKILL.md"
cp -R "$BACKUP_ONE/." "$INVALID_HOME/backups/corrupt/"
printf 'not-a-valid-inventory\n' >"$INVALID_HOME/backups/corrupt/managed-inventory.tsv"
INVALID_BEFORE="$(snapshot_files "$INVALID_HOME/skills")"
if CODEX_HOME="$INVALID_HOME" bash "$ROOT/scripts/rollback-codex-profile.sh" \
  "$INVALID_HOME/backups/corrupt" >/dev/null 2>&1; then
  fail 'rollback accepted a corrupt backup'
fi
INVALID_AFTER="$(snapshot_files "$INVALID_HOME/skills")"
assert_eq "$INVALID_BEFORE" "$INVALID_AFTER" \
  'corrupt backup validation happens before live mutation'
if list_matching_directories "$INVALID_HOME/backups/superzhao-current-before-rollback-*" \
  | grep -q .; then
  fail 'corrupt backup created a rollback archive before validation'
fi
if CODEX_HOME="$INVALID_HOME" bash "$ROOT/scripts/rollback-codex-profile.sh" \
  "$BACKUP_ONE" >/dev/null 2>&1; then
  fail 'rollback accepted a backup from another CODEX_HOME'
fi
assert_eq "$INVALID_BEFORE" "$(snapshot_files "$INVALID_HOME/skills")" \
  'foreign backup rejection does not mutate live skills'

printf 'Incomplete source preflight\n'
INCOMPLETE_ROOT="$TMP/incomplete-source"
INCOMPLETE_HOME="$TMP/incomplete-home"
mkdir -p "$INCOMPLETE_ROOT/scripts" "$INCOMPLETE_ROOT/skills" \
  "$INCOMPLETE_HOME/skills/using-superpowers" \
  "$INCOMPLETE_HOME/skills/brainstorming" \
  "$INCOMPLETE_HOME/skills/writing-skills" \
  "$INCOMPLETE_HOME/skills/personal-sentinel"
cp "$ROOT/scripts/install-codex-profile.sh" "$INCOMPLETE_ROOT/scripts/"
for skill in "${SKILLS[@]}"; do
  if [[ "$skill" != writing-skills ]]; then
    cp -R "$ROOT/skills/$skill" "$INCOMPLETE_ROOT/skills/$skill"
  fi
done
printf 'preflight-superpowers\n' >"$INCOMPLETE_HOME/skills/using-superpowers/SKILL.md"
printf 'preflight-brainstorming\n' >"$INCOMPLETE_HOME/skills/brainstorming/SKILL.md"
printf 'preflight-writing\n' >"$INCOMPLETE_HOME/skills/writing-skills/SKILL.md"
printf 'preflight-personal\n' >"$INCOMPLETE_HOME/skills/personal-sentinel/SKILL.md"
INCOMPLETE_BEFORE="$(snapshot_files "$INCOMPLETE_HOME/skills")"
if CODEX_HOME="$INCOMPLETE_HOME" bash "$INCOMPLETE_ROOT/scripts/install-codex-profile.sh" \
  >/dev/null 2>&1; then
  fail 'installer accepted an incomplete copied source tree'
fi
assert_eq "$INCOMPLETE_BEFORE" "$(snapshot_files "$INCOMPLETE_HOME/skills")" \
  'incomplete source validation leaves all live skills intact'
[[ ! -e "$INCOMPLETE_HOME/superzhao-last-backup" ]] \
  || fail 'incomplete source preflight updated the last-backup pointer'

printf 'Mid-install failure recovery\n'
FAILURE_HOME="$TMP/failure-home"
FAKEBIN="$TMP/fakebin"
MV_STATE="$TMP/mv-state"
mkdir -p \
  "$FAILURE_HOME/skills/brainstorming" \
  "$FAILURE_HOME/skills/dispatching-parallel-agents" \
  "$FAILURE_HOME/skills/personal-sentinel" \
  "$FAKEBIN"
printf 'original-brainstorming\n' >"$FAILURE_HOME/skills/brainstorming/SKILL.md"
printf 'untouched-dispatching\n' >"$FAILURE_HOME/skills/dispatching-parallel-agents/SKILL.md"
printf 'failure-personal\n' >"$FAILURE_HOME/skills/personal-sentinel/SKILL.md"
cat >"$FAKEBIN/mv" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
count=0
if [[ -f "$SUPERZHAO_MV_STATE" ]]; then
  count="$(cat "$SUPERZHAO_MV_STATE")"
fi
count=$((count + 1))
printf '%s\n' "$count" >"$SUPERZHAO_MV_STATE"
if [[ "$count" -eq 3 ]]; then
  exit 97
fi
exec "$SUPERZHAO_REAL_MV" "$@"
EOF
chmod +x "$FAKEBIN/mv"
FAILURE_BEFORE="$(snapshot_files "$FAILURE_HOME/skills")"
if PATH="$FAKEBIN:$PATH" \
  SUPERZHAO_MV_STATE="$MV_STATE" \
  SUPERZHAO_REAL_MV="$REAL_MV" \
  CODEX_HOME="$FAILURE_HOME" \
  bash "$ROOT/scripts/install-codex-profile.sh" >/dev/null 2>&1; then
  fail 'installer unexpectedly succeeded through an injected move failure'
fi
assert_eq "$FAILURE_BEFORE" "$(snapshot_files "$FAILURE_HOME/skills")" \
  'install failure restores touched entries without deleting untouched entries'
[[ ! -e "$FAILURE_HOME/superzhao-last-backup" ]] \
  || fail 'failed install updated the last-backup pointer'

printf 'Install interruption after backup move\n'
INSTALL_SIGNAL_HOME="$TMP/install-signal-home"
INSTALL_SIGNAL_BIN="$TMP/install-signal-bin"
INSTALL_SIGNAL_STATE="$TMP/install-signal-state"
mkdir -p \
  "$INSTALL_SIGNAL_HOME/skills/brainstorming" \
  "$INSTALL_SIGNAL_HOME/skills/personal-sentinel" \
  "$INSTALL_SIGNAL_BIN"
printf 'signal-original-brainstorming\n' \
  >"$INSTALL_SIGNAL_HOME/skills/brainstorming/SKILL.md"
printf 'signal-personal\n' \
  >"$INSTALL_SIGNAL_HOME/skills/personal-sentinel/SKILL.md"
cat >"$INSTALL_SIGNAL_BIN/mv" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
count=0
if [[ -f "$SUPERZHAO_SIGNAL_STATE" ]]; then
  count="$(cat "$SUPERZHAO_SIGNAL_STATE")"
fi
count=$((count + 1))
printf '%s\n' "$count" >"$SUPERZHAO_SIGNAL_STATE"
"$SUPERZHAO_REAL_MV" "$@"
if [[ "$count" -eq 1 ]]; then
  kill -TERM "$PPID"
fi
EOF
chmod +x "$INSTALL_SIGNAL_BIN/mv"
INSTALL_SIGNAL_BEFORE="$(snapshot_files "$INSTALL_SIGNAL_HOME/skills")"
if PATH="$INSTALL_SIGNAL_BIN:$PATH" \
  SUPERZHAO_SIGNAL_STATE="$INSTALL_SIGNAL_STATE" \
  SUPERZHAO_REAL_MV="$REAL_MV" \
  CODEX_HOME="$INSTALL_SIGNAL_HOME" \
  bash "$ROOT/scripts/install-codex-profile.sh" >/dev/null 2>&1; then
  fail 'installer unexpectedly succeeded after an injected termination signal'
fi
assert_eq "$INSTALL_SIGNAL_BEFORE" "$(snapshot_files "$INSTALL_SIGNAL_HOME/skills")" \
  'install interruption restores an entry moved before post-move bookkeeping'

printf 'Rollback interruption after archive move\n'
ROLLBACK_SIGNAL_HOME="$TMP/rollback-signal-home"
ROLLBACK_SIGNAL_BIN="$TMP/rollback-signal-bin"
ROLLBACK_SIGNAL_STATE="$TMP/rollback-signal-state"
mkdir -p \
  "$ROLLBACK_SIGNAL_HOME/skills/brainstorming" \
  "$ROLLBACK_SIGNAL_HOME/skills/personal-sentinel" \
  "$ROLLBACK_SIGNAL_BIN"
printf 'rollback-backup-original\n' \
  >"$ROLLBACK_SIGNAL_HOME/skills/brainstorming/SKILL.md"
printf 'rollback-signal-personal\n' \
  >"$ROLLBACK_SIGNAL_HOME/skills/personal-sentinel/SKILL.md"
CODEX_HOME="$ROLLBACK_SIGNAL_HOME" bash "$ROOT/scripts/install-codex-profile.sh" \
  >/dev/null
ROLLBACK_SIGNAL_BACKUP="$(cat "$ROLLBACK_SIGNAL_HOME/superzhao-last-backup")"
printf 'rollback-current-before-signal\n' \
  >"$ROLLBACK_SIGNAL_HOME/skills/brainstorming/SKILL.md"
cat >"$ROLLBACK_SIGNAL_BIN/mv" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
count=0
if [[ -f "$SUPERZHAO_SIGNAL_STATE" ]]; then
  count="$(cat "$SUPERZHAO_SIGNAL_STATE")"
fi
count=$((count + 1))
printf '%s\n' "$count" >"$SUPERZHAO_SIGNAL_STATE"
"$SUPERZHAO_REAL_MV" "$@"
if [[ "$count" -eq 1 ]]; then
  kill -TERM "$PPID"
fi
EOF
chmod +x "$ROLLBACK_SIGNAL_BIN/mv"
ROLLBACK_SIGNAL_BEFORE="$(snapshot_files "$ROLLBACK_SIGNAL_HOME/skills")"
if PATH="$ROLLBACK_SIGNAL_BIN:$PATH" \
  SUPERZHAO_SIGNAL_STATE="$ROLLBACK_SIGNAL_STATE" \
  SUPERZHAO_REAL_MV="$REAL_MV" \
  CODEX_HOME="$ROLLBACK_SIGNAL_HOME" \
  bash "$ROOT/scripts/rollback-codex-profile.sh" "$ROLLBACK_SIGNAL_BACKUP" \
  >/dev/null 2>&1; then
  fail 'rollback unexpectedly succeeded after an injected termination signal'
fi
assert_eq "$ROLLBACK_SIGNAL_BEFORE" "$(snapshot_files "$ROLLBACK_SIGNAL_HOME/skills")" \
  'rollback interruption restores an entry moved before post-move bookkeeping'

printf 'Install interruption after pointer publication\n'
POINTER_SIGNAL_HOME="$TMP/pointer-signal-home"
POINTER_SIGNAL_BIN="$TMP/pointer-signal-bin"
POINTER_SIGNAL_STATE="$TMP/pointer-signal-state"
mkdir -p "$POINTER_SIGNAL_BIN"
write_managed_profile "$POINTER_SIGNAL_HOME"
PREVIOUS_POINTER="$POINTER_SIGNAL_HOME/backups/previous-backup"
printf '%s\n' "$PREVIOUS_POINTER" \
  >"$POINTER_SIGNAL_HOME/superzhao-last-backup"
cat >"$POINTER_SIGNAL_BIN/mv" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
destination=""
for argument in "$@"; do
  destination="$argument"
done
"$SUPERZHAO_REAL_MV" "$@"
if [[ "$destination" == "$SUPERZHAO_POINTER_TARGET" \
  && ! -e "$SUPERZHAO_SIGNAL_STATE" ]]; then
  : >"$SUPERZHAO_SIGNAL_STATE"
  kill -TERM "$PPID"
fi
EOF
chmod +x "$POINTER_SIGNAL_BIN/mv"
POINTER_SIGNAL_BEFORE="$(snapshot_files "$POINTER_SIGNAL_HOME/skills")"
if PATH="$POINTER_SIGNAL_BIN:$PATH" \
  SUPERZHAO_POINTER_TARGET="$POINTER_SIGNAL_HOME/superzhao-last-backup" \
  SUPERZHAO_SIGNAL_STATE="$POINTER_SIGNAL_STATE" \
  SUPERZHAO_REAL_MV="$REAL_MV" \
  CODEX_HOME="$POINTER_SIGNAL_HOME" \
  bash "$ROOT/scripts/install-codex-profile.sh" >/dev/null 2>&1; then
  fail 'installer unexpectedly succeeded after pointer-publication termination'
fi
assert_eq "$POINTER_SIGNAL_BEFORE" "$(snapshot_files "$POINTER_SIGNAL_HOME/skills")" \
  'pointer-publication interruption restores the prior live profile'
assert_file_line "$PREVIOUS_POINTER" "$POINTER_SIGNAL_HOME/superzhao-last-backup" \
  'pointer-publication interruption restores the previous backup pointer'

printf 'Install and rollback test passed\n'
