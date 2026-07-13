#!/usr/bin/env bash
set -euo pipefail

LC_ALL=C
export LC_ALL
umask 077

CODEX_ROOT_INPUT="${CODEX_HOME:-$HOME/.codex}"
CODEX_ROOT=""
SKILLS_ROOT=""
BACKUPS_ROOT=""
LAST_BACKUP_POINTER=""
LOCK_DIR=""
LOCK_TOKEN="$$-${RANDOM}-${RANDOM}"
LOCK_HELD=no
PRESERVE_LOCK=no
BACKUP=""
ARCHIVE=""
VALIDATION_STAGE=""
RESTORE_STAGE=""
PRESERVE_VALIDATION=no
RECOVERY_FAILED=no

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

ORIGINAL_STATES=()
TOUCHED_SKILLS=()
TOUCHED_CURRENT_STATES=()

path_exists() {
  [[ -e "$1" || -L "$1" ]]
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

is_managed_skill() {
  local candidate="$1"
  local skill

  for skill in "${SKILLS[@]}"; do
    [[ "$candidate" == "$skill" ]] && return 0
  done
  return 1
}

stat_device() {
  local path="$1"
  local value

  if value="$(stat -f '%d' "$path" 2>/dev/null)"; then
    :
  elif value="$(stat -c '%d' "$path" 2>/dev/null)"; then
    :
  else
    printf 'error: cannot determine filesystem device for %s\n' "$path" >&2
    return 1
  fi
  case "$value" in
    '' | *[!0-9]*)
      printf 'error: invalid filesystem device for %s: %s\n' "$path" "$value" >&2
      return 1
      ;;
  esac
  printf '%s\n' "$value"
}

stat_mode() {
  local path="$1"
  local value

  if value="$(stat -f '%Lp' "$path" 2>/dev/null)"; then
    :
  elif value="$(stat -c '%a' "$path" 2>/dev/null)"; then
    :
  else
    printf 'error: cannot determine mode for %s\n' "$path" >&2
    return 1
  fi
  case "$value" in
    '' | *[!0-7]*)
      printf 'error: invalid mode for %s: %s\n' "$path" "$value" >&2
      return 1
      ;;
  esac
  printf '%s\n' "$value"
}

ensure_container_directory() {
  local path="$1"
  local label="$2"

  [[ ! -L "$path" ]] || die "$label must not be a symlink: $path"
  if [[ -e "$path" && ! -d "$path" ]]; then
    die "$label is not a directory: $path"
  fi
  mkdir -p "$path"
  [[ -d "$path" && ! -L "$path" ]] \
    || die "$label is not a physical directory: $path"
}

create_unique_directory() {
  local base="$1"
  local candidate="$base"
  local suffix=0

  while ! mkdir "$candidate" 2>/dev/null; do
    suffix=$((suffix + 1))
    if [[ "$suffix" -gt 1000 ]]; then
      printf 'error: could not allocate a unique directory for %s\n' "$base" >&2
      return 1
    fi
    candidate="$base-$suffix"
  done
  printf '%s\n' "$candidate"
}

describe_existing_lock() {
  local owner="$LOCK_DIR/owner"
  local owner_pid
  local owner_token
  local owner_command
  local line_count

  if [[ -L "$LOCK_DIR" || ! -d "$LOCK_DIR" ]]; then
    die "deployment lock is not a physical directory: $LOCK_DIR; inspect it manually"
  fi
  if [[ -L "$owner" || ! -f "$owner" ]]; then
    die "deployment lock metadata is missing or unsafe: $owner; do not remove it until no profile operation is running"
  fi
  line_count="$(wc -l <"$owner" | tr -d ' ')"
  owner_pid="$(sed -n 's/^pid=//p' "$owner")"
  owner_token="$(sed -n 's/^token=//p' "$owner")"
  owner_command="$(sed -n 's/^command=//p' "$owner")"
  case "$owner_pid" in
    '' | *[!0-9]*)
      die "deployment lock metadata is malformed: $owner; inspect and remove it manually only when safe"
      ;;
  esac
  case "$owner_token" in
    '' | *[!A-Za-z0-9._-]*)
      die "deployment lock metadata is malformed: $owner; inspect and remove it manually only when safe"
      ;;
  esac
  if [[ "$line_count" -ne 3 || -z "$owner_command" ]]; then
    die "deployment lock metadata is malformed: $owner; inspect and remove it manually only when safe"
  fi
  if kill -0 "$owner_pid" 2>/dev/null; then
    die "deployment lock is active (pid $owner_pid, command $owner_command): $LOCK_DIR"
  fi
  die "deployment lock is stale or its owner is unavailable (pid $owner_pid): $LOCK_DIR; inspect and remove it manually only when safe"
}

