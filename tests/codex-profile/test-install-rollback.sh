#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
REAL_MV="$(command -v mv)"
REAL_CP="$(command -v cp)"
REAL_STAT="$(command -v stat)"
BACKGROUND_PID=""

cleanup_test() {
  if [[ -n "$BACKGROUND_PID" ]]; then
    kill -TERM "$BACKGROUND_PID" 2>/dev/null || true
    wait "$BACKGROUND_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP"
}

trap cleanup_test EXIT
PROFILE_TEST_CASE="${PROFILE_TEST_CASE:-all}"

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

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local label="$3"

  if [[ "$haystack" != *"$needle"* ]]; then
    printf 'FAIL: %s\nexpected to find: %s\nin: %s\n' \
      "$label" "$needle" "$haystack" >&2
    exit 1
  fi
}

portable_mode() {
  local path="$1"

  if "$REAL_STAT" -f '%Lp' "$path" >/dev/null 2>&1; then
    "$REAL_STAT" -f '%Lp' "$path"
  else
    "$REAL_STAT" -c '%a' "$path"
  fi
}

snapshot_files() {
  local root="$1"

  (
    cd "$root"
    find . -print | LC_ALL=C sort | while IFS= read -r path; do
      mode="$(portable_mode "$path")"
      if [[ -L "$path" ]]; then
        printf 'l\t%s\t%s\t%s\n' "$mode" "$path" "$(readlink "$path")"
      elif [[ -d "$path" ]]; then
        printf 'd\t%s\t%s\n' "$mode" "$path"
      elif [[ -f "$path" ]]; then
        printf 'f\t%s\t%s\t%s\n' \
          "$mode" "$path" "$(shasum -a 256 "$path" | awk '{print $1}')"
      else
        printf 'o\t%s\t%s\n' "$mode" "$path"
      fi
    done
  )
}

snapshot_entry() {
  local path="$1"
  local mode

  if [[ -L "$path" ]]; then
    mode="$(portable_mode "$path")"
    printf 'l\t%s\t%s\n' "$mode" "$(readlink "$path")"
  elif [[ -d "$path" ]]; then
    printf 'd\t%s\n' "$(portable_mode "$path")"
  elif [[ -f "$path" ]]; then
    printf 'f\t%s\t%s\n' \
      "$(portable_mode "$path")" "$(shasum -a 256 "$path" | awk '{print $1}')"
  elif [[ -e "$path" ]]; then
    printf 'o\t%s\n' "$(portable_mode "$path")"
  else
    printf 'absent\n'
  fi
}

case_enabled() {
  [[ "$PROFILE_TEST_CASE" == all || "$PROFILE_TEST_CASE" == "$1" ]]
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
    "$codex_home/skills/using-superpowers/empty-original" \
    "$codex_home/skills/personal-sentinel"
  printf 'original-superpowers\n' >"$codex_home/skills/using-superpowers/SKILL.md"
  printf 'keep-personal\n' >"$codex_home/skills/personal-sentinel/SKILL.md"
  chmod 750 "$codex_home/skills/using-superpowers"
  chmod 711 "$codex_home/skills/using-superpowers/empty-original"
  chmod 640 "$codex_home/skills/using-superpowers/SKILL.md"
}

printf 'Install and rollback happy path\n'
CODEX_HOME="$TMP/happy-home"
export CODEX_HOME
write_managed_profile "$CODEX_HOME"

INSTALL_ONE_OUTPUT="$(bash "$ROOT/scripts/install-codex-profile.sh")"

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
assert_contains "$INSTALL_ONE_OUTPUT" "Installed Superzhao skills. Backup: $BACKUP_ONE" \
  'installer success output reports the backup path'
assert_contains "$INSTALL_ONE_OUTPUT" 'Start a new Codex task to refresh discovery.' \
  'installer success output reports the refresh action'
assert_file_line 'original-superpowers' "$BACKUP_ONE/skills/using-superpowers/SKILL.md" \
  'first backup contains the original managed skill'
assert_file_line 'superzhao-codex-profile-v2' "$BACKUP_ONE/format-version.txt" \
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

INSTALL_TWO_OUTPUT="$(bash "$ROOT/scripts/install-codex-profile.sh")"
BACKUP_TWO="$(cat "$CODEX_HOME/superzhao-last-backup")"
[[ "$BACKUP_TWO" != "$BACKUP_ONE" ]] || fail 'repeated installs reused a backup path'
[[ -d "$BACKUP_ONE" && -d "$BACKUP_TWO" ]] \
  || fail 'repeated install did not preserve both backups'
cmp -s "$BACKUP_ONE/installed-sha256.txt" "$BACKUP_TWO/installed-sha256.txt" \
  || fail 'identical installs did not record deterministic checksums'
assert_file_line 'keep-personal' "$CODEX_HOME/skills/personal-sentinel/SKILL.md" \
  'repeated installer preserves an unrelated personal skill'
