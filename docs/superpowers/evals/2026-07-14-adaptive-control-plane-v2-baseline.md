# Adaptive Control Plane v2 Raw Historical Baseline

Capture date: 2026-07-14

Repository:
/Users/liuxianzhao/Documents/myProject/superzhao/.worktrees/adaptive-control-plane-v2

This is timestamped historical command evidence captured before any Skill
content changed. The RED section was captured from an isolated worktree at the
design commit. The regression sections were captured after repairing the test
launcher, while all 14 Skill directories still matched the installed profile.

The code blocks below are the merged terminal streams as captured. Exit status
is recorded separately. This document is not an ActionReceipt, canonical
profile digest, immutable record, or independent attestation.

## Source and tool baseline

UTC start: 2026-07-14T11:26:13Z

Observed exit: 0

Command:

~~~bash
date -u '+%Y-%m-%dT%H:%M:%SZ'
git rev-parse HEAD
git rev-parse main
git rev-parse origin/main
git rev-parse upstream/main
git --version
node --version
npm --version
claude --version
codex --version
command -v opencode >/dev/null 2>&1 && opencode --version || printf '%s\n' 'opencode: command not found'
bash --version | sed -n '1p'
shellcheck --version
command -v shfmt >/dev/null 2>&1 && shfmt --version || printf '%s\n' 'shfmt: command not found'
~~~

Raw terminal stream:

~~~text
2026-07-14T11:26:13Z
0075913ceeca326e00f685b93fd6820577ea11a6
e8e5a618d7f1bfa4b88ec298c8c500e2fda42295
e8e5a618d7f1bfa4b88ec298c8c500e2fda42295
d884ae04edebef577e82ff7c4e143debd0bbec99
git version 2.50.1 (Apple Git-155)
v26.3.0
11.16.0
2.1.185 (Claude Code)
codex-cli 0.142.0
opencode: command not found
GNU bash, version 3.2.57(1)-release (arm64-apple-darwin25)
ShellCheck - shell script analysis tool
version: 0.11.0
license: GNU General Public License, version 3
website: https://www.shellcheck.net
shfmt: command not found
~~~

## Installed-tree content baseline

UTC start: 2026-07-14T11:26:13Z

Observed exit: 0

Command:

~~~bash
date -u '+%Y-%m-%dT%H:%M:%SZ'
CODEX_ROOT="${CODEX_HOME:-$HOME/.codex}"
for skill in brainstorming dispatching-parallel-agents executing-plans \
  finishing-a-development-branch receiving-code-review requesting-code-review \
  subagent-driven-development systematic-debugging test-driven-development \
  using-git-worktrees using-superpowers verification-before-completion \
  writing-plans writing-skills; do
  if diff -qr "skills/$skill" "$CODEX_ROOT/skills/$skill" >/dev/null; then
    printf '%s\tIDENTICAL_RECURSIVE_CONTENT\n' "$skill"
  else
    printf '%s\tDIFFERS_OR_MISSING\n' "$skill"
  fi
done
~~~

Raw terminal stream:

~~~text
2026-07-14T11:26:13Z
brainstorming	IDENTICAL_RECURSIVE_CONTENT
dispatching-parallel-agents	IDENTICAL_RECURSIVE_CONTENT
executing-plans	IDENTICAL_RECURSIVE_CONTENT
finishing-a-development-branch	IDENTICAL_RECURSIVE_CONTENT
receiving-code-review	IDENTICAL_RECURSIVE_CONTENT
requesting-code-review	IDENTICAL_RECURSIVE_CONTENT
subagent-driven-development	IDENTICAL_RECURSIVE_CONTENT
systematic-debugging	IDENTICAL_RECURSIVE_CONTENT
test-driven-development	IDENTICAL_RECURSIVE_CONTENT
using-git-worktrees	IDENTICAL_RECURSIVE_CONTENT
using-superpowers	IDENTICAL_RECURSIVE_CONTENT
verification-before-completion	IDENTICAL_RECURSIVE_CONTENT
writing-plans	IDENTICAL_RECURSIVE_CONTENT
writing-skills	IDENTICAL_RECURSIVE_CONTENT
~~~

This diff -qr observation covers paths and file bytes only. It is not a mode,
symlink, inventory, or digest identity check.

## RED: original launcher was not portable on this host

UTC start: 2026-07-14T11:27:04Z