acquire_lock() {
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    describe_existing_lock
  fi
  LOCK_HELD=yes
  printf 'pid=%s\ntoken=%s\ncommand=rollback\n' "$$" "$LOCK_TOKEN" >"$LOCK_DIR/owner"
}

release_lock() {
  local owner="$LOCK_DIR/owner"
  local expected
  local actual

  [[ "$LOCK_HELD" == yes ]] || return 0
  [[ "$PRESERVE_LOCK" == no ]] || return 0
  expected="$(printf 'pid=%s\ntoken=%s\ncommand=rollback\n' "$$" "$LOCK_TOKEN")"
  if [[ -L "$owner" || ! -f "$owner" ]]; then
    printf 'error: refusing to release changed deployment lock metadata: %s\n' "$owner" >&2
    return 1
  fi
  actual="$(cat "$owner")"
  if [[ "$actual" != "$expected" ]]; then
    printf 'error: refusing to release deployment lock owned by another token: %s\n' "$LOCK_DIR" >&2
    return 1
  fi
  rm "$owner" || return 1
  rmdir "$LOCK_DIR" || return 1
  LOCK_HELD=no
}

cleanup_validation() {
  if [[ "$PRESERVE_VALIDATION" == no \
    && -n "$VALIDATION_STAGE" && -d "$VALIDATION_STAGE" ]]; then
    rm -rf "$VALIDATION_STAGE"
  fi
}

cleanup_on_exit() {
  set +e
  cleanup_validation
  release_lock
}

trap cleanup_on_exit EXIT

verify_same_device() {
  local reference="$1"
  shift
  local reference_device
  local path
  local device

  reference_device="$(stat_device "$reference")" || return 1
  for path in "$@"; do
    device="$(stat_device "$path")" || return 1
    if [[ "$device" != "$reference_device" ]]; then
      printf 'error: cross-device transaction is unsafe: %s is device %s, expected %s from %s\n' \
        "$path" "$device" "$reference_device" "$reference" >&2
      return 1
    fi
  done
}

verify_live_entries_same_device() {
  local skill
  local live_path

  for skill in "${SKILLS[@]}"; do
    live_path="$SKILLS_ROOT/$skill"
    if path_exists "$live_path"; then
      verify_same_device "$CODEX_ROOT" "$live_path" || return 1
    fi
  done
}

validate_profile_tree() {
  local root="$1"
  local label="$2"
  local path

  [[ ! -L "$root" ]] || die "$label must not be a symlink: $root"
  [[ -d "$root" ]] || die "$label is not a directory: $root"
  while IFS= read -r path; do
    if [[ -L "$path" ]]; then
      die "$label contains a symlink, which this profile forbids: $path"
    fi
    if [[ ! -d "$path" && ! -f "$path" ]]; then
      die "$label contains an unsupported entry type: $path"
    fi
  done < <(find "$root" -print | LC_ALL=C sort)
}