assert_contains "$INSTALL_TWO_OUTPUT" "$BACKUP_TWO" \
  'repeated installer output reports its unique backup path'

ROLLBACK_DEFAULT_OUTPUT="$(bash "$ROOT/scripts/rollback-codex-profile.sh")"
assert_contains "$ROLLBACK_DEFAULT_OUTPUT" \
  "Restored Superpowers skills from $BACKUP_TWO" \
  'no-argument rollback consumes the last-backup pointer'
assert_contains "$ROLLBACK_DEFAULT_OUTPUT" 'Current profile archived at ' \
  'no-argument rollback reports the current-profile archive'
assert_file_line 'keep-personal' "$CODEX_HOME/skills/personal-sentinel/SKILL.md" \
  'no-argument rollback preserves an unrelated personal skill'

printf 'mutated-installed-copy\n' >"$CODEX_HOME/skills/using-superpowers/SKILL.md"
ROLLBACK_ONE_OUTPUT="$(bash "$ROOT/scripts/rollback-codex-profile.sh" "$BACKUP_ONE")"
assert_contains "$ROLLBACK_ONE_OUTPUT" \
  "Restored Superpowers skills from $BACKUP_ONE" \
  'explicit rollback success output reports its source backup'

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
assert_eq '3' "$ARCHIVE_COUNT" 'no-argument and repeated rollbacks use unique archive paths'
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
set +e
PATH="$FAKEBIN:$PATH" \
  SUPERZHAO_MV_STATE="$MV_STATE" \
  SUPERZHAO_REAL_MV="$REAL_MV" \
  CODEX_HOME="$FAILURE_HOME" \
  bash "$ROOT/scripts/install-codex-profile.sh" >/dev/null 2>&1
FAILURE_STATUS=$?
set -e
assert_eq '97' "$FAILURE_STATUS" \
  'installer preserves the initiating failure status after successful recovery'
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
set +e
PATH="$INSTALL_SIGNAL_BIN:$PATH" \
  SUPERZHAO_SIGNAL_STATE="$INSTALL_SIGNAL_STATE" \
  SUPERZHAO_REAL_MV="$REAL_MV" \
  CODEX_HOME="$INSTALL_SIGNAL_HOME" \
  bash "$ROOT/scripts/install-codex-profile.sh" >/dev/null 2>&1
INSTALL_SIGNAL_STATUS=$?
set -e
assert_eq '143' "$INSTALL_SIGNAL_STATUS" \
  'installer preserves TERM status after successful recovery'
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
set +e
PATH="$ROLLBACK_SIGNAL_BIN:$PATH" \
  SUPERZHAO_SIGNAL_STATE="$ROLLBACK_SIGNAL_STATE" \
  SUPERZHAO_REAL_MV="$REAL_MV" \
  CODEX_HOME="$ROLLBACK_SIGNAL_HOME" \
  bash "$ROOT/scripts/rollback-codex-profile.sh" "$ROLLBACK_SIGNAL_BACKUP" \
  >/dev/null 2>&1
ROLLBACK_SIGNAL_STATUS=$?
set -e
assert_eq '143' "$ROLLBACK_SIGNAL_STATUS" \
  'rollback preserves TERM status after successful recovery'
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
set +e
PATH="$POINTER_SIGNAL_BIN:$PATH" \
  SUPERZHAO_POINTER_TARGET="$(cd "$POINTER_SIGNAL_HOME" && pwd -P)/superzhao-last-backup" \
  SUPERZHAO_SIGNAL_STATE="$POINTER_SIGNAL_STATE" \
  SUPERZHAO_REAL_MV="$REAL_MV" \
  CODEX_HOME="$POINTER_SIGNAL_HOME" \
  bash "$ROOT/scripts/install-codex-profile.sh" >/dev/null 2>&1
POINTER_SIGNAL_STATUS=$?
set -e
assert_eq '143' "$POINTER_SIGNAL_STATUS" \
  'pointer-publication recovery preserves TERM status'
assert_eq "$POINTER_SIGNAL_BEFORE" "$(snapshot_files "$POINTER_SIGNAL_HOME/skills")" \
  'pointer-publication interruption restores the prior live profile'
assert_file_line "$PREVIOUS_POINTER" "$POINTER_SIGNAL_HOME/superzhao-last-backup" \
  'pointer-publication interruption restores the previous backup pointer'

if case_enabled device; then
  printf 'Cross-device preflight refusal\n'
  DEVICE_HOME="$TMP/device-home"
  DEVICE_BIN="$TMP/device-bin"
  mkdir -p "$DEVICE_BIN"
  write_managed_profile "$DEVICE_HOME"
  printf 'device-old-pointer\n' >"$DEVICE_HOME/superzhao-last-backup"
  cat >"$DEVICE_BIN/stat" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
path=""
for argument in "$@"; do
  path="$argument"
done
if [[ "$#" -ge 3 && ( "$1" == -f || "$1" == -c ) && "$2" == '%d' \
  && "${SUPERZHAO_DEVICE_CASE:-}" == stage \
  && "$path" == *'.superzhao-stage-'* ]]; then
  printf '999999999\n'
  exit 0