Source: detached temporary worktree at
0075913ceeca326e00f685b93fd6820577ea11a6

Capture-wrapper exit: 0

Tested runner exit: 1

Command:

~~~bash
set -u
BASELINE_WORKTREE="$(mktemp -d /tmp/superzhao-baseline.XXXXXX)"
git worktree add --detach "$BASELINE_WORKTREE" \
  0075913ceeca326e00f685b93fd6820577ea11a6 >/dev/null 2>&1
cd "$BASELINE_WORKTREE"
date -u '+%Y-%m-%dT%H:%M:%SZ'
command -v timeout >/dev/null 2>&1
TIMEOUT_LOOKUP_STATUS=$?
command -v gtimeout >/dev/null 2>&1
GTIMEOUT_LOOKUP_STATUS=$?
printf 'timeout lookup exit: %s\ngtimeout lookup exit: %s\n' \
  "$TIMEOUT_LOOKUP_STATUS" "$GTIMEOUT_LOOKUP_STATUS"
bash tests/claude-code/run-skill-tests.sh --timeout 1
RUNNER_STATUS=$?
printf 'runner exit: %s\n' "$RUNNER_STATUS"
cd /
git -C /Users/liuxianzhao/Documents/myProject/superzhao \
  worktree remove "$BASELINE_WORKTREE" --force
exit 0
~~~

Raw terminal stream:

~~~text
2026-07-14T11:27:04Z
timeout lookup exit: 1
gtimeout lookup exit: 1
========================================
 Claude Code Skills Test Suite
========================================

Repository: /tmp/superzhao-baseline.Bpv00X
Test time: Tue Jul 14 19:27:04 CST 2026
Claude version: 2.1.185 (Claude Code)

----------------------------------------
Running: test-worktree-path-policy.sh
----------------------------------------
  [FAIL] (0s)

  Output:
    tests/claude-code/run-skill-tests.sh: line 143: timeout: command not found

----------------------------------------
Running: test-sdd-workspace.sh
----------------------------------------
  [FAIL] (0s)

  Output:
    tests/claude-code/run-skill-tests.sh: line 143: timeout: command not found

----------------------------------------
Running: test-subagent-driven-development.sh
----------------------------------------
  [FAIL] (0s)

  Output:
    tests/claude-code/run-skill-tests.sh: line 143: timeout: command not found

========================================
 Test Results Summary
========================================

  Passed:  0
  Failed:  3
  Skipped: 0

Note: Integration tests were not run (they take 10-30 minutes).
Use --integration flag to run full workflow execution tests.

STATUS: FAILED
runner exit: 1
~~~

## GREEN: portable timeout contract on the oldest supported Node

UTC start: 2026-07-14T11:26:13Z

Observed exit: 0

Command:

~~~bash
date -u '+%Y-%m-%dT%H:%M:%SZ'
/Users/liuxianzhao/.nvm/versions/node/v18.20.8/bin/node --version
/Users/liuxianzhao/.nvm/versions/node/v18.20.8/bin/node \
  --test tests/codex-profile/test-run-with-timeout.mjs
~~~

Raw terminal stream:

~~~text
2026-07-14T11:26:13Z
v18.20.8
TAP version 13
# Subtest: preserves the child exit code
ok 1 - preserves the child exit code
  ---
  duration_ms: 61.996708
  ...
# Subtest: returns status 124 when the command times out
ok 2 - returns status 124 when the command times out
  ---
  duration_ms: 386.643834
  ...
# Subtest: passes child stdout and stderr through unchanged
ok 3 - passes child stdout and stderr through unchanged
  ---
  duration_ms: 62.162125
  ...
# Subtest: preserves argument boundaries
ok 4 - preserves argument boundaries
  ---
  duration_ms: 64.489458
  ...
# Subtest: exports the timeout runner used by inherited Claude helper functions
ok 5 - exports the timeout runner used by inherited Claude helper functions
  ---
  duration_ms: 40.902709
  ...
# Subtest: terminates descendants in the child process group
ok 6 - terminates descendants in the child process group
  ---
  duration_ms: 797.830917
  ...
# Subtest: kills an ignoring descendant after the process-group leader exits
ok 7 - kills an ignoring descendant after the process-group leader exits
  ---
  duration_ms: 810.299
  ...
# Subtest: forwards external termination and reaps an ignoring child group
ok 8 - forwards external termination and reaps an ignoring child group
  ---
  duration_ms: 198.539875
  ...
