---
name: finishing-a-development-branch
description: Use when the task created or managed a branch/worktree, or when the user asks to merge, push, open a PR, keep, discard, or clean up completed development work
---

# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Confirm task ownership or an explicit finishing request → Identify the named action → Detect the actual environment and ownership → Present options only when needed → Apply the action-specific gate → Execute → Clean up eligible task-owned state.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

## Entry Gate

Before running the finishing workflow, establish why this skill applies:

- If this task created or managed the branch/worktree, continue through the process. Offer the appropriate finishing menu only when no specific action has already been requested.
- If the user requested a specific finishing action, identify that action first, then detect the environment and apply only its gate. Do not replace a specific request with a menu.
- Otherwise, stop. Do not present a finishing menu for work that neither created nor managed a branch/worktree.

Being located on a branch or in a linked worktree does not prove that this task created or managed it. Use the task's actual actions and recorded provenance.

## The Process

### Step 1: Identify the Requested Action

Before environment discovery or test execution, normalize the request to one named action:

- An explicit local integration request → `merge`.
- An explicit branch publication request → `push`.
- An explicit request to open or create a pull request → `publish_pr`.
- An explicit preservation request → `keep`.
- An explicit deletion or abandonment request → `discard`.
- No specific action, but the task created or managed the branch/worktree → `menu`.

Do not turn a specific request into `menu`, and do not infer `publish_pr` from `push`.

### Step 2: Detect Environment

**Determine the actual current workspace state and recorded provenance before presenting options or executing the named action. Do not infer ownership from the path or from how the task started:**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

Classify ownership separately:

- `task-owned`: this task created the branch/worktree or recorded that it took responsibility for managing it.
- `harness-owned`: the workspace existed before this task, the host created it, or ownership provenance is absent.
- `normal-checkout`: `GIT_DIR == GIT_COMMON`; there is no linked worktree to remove.

A `.worktrees/` pathname may corroborate recorded task ownership, but never establishes ownership by itself.

This determines which menu to show and how cleanup works:

| State | Menu | Cleanup |
|-------|------|---------|
| `GIT_DIR == GIT_COMMON`, named branch | Standard 4 options | No worktree to clean up |
| `GIT_DIR == GIT_COMMON`, detached HEAD | Reduced 3 options (no merge) | No worktree; preserve or abandon only the confirmed detached commit |
| `GIT_DIR != GIT_COMMON`, named branch | Standard 4 options | Provenance-based (see Step 7) |
| `GIT_DIR != GIT_COMMON`, detached HEAD | Reduced 3 options (no merge) | Preserve unless recorded task-owned |

### Step 3: Determine Base Branch

Determine a verified base only when `merge`, `publish_pr`, `discard`, or `menu` needs it. Skip this step for `push` and `keep`; those actions must not be blocked by unrelated base-branch discovery.

```bash
# Try common base branches
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

Or ask: "This branch split from main - is that correct?"

### Step 4: Present Options When the Action Is `menu`

Only present a menu when the Entry Gate confirmed that this task created or managed the branch/worktree and Step 1 selected `menu`. If Step 1 selected a specific action, skip the menu and continue directly to Step 5.

**Named-branch normal checkout and named-branch worktree — present exactly these 4 options:**

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
Implementation complete. You're on a detached HEAD.

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

### Step 5: Apply the Action-Specific Gate

The `merge`, `push`, and `publish_pr` actions require fresh tests and a clean committed tree before execution: `git status --short` must be empty both before and after the test command. Run the project's relevant test command and record its current output. A dirty tree or failure blocks only the selected integration or publication action; report the evidence and preserve the branch/worktree.

The `keep` action does not require tests. Proceed directly to its reporting behavior even when tests are failing or unavailable.

The `discard` action does not require tests. Before asking for confirmation, inspect and report the exact state and ownership:

```bash
git status --short
git log --oneline <safe-base-branch>..HEAD
git branch --show-current
git rev-parse HEAD
git worktree list --porcelain
```

Then require exact confirmation:

```
This will permanently delete:
- Branch <name-or-none>
- Commits: <commit-list-or-detached-commit>
- Tracked/untracked task-owned changes: <exact-status-list-or-none>
- Task-owned worktree: <path-or-none>