fi
if [[ "$#" -ge 3 && ( "$1" == -f || "$1" == -c ) && "$2" == '%d' \
  && "${SUPERZHAO_DEVICE_CASE:-}" == live \
  && "$path" == "${SUPERZHAO_CROSS_DEVICE_PATH:-}" ]]; then
  printf '999999999\n'
  exit 0
fi
exec "$SUPERZHAO_REAL_STAT" "$@"
EOF
  chmod +x "$DEVICE_BIN/stat"
  DEVICE_BEFORE="$(snapshot_files "$DEVICE_HOME/skills")"
  DEVICE_POINTER_BEFORE="$(snapshot_entry "$DEVICE_HOME/superzhao-last-backup")"
  set +e
  DEVICE_OUTPUT="$(PATH="$DEVICE_BIN:$PATH" \
    SUPERZHAO_DEVICE_CASE=stage \
    SUPERZHAO_REAL_STAT="$REAL_STAT" \
    CODEX_HOME="$DEVICE_HOME" \
    bash "$ROOT/scripts/install-codex-profile.sh" 2>&1)"
  DEVICE_STATUS=$?
  set -e
  [[ "$DEVICE_STATUS" -ne 0 ]] || fail 'installer accepted a cross-device stage'
  assert_contains "$DEVICE_OUTPUT" 'device' \
    'cross-device refusal explains the device mismatch'
  assert_eq "$DEVICE_BEFORE" "$(snapshot_files "$DEVICE_HOME/skills")" \
    'cross-device preflight leaves live skills unchanged'
  assert_eq "$DEVICE_POINTER_BEFORE" \
    "$(snapshot_entry "$DEVICE_HOME/superzhao-last-backup")" \
    'cross-device preflight leaves the pointer unchanged'

  expect_live_device_refused() {
    local action="$1"
    local codex_home="$TMP/device-live-$action"
    local backup=""
    local live_path
    local before
    local pointer_before
    local archives_before
    local output
    local exit_status

    write_managed_profile "$codex_home"
    codex_home="$(cd "$codex_home" && pwd -P)"
    live_path="$codex_home/skills/using-superpowers"
    if [[ "$action" == rollback ]]; then
      CODEX_HOME="$codex_home" \
        bash "$ROOT/scripts/install-codex-profile.sh" >/dev/null
      backup="$(cat "$codex_home/superzhao-last-backup")"
      printf 'current-before-cross-device-rollback\n' \
        >"$live_path/SKILL.md"
    else
      printf 'device-live-old-pointer\n' \
        >"$codex_home/superzhao-last-backup"
    fi
    before="$(snapshot_files "$codex_home/skills")"
    pointer_before="$(snapshot_entry "$codex_home/superzhao-last-backup")"
    archives_before="$(list_matching_directories \
      "$codex_home/backups/superzhao-current-before-rollback-*")"

    set +e
    if [[ "$action" == rollback ]]; then
      output="$(PATH="$DEVICE_BIN:$PATH" \
        SUPERZHAO_DEVICE_CASE=live \
        SUPERZHAO_CROSS_DEVICE_PATH="$live_path" \
        SUPERZHAO_REAL_STAT="$REAL_STAT" \
        CODEX_HOME="$codex_home" \
        bash "$ROOT/scripts/rollback-codex-profile.sh" "$backup" 2>&1)"
      exit_status=$?
    else
      output="$(PATH="$DEVICE_BIN:$PATH" \
        SUPERZHAO_DEVICE_CASE=live \
        SUPERZHAO_CROSS_DEVICE_PATH="$live_path" \
        SUPERZHAO_REAL_STAT="$REAL_STAT" \
        CODEX_HOME="$codex_home" \
        bash "$ROOT/scripts/install-codex-profile.sh" 2>&1)"
      exit_status=$?
    fi
    set -e
    [[ "$exit_status" -ne 0 ]] \
      || fail "$action accepted a cross-device live managed root"
    assert_contains "$output" 'device' \
      "$action reports the live-root device mismatch"
    assert_eq "$before" "$(snapshot_files "$codex_home/skills")" \
      "$action live-root refusal leaves skills unchanged"
    assert_eq "$pointer_before" \
      "$(snapshot_entry "$codex_home/superzhao-last-backup")" \
      "$action live-root refusal leaves the pointer unchanged"
    assert_eq "$archives_before" "$(list_matching_directories \
      "$codex_home/backups/superzhao-current-before-rollback-*")" \
      "$action live-root refusal occurs before archive mutation"
  }

  expect_live_device_refused install
  expect_live_device_refused rollback
fi