build_tree_manifests() {
  local root="$1"
  local tree_output="$2"
  local checksum_output="$3"
  local path
  local relative
  local type
  local mode
  local digest

  [[ -d "$root" && ! -L "$root" ]] || return 1
  : >"$tree_output"
  : >"$checksum_output"
  while IFS= read -r path; do
    [[ "$path" != "$root" ]] || continue
    relative="${path#"$root"/}"
    case "$relative" in
      *$'\n'* | *$'\t'* | /* | ../* | */../* | */.. | *//*)
        printf 'error: unsafe manifest path: %s\n' "$relative" >&2
        return 1
        ;;
    esac
    if [[ -L "$path" ]]; then
      printf 'error: backup tree contains forbidden symlink: %s\n' "$path" >&2
      return 1
    elif [[ -d "$path" ]]; then
      type=d
    elif [[ -f "$path" ]]; then
      type=f
    else
      printf 'error: backup tree contains unsupported entry: %s\n' "$path" >&2
      return 1
    fi
    mode="$(stat_mode "$path")" || return 1
    printf '%s\t%s\t%s\n' "$type" "$mode" "$relative" >>"$tree_output"
    if [[ "$type" == f ]]; then
      digest="$(shasum -a 256 "$path")" || return 1
      digest="${digest%% *}"
      printf '%s  %s\n' "$digest" "$relative" >>"$checksum_output"
    fi
  done < <(find "$root" -print | LC_ALL=C sort)
}

validate_metadata_file() {
  local path="$1"
  local label="$2"
  local mode

  [[ ! -L "$path" ]] || die "backup metadata symlink is forbidden: $path"
  [[ -f "$path" ]] || die "backup is missing regular metadata file $label"
  mode="$(stat_mode "$path")"
  [[ "$mode" == 600 ]] \
    || die "backup metadata mode is unsafe for $label: $mode"
}

validate_managed_skills_manifest() {
  local index=0
  local line

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$index" -lt "${#SKILLS[@]}" ]] \
      || die 'backup managed-skills.txt has extra entries'
    [[ "$line" == "${SKILLS[$index]}" ]] \
      || die 'backup managed-skills.txt does not match this profile'
    index=$((index + 1))
  done <"$BACKUP/managed-skills.txt"
  [[ "$index" -eq "${#SKILLS[@]}" ]] \
    || die 'backup managed-skills.txt is incomplete'
}

validate_inventory() {
  local index=0
  local line
  local expected_skill
  local state

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$index" -lt "${#SKILLS[@]}" ]] \
      || die 'backup managed-inventory.tsv has extra entries'
    expected_skill="${SKILLS[$index]}"
    case "$line" in
      "$expected_skill"$'\tpresent') state=present ;;
      "$expected_skill"$'\tabsent') state=absent ;;
      *) die 'backup managed-inventory.tsv is invalid' ;;
    esac
    ORIGINAL_STATES+=("$state")
    index=$((index + 1))
  done <"$BACKUP/managed-inventory.tsv"
  [[ "$index" -eq "${#SKILLS[@]}" ]] \
    || die 'backup managed-inventory.tsv is incomplete'
}

validate_source_commit() {
  local commit
  local length

  commit="$(cat "$BACKUP/source-commit.txt")"
  [[ "$commit" != *$'\n'* ]] || die 'backup source commit has multiple lines'
  length="${#commit}"
  [[ "$length" -eq 40 || "$length" -eq 64 ]] \
    || die 'backup source commit has an invalid length'
  case "$commit" in
    *[!0-9a-fA-F]*) die 'backup source commit is not hexadecimal' ;;
  esac
}

