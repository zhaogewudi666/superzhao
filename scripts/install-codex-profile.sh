#!/usr/bin/env bash
set -euo pipefail

LC_ALL=C
export LC_ALL
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
CODEX_ROOT_INPUT="${CODEX_HOME:-$HOME/.codex}"
CODEX_ROOT=""
SKILLS_ROOT=""
BACKUPS_ROOT=""
LAST_BACKUP_POINTER=""
LOCK_DIR=""
LOCK_TOKEN="$$-${RANDOM}-${RANDOM}"
LOCK_HELD=no
PRESERVE_LOCK=no
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE=""
PAYLOAD=""
BACKUP=""
PREVIOUS_POINTER_STATE=absent
POINTER_PUBLISH_STARTED=no
PRESERVE_STAGE=no
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

TOUCHED_SKILLS=()
TOUCHED_ORIGINAL_STATES=()

path_exists() {
  [[ -e "$1" || -L "$1" ]]
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
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
  printf 'pid=%s\ntoken=%s\ncommand=install\n' "$$" "$LOCK_TOKEN" >"$LOCK_DIR/owner"
}

release_lock() {
  local owner="$LOCK_DIR/owner"
  local expected
  local actual

  [[ "$LOCK_HELD" == yes ]] || return 0
  [[ "$PRESERVE_LOCK" == no ]] || return 0
  expected="$(printf 'pid=%s\ntoken=%s\ncommand=install\n' "$$" "$LOCK_TOKEN")"
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

cleanup_stage() {
  if [[ "$PRESERVE_STAGE" == no && -n "$STAGE" && -d "$STAGE" ]]; then
    rm -rf "$STAGE"
  fi
}

cleanup_on_exit() {
  set +e
  cleanup_stage
  release_lock
}

trap cleanup_on_exit EXIT

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
      printf 'error: manifest tree contains forbidden symlink: %s\n' "$path" >&2
      return 1
    elif [[ -d "$path" ]]; then
      type=d
    elif [[ -f "$path" ]]; then
      type=f
    else
      printf 'error: manifest tree contains unsupported entry: %s\n' "$path" >&2
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

mark_recovery_failure() {
  RECOVERY_FAILED=yes
  printf 'error: recovery step failed: %s\n' "$1" >&2
}

restore_published_pointer() {
  local pending_pointer="$STAGE/last-backup-pointer"
  local previous_pointer="$STAGE/previous-last-backup"

  [[ "$POINTER_PUBLISH_STARTED" == yes ]] || return 0
  path_exists "$pending_pointer" && return 0
  if [[ "$PREVIOUS_POINTER_STATE" == present ]]; then
    if ! path_exists "$previous_pointer"; then
      mark_recovery_failure "saved previous pointer is missing at $previous_pointer"
    elif ! mv "$previous_pointer" "$LAST_BACKUP_POINTER"; then
      mark_recovery_failure "could not restore pointer to $LAST_BACKUP_POINTER"
    fi
  elif path_exists "$LAST_BACKUP_POINTER" && ! rm -f "$LAST_BACKUP_POINTER"; then
    mark_recovery_failure "could not remove published pointer $LAST_BACKUP_POINTER"
  fi
}

restore_touched_entries() {
  local index="${#TOUCHED_SKILLS[@]}"
  local skill
  local original_state
  local live_path
  local backup_path

  while [[ "$index" -gt 0 ]]; do
    index=$((index - 1))
    skill="${TOUCHED_SKILLS[$index]}"
    original_state="${TOUCHED_ORIGINAL_STATES[$index]}"
    live_path="$SKILLS_ROOT/$skill"
    backup_path="$BACKUP/skills/$skill"
    if [[ "$original_state" == present ]]; then
      path_exists "$backup_path" || continue
      if path_exists "$live_path" && ! rm -rf "$live_path"; then
        mark_recovery_failure "could not remove replacement $live_path"
        continue
      fi
      if ! mv "$backup_path" "$live_path"; then
        mark_recovery_failure "could not restore $skill from $backup_path"
      fi
    else
      path_exists "$PAYLOAD/$skill" && continue
      if path_exists "$live_path" && ! rm -rf "$live_path"; then
        mark_recovery_failure "could not remove newly installed $live_path"
      fi
    fi
  done
}

abort_install() {
  local original_status="$1"

  trap - ERR HUP INT TERM
  set +e +u
  RECOVERY_FAILED=no
  restore_published_pointer
  restore_touched_entries
  if [[ "$RECOVERY_FAILED" == yes ]]; then
    PRESERVE_STAGE=yes
    PRESERVE_LOCK=yes
    printf 'error: automatic install recovery incomplete (original status: %s)\n' \
      "$original_status" >&2
    printf 'error: Backup: %s\nerror: Stage: %s\nerror: Lock: %s\n' \
      "$BACKUP" "$STAGE" "$LOCK_DIR" >&2
    exit 70
  fi
  cleanup_stage
  if ! release_lock; then
    PRESERVE_STAGE=yes
    PRESERVE_LOCK=yes
    printf 'error: automatic install recovery incomplete (original status: %s)\n' \
      "$original_status" >&2
    printf 'error: Backup: %s\nerror: Stage: %s\nerror: Lock: %s\n' \
      "$BACKUP" "$STAGE" "$LOCK_DIR" >&2
    exit 70
  fi
  exit "$original_status"
}

mkdir -p "$CODEX_ROOT_INPUT"
CODEX_ROOT="$(cd "$CODEX_ROOT_INPUT" && pwd -P)"
SKILLS_ROOT="$CODEX_ROOT/skills"
BACKUPS_ROOT="$CODEX_ROOT/backups"
LAST_BACKUP_POINTER="$CODEX_ROOT/superzhao-last-backup"
LOCK_DIR="$CODEX_ROOT/.superzhao-profile.lock"
ensure_container_directory "$SKILLS_ROOT" 'skills container root'
ensure_container_directory "$BACKUPS_ROOT" 'backups container root'
acquire_lock

trap 'abort_install $?' ERR
trap 'abort_install 129' HUP
trap 'abort_install 130' INT
trap 'abort_install 143' TERM

[[ ! -L "$LAST_BACKUP_POINTER" ]] \
  || die "last-backup pointer must not be a symlink: $LAST_BACKUP_POINTER"
if path_exists "$LAST_BACKUP_POINTER" && [[ ! -f "$LAST_BACKUP_POINTER" ]]; then
  die "last-backup pointer is not a regular file: $LAST_BACKUP_POINTER"
fi

for skill in "${SKILLS[@]}"; do
  [[ -d "$ROOT/skills/$skill" && ! -L "$ROOT/skills/$skill" ]] \
    || die "source skill directory is missing or symlinked: skills/$skill"
  [[ -f "$ROOT/skills/$skill/SKILL.md" && ! -L "$ROOT/skills/$skill/SKILL.md" ]] \
    || die "source skill entrypoint is missing or symlinked: skills/$skill/SKILL.md"
  validate_profile_tree "$ROOT/skills/$skill" "source skill $skill"
  if path_exists "$SKILLS_ROOT/$skill"; then
    validate_profile_tree "$SKILLS_ROOT/$skill" "live skill $skill"
  fi
done

STAGE="$(create_unique_directory "$CODEX_ROOT/.superzhao-stage-$STAMP-$$")"
PAYLOAD="$STAGE/payload"
mkdir "$PAYLOAD"
for skill in "${SKILLS[@]}"; do
  cp -PpR "$ROOT/skills/$skill" "$PAYLOAD/$skill"
done
for skill in "${SKILLS[@]}"; do
  validate_profile_tree "$PAYLOAD/$skill" "staged skill $skill"
done
build_tree_manifests \
  "$PAYLOAD" "$STAGE/installed-tree.tsv" "$STAGE/installed-sha256.txt"

SOURCE_COMMIT="$(git -C "$ROOT" rev-parse --verify HEAD)"
BACKUP="$(create_unique_directory "$BACKUPS_ROOT/superzhao-$STAMP-$$")"
mkdir "$BACKUP/skills"
printf 'superzhao-codex-profile-v2\n' >"$BACKUP/format-version.txt"
printf '%s\n' "$SOURCE_COMMIT" >"$BACKUP/source-commit.txt"
: >"$BACKUP/managed-skills.txt"
: >"$BACKUP/managed-inventory.tsv"
for skill in "${SKILLS[@]}"; do
  printf '%s\n' "$skill" >>"$BACKUP/managed-skills.txt"
  if path_exists "$SKILLS_ROOT/$skill"; then
    printf '%s\tpresent\n' "$skill" >>"$BACKUP/managed-inventory.tsv"
  else
    printf '%s\tabsent\n' "$skill" >>"$BACKUP/managed-inventory.tsv"
  fi
done
cp -Pp "$STAGE/installed-tree.tsv" "$BACKUP/installed-tree.tsv"
cp -Pp "$STAGE/installed-sha256.txt" "$BACKUP/installed-sha256.txt"

verify_same_device "$CODEX_ROOT" \
  "$SKILLS_ROOT" "$BACKUPS_ROOT" "$STAGE" "$BACKUP"
verify_live_entries_same_device

for skill in "${SKILLS[@]}"; do
  original_state=absent
  if path_exists "$SKILLS_ROOT/$skill"; then
    original_state=present
  fi
  TOUCHED_ORIGINAL_STATES+=("$original_state")
  TOUCHED_SKILLS+=("$skill")
  if [[ "$original_state" == present ]]; then
    mv "$SKILLS_ROOT/$skill" "$BACKUP/skills/$skill" \
      || abort_install "$?"
  fi
  mv "$PAYLOAD/$skill" "$SKILLS_ROOT/$skill" \
    || abort_install "$?"
done

build_tree_manifests \
  "$BACKUP/skills" "$BACKUP/original-tree.tsv" "$BACKUP/original-sha256.txt"
(
  cd "$SKILLS_ROOT"
  shasum -a 256 -c "$BACKUP/installed-sha256.txt" >/dev/null
)

if path_exists "$LAST_BACKUP_POINTER"; then
  cp -Pp "$LAST_BACKUP_POINTER" "$STAGE/previous-last-backup"
  PREVIOUS_POINTER_STATE=present
fi
printf '%s\n' "$BACKUP" >"$STAGE/last-backup-pointer"
POINTER_PUBLISH_STARTED=yes
mv "$STAGE/last-backup-pointer" "$LAST_BACKUP_POINTER" \
  || abort_install "$?"

trap - ERR HUP INT TERM
cleanup_stage
release_lock || die "could not release deployment lock: $LOCK_DIR"
trap - EXIT
printf 'Installed Superzhao skills. Backup: %s\nStart a new Codex task to refresh discovery.\n' \
  "$BACKUP"