if case_enabled schema; then
  printf 'Hardened backup schema version\n'
  SCHEMA_HOME="$TMP/schema-home"
  write_managed_profile "$SCHEMA_HOME"
  CODEX_HOME="$SCHEMA_HOME" \
    bash "$ROOT/scripts/install-codex-profile.sh" >/dev/null
  SCHEMA_BACKUP="$(cat "$SCHEMA_HOME/superzhao-last-backup")"
  printf 'superzhao-codex-profile-v1\n' >"$SCHEMA_BACKUP/format-version.txt"
  rm \
    "$SCHEMA_BACKUP/installed-tree.tsv" \
    "$SCHEMA_BACKUP/original-tree.tsv" \
    "$SCHEMA_BACKUP/original-sha256.txt"
  SCHEMA_BEFORE="$(snapshot_files "$SCHEMA_HOME/skills")"
  SCHEMA_POINTER_BEFORE="$(snapshot_entry \
    "$SCHEMA_HOME/superzhao-last-backup")"
  SCHEMA_ARCHIVES_BEFORE="$(list_matching_directories \
    "$SCHEMA_HOME/backups/superzhao-current-before-rollback-*")"
  set +e
  SCHEMA_OUTPUT="$(CODEX_HOME="$SCHEMA_HOME" \
    bash "$ROOT/scripts/rollback-codex-profile.sh" "$SCHEMA_BACKUP" 2>&1)"
  SCHEMA_STATUS=$?
  set -e
  [[ "$SCHEMA_STATUS" -ne 0 ]] \
    || fail 'rollback accepted an obsolete v1 backup as the hardened schema'
  assert_contains "$SCHEMA_OUTPUT" 'not supported' \
    'obsolete schema refusal is explicit'
  assert_eq "$SCHEMA_BEFORE" "$(snapshot_files "$SCHEMA_HOME/skills")" \
    'obsolete schema refusal leaves live skills unchanged'
  assert_eq "$SCHEMA_POINTER_BEFORE" \
    "$(snapshot_entry "$SCHEMA_HOME/superzhao-last-backup")" \
    'obsolete schema refusal leaves the pointer unchanged'
  assert_eq "$SCHEMA_ARCHIVES_BEFORE" "$(list_matching_directories \
    "$SCHEMA_HOME/backups/superzhao-current-before-rollback-*")" \
    'obsolete schema refusal occurs before archive creation'
fi

if case_enabled locks; then
  printf 'Shared transaction lock refusal\n'

  make_test_lock() {
    local codex_home="$1"
    local state="$2"
    local lock="$codex_home/.superzhao-profile.lock"

    mkdir "$lock"
    case "$state" in
      active)
        printf 'pid=%s\ntoken=test-active\ncommand=test-holder\n' "$$" >"$lock/owner"
        ;;
      stale)
        printf 'pid=999999999\ntoken=test-stale\ncommand=test-holder\n' >"$lock/owner"
        ;;
      unknown)
        :
        ;;
      *)
        fail "unknown lock fixture state: $state"
        ;;
    esac
  }

  exercise_lock_refusal() {
    local action="$1"
    local state="$2"
    local codex_home="$TMP/lock-$action-$state"
    local backup=""
    local before
    local pointer_before
    local output
    local exit_status
    local expected_word

    write_managed_profile "$codex_home"
    if [[ "$action" == rollback ]]; then
      CODEX_HOME="$codex_home" bash "$ROOT/scripts/install-codex-profile.sh" >/dev/null
      backup="$(cat "$codex_home/superzhao-last-backup")"
      printf 'current-before-locked-rollback\n' \
        >"$codex_home/skills/using-superpowers/SKILL.md"
    else
      printf 'lock-old-pointer\n' >"$codex_home/superzhao-last-backup"
    fi
    make_test_lock "$codex_home" "$state"
    before="$(snapshot_files "$codex_home/skills")"
    pointer_before="$(snapshot_entry "$codex_home/superzhao-last-backup")"

    set +e
    if [[ "$action" == rollback ]]; then
      output="$(CODEX_HOME="$codex_home" \
        bash "$ROOT/scripts/rollback-codex-profile.sh" "$backup" 2>&1)"
      exit_status=$?
    else
      output="$(CODEX_HOME="$codex_home" \
        bash "$ROOT/scripts/install-codex-profile.sh" 2>&1)"
      exit_status=$?
    fi
    set -e
    [[ "$exit_status" -ne 0 ]] \
      || fail "$action accepted a $state transaction lock"
    case "$state" in
      active) expected_word=active ;;
      stale) expected_word=stale ;;
      unknown) expected_word=missing ;;
    esac
    assert_contains "$output" "$expected_word" \
      "$action reports actionable $state-lock diagnostics"
    assert_eq "$before" "$(snapshot_files "$codex_home/skills")" \
      "$action $state-lock refusal leaves live skills unchanged"
    assert_eq "$pointer_before" \
      "$(snapshot_entry "$codex_home/superzhao-last-backup")" \
      "$action $state-lock refusal leaves the pointer unchanged"
  }

  for lock_state in active stale unknown; do
    exercise_lock_refusal install "$lock_state"
    exercise_lock_refusal rollback "$lock_state"
  done

  printf 'Real overlapping install serialization\n'
  OVERLAP_HOME="$TMP/lock-real-overlap"
  OVERLAP_BIN="$TMP/lock-real-overlap-bin"
  OVERLAP_READY="$TMP/lock-real-overlap-ready"
  OVERLAP_RELEASE="$TMP/lock-real-overlap-release"
  mkdir -p "$OVERLAP_BIN"
  write_managed_profile "$OVERLAP_HOME"
  cat >"$OVERLAP_BIN/cp" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ ! -e "$SUPERZHAO_OVERLAP_READY" ]]; then
  : >"$SUPERZHAO_OVERLAP_READY"
  while [[ ! -e "$SUPERZHAO_OVERLAP_RELEASE" ]]; do
    sleep 0.05
  done