# Subtest: a repeated external signal immediately kills the child group
ok 9 - a repeated external signal immediately kills the child group
  ---
  duration_ms: 93.688583
  ...
# Subtest: an outer timeout cancels a detached leaf created by an inner wrapper
ok 10 - an outer timeout cancels a detached leaf created by an inner wrapper
  ---
  duration_ms: 796.914541
  ...
# Subtest: explicit skill runner rejects partial output after a command failure
ok 11 - explicit skill runner rejects partial output after a command failure
  ---
  duration_ms: 102.652042
  ...
# Subtest: explicit skill runner reports timeout output as indeterminate
ok 12 - explicit skill runner reports timeout output as indeterminate
  ---
  duration_ms: 81.571833
  ...
1..12
# tests 12
# suites 0
# pass 12
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3542.7665
~~~

The same twelve tests also passed under the host Node v26.3.0. The assertions
cover exit-code preservation, status 124, stream forwarding, argument
boundaries, inherited helper configuration, descendant cleanup, external
signal forwarding, repeated-signal escalation, nested timeout cancellation,
and rejection of partial explicit-request output after failures or timeouts.

## Deterministic Codex profile regression

UTC start: 2026-07-14T11:26:20Z

Observed exit: 0

Command:

~~~bash
date -u '+%Y-%m-%dT%H:%M:%SZ'
bash tests/codex-profile/run-tests.sh
~~~

Raw terminal stream:

~~~text
2026-07-14T11:26:20Z
Install and rollback happy path
Restored Superpowers skills from /private/var/folders/gx/87529l5x6sg4pfndryn8g02c0000gn/T/tmp.jDz2BgI92k/happy-home/backups/superzhao-20260714-192620-24807
Current profile archived at /private/var/folders/gx/87529l5x6sg4pfndryn8g02c0000gn/T/tmp.jDz2BgI92k/happy-home/backups/superzhao-current-before-rollback-20260714-192625-27426
Start a new Codex task to refresh discovery.
Invalid backup preflight
Incomplete source preflight
Mid-install failure recovery
Install interruption after backup move
Rollback interruption after archive move
Install interruption after pointer publication
Cross-device preflight refusal
Hardened backup schema version
Shared transaction lock refusal
Real overlapping install serialization
Complete backup integrity validation
Internal symlink rejection
Private umask and mode fidelity
Incomplete automatic recovery reporting
Install and rollback test passed
Codex profile contract checks passed
~~~

## Shell lint harness regression

UTC start: 2026-07-14T11:26:13Z

Observed exit: 0

Command:

~~~bash
date -u '+%Y-%m-%dT%H:%M:%SZ'
bash tests/shell-lint/test-lint-shell.sh
~~~

Raw terminal stream:

~~~text
2026-07-14T11:26:13Z
Shell lint script tests
  [PASS] lint-shell check mode exits successfully with stub tools
  [PASS] reports changed shell file count
  [PASS] does not run shfmt in lint mode
  [PASS] runs ShellCheck
  [PASS] uses warning severity as the baseline
  [PASS] allows ShellCheck to follow sourced files
  [PASS] resolves ShellCheck sources relative to each script
  [PASS] includes changed extensionless shell shebang file
  [PASS] includes changed tracked .sh file
  [PASS] includes untracked shell files by default
  [PASS] ignores Markdown with shell snippets
  [PASS] lint-shell --format exits successfully with stub tools
  [PASS] uses shfmt write mode with --format
  [PASS] runs ShellCheck after --format
  [PASS] keeps warning severity after --format
  [PASS] --all includes tracked extensionless shell shebang file
  [PASS] --all includes tracked .sh file
  [PASS] --all ignores untracked shell files
All shell lint script tests passed
~~~

## External-runner diagnostics and limits

- After the launcher repair, the Claude suite reached Claude Code but the
  semantic run returned 401 Invalid authentication credentials. That result is
  an external authentication diagnostic, not Skill-behavior evidence.
- OpenCode was unavailable, so the two OpenCode launcher changes received Bash
  syntax and static invocation checks only.
- Node 18.20.8 and Node 26.3.0 were executed on macOS. Linux process behavior
  was not executed in this capture.
- Tasks 2 through 4 add canonical inventory hashing, independently observed
  receipts, behavior evaluation, and installation recovery evidence.