Workspace ownership: <task-owned|harness-owned|normal-checkout>
Type 'discard' to confirm.
```

Wait for the exact text `discard`. Any other response cancels the action without changing state.

### Step 5b: Bind the Exact Action

Before a merge, publication, PR creation, or discard, capture the resolved target
in task context rather than relying on an earlier generic intention.

Record an Action Binding: named action, remote name and remote URL, remote ref or local target, full HEAD SHA, changed-path scope and clean-tree state, authorizing instruction, and branch/worktree ownership.

Use `not applicable` for remote fields on local-only actions. For publication,
resolve the configured remote to its actual URL and a full
`refs/heads/<branch>` destination. A configured upstream may supply an unambiguous
default; if multiple plausible remotes, refs, bases, or ownership scopes remain,
ask rather than choosing a materially different target. Redact credentials when
reporting a URL, while retaining the exact endpoint in the execution binding.

Immediately before each external or destructive action, recheck the Action Binding; drift in action, HEAD, tree/scope, remote URL/ref, base, or ownership requires reauthorization for the new binding.

The authorizing instruction may cover the completed result of the stated task,
but it does not cover later adjacent changes, a different remote/ref, force push,
PR creation after a push-only request, or deletion outside the confirmed scope.

### Step 6: Execute the Named Action

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
git merge <feature-branch>

# Verify tests on merged result
<test command>

# Only after merge and merged-result tests succeed, apply ownership-based cleanup
```

This is a local merge against the current local base. Updating the base from a remote is a separate action and requires its own explicit request and point-of-execution authorization.

After the merge and merged-result tests succeed:

- In a normal checkout, verify the base branch is current, then delete the merged feature branch with `git branch -d <feature-branch>`.
- For a recorded task-owned linked worktree, complete Step 7, verify the feature branch is not checked out anywhere, then delete it with `git branch -d <feature-branch>`.
- For merge in a harness-owned workspace, preserve the branch and worktree and report both; never clean up host-owned state.

#### Shared branch publication for `push` and `publish_pr`

Both actions begin with the same safe, non-force branch publication and exact
remote verification. Resolve and bind these values first:

```bash
REMOTE=<configured-remote>
REMOTE_URL=$(git remote get-url "$REMOTE")
REMOTE_BRANCH=<remote-branch>
REMOTE_REF="refs/heads/$REMOTE_BRANCH"
PUBLISHED_SHA=$(git rev-parse HEAD)
```

On a named branch:

```bash
LOCAL_BRANCH=$(git branch --show-current)
test "$(git rev-parse "$LOCAL_BRANCH")" = "$PUBLISHED_SHA"
git push -u "$REMOTE" "$LOCAL_BRANCH:$REMOTE_REF"
```

On detached HEAD, select and report an explicit, non-conflicting new branch name.
Check the exact ref before publication; if it already exists, stop and choose
another rather than overwriting it:

```bash
git ls-remote --heads "$REMOTE_URL" "$REMOTE_REF"
```

Publish the bound detached commit explicitly; creating a local branch is optional
and must not be used to hide a changed commit identity:

```bash
test -z "$(git branch --show-current)"
git push "$REMOTE" "$PUBLISHED_SHA:$REMOTE_REF"
```

Never force-push either path. Read the exact remote ref back and compare it to the
captured commit:

```bash
REMOTE_SHA=$(git ls-remote --exit-code "$REMOTE_URL" "$REMOTE_REF" | awk 'NR == 1 { print $1 }')
test "$REMOTE_SHA" = "$PUBLISHED_SHA"
test "$(git rev-parse HEAD)" = "$PUBLISHED_SHA"
```

A remote branch merely existing is insufficient; report publication only when the remote SHA exactly equals the pushed local SHA. If equality or the final HEAD check fails, report the mismatch and preserve the branch/worktree without claiming success.

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

On a named branch, report: "Keeping branch <name>. Worktree preserved at <path>."

On detached HEAD, report: "Keeping detached commit <sha>. Workspace preserved at <path>."

**Don't cleanup worktree.**

#### `discard`

Execute only after Step 5 recorded the inspected state and received exact confirmation.

Before discard in any normal checkout, require `git status --short` to be empty before switching to a safe base. If it is dirty, do not switch: separately confirm and dispose of only the exact task-owned paths already reported, preserve unknown or other-owned paths, then re-check for an empty status.

For discard from a named branch in a normal checkout, switch to a verified safe base before deleting the feature branch. Never attempt to delete the branch that is currently checked out:

```bash
git switch <safe-base-branch>
test "$(git branch --show-current)" != "<feature-branch>"
git branch -D <feature-branch>
```

For a detached normal checkout, discard only after exact confirmation: switch to a verified safe base and do not delete any branch or unrelated ref:

```bash
git switch <safe-base-branch>
test -n "$(git branch --show-current)"
```