fi
exec "$SUPERZHAO_REAL_CP" "$@"
EOF
  chmod +x "$OVERLAP_BIN/cp"
  PATH="$OVERLAP_BIN:$PATH" \
    SUPERZHAO_OVERLAP_READY="$OVERLAP_READY" \
    SUPERZHAO_OVERLAP_RELEASE="$OVERLAP_RELEASE" \
    SUPERZHAO_REAL_CP="$REAL_CP" \
    CODEX_HOME="$OVERLAP_HOME" \
    bash "$ROOT/scripts/install-codex-profile.sh" \
    >"$TMP/overlap-first.out" 2>"$TMP/overlap-first.err" &
  BACKGROUND_PID=$!
  wait_attempt=0
  while [[ ! -e "$OVERLAP_READY" ]]; do
    wait_attempt=$((wait_attempt + 1))
    [[ "$wait_attempt" -le 200 ]] \
      || fail 'timed out waiting for the first installer to hold its lock'
    sleep 0.05
  done
  OVERLAP_LOCK="$OVERLAP_HOME/.superzhao-profile.lock"
  assert_eq '700' "$(portable_mode "$OVERLAP_LOCK")" \
    'real transaction lock directory is private'
  assert_eq '600' "$(portable_mode "$OVERLAP_LOCK/owner")" \
    'real transaction lock metadata is private'
  grep -qx "pid=$BACKGROUND_PID" "$OVERLAP_LOCK/owner" \
    || fail 'real transaction lock records its owner PID'
  grep -Eq '^token=[A-Za-z0-9._-]+$' "$OVERLAP_LOCK/owner" \
    || fail 'real transaction lock records a nonempty owner token'
  OVERLAP_BEFORE="$(snapshot_files "$OVERLAP_HOME/skills")"
  set +e
  OVERLAP_SECOND_OUTPUT="$(CODEX_HOME="$OVERLAP_HOME" \
    bash "$ROOT/scripts/install-codex-profile.sh" 2>&1)"
  OVERLAP_SECOND_STATUS=$?
  set -e
  [[ "$OVERLAP_SECOND_STATUS" -ne 0 ]] \
    || fail 'overlapping installer entered an active transaction'
  assert_contains "$OVERLAP_SECOND_OUTPUT" 'active' \
    'overlapping installer reports the active lock owner'
  assert_eq "$OVERLAP_BEFORE" "$(snapshot_files "$OVERLAP_HOME/skills")" \
    'refused overlapping installer does not mutate live skills'
  : >"$OVERLAP_RELEASE"
  set +e
  wait "$BACKGROUND_PID"
  OVERLAP_FIRST_STATUS=$?
  set -e
  BACKGROUND_PID=""
  assert_eq '0' "$OVERLAP_FIRST_STATUS" \
    'first serialized installer completes after the hold is released'
  [[ ! -e "$OVERLAP_LOCK" ]] \
    || fail 'successful installer did not release its own lock token'
fi

if case_enabled integrity; then
  printf 'Complete backup integrity validation\n'
  for manifest in original-tree.tsv original-sha256.txt installed-tree.tsv; do
    [[ -f "$BACKUP_ONE/$manifest" ]] \
      || fail "installer did not create complete manifest $manifest"
  done

  STAGED_COPY_HOME="$TMP/integrity-staged-copy"
  STAGED_COPY_BIN="$TMP/integrity-staged-copy-bin"
  mkdir -p "$STAGED_COPY_BIN"
  write_managed_profile "$STAGED_COPY_HOME"
  CODEX_HOME="$STAGED_COPY_HOME" \
    bash "$ROOT/scripts/install-codex-profile.sh" >/dev/null
  STAGED_COPY_BACKUP="$(cat "$STAGED_COPY_HOME/superzhao-last-backup")"
  printf 'current-before-staged-copy-check\n' \
    >"$STAGED_COPY_HOME/skills/using-superpowers/SKILL.md"
  STAGED_COPY_BEFORE="$(snapshot_files "$STAGED_COPY_HOME/skills")"
  STAGED_COPY_POINTER_BEFORE="$(snapshot_entry \
    "$STAGED_COPY_HOME/superzhao-last-backup")"
  STAGED_COPY_ARCHIVES_BEFORE="$(list_matching_directories \
    "$STAGED_COPY_HOME/backups/superzhao-current-before-rollback-*")"
  cat >"$STAGED_COPY_BIN/cp" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
