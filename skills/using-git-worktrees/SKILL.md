---
name: using-git-worktrees
description: Use before R3 implementation, parallel writers, long-lived isolated work, or changes that overlap a dirty working tree when the task is in a Git repository
---

# Using Git Worktrees

Use isolation when it protects a concrete risk: high-impact implementation,
concurrent writers, a separate lifecycle, or overlap with existing user changes.
Detect the current workspace first and prefer the host's native isolation.

**Core principle:** Isolate ownership, not routine work.

Announce this Skill when it causes a workspace switch, creates a branch/worktree,
or stops work at an isolation gate. Merely detecting that the current checkout is
already safe needs no ceremony.

## 1. Detect the Current Workspace

Before creating anything, inspect the repository, branch, current isolation, and
dirty paths:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
BASE_SHA=$(git rev-parse HEAD)
git status --short
git worktree list --porcelain
```

`GIT_DIR != GIT_COMMON` normally indicates a linked worktree, but it also occurs
inside submodules. Check the guard before classifying the workspace:

```bash
git rev-parse --show-superproject-working-tree 2>/dev/null
```

If this is already a linked worktree, do not nest another one. Preserve its
branch or detached state and continue to the setup check. A normal checkout or a
submodule still needs the isolation decision below.

Create an Isolation record in the task context: full base SHA, branch or detached state, workspace path, mechanism, owned path scope, pre-existing dirty paths, and cleanup owner.

This is a concise ownership handoff, not a new repository file or control system.
Update it if the base, branch, workspace, or owned scope changes.

## 2. Apply the Isolation Gate

Isolation is required for R3 implementation, parallel writers, long-lived work needing a separate lifecycle, and dirty overlapping edits.

Also isolate when the user explicitly requests it. Compare the actual dirty paths
with the intended edit scope; unrelated dirty files alone do not justify another
workspace. Safe R0/R1 and ordinary R2 work in a clean, singly-owned checkout stay
in place by default.

Creating local reversible isolation is a normal implementation step when the authorized task activates this gate; ask only when the mechanism, location, branch lifecycle, or cleanup creates a material user choice or crosses the authorized scope.

Honor a declared workspace or branch preference. If required isolation is
declined or every mechanism is unavailable, stop before editing and request an
explicitly named isolation waiver for the exact risk and owned scope. Generic
permission to continue is not a waiver.

## 3. Choose the Mechanism

1. Use an existing host-managed isolated workspace when one is already active.
2. Otherwise prefer a native worktree/workspace tool exposed by the host. It owns
   placement and cleanup; do not create parallel Git state behind its back.
3. Use `git worktree` only when no native mechanism exists.

For a manual worktree, follow explicit project guidance first, then an existing
`.worktrees/` or `worktrees/` convention. For any project-local location, verify
it is ignored before creation:

```bash
git check-ignore -q .worktrees 2>/dev/null || \
  git check-ignore -q worktrees 2>/dev/null
git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME" "$BASE_SHA"
```

If the candidate directory is not ignored, choose an already supported ignored
or external location. Changing `.gitignore` is a repository change and is not
authorized merely by the need for isolation.

If creation is denied, try another safe isolated mechanism already supported by
the host, such as a host-managed workspace or disposable clone at the recorded
base. If none exists, request the scoped waiver; never reinterpret denial as
permission to edit an unsafe checkout.

## 4. Prepare Without Guessing

Read project instructions, manifests, lockfiles, and existing dependency state to
identify what setup is actually necessary. Do not auto-run a dependency command merely because a manifest file exists.

Preview each necessary dependency command and its side effects before execution: network access, lifecycle scripts, tracked-file changes, global state, credentials, or new tools.

- A lockfile-faithful, local setup already implied by the authorized build may be
  executed as a normal implementation step.
- Ask before a command adds dependencies or tools, changes tracked/global state,
  runs untrusted lifecycle code outside existing authorization, or otherwise
  crosses the task boundary.
- Reuse valid existing artifacts when their inputs match. Do not reinstall simply
  because the workspace is new.

## 5. Establish Proportionate Baseline Evidence

Scale baseline validation to risk and the affected surface; use the full suite when the risk or cross-cutting scope warrants it, not as a ritual for every worktree.

Before editing, run the smallest deterministic checks that can distinguish new
failures from pre-existing ones. Record the command, relevant inputs, result, and
current tree/base binding. If a relevant baseline failure prevents safe proof,
stop and diagnose or ask for direction. An unrelated known failure may be recorded
and work may continue only when the requested result still has adequate evidence.

Report the workspace path, branch/detached state, base SHA, owned scope, setup
performed, baseline evidence, and cleanup owner. Do not claim the entire project
passes when only targeted checks ran.

## Non-Negotiable Boundaries

- Never nest a worktree inside an already isolated workspace.
- Never let parallel writers share the same mutable checkout or owned files.
- Never use manual `git worktree` behind a native workspace manager.
- Never place a project-local worktree in a tracked directory.
- Never edit an unsafe checkout after required isolation fails.
- Never run dependency setup or a full test suite solely from filename heuristics.