validate_manifest_pair() {
  local tree_file="$1"
  local checksum_file="$2"
  local scope="$3"
  local expected_files="$VALIDATION_STAGE/$scope-expected-files"
  local actual_files="$VALIDATION_STAGE/$scope-actual-files"
  local line
  local type
  local mode
  local path
  local extra
  local previous_path=""
  local hash
  local skill

  : >"$expected_files"
  while IFS= read -r line || [[ -n "$line" ]]; do
    IFS=$'\t' read -r type mode path extra <<<"$line"
    [[ -n "$type" && -n "$mode" && -n "$path" && -z "$extra" ]] \
      || die "backup $scope tree manifest has an invalid line"
    [[ "$line" == "$type"$'\t'"$mode"$'\t'"$path" ]] \
      || die "backup $scope tree manifest has an invalid field layout"
    [[ "$type" == d || "$type" == f ]] \
      || die "backup $scope tree manifest has an invalid type"
    case "$mode" in
      '' | *[!0-7]*) die "backup $scope tree manifest has an invalid mode" ;;
    esac
    case "$path" in
      /* | ./* | ../* | */../* | */.. | *//* | *$'\n'* | *$'\t'* | '')
        die "backup $scope tree manifest has an unsafe path"
        ;;
    esac
    skill="${path%%/*}"
    is_managed_skill "$skill" \
      || die "backup $scope tree manifest references unmanaged path $path"
    if [[ -n "$previous_path" && ! "$path" > "$previous_path" ]]; then
      die "backup $scope tree manifest is not path-sorted"
    fi
    previous_path="$path"
    [[ "$type" == f ]] && printf '%s\n' "$path" >>"$expected_files"
  done <"$tree_file"

  : >"$actual_files"
  previous_path=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "${#line}" -gt 66 && "${line:64:2}" == '  ' ]] \
      || die "backup $scope checksum manifest has an invalid line"
    hash="${line:0:64}"
    path="${line:66}"
    case "$hash" in
      *[!0-9a-f]*) die "backup $scope checksum manifest has an invalid digest" ;;
    esac
    case "$path" in
      /* | ./* | ../* | */../* | */.. | *//* | *$'\n'* | *$'\t'* | '')
        die "backup $scope checksum manifest has an unsafe path"
        ;;
    esac
    skill="${path%%/*}"
    is_managed_skill "$skill" \
      || die "backup $scope checksum manifest references unmanaged path $path"
    if [[ -n "$previous_path" && ! "$path" > "$previous_path" ]]; then
      die "backup $scope checksum manifest is not path-sorted"
    fi
    previous_path="$path"
    printf '%s\n' "$path" >>"$actual_files"
  done <"$checksum_file"
  cmp -s "$expected_files" "$actual_files" \
    || die "backup $scope manifests are incomplete or inconsistent"
}

validate_manifest_roots() {
  local index=0
  local skill
  local state
  local pattern

  for skill in "${SKILLS[@]}"; do
    grep -Eq "^d\t[0-7]+\t${skill}$" "$BACKUP/installed-tree.tsv" \
      || die "backup installed tree manifest is missing root $skill"
    grep -Eq "^f\t[0-7]+\t${skill}/SKILL\\.md$" "$BACKUP/installed-tree.tsv" \
      || die "backup installed tree manifest is missing $skill/SKILL.md"
    state="${ORIGINAL_STATES[$index]}"
    pattern="^[df]\t[0-7]+\t${skill}(/|$)"
    if [[ "$state" == present ]]; then
      grep -Eq "^d\t[0-7]+\t${skill}$" "$BACKUP/original-tree.tsv" \
        || die "backup original tree manifest is missing root $skill"
    elif grep -Eq "$pattern" "$BACKUP/original-tree.tsv"; then
      die "backup original tree manifest contains originally absent $skill"
    fi
    index=$((index + 1))
  done
}

validate_backup_layout() {
  local metadata
  local backup_mode
  local skills_mode

  [[ ! -L "$BACKUP" && -d "$BACKUP" ]] \
    || die "backup directory must not be a symlink: $BACKUP"
  [[ ! -L "$BACKUP/skills" && -d "$BACKUP/skills" ]] \
    || die "backup skills container symlink is forbidden: $BACKUP/skills"
  backup_mode="$(stat_mode "$BACKUP")"
  skills_mode="$(stat_mode "$BACKUP/skills")"
  [[ "$backup_mode" == 700 && "$skills_mode" == 700 ]] \
    || die "backup containers have unsafe modes: backup=$backup_mode skills=$skills_mode"
  for metadata in \
    format-version.txt source-commit.txt managed-skills.txt managed-inventory.tsv \
    installed-tree.tsv installed-sha256.txt original-tree.tsv original-sha256.txt; do
    validate_metadata_file "$BACKUP/$metadata" "$metadata"
  done
}

mark_recovery_failure() {
  RECOVERY_FAILED=yes
  printf 'error: recovery step failed: %s\n' "$1" >&2
}