destination=""
for argument in "$@"; do
  destination="$argument"
done
"$SUPERZHAO_REAL_CP" "$@"
if [[ "$destination" == *'.superzhao-rollback-stage-'*'/restore/using-superpowers' ]]; then
  printf 'altered-after-successful-copy\n' >"$destination/SKILL.md"
fi
EOF
  chmod +x "$STAGED_COPY_BIN/cp"
  set +e
  STAGED_COPY_OUTPUT="$(PATH="$STAGED_COPY_BIN:$PATH" \
    SUPERZHAO_REAL_CP="$REAL_CP" \
    CODEX_HOME="$STAGED_COPY_HOME" \
    bash "$ROOT/scripts/rollback-codex-profile.sh" \
      "$STAGED_COPY_BACKUP" 2>&1)"
  STAGED_COPY_STATUS=$?
  set -e
  [[ "$STAGED_COPY_STATUS" -ne 0 ]] \
    || fail 'rollback accepted an altered staged original copy'
  assert_contains "$STAGED_COPY_OUTPUT" 'staged original' \
    'rollback reports staged-original integrity failure'
  assert_eq "$STAGED_COPY_BEFORE" \
    "$(snapshot_files "$STAGED_COPY_HOME/skills")" \
    'staged-original integrity failure leaves live skills unchanged'
  assert_eq "$STAGED_COPY_POINTER_BEFORE" \
    "$(snapshot_entry "$STAGED_COPY_HOME/superzhao-last-backup")" \
    'staged-original integrity failure leaves the pointer unchanged'
  assert_eq "$STAGED_COPY_ARCHIVES_BEFORE" "$(list_matching_directories \
    "$STAGED_COPY_HOME/backups/superzhao-current-before-rollback-*")" \
    'staged-original integrity failure occurs before archive creation'

  expect_backup_rejected() {
    local backup="$1"
    local label="$2"
    local before
    local pointer_before
    local archives_before
    local output
    local exit_status

    before="$(snapshot_files "$CODEX_HOME/skills")"
    pointer_before="$(snapshot_entry "$CODEX_HOME/superzhao-last-backup")"
    archives_before="$(list_matching_directories \
      "$CODEX_HOME/backups/superzhao-current-before-rollback-*")"
    set +e
    output="$(bash "$ROOT/scripts/rollback-codex-profile.sh" "$backup" 2>&1)"
    exit_status=$?
    set -e
    [[ "$exit_status" -ne 0 ]] || fail "rollback accepted $label"
    assert_contains "$output" 'backup' "$label reports backup validation failure"
    assert_eq "$before" "$(snapshot_files "$CODEX_HOME/skills")" \
      "$label leaves live skills unchanged"
    assert_eq "$pointer_before" \
      "$(snapshot_entry "$CODEX_HOME/superzhao-last-backup")" \
      "$label leaves the pointer unchanged"
    assert_eq "$archives_before" "$(list_matching_directories \
      "$CODEX_HOME/backups/superzhao-current-before-rollback-*")" \
      "$label is rejected before archive creation"
  }

  CORRUPT_BACKUP="$CODEX_HOME/backups/integrity-corrupt"
  cp -PpR "$BACKUP_ONE" "$CORRUPT_BACKUP"
  printf 'corrupted-original\n' \
    >"$CORRUPT_BACKUP/skills/using-superpowers/SKILL.md"
  expect_backup_rejected "$CORRUPT_BACKUP" 'corrupted original backup file'

  DELETED_BACKUP="$CODEX_HOME/backups/integrity-deleted"
  cp -PpR "$BACKUP_ONE" "$DELETED_BACKUP"
  rm "$DELETED_BACKUP/skills/using-superpowers/SKILL.md"
  expect_backup_rejected "$DELETED_BACKUP" 'deleted original backup file'

  EXTRA_BACKUP="$CODEX_HOME/backups/integrity-extra"
  cp -PpR "$BACKUP_ONE" "$EXTRA_BACKUP"
  printf 'unexpected\n' >"$EXTRA_BACKUP/skills/using-superpowers/extra.txt"
  expect_backup_rejected "$EXTRA_BACKUP" 'extra original backup file'

  MODE_BACKUP="$CODEX_HOME/backups/integrity-mode"
  cp -PpR "$BACKUP_ONE" "$MODE_BACKUP"
  chmod 600 "$MODE_BACKUP/skills/using-superpowers/SKILL.md"
  expect_backup_rejected "$MODE_BACKUP" 'mode-changed original backup file'

  INCOMPLETE_INSTALLED="$CODEX_HOME/backups/integrity-installed-incomplete"
  cp -PpR "$BACKUP_ONE" "$INCOMPLETE_INSTALLED"
  sed '$d' "$INCOMPLETE_INSTALLED/installed-sha256.txt" \
    >"$INCOMPLETE_INSTALLED/installed-sha256.txt.new"
  mv "$INCOMPLETE_INSTALLED/installed-sha256.txt.new" \
    "$INCOMPLETE_INSTALLED/installed-sha256.txt"
  expect_backup_rejected "$INCOMPLETE_INSTALLED" \
    'incomplete installed checksum manifest'
