---
name: finishing-a-development-branch
description: Use when the task created or managed a branch/worktree, or when the user asks to merge, push, open a PR, keep, discard, or clean up completed development work
---

# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Confirm task ownership or an explicit finishing request → Verify tests → Detect the actual environment → Present options only for task-managed work → Map the selection to a named action → Execute → Clean up.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

## Entry Gate

Before running the finishing workflow, establish why this skill applies:

- If this task created or managed the branch/worktree, continue through the process and offer the appropriate finishing menu.
- If the user requested a specific finishing action, continue through verification and environment detection, then perform that action directly. Do not replace a specific request with a menu.
- Otherwise, stop. Do not present a finishing menu for work that neither created nor managed a branch/worktree.

Being located on a branch or in a linked worktree does not prove that this task created or managed it. Use the task's actual actions and recorded provenance.

## The Process

### Step 1: Verify Tests

**Before presenting options, verify tests pass:**

```bash
# Run project's test suite
npm test / cargo test / pytest / go test ./...
```

**If tests fail:**
```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR until tests pass.
```

Stop. Don't proceed to Step 2.

**If tests pass:** Continue to Step 2.

### Step 2: Detect Environment

**Determine the actual current workspace state before presenting options or executing a requested action. Do not infer it from how the task started:**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

This determines which menu to show and how cleanup works:

| State | Menu | Cleanup |
|-------|------|---------|
| `GIT_DIR == GIT_COMMON` (normal repo) | Standard 4 options | No worktree to clean up |
| `GIT_DIR != GIT_COMMON`, named branch | Standard 4 options | Provenance-based (see Step 6) |
| `GIT_DIR != GIT_COMMON`, detached HEAD | Reduced 3 options (no merge) | No cleanup (externally managed) |

### Step 3: Determine Base Branch

```bash
# Try common base branches
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

Or ask: "This branch split from main - is that correct?"

### Step 4: Present Options

Only present a menu when the Entry Gate confirmed that this task created or managed the branch/worktree. If the user requested a specific finishing action, skip the menu and execute that action in Step 5 after any required confirmation.

**Normal repo and named-branch worktree — present exactly these 4 options:**

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

Map the response immediately, before execution:

- `1` → `merge`
- `2` → `publish_pr`
- `3` → `keep`
- `4` → `discard`

**Detached HEAD — present exactly these 3 options:**

```
Implementation complete. You're on a detached HEAD (externally managed workspace).