restore_archived_entries() {
  local index="${#TOUCHED_SKILLS[@]}"
  local skill
  local current_state
  local live_path
  local archive_path

  while [[ "$index" -gt 0 ]]; do
    index=$((index - 1))
    skill="${TOUCHED_SKILLS[$index]}"
    current_state="${TOUCHED_CURRENT_STATES[$index]}"
    live_path="$SKILLS_ROOT/$skill"
    archive_path="$ARCHIVE/skills/$skill"
    if [[ "$current_state" == present ]]; then
      path_exists "$archive_path" || continue
      if path_exists "$live_path" && ! rm -rf "$live_path"; then
        mark_recovery_failure "could not remove restored entry $live_path"
        continue
      fi
      if ! mv "$archive_path" "$live_path"; then
        mark_recovery_failure "could not restore current $skill from $archive_path"
      fi
    elif path_exists "$live_path" && ! rm -rf "$live_path"; then
      mark_recovery_failure "could not remove rollback-created entry $live_path"
    fi
  done
}

abort_rollback() {
  local original_status="$1"

  trap - ERR HUP INT TERM
  set +e +u
  RECOVERY_FAILED=no
  restore_archived_entries
  if [[ "$RECOVERY_FAILED" == yes ]]; then
    PRESERVE_VALIDATION=yes
    PRESERVE_LOCK=yes
    printf 'error: automatic rollback recovery incomplete (original status: %s)\n' \
      "$original_status" >&2
    printf 'error: Backup: %s\nerror: Archive: %s\nerror: Stage: %s\nerror: Lock: %s\n' \
      "$BACKUP" "$ARCHIVE" "$VALIDATION_STAGE" "$LOCK_DIR" >&2
    exit 70
  fi
  cleanup_validation
  if ! release_lock; then
    PRESERVE_VALIDATION=yes
    PRESERVE_LOCK=yes
    printf 'error: automatic rollback recovery incomplete (original status: %s)\n' \
      "$original_status" >&2
    printf 'error: Backup: %s\nerror: Archive: %s\nerror: Stage: %s\nerror: Lock: %s\n' \
      "$BACKUP" "$ARCHIVE" "$VALIDATION_STAGE" "$LOCK_DIR" >&2
    exit 70
  fi
  exit "$original_status"
}

if [[ "$#" -gt 1 ]]; then
  die 'usage: rollback-codex-profile.sh [backup-path]'
fi

mkdir -p "$CODEX_ROOT_INPUT"
CODEX_ROOT="$(cd "$CODEX_ROOT_INPUT" && pwd -P)"
SKILLS_ROOT="$CODEX_ROOT/skills"
BACKUPS_ROOT="$CODEX_ROOT/backups"
LAST_BACKUP_POINTER="$CODEX_ROOT/superzhao-last-backup"
LOCK_DIR="$CODEX_ROOT/.superzhao-profile.lock"
ensure_container_directory "$SKILLS_ROOT" 'skills container root'
ensure_container_directory "$BACKUPS_ROOT" 'backups container root'
acquire_lock

trap 'abort_rollback $?' ERR
trap 'abort_rollback 129' HUP
trap 'abort_rollback 130' INT
trap 'abort_rollback 143' TERM

if [[ "$#" -eq 1 ]]; then
  BACKUP="$1"
else
  [[ ! -L "$LAST_BACKUP_POINTER" ]] \
    || die "last-backup pointer must not be a symlink: $LAST_BACKUP_POINTER"
  [[ -f "$LAST_BACKUP_POINTER" ]] || die 'last-backup pointer is missing'
  BACKUP="$(cat "$LAST_BACKUP_POINTER")"
fi
[[ -n "$BACKUP" && "$BACKUP" != *$'\n'* ]] \
  || die 'backup path is empty or contains multiple lines'
[[ ! -L "$BACKUP" && -d "$BACKUP" ]] \
  || die "backup directory does not exist or is a symlink: $BACKUP"
BACKUP="$(cd "$BACKUP" && pwd -P)"
[[ "${BACKUP%/*}" == "$BACKUPS_ROOT" ]] \
  || die 'backup is outside the configured canonical backup root'

verify_same_device "$CODEX_ROOT" "$SKILLS_ROOT" "$BACKUPS_ROOT" "$BACKUP"
verify_live_entries_same_device
[[ ! -L "$BACKUP/format-version.txt" && -f "$BACKUP/format-version.txt" ]] \
  || die 'backup format metadata is missing or unsafe'