fi

if case_enabled symlinks; then
  printf 'Internal symlink rejection\n'

  expect_symlink_backup_rejected() {
    local backup="$1"
    local label="$2"
    local before
    local pointer_before
    local output
    local exit_status

    before="$(snapshot_files "$CODEX_HOME/skills")"
    pointer_before="$(snapshot_entry "$CODEX_HOME/superzhao-last-backup")"

    set +e
    output="$(bash "$ROOT/scripts/rollback-codex-profile.sh" "$backup" 2>&1)"
    exit_status=$?
    set -e
    [[ "$exit_status" -ne 0 ]] || fail "rollback accepted $label"
    assert_contains "$output" 'symlink' "$label reports its symlink boundary"
    assert_eq "$before" "$(snapshot_files "$CODEX_HOME/skills")" \
      "$label leaves live skills unchanged"
    assert_eq "$pointer_before" \
      "$(snapshot_entry "$CODEX_HOME/superzhao-last-backup")" \
      "$label leaves the pointer unchanged"
  }

  SKILLS_LINK_BACKUP="$CODEX_HOME/backups/symlink-skills-container"
  cp -PpR "$BACKUP_ONE" "$SKILLS_LINK_BACKUP"
  rm -rf "$SKILLS_LINK_BACKUP/skills"
  ln -s "$BACKUP_ONE/skills" "$SKILLS_LINK_BACKUP/skills"
  expect_symlink_backup_rejected "$SKILLS_LINK_BACKUP" \
    'symlinked backup skills container'

  METADATA_LINK_BACKUP="$CODEX_HOME/backups/symlink-metadata"
  cp -PpR "$BACKUP_ONE" "$METADATA_LINK_BACKUP"
  rm "$METADATA_LINK_BACKUP/managed-inventory.tsv"
  ln -s "$BACKUP_ONE/managed-inventory.tsv" \
    "$METADATA_LINK_BACKUP/managed-inventory.tsv"
  expect_symlink_backup_rejected "$METADATA_LINK_BACKUP" \
    'symlinked backup metadata file'

  POINTER_LINK_HOME="$TMP/pointer-link-home"
  write_managed_profile "$POINTER_LINK_HOME"
  printf 'old-pointer-target\n' >"$POINTER_LINK_HOME/pointer-target"
  ln -s "$POINTER_LINK_HOME/pointer-target" \
    "$POINTER_LINK_HOME/superzhao-last-backup"
  POINTER_LINK_BEFORE="$(snapshot_files "$POINTER_LINK_HOME/skills")"
  set +e
  POINTER_LINK_OUTPUT="$(CODEX_HOME="$POINTER_LINK_HOME" \
    bash "$ROOT/scripts/install-codex-profile.sh" 2>&1)"
  POINTER_LINK_STATUS=$?
  set -e
  [[ "$POINTER_LINK_STATUS" -ne 0 ]] \
    || fail 'installer accepted a symlinked last-backup pointer'
  assert_contains "$POINTER_LINK_OUTPUT" 'symlink' \
    'pointer-symlink refusal is explicit'
  assert_eq "$POINTER_LINK_BEFORE" "$(snapshot_files "$POINTER_LINK_HOME/skills")" \
    'pointer-symlink refusal leaves live skills unchanged'
  [[ -L "$POINTER_LINK_HOME/superzhao-last-backup" ]] \
    || fail 'pointer-symlink refusal replaced the original symlink'

  ROOT_LINK_HOME="$TMP/root-link-home"
  mkdir -p "$ROOT_LINK_HOME/real-skills/using-superpowers"
  printf 'root-link-original\n' \
    >"$ROOT_LINK_HOME/real-skills/using-superpowers/SKILL.md"
  ln -s "$ROOT_LINK_HOME/real-skills" "$ROOT_LINK_HOME/skills"
  ROOT_LINK_BEFORE="$(snapshot_files "$ROOT_LINK_HOME/real-skills")"
  set +e
  ROOT_LINK_OUTPUT="$(CODEX_HOME="$ROOT_LINK_HOME" \
    bash "$ROOT/scripts/install-codex-profile.sh" 2>&1)"
  ROOT_LINK_STATUS=$?
  set -e
  [[ "$ROOT_LINK_STATUS" -ne 0 ]] \
    || fail 'installer accepted a symlinked skills container root'
  assert_contains "$ROOT_LINK_OUTPUT" 'symlink' \
    'skills-root symlink refusal is explicit'
  assert_eq "$ROOT_LINK_BEFORE" "$(snapshot_files "$ROOT_LINK_HOME/real-skills")" \
    'skills-root symlink refusal leaves its target unchanged'