1. Push as new branch and create a Pull Request
2. Keep as-is (I'll handle it later)
3. Discard this work

Which option?
```

Map the response immediately, before execution:

- `1` → `publish_pr`
- `2` → `keep`
- `3` → `discard`

**Don't add explanation** - keep options concise.

### Step 5: Execute the Named Action

Normalize an explicitly requested finishing action before execution. Never carry a bare menu number into this step.

- An explicit `push` request → `push`.
- An explicit request to open or create a PR → `publish_pr`.
- Both menus' publication choices → `publish_pr`, as mapped in Step 4.

Authorization to `push` is not authorization to create a PR.

#### `merge`

This action is available only from the standard menu or an explicit merge request in a named-branch environment.

```bash
# Get main repo root for CWD safety
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"

# Merge first — verify success before removing anything
git checkout <base-branch>
git pull
git merge <feature-branch>

# Verify tests on merged result
<test command>

# Only after merge succeeds: cleanup worktree (Step 6), then delete branch
```

Then: Cleanup worktree (Step 6), then delete branch:

```bash
git branch -d <feature-branch>
```

#### Shared branch publication for `push` and `publish_pr`

Both actions begin with the same safe, non-force branch publication and remote verification.

On a named branch:

```bash
git push -u origin <feature-branch>
```

On detached HEAD, select and report an explicit, non-conflicting `<new-branch>` name. Check the remote before publishing; if the name already exists, stop and choose another rather than overwriting it:

```bash
git ls-remote --heads origin refs/heads/<new-branch>
```

Use the actual permissions available in the workspace:

- If local branch creation succeeds, create the branch and push it normally:
  ```bash
  git switch -c <new-branch>
  git push -u origin <new-branch>
  ```
- If the host rejects local ref creation but permits remote publication, push the detached commit explicitly:
  ```bash
  git push origin HEAD:refs/heads/<new-branch>
  ```

Never force-push either path. Verify the remote branch exists:

```bash
git ls-remote --exit-code --heads origin refs/heads/<remote-branch>
```

#### `push`

After the shared publication procedure succeeds, report the remote and verified branch name, then stop. A `push` action **MUST NOT** create a PR or invoke PR-creation tooling.

**Do NOT clean up the branch or worktree** — preserve both for subsequent work.

#### `publish_pr`

After the shared publication procedure succeeds, create the pull request. Use an available platform or GitHub PR-creation tool and verify the returned PR with its corresponding read tool. If no such tool is available, use GitHub CLI:

```bash
CREATED_PR_URL=$(gh pr create --base <base-branch> --head <remote-branch> --fill)
VERIFIED_PR_URL=$(gh pr view "$CREATED_PR_URL" --json url --jq '.url')
```

For a fork, use the actual `<owner>:<remote-branch>` value required by `--head`. Report `VERIFIED_PR_URL`. If creation or verification fails, report the exact blocker and preserve the branch/worktree for retry.

**Do NOT clean up the branch or worktree** — the user needs both for PR feedback.

#### `keep`

Report: "Keeping branch <name>. Worktree preserved at <path>."

**Don't cleanup worktree.**

#### `discard`

**Confirm first:**
```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for exact confirmation.

If confirmed on a named branch:
```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
```

Then: Cleanup the task-owned worktree (Step 6), then force-delete the task branch:
```bash
git branch -D <feature-branch>
```

For detached HEAD in a harness-owned workspace, use the host's explicit discard/exit control if available. Otherwise preserve the workspace and report that automatic deletion is unavailable; do not delete unrelated refs or harness-owned state.

### Step 6: Cleanup Workspace

Cleanup is eligible only for `merge` and confirmed `discard`. The `push`, `publish_pr`, and `keep` actions always preserve the branch and worktree.

Use the actual values captured in Step 2. If they need refreshing, do so while still inside the task workspace and before changing directories; do not overwrite them after moving to the main checkout:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

**If `GIT_DIR == GIT_COMMON`:** Normal repo, no worktree to clean up. Done.

**If worktree path is under `.worktrees/` or `worktrees/`:** Superpowers created this worktree — we own cleanup.

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
git worktree remove "$WORKTREE_PATH"
git worktree prune  # Self-healing: clean up any stale registrations
```

**Otherwise:** The host environment (harness) owns this workspace. Do NOT remove it. If your platform provides a workspace-exit tool, use it. Otherwise, leave the workspace in place.

## Quick Reference

| Entry condition | Action |
|-----------------|--------|
| Task created or managed branch/worktree | Verify, detect, then present the matching menu |
| User requested a specific finishing action | Verify, detect, then execute that action without a menu |
| Neither condition applies | Stop; do not present a finishing menu |

| Named action | Result | Branch/worktree handling |
|--------------|--------|--------------------------|
| `merge` | Merge locally and re-test | Clean up only task-owned worktree/branch after success |
| `push` | Publish and verify the remote branch; do not create a PR | Preserve branch and worktree |
| `publish_pr` | Push, create PR, verify and report URL | Preserve branch and worktree |
| `keep` | Leave work as-is | Preserve branch and worktree |
| `discard` | Permanently discard after exact confirmation | Clean up only task-owned state; never remove harness-owned state |

## Common Mistakes

**Skipping test verification**
- **Problem:** Merge broken code, create failing PR
- **Fix:** Always verify tests before offering options

**Open-ended questions**
- **Problem:** "What should I do next?" is ambiguous
- **Fix:** For a task-managed branch/worktree, present exactly 4 structured options (or 3 for detached HEAD)

**Offering a menu without task ownership**
- **Problem:** Routine work in an existing checkout triggers an irrelevant merge, PR, keep, or discard decision
- **Fix:** Confirm this task created or managed the branch/worktree before presenting any menu

**Cleaning up after `push` or `publish_pr`**
- **Problem:** Remove a branch/worktree the user still needs for follow-up or PR iteration
- **Fix:** Preserve the branch/worktree for `push`, `publish_pr`, and `keep`; cleanup is only eligible for `merge` and confirmed `discard`

**Turning `push` into PR creation**
- **Problem:** Treats remote publication as authorization for an additional external side effect
- **Fix:** Report the verified remote branch and stop; only `publish_pr` may create a PR

**Stopping `publish_pr` after branch publication**
- **Problem:** Reports publication complete without creating or verifying the pull request
- **Fix:** Create the PR, verify it through a read operation, and report its URL

**Deleting branch before removing worktree**
- **Problem:** `git branch -d` fails because worktree still references the branch
- **Fix:** Merge first, remove worktree, then delete branch

**Running git worktree remove from inside the worktree**
- **Problem:** Command fails silently when CWD is inside the worktree being removed
- **Fix:** Always `cd` to main repo root before `git worktree remove`

**Cleaning up harness-owned worktrees**
- **Problem:** Removing a worktree the harness created causes phantom state
- **Fix:** Only clean up worktrees under `.worktrees/` or `worktrees/`

**No confirmation for discard**
- **Problem:** Accidentally delete work
- **Fix:** Require typed "discard" confirmation

## Red Flags

**Never:**
- Proceed with failing tests
- Present a finishing menu for work that neither created nor managed a branch/worktree
- Merge without verifying tests on result
- Delete work without confirmation
- Create a PR for an explicit `push` request
- Force-push without explicit request
- Remove a worktree before confirming merge success
- Clean up worktrees you didn't create (provenance check)
- Run `git worktree remove` from inside the worktree

**Always:**
- Verify tests before offering options
- Detect the actual current environment before presenting a menu or executing a requested action
- For a task-managed branch/worktree, present exactly 4 options (or 3 for detached HEAD)
- Map menu numbers to named actions before execution
- Normalize an explicit `push` separately from `publish_pr`
- Get typed confirmation before `discard`
- Clean up task-owned worktree state only for `merge` and confirmed `discard`
- `cd` to main repo root before worktree removal
- Run `git worktree prune` after removal