For a recorded task-owned linked worktree, return to the main repository and remove that worktree through Step 7. If it used a named feature branch, verify that branch is no longer checked out anywhere and only then delete it; detached work has no branch to delete:

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
# Complete Step 7 before branch deletion.
git worktree list --porcelain
git branch -D <feature-branch>
```

For a harness-owned workspace, preserve the workspace and report that host-owned cleanup is required. Use the host's explicit discard/exit control only when the user authorized that exact control; otherwise do not delete refs, files, or harness-owned state.

### Step 7: Cleanup Workspace

Cleanup is eligible only for `merge` and confirmed `discard`. The `push`, `publish_pr`, and `keep` actions always preserve the branch and worktree.

Use the actual values captured in Step 2. If they need refreshing, do so while still inside the task workspace and before changing directories; do not overwrite them after moving to the main checkout:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

**If `GIT_DIR == GIT_COMMON`:** Normal repo, no worktree to clean up. Done.

**If recorded ownership is `task-owned`:** The task may clean up the linked worktree. Confirm that `WORKTREE_PATH` matches the recorded path; a `.worktrees/` or `worktrees/` name alone is insufficient.

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
```

For merge of a clean task-owned linked worktree, use standard `git worktree remove "$WORKTREE_PATH"` after the merged-result tests pass.

For confirmed discard of the exact task-owned state, use `git worktree remove --force "$WORKTREE_PATH"`; the force is authorized only by the state-specific confirmation in Step 5 and must never be reused for merge or unknown ownership.

Do not run repository-wide stale-registration cleanup automatically. A normal `git worktree remove` removes the selected worktree's registration; if targeted removal fails, report the exact state rather than touching other worktree records.

**If recorded ownership is `harness-owned` or unknown:** Preserve the workspace and report its path and ownership. Do not remove it, prune its state, or delete its refs. Use a host workspace-exit tool only when the user authorized that exact action.

## Quick Reference

| Entry condition | Action |
|-----------------|--------|
| Task created or managed branch/worktree, no specific request | Select `menu`, detect, then present the matching menu |
| User requested a specific finishing action | Identify it, detect state/ownership, then apply only that action's gate |
| Neither condition applies | Stop; do not present a finishing menu |

| Named action | Fresh tests? | Result | Branch/worktree handling |
|--------------|--------------|--------|--------------------------|
| `merge` | Required before action and again on merged result | Merge locally | Clean up only task-owned worktree/branch after success |
| `push` | Required before action | Publish and verify the remote branch; do not create a PR | Preserve branch and worktree |
| `publish_pr` | Required before action | Push, create PR, verify and report URL | Preserve branch and worktree |
| `keep` | Not required | Leave work as-is | Preserve branch and worktree |
| `discard` | Not required | Inspect state, require exact confirmation, then discard | Clean up only task-owned state; preserve and report harness-owned state |

## Common Mistakes

**Testing before selecting an action**
- **Problem:** Failing tests prevent a user from keeping or explicitly discarding work
- **Fix:** Identify the action first; require fresh tests only for `merge`, `push`, and `publish_pr`

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

**Deleting the current branch in a normal checkout**
- **Problem:** Branch deletion fails or cleanup targets the wrong state
- **Fix:** Switch to a verified safe base, confirm the feature branch is no longer current, then delete it

**Running git worktree remove from inside the worktree**
- **Problem:** Command fails silently when CWD is inside the worktree being removed
- **Fix:** Always `cd` to main repo root before `git worktree remove`

**Cleaning up harness-owned worktrees**
- **Problem:** Removing a worktree the harness created causes phantom state
- **Fix:** Preserve and report harness-owned or unknown-provenance workspaces; path naming alone never proves task ownership

**Repository-wide stale-registration cleanup**
- **Problem:** Cleanup can remove administrative state for a missing or temporarily offline harness-owned worktree
- **Fix:** Remove only the confirmed task-owned worktree and report targeted-removal failures

**No confirmation for discard**
- **Problem:** Accidentally delete work
- **Fix:** Require typed "discard" confirmation

## Red Flags

**Never:**
- Execute `merge`, `push`, or `publish_pr` without fresh passing tests
- Let failing tests block `keep` or confirmed `discard`
- Present a finishing menu for work that neither created nor managed a branch/worktree
- Merge without verifying tests on result
- Delete work without confirmation
- Create a PR for an explicit `push` request
- Force-push without explicit request
- Remove a worktree before confirming merge success
- Clean up worktrees you didn't create (provenance check)
- Run `git worktree remove` from inside the worktree

**Always:**
- Identify and normalize the requested action before environment detection or tests
- Detect the actual current environment before presenting a menu or executing a requested action
- Inspect state and ownership before requesting exact discard confirmation
- For a task-managed branch/worktree, present exactly 4 options (or 3 for detached HEAD)
- Map menu numbers to named actions before execution
- Normalize an explicit `push` separately from `publish_pr`
- Get typed confirmation before `discard`
- Clean up task-owned worktree state only for `merge` and confirmed `discard`
- `cd` to main repo root before worktree removal
- Keep worktree cleanup targeted to the recorded task-owned path
