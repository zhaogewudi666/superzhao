#!/usr/bin/env bash
set -euo pipefail

LC_ALL=C
export LC_ALL

CODEX_ROOT="${CODEX_HOME:-$HOME/.codex}"
SKILLS_ROOT="$CODEX_ROOT/skills"
BACKUPS_ROOT="$CODEX_ROOT/backups"
BACKUP=""
ARCHIVE=""

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
    if [[ "$candidate" == "$skill" ]]; then
      return 0
    fi
  done
  return 1
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

validate_managed_skills_manifest() {
  local index=0
  local line

  [[ -f "$BACKUP/managed-skills.txt" ]] \
    || die 'backup is missing managed-skills.txt'
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

  [[ -f "$BACKUP/managed-inventory.tsv" ]] \
    || die 'backup is missing managed-inventory.tsv'
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$index" -lt "${#SKILLS[@]}" ]] \
      || die 'backup managed-inventory.tsv has extra entries'
    expected_skill="${SKILLS[$index]}"
    case "$line" in
      "$expected_skill"$'\tpresent')
        state=present
        ;;
      "$expected_skill"$'\tabsent')
        state=absent
        ;;
      *)
        die 'backup managed-inventory.tsv is invalid'
        ;;
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

  [[ -f "$BACKUP/source-commit.txt" ]] \
    || die 'backup is missing source-commit.txt'
  commit="$(cat "$BACKUP/source-commit.txt")"
  [[ "$commit" != *$'\n'* ]] || die 'backup source commit has multiple lines'
  length="${#commit}"
  [[ "$length" -eq 40 || "$length" -eq 64 ]] \
    || die 'backup source commit has an invalid length'
  case "$commit" in
    *[!0-9a-fA-F]*)
      die 'backup source commit is not hexadecimal'
      ;;
  esac
}

validate_checksums() {
  local line
  local hash
  local path
  local skill
  local previous_path=""
  local line_count=0
  local found

  [[ -s "$BACKUP/installed-sha256.txt" ]] \
    || die 'backup installed-sha256.txt is missing or empty'
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "${#line}" -gt 66 && "${line:64:2}" == '  ' ]] \
      || die 'backup installed-sha256.txt has an invalid line'
    hash="${line:0:64}"
    path="${line:66}"
    case "$hash" in
      *[!0-9a-f]*)
        die 'backup installed-sha256.txt has an invalid digest'
        ;;
    esac
    case "$path" in
      /* | ./* | ../* | */../* | */.. | *//* | '')
        die 'backup installed-sha256.txt has an unsafe path'
        ;;
    esac
    skill="${path%%/*}"
    [[ "$skill" != "$path" ]] && is_managed_skill "$skill" \
      || die 'backup installed-sha256.txt references an unmanaged path'
    if [[ -n "$previous_path" && ! "$path" > "$previous_path" ]]; then
      die 'backup installed-sha256.txt is not deterministically path-sorted'
    fi
    previous_path="$path"
    line_count=$((line_count + 1))
  done <"$BACKUP/installed-sha256.txt"
  [[ "$line_count" -gt 0 ]] || die 'backup installed-sha256.txt is empty'

  for skill in "${SKILLS[@]}"; do
    found=no
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ "${line:66}" == "$skill/SKILL.md" ]]; then
        found=yes
        break
      fi
    done <"$BACKUP/installed-sha256.txt"
    [[ "$found" == yes ]] \
      || die "backup checksum manifest is missing $skill/SKILL.md"
  done
}