[[ "$(cat "$BACKUP/format-version.txt")" == superzhao-codex-profile-v2 ]] \
  || die 'backup format is not supported'
validate_backup_layout
validate_managed_skills_manifest
validate_inventory
validate_source_commit

VALIDATION_STAGE="$(create_unique_directory \
  "$CODEX_ROOT/.superzhao-rollback-stage-$(date +%Y%m%d-%H%M%S)-$$")"
RESTORE_STAGE="$VALIDATION_STAGE/restore"
mkdir "$RESTORE_STAGE"
verify_same_device "$CODEX_ROOT" "$VALIDATION_STAGE"
validate_manifest_pair \
  "$BACKUP/installed-tree.tsv" "$BACKUP/installed-sha256.txt" installed
validate_manifest_pair \
  "$BACKUP/original-tree.tsv" "$BACKUP/original-sha256.txt" original
validate_manifest_roots
build_tree_manifests "$BACKUP/skills" \
  "$VALIDATION_STAGE/rebuilt-original-tree.tsv" \
  "$VALIDATION_STAGE/rebuilt-original-sha256.txt"
cmp -s "$BACKUP/original-tree.tsv" \
  "$VALIDATION_STAGE/rebuilt-original-tree.tsv" \
  || die 'backup original tree manifest does not match backup/skills'
cmp -s "$BACKUP/original-sha256.txt" \
  "$VALIDATION_STAGE/rebuilt-original-sha256.txt" \
  || die 'backup original checksums do not match backup/skills'

index=0
for skill in "${SKILLS[@]}"; do
  if [[ "${ORIGINAL_STATES[$index]}" == present ]]; then
    cp -PpR "$BACKUP/skills/$skill" "$RESTORE_STAGE/$skill"
    validate_profile_tree "$RESTORE_STAGE/$skill" "staged original skill $skill"
  fi
  if path_exists "$SKILLS_ROOT/$skill"; then
    validate_profile_tree "$SKILLS_ROOT/$skill" "live skill $skill"
  fi
  index=$((index + 1))
done
build_tree_manifests "$RESTORE_STAGE" \
  "$VALIDATION_STAGE/staged-original-tree.tsv" \
  "$VALIDATION_STAGE/staged-original-sha256.txt"
cmp -s "$BACKUP/original-tree.tsv" \
  "$VALIDATION_STAGE/staged-original-tree.tsv" \
  || die 'staged original tree does not match the validated backup'
cmp -s "$BACKUP/original-sha256.txt" \
  "$VALIDATION_STAGE/staged-original-sha256.txt" \
  || die 'staged original checksums do not match the validated backup'

STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$(create_unique_directory \
  "$BACKUPS_ROOT/superzhao-current-before-rollback-$STAMP-$$")"
mkdir "$ARCHIVE/skills"
printf '%s\n' "$BACKUP" >"$ARCHIVE/rollback-source.txt"
verify_same_device "$CODEX_ROOT" \
  "$SKILLS_ROOT" "$BACKUPS_ROOT" "$BACKUP" "$VALIDATION_STAGE" "$ARCHIVE"
verify_live_entries_same_device

index=0
for skill in "${SKILLS[@]}"; do
  current_state=absent
  if path_exists "$SKILLS_ROOT/$skill"; then
    current_state=present
  fi
  TOUCHED_CURRENT_STATES+=("$current_state")
  TOUCHED_SKILLS+=("$skill")
  if [[ "$current_state" == present ]]; then
    mv "$SKILLS_ROOT/$skill" "$ARCHIVE/skills/$skill" \
      || abort_rollback "$?"
  fi
  if [[ "${ORIGINAL_STATES[$index]}" == present ]]; then
    mv "$RESTORE_STAGE/$skill" "$SKILLS_ROOT/$skill" \
      || abort_rollback "$?"
  fi
  index=$((index + 1))
done

trap - ERR HUP INT TERM
cleanup_validation
release_lock || die "could not release deployment lock: $LOCK_DIR"
trap - EXIT
printf 'Restored Superpowers skills from %s\nCurrent profile archived at %s\nStart a new Codex task to refresh discovery.\n' \
  "$BACKUP" "$ARCHIVE"