fi

if case_enabled modes; then
  printf 'Private umask and mode fidelity\n'
  MODE_HOME="$TMP/mode-home"
  write_managed_profile "$MODE_HOME"
  MODE_BEFORE="$(snapshot_files "$MODE_HOME/skills")"
  (
    umask 000
    CODEX_HOME="$MODE_HOME" bash "$ROOT/scripts/install-codex-profile.sh" >/dev/null
  )
  MODE_RUN_BACKUP="$(cat "$MODE_HOME/superzhao-last-backup")"
  assert_eq '700' "$(portable_mode "$MODE_RUN_BACKUP")" \
    'backup directory is private under a permissive caller umask'
  for metadata in \
    format-version.txt source-commit.txt managed-skills.txt managed-inventory.tsv \
    installed-tree.tsv installed-sha256.txt original-tree.tsv original-sha256.txt; do
    assert_eq '600' "$(portable_mode "$MODE_RUN_BACKUP/$metadata")" \
      "backup metadata $metadata is private"
  done
  assert_eq "$(portable_mode \
    "$ROOT/skills/systematic-debugging/find-polluter.sh")" \
    "$(portable_mode \
      "$MODE_HOME/skills/systematic-debugging/find-polluter.sh")" \
    'installer preserves executable source-file mode'
  (
    umask 077
    CODEX_HOME="$MODE_HOME" bash "$ROOT/scripts/rollback-codex-profile.sh" >/dev/null
  )
  assert_eq "$MODE_BEFORE" "$(snapshot_files "$MODE_HOME/skills")" \
    'rollback restores file, directory, and empty-directory modes'
fi

if case_enabled recovery; then
  printf 'Incomplete automatic recovery reporting\n'
  RECOVERY_HOME="$TMP/recovery-home"
  RECOVERY_BIN="$TMP/recovery-bin"
  RECOVERY_STATE="$TMP/recovery-state"
  mkdir -p \
    "$RECOVERY_HOME/skills/brainstorming" \
    "$RECOVERY_HOME/skills/dispatching-parallel-agents" \
    "$RECOVERY_HOME/skills/personal-sentinel" \
    "$RECOVERY_BIN"
  printf 'recovery-brainstorming\n' >"$RECOVERY_HOME/skills/brainstorming/SKILL.md"
  printf 'recovery-dispatching\n' \
    >"$RECOVERY_HOME/skills/dispatching-parallel-agents/SKILL.md"
  printf 'recovery-personal\n' >"$RECOVERY_HOME/skills/personal-sentinel/SKILL.md"
  cat >"$RECOVERY_BIN/mv" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
count=0
if [[ -f "$SUPERZHAO_RECOVERY_STATE" ]]; then
  count="$(cat "$SUPERZHAO_RECOVERY_STATE")"
fi
count=$((count + 1))
printf '%s\n' "$count" >"$SUPERZHAO_RECOVERY_STATE"
case "$count" in
  3) exit 97 ;;
  4) exit 98 ;;
esac
exec "$SUPERZHAO_REAL_MV" "$@"
EOF
  chmod +x "$RECOVERY_BIN/mv"
  set +e
  RECOVERY_OUTPUT="$(PATH="$RECOVERY_BIN:$PATH" \
    SUPERZHAO_RECOVERY_STATE="$RECOVERY_STATE" \
    SUPERZHAO_REAL_MV="$REAL_MV" \
    CODEX_HOME="$RECOVERY_HOME" \
    bash "$ROOT/scripts/install-codex-profile.sh" 2>&1)"
  RECOVERY_STATUS=$?
  set -e
  assert_eq '70' "$RECOVERY_STATUS" \
    'incomplete automatic recovery returns its distinct status'
  assert_contains "$RECOVERY_OUTPUT" 'automatic install recovery incomplete' \
    'incomplete recovery emits a clear diagnostic'
  assert_contains "$RECOVERY_OUTPUT" 'original status: 97' \
    'incomplete recovery reports the initiating status'
  assert_contains "$RECOVERY_OUTPUT" "$RECOVERY_HOME/backups/" \
    'incomplete recovery reports the backup path'
  assert_contains "$RECOVERY_OUTPUT" "$RECOVERY_HOME/.superzhao-stage-" \
    'incomplete recovery reports the stage path'
  assert_contains "$RECOVERY_OUTPUT" "$RECOVERY_HOME/.superzhao-profile.lock" \
    'incomplete recovery reports the retained lock path'
  list_matching_directories "$RECOVERY_HOME/backups/superzhao-*" | grep -q . \
    || fail 'incomplete recovery did not preserve its backup'
  list_matching_directories "$RECOVERY_HOME/.superzhao-stage-*" | grep -q . \
    || fail 'incomplete recovery did not preserve its stage'
  [[ -d "$RECOVERY_HOME/.superzhao-profile.lock" ]] \
    || fail 'incomplete recovery did not preserve its transaction lock'
fi

printf 'Install and rollback test passed\n'