validate_backup_entries() {
  local index=0
  local skill
  local state
  local entry
  local name

  [[ -d "$BACKUP/skills" ]] || die 'backup is missing its skills directory'
  for skill in "${SKILLS[@]}"; do
    state="${ORIGINAL_STATES[$index]}"
    if [[ "$state" == present ]]; then
      path_exists "$BACKUP/skills/$skill" \
        || die "backup is missing original entry for $skill"
    elif path_exists "$BACKUP/skills/$skill"; then
      die "backup unexpectedly contains originally absent entry $skill"
    fi
    index=$((index + 1))
  done

  for entry in \
    "$BACKUP/skills"/* \
    "$BACKUP/skills"/.[!.]* \
    "$BACKUP/skills"/..?*; do
    path_exists "$entry" || continue
    name="${entry##*/}"
    is_managed_skill "$name" \
      || die "backup contains unmanaged skill entry: $name"
  done
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
      # A missing archive entry means the attempted live-to-archive move did
      # not land, so recovery must not delete the pre-existing live entry.
      path_exists "$archive_path" || continue
      if path_exists "$live_path"; then
        rm -rf "$live_path"
      fi
      mv "$archive_path" "$live_path"
    elif path_exists "$live_path"; then
      rm -rf "$live_path"
    fi
  done
}

abort_rollback() {
  local exit_status="$1"

  trap - ERR HUP INT TERM
  set +e
  restore_archived_entries
  exit "$exit_status"
}

if [[ "$#" -gt 1 ]]; then
  die 'usage: rollback-codex-profile.sh [backup-path]'
fi

if [[ "$#" -eq 1 ]]; then
  BACKUP="$1"
else
  [[ -f "$CODEX_ROOT/superzhao-last-backup" ]] \
    || die 'last-backup pointer is missing'
  BACKUP="$(cat "$CODEX_ROOT/superzhao-last-backup")"
fi
[[ -n "$BACKUP" && "$BACKUP" != *$'\n'* ]] \
  || die 'backup path is empty or contains multiple lines'
[[ -d "$BACKUPS_ROOT" ]] || die 'backup root does not exist'

BACKUPS_CANONICAL="$(cd "$BACKUPS_ROOT" && pwd -P)"
[[ -d "$BACKUP" ]] || die "backup directory does not exist: $BACKUP"
BACKUP="$(cd "$BACKUP" && pwd -P)"
case "$BACKUP" in
  "$BACKUPS_CANONICAL"/*)
    ;;
  *)
    die 'backup is outside the configured CODEX_HOME backup root'
    ;;
esac

[[ -f "$BACKUP/format-version.txt" ]] \
  || die 'backup is missing format-version.txt'
[[ "$(cat "$BACKUP/format-version.txt")" == superzhao-codex-profile-v1 ]] \
  || die 'backup format is not supported'
validate_managed_skills_manifest
validate_inventory
validate_source_commit
validate_checksums
validate_backup_entries

# No live or archive mutation occurs before every backup check above succeeds.
mkdir -p "$SKILLS_ROOT"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$(create_unique_directory \
  "$BACKUPS_ROOT/superzhao-current-before-rollback-$STAMP-$$")"
mkdir "$ARCHIVE/skills"
printf '%s\n' "$BACKUP" >"$ARCHIVE/rollback-source.txt"

trap 'abort_rollback $?' ERR
trap 'abort_rollback 129' HUP
trap 'abort_rollback 130' INT
trap 'abort_rollback 143' TERM

index=0
for skill in "${SKILLS[@]}"; do
  current_state=absent
  if path_exists "$SKILLS_ROOT/$skill"; then
    current_state=present
  fi

  # Record intent before moving the live entry. Recovery trusts the unique
  # archive target, not post-move bookkeeping, to decide whether to restore.
  TOUCHED_CURRENT_STATES+=("$current_state")
  TOUCHED_SKILLS+=("$skill")
  if [[ "$current_state" == present ]]; then
    mv "$SKILLS_ROOT/$skill" "$ARCHIVE/skills/$skill" \
      || abort_rollback "$?"
  fi

  if [[ "${ORIGINAL_STATES[$index]}" == present ]]; then
    cp -R "$BACKUP/skills/$skill" "$SKILLS_ROOT/$skill" \
      || abort_rollback "$?"
  fi
  index=$((index + 1))
done

trap - ERR HUP INT TERM
printf 'Restored Superpowers skills from %s\nCurrent profile archived at %s\nStart a new Codex task to refresh discovery.\n' \
  "$BACKUP" "$ARCHIVE"
