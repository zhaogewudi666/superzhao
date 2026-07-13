#!/usr/bin/env bash
set -euo pipefail

LC_ALL=C
export LC_ALL

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_ROOT="${CODEX_HOME:-$HOME/.codex}"
SKILLS_ROOT="$CODEX_ROOT/skills"
BACKUPS_ROOT="$CODEX_ROOT/backups"
LAST_BACKUP_POINTER="$CODEX_ROOT/superzhao-last-backup"
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE=""
PAYLOAD=""
BACKUP=""
PREVIOUS_POINTER_STATE=absent
POINTER_PUBLISH_STARTED=no
PRESERVE_STAGE=no

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

cleanup() {
  if [[ "$PRESERVE_STAGE" == no && -n "$STAGE" && -d "$STAGE" ]]; then
    rm -rf "$STAGE"
  fi
}

restore_published_pointer() {
  local pending_pointer="$STAGE/last-backup-pointer"
  local previous_pointer="$STAGE/previous-last-backup"

  [[ "$POINTER_PUBLISH_STARTED" == yes ]] || return 0
  # rename(2) within CODEX_HOME is atomic. If the source still exists, the
  # publication move did not land and the previous live pointer is untouched.
  path_exists "$pending_pointer" && return 0

  if [[ "$PREVIOUS_POINTER_STATE" == present ]]; then
    path_exists "$previous_pointer" || return 1
    mv "$previous_pointer" "$LAST_BACKUP_POINTER"
  elif path_exists "$LAST_BACKUP_POINTER"; then
    rm -f "$LAST_BACKUP_POINTER"
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
      # A missing backup means the attempted live-to-backup move never landed.
      # In that case the pre-existing live entry must remain untouched.
      path_exists "$backup_path" || continue
      if path_exists "$live_path"; then
        rm -rf "$live_path"
      fi
      mv "$backup_path" "$live_path"
    else
      # A still-staged payload means its live move never landed.
      path_exists "$PAYLOAD/$skill" && continue
      if path_exists "$live_path"; then
        rm -rf "$live_path"
      fi
    fi
  done
}

abort_install() {
  local exit_status="$1"
  local pointer_restore_status=0

  trap - ERR HUP INT TERM
  set +e
  restore_published_pointer || pointer_restore_status=$?
  restore_touched_entries
  if [[ "$pointer_restore_status" -ne 0 ]]; then
    # Retain the only saved copy of the prior pointer for manual recovery.
    PRESERVE_STAGE=yes
  fi
  cleanup
  exit "$exit_status"
}

write_installed_checksums() {
  local payload_root="$1"
  local output="$2"
  local skill
  local path

  : >"$output"
  (
    cd "$payload_root"
    for skill in "${SKILLS[@]}"; do
      find "$skill" -type f -print
    done | LC_ALL=C sort | while IFS= read -r path; do
      shasum -a 256 "$path"
    done
  ) >>"$output"
}

trap cleanup EXIT
trap 'abort_install $?' ERR
trap 'abort_install 129' HUP
trap 'abort_install 130' INT
trap 'abort_install 143' TERM

mkdir -p "$CODEX_ROOT" "$SKILLS_ROOT"
STAGE="$(create_unique_directory "$CODEX_ROOT/.superzhao-stage-$STAMP-$$")"
PAYLOAD="$STAGE/payload"
mkdir "$PAYLOAD"

# Complete source validation precedes all backup and live-profile mutation.
for skill in "${SKILLS[@]}"; do
  [[ -d "$ROOT/skills/$skill" ]] \
    || die "source skill directory is missing: skills/$skill"
  [[ -f "$ROOT/skills/$skill/SKILL.md" && -r "$ROOT/skills/$skill/SKILL.md" ]] \
    || die "source skill entrypoint is not a readable file: skills/$skill/SKILL.md"
done

for skill in "${SKILLS[@]}"; do
  cp -R "$ROOT/skills/$skill" "$PAYLOAD/$skill"
done

for skill in "${SKILLS[@]}"; do
  [[ -d "$PAYLOAD/$skill" ]] \
    || die "staged skill directory is missing: $skill"
  [[ -f "$PAYLOAD/$skill/SKILL.md" && -r "$PAYLOAD/$skill/SKILL.md" ]] \
    || die "staged skill entrypoint is not a readable file: $skill/SKILL.md"
done

SOURCE_COMMIT="$(git -C "$ROOT" rev-parse --verify HEAD)"
write_installed_checksums "$PAYLOAD" "$STAGE/installed-sha256.txt"
[[ -s "$STAGE/installed-sha256.txt" ]] \
  || die 'staged checksum manifest is empty'

mkdir -p "$BACKUPS_ROOT"
BACKUP="$(create_unique_directory "$BACKUPS_ROOT/superzhao-$STAMP-$$")"
mkdir "$BACKUP/skills"
printf 'superzhao-codex-profile-v1\n' >"$BACKUP/format-version.txt"
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
cp "$STAGE/installed-sha256.txt" "$BACKUP/installed-sha256.txt"

for skill in "${SKILLS[@]}"; do
  original_state=absent
  if path_exists "$SKILLS_ROOT/$skill"; then
    original_state=present
  fi

  # Record intent before the first move. Recovery checks whether the unique
  # backup target actually appeared before it changes a pre-existing entry.
  TOUCHED_ORIGINAL_STATES+=("$original_state")
  TOUCHED_SKILLS+=("$skill")
  if [[ "$original_state" == present ]]; then
    mv "$SKILLS_ROOT/$skill" "$BACKUP/skills/$skill" \
      || abort_install "$?"
  fi

  mv "$PAYLOAD/$skill" "$SKILLS_ROOT/$skill" \
    || abort_install "$?"
done

(
  cd "$SKILLS_ROOT"
  shasum -a 256 -c "$BACKUP/installed-sha256.txt" >/dev/null
)

if path_exists "$LAST_BACKUP_POINTER"; then
  cp -p "$LAST_BACKUP_POINTER" "$STAGE/previous-last-backup"
  PREVIOUS_POINTER_STATE=present
fi
printf '%s\n' "$BACKUP" >"$STAGE/last-backup-pointer"
POINTER_PUBLISH_STARTED=yes
mv "$STAGE/last-backup-pointer" "$LAST_BACKUP_POINTER" \
  || abort_install "$?"

trap - ERR HUP INT TERM
printf 'Installed Superzhao skills. Backup: %s\nStart a new Codex task to refresh discovery.\n' \
  "$BACKUP"
