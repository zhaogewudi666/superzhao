# Superzhao Codex Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and activate a risk-tiered, Codex-native Superpowers distribution that preserves strict engineering safeguards for consequential work while avoiding full workflow expansion for read-only and low-risk tasks.

**Architecture:** Keep the upstream v6.1.1 repository and skill names intact, concentrate local behavior in a shared risk reference plus narrow edits to routing and workflow skills, and add deterministic contract tests for the Codex profile. Provide repository-owned installation and rollback scripts so the customized checkout remains the source of truth while `~/.codex/skills` is a validated deployment target.

**Tech Stack:** Markdown skills, Bash tests and deployment scripts, Git, Codex collaboration tools.

## Global Constraints

- Preserve root-cause-first debugging, test-first observable behavior changes, fresh verification evidence, scoped edits, explicit authorization for destructive/external actions, risk-appropriate isolation and review, and main-agent verification of subagent work.
- Use four observable levels: R0 read-only, R1 localized reversible non-behavioral change, R2 bug/behavior/API/multi-file change, and R3 security/auth/money/migration/concurrency/destructive/production/external/cross-system work.
- Use the highest matching risk level and escalate ambiguity only when its answer changes scope, architecture, or risk.
- Keep `origin` as `zhaogewudi666/superzhao` and `upstream` as `obra/superpowers`.
- Keep custom behavior in the minimum number of files and avoid unrelated reformatting.
- Add no third-party runtime dependency.
- Do not reference unavailable Codex model selection, named agent types, or `close_agent`.
- Back up active local skills and validate rollback before replacing anything under `~/.codex/skills`.

---

### Task 1: Add Failing Codex Profile Contract Tests

**Files:**
- Create: `tests/codex-profile/test-risk-routing-contract.sh`
- Create: `tests/codex-profile/run-tests.sh`

**Interfaces:**
- Consumes: upstream skill files under `skills/`
- Produces: deterministic pass/fail contract for risk labels, narrow triggers, Codex tool names, validation scaling, and local deployment scripts

- [ ] **Step 1: Write the failing routing contract**

Create `tests/codex-profile/test-risk-routing-contract.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
failures=0

require_text() {
  local file="$1" pattern="$2" label="$3"
  if ! grep -Eq "$pattern" "$ROOT/$file"; then
    printf 'FAIL: %s\n' "$label" >&2
    failures=$((failures + 1))
  fi
}

reject_text() {
  local file="$1" pattern="$2" label="$3"
  if grep -Eq "$pattern" "$ROOT/$file"; then
    printf 'FAIL: %s\n' "$label" >&2
    failures=$((failures + 1))
  fi
}

require_text skills/using-superpowers/SKILL.md 'R0|R1|R2|R3' 'bootstrap routes by risk'
require_text skills/using-superpowers/SKILL.md 'explicit(ly)? named|clearly match' 'bootstrap uses explicit skill matching'
reject_text skills/using-superpowers/SKILL.md '1% chance' 'bootstrap removes one-percent trigger'

require_text skills/brainstorming/SKILL.md 'material(ly)? ambiguous|consequential trade-offs|R3' 'brainstorming has narrow trigger'
reject_text skills/brainstorming/SKILL.md 'EVERY project' 'brainstorming no longer forces every project'
require_text skills/writing-plans/SKILL.md 'three dependent|multiple components|R3' 'planning is complexity gated'
require_text skills/test-driven-development/SKILL.md 'observable behavior|regression|public contract' 'TDD targets observable behavior'
require_text skills/test-driven-development/SKILL.md 'alternative validation|best available deterministic validation' 'TDD has explicit non-behavior fallback'
require_text skills/subagent-driven-development/SKILL.md 'fork_turns' 'SDD controls inherited context'
reject_text skills/subagent-driven-development/SKILL.md 'must explicitly specify a model|general-purpose subagent' 'SDD does not require unsupported dispatch fields'
reject_text skills/subagent-driven-development/implementer-prompt.md 'Subagent \(general-purpose\)|model: \[MODEL' 'implementer prompt uses available dispatch fields'
reject_text skills/subagent-driven-development/task-reviewer-prompt.md 'Subagent \(general-purpose\)|model: \[MODEL' 'task reviewer prompt uses available dispatch fields'
reject_text skills/requesting-code-review/code-reviewer.md 'Subagent \(general-purpose\)' 'code reviewer prompt is capability-neutral'

reject_text skills/using-superpowers/references/codex-tools.md 'close_agent' 'Codex reference removes unavailable close_agent'
require_text skills/using-superpowers/references/codex-tools.md 'fork_turns' 'Codex reference documents fork_turns'
require_text skills/using-superpowers/references/codex-tools.md 'followup_task' 'Codex reference documents follow-up turns'
require_text skills/using-superpowers/references/codex-tools.md 'interrupt_agent' 'Codex reference documents interruption'

require_text skills/verification-before-completion/SKILL.md 'R1|targeted' 'verification scales low-risk checks'
require_text skills/verification-before-completion/SKILL.md 'R2|affected' 'verification scales medium-risk checks'
require_text skills/verification-before-completion/SKILL.md 'R3|full' 'verification scales high-risk checks'

for script in scripts/install-codex-profile.sh scripts/rollback-codex-profile.sh; do
  if [[ ! -x "$ROOT/$script" ]]; then
    printf 'FAIL: executable %s is missing\n' "$script" >&2
    failures=$((failures + 1))
  fi
done

if (( failures > 0 )); then
  printf '%d contract check(s) failed\n' "$failures" >&2
  exit 1
fi

printf 'Codex profile contract checks passed\n'
```

- [ ] **Step 2: Add a test runner**

Create `tests/codex-profile/run-tests.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for test_file in "$SCRIPT_DIR"/test-*.sh; do
  bash "$test_file"
done
```

- [ ] **Step 3: Make the tests executable and verify RED**

Run:

```bash
chmod +x tests/codex-profile/test-risk-routing-contract.sh tests/codex-profile/run-tests.sh
bash tests/codex-profile/run-tests.sh
```

Expected: FAIL for missing risk routing, unsupported Codex references, and missing installer scripts.

- [ ] **Step 4: Commit the RED contract**

```bash
git add tests/codex-profile
git commit -m "test: define Codex profile contracts"
```

### Task 2: Implement the Risk Router and Codex Tool Contract

**Files:**
- Create: `skills/using-superpowers/references/risk-levels.md`
- Modify: `skills/using-superpowers/SKILL.md`
- Modify: `skills/using-superpowers/references/codex-tools.md`

**Interfaces:**
- Consumes: user request, task scope, side effects, and current Codex tool surface
- Produces: risk level, matching-skill decision, and valid Codex dispatch/finishing behavior

- [ ] **Step 1: Add the shared risk reference**

Create `skills/using-superpowers/references/risk-levels.md` with this contract:

```markdown
# Risk Levels

Use the highest matching level. Ambiguity escalates only when the answer changes scope, architecture, side effects, or risk.

| Level | Observable conditions | Default process |
|---|---|---|
| R0 | Read-only explanation, search, audit, status, or review without requested edits | Inspect directly and support conclusions with evidence. |
| R1 | Localized and reversible; no runtime behavior, data contract, security, deployment, external integration, or production-critical change | Edit directly, inspect the diff, and run targeted validation. |
| R2 | Bug, observable behavior, public API, or coordinated multi-file change without R3 consequences | Investigate bugs first; use test-first when automatable; plan only for three dependent steps or multiple components; review material logic once at the end. |
| R3 | Security, auth, money, migration, concurrency, destructive data action, production deployment, external side effect, or cross-system change | Require approved written design, isolation, plan, TDD/debugging as applicable, independent review, full verification, rollback or compensation, and separate authorization for destructive/publish/deploy actions. |

Explicit user instructions override the default process but do not silently authorize destructive or external actions.
```

- [ ] **Step 2: Rewrite the bootstrap as a concise router**

Replace the body of `skills/using-superpowers/SKILL.md` while retaining its frontmatter name. Its description must trigger at conversation start and its body must contain, in order:

```markdown
# Using Superpowers

Check skills before acting. Load a skill when the user names it or its description clearly matches the request; do not load skills for merely adjacent topics.

1. Read user and project instructions first.
2. Classify the task with [risk-levels.md](references/risk-levels.md).
3. Load matching process skills before implementation skills.
4. Announce each selected skill and follow its required gates.
5. Keep R0/R1 proportional; preserve R3 safeguards.

User instructions override skills. A skill overrides default behavior only within its stated trigger. Dispatched subagents skip this bootstrap unless their task explicitly requires a skill.

For Codex-specific collaboration and worktree behavior, read [codex-tools.md](references/codex-tools.md).
```

- [ ] **Step 3: Replace obsolete Codex guidance**

Rewrite `skills/using-superpowers/references/codex-tools.md` to document:

```markdown
# Codex Tools

## Collaboration

When collaboration tools are available, dispatch with `spawn_agent(task_name, message, fork_turns)`. Always choose `fork_turns` deliberately:

- `none` for isolated validation and narrowly scoped work with a self-contained prompt.
- a small numeric window when recent conversation context is required.
- `all` only when the subagent truly needs the full session.

Use `followup_task` for another turn on an existing agent, `send_message` for non-triggering context, `wait_agent` for mailbox updates, and `interrupt_agent` only to interrupt active work. Do not invent model, agent-type, or cleanup parameters absent from the current schema.

## Environment Detection

Inspect `git rev-parse --git-dir`, `git rev-parse --git-common-dir`, `git branch --show-current`, remotes, authentication, and actual permissions before choosing worktree or publish behavior. Detached HEAD is a state to handle, not proof that branch, push, or PR operations are impossible.

Prefer native isolation when the runtime exposes it; otherwise use the guarded Git fallback from `using-git-worktrees`.

## Codex App Finishing

Use available Codex App controls when they are relevant. If branch or publish commands fail, report the observed restriction and the safe next action; do not assume a sandbox restriction before testing it.

## Visual Companion

The brainstorming visual companion is a bundled local server workflow, not a native Codex tool. Offer it only when the visual decision benefits from it and follow the skill's consent rule.
```

- [ ] **Step 4: Run the contract and confirm remaining failures are downstream only**

Run `bash tests/codex-profile/run-tests.sh`.

Expected: bootstrap and Codex reference checks pass; planning, TDD, SDD, verification, and installer checks still fail.

- [ ] **Step 5: Commit the router**

```bash
git add skills/using-superpowers
git commit -m "feat: add Codex risk router"
```

### Task 3: Make Design and Planning Risk-Proportional

**Files:**
- Modify: `skills/brainstorming/SKILL.md`
- Modify: `skills/writing-plans/SKILL.md`

**Interfaces:**
- Consumes: risk level, ambiguity, architecture choices, number of dependent steps, component count
- Produces: direct execution, concise inline design, or full approved spec and plan

- [ ] **Step 1: Narrow brainstorming discovery**

Set the `brainstorming` description to:

```yaml
description: Use when requirements are materially ambiguous, consequential design trade-offs exist, architecture or interfaces must be chosen, or work is high risk (R3), before implementation
```

Replace the universal hard gate with a conditional contract:

```markdown
<HARD-GATE>
For R3 work, do not implement until the design and written spec are approved. For R2 work with clear intent and interfaces, an inline design is sufficient. R0 and R1 do not use this skill.
</HARD-GATE>
```

Replace every claim that the full process applies to every project with:

```markdown
Use the full checklist for R3. For R2, stop after a concise design when scope, interfaces, error handling, and verification are clear; do not create or commit a spec unless the user or project requires one.
```

Keep the existing full R3 checklist, approach comparison, visual-companion consent, spec self-review, and written-spec approval behavior.

- [ ] **Step 2: Narrow plan discovery and output**

Set the `writing-plans` description to:

```yaml
description: Use when approved high-risk work (R3), three or more dependent implementation steps, or multiple coordinated components require a written implementation plan before coding
```

Add this decision rule after Overview:

```markdown
## Plan Gate

Write a plan for R3 work and for R2 work with at least three dependent steps or multiple coordinated components. Do not create a plan for R0/R1 or a clear single-step R2 fix.
```

Change plan granularity from mandatory 2–5 minute steps to coherent independently verifiable tasks. Require exact code only where an interface, migration, fragile algorithm, or non-obvious command would otherwise be ambiguous. Require commits at coherent reviewable boundaries rather than after every mechanical action.

- [ ] **Step 3: Run routing contracts**

Run `bash tests/codex-profile/run-tests.sh`.

Expected: brainstorming and writing-plan checks pass; TDD, SDD, verification, and installer checks remain failing.

- [ ] **Step 4: Commit planning changes**

```bash
git add skills/brainstorming/SKILL.md skills/writing-plans/SKILL.md
git commit -m "feat: scale design and planning by risk"
```

### Task 4: Make TDD and Subagents Risk-Proportional

**Files:**
- Modify: `skills/test-driven-development/SKILL.md`
- Modify: `skills/subagent-driven-development/SKILL.md`
- Modify: `skills/subagent-driven-development/implementer-prompt.md`
- Modify: `skills/subagent-driven-development/task-reviewer-prompt.md`
- Modify: `skills/requesting-code-review/SKILL.md`
- Modify: `skills/requesting-code-review/code-reviewer.md`

**Interfaces:**
- Consumes: observable behavior, testability, risk, task boundaries, available collaboration schema
- Produces: test-first or documented deterministic alternative; direct implementation, final-only review, or task-by-task SDD

- [ ] **Step 1: Update TDD trigger and exceptions**

Set the description to:

```yaml
description: Use before changing observable behavior, fixing a reproducible bug, modifying a public contract, or implementing security- or data-sensitive logic when an automated test surface is available
```

Retain strict RED-GREEN-REFACTOR for matching work. Replace the broad exception section with:

```markdown
## When Test-First Does Not Apply

Copy, comments, generated artifacts, throwaway exploration, and configuration without a practical automated-test surface may use the best available deterministic validation. State why a failing automated test is not practical and run that validation before claiming completion.

Do not delete pre-existing user code because it predates the current test cycle. Before changing its observable behavior, add a failing regression or characterization test where practical.
```

Keep anti-rationalization rules for work that matches the skill.

- [ ] **Step 2: Add an SDD risk gate and Codex dispatch contract**

Set the description to:

```yaml
description: Use when executing an approved high-risk plan (R3) or a multi-task implementation whose isolated task contexts and independent reviews materially improve reliability
```

Add near the top:

```markdown
## Execution Gate

- R1: implement directly; no implementation or review subagent by default.
- R2: implement directly and use one final independent review for material logic unless task isolation clearly improves reliability.
- R3: use fresh implementers and task review at meaningful task boundaries, then one whole-change review.

Every `spawn_agent` call must choose `fork_turns` explicitly. Do not require unavailable model, named agent-type, or cleanup parameters.
```

Remove model-selection requirements and replace dispatch-type wording with capability-neutral "dispatch a subagent." Keep file-based briefs/reports/review packages, skeptical read-only reviews, Critical/Important fix loops, and main-agent evidence checks.

- [ ] **Step 3: Align implementer and reviewer prompts**

Remove instructions that require a model or named agent type. Add an explicit input field:

```markdown
**Context policy:** Use only the task brief, referenced files, and the explicitly provided conversation window. Report when required context is missing rather than assuming it.
```

Keep RED/GREEN evidence mandatory when TDD applies and require alternative-validation evidence when the task is outside the TDD trigger.

- [ ] **Step 4: Narrow requesting-code-review trigger**

Set its description to:

```yaml
description: Use for material R2 logic before integration, at meaningful R3 task boundaries, before merging, or when the user explicitly requests independent code review
```

Retain severity handling and evidence-backed disagreement.

Replace the `Subagent (general-purpose)` wrapper in `skills/requesting-code-review/code-reviewer.md` with a capability-neutral dispatch template that requires an explicit `fork_turns` choice and retains the existing reviewer prompt body.

- [ ] **Step 5: Run routing contracts**

Run `bash tests/codex-profile/run-tests.sh`.

Expected: TDD and SDD checks pass; verification and installer checks remain failing.

- [ ] **Step 6: Commit implementation workflow changes**

```bash
git add skills/test-driven-development skills/subagent-driven-development skills/requesting-code-review
git commit -m "feat: scale TDD and subagents by risk"
```

### Task 5: Scale Isolation, Finishing, and Verification

**Files:**
- Modify: `skills/using-git-worktrees/SKILL.md`
- Modify: `skills/finishing-a-development-branch/SKILL.md`
- Modify: `skills/verification-before-completion/SKILL.md`

**Interfaces:**
- Consumes: risk level, dirty overlap, parallel writers, branch ownership, claimed result
- Produces: isolation decision, branch-finishing decision, and proportionate fresh evidence

- [ ] **Step 1: Gate worktree creation**

Set the worktree description to:

```yaml
description: Use before R3 implementation, parallel writers, long-lived isolated work, or changes that overlap a dirty working tree when the task is in a Git repository
```

Keep environment detection, consent, ignore checks, setup, and baseline verification. Add: R0/R1 and ordinary R2 work already in a safe clean checkout do not create a worktree by default.

- [ ] **Step 2: Gate branch finishing**

Set the finishing description to:

```yaml
description: Use when the task created or managed a branch/worktree, or when the user asks to merge, push, open a PR, keep, discard, or clean up completed development work
```

Do not present a finishing menu for work that neither created nor managed a branch. Keep discard confirmation and actual environment detection.

- [ ] **Step 3: Add proportionate verification scope**

Keep the fresh-evidence iron law. Add:

```markdown
## Scope by Risk

- R1: run the narrowest targeted check that proves the requested artifact or value changed correctly; inspect the diff.
- R2: run focused tests plus affected suites and relevant lint, type, or build checks.
- R3: run the complete relevant suite, integration or migration checks, security boundaries, and rollback or compensation validation.

Risk scales verification breadth, never the requirement for fresh evidence.
```

- [ ] **Step 4: Run routing contracts**

Run `bash tests/codex-profile/run-tests.sh`.

Expected: only installer checks fail.

- [ ] **Step 5: Commit guardrail changes**

```bash
git add skills/using-git-worktrees/SKILL.md skills/finishing-a-development-branch/SKILL.md skills/verification-before-completion/SKILL.md
git commit -m "feat: scale isolation and verification by risk"
```

### Task 6: Add Tested Codex Installation and Rollback

**Files:**
- Create: `tests/codex-profile/test-install-rollback.sh`
- Create: `scripts/install-codex-profile.sh`
- Create: `scripts/rollback-codex-profile.sh`

**Interfaces:**
- Consumes: repository `skills/`, optional `CODEX_HOME`, optional backup path
- Produces: timestamped backup, checksum/source manifest, active customized skills, and reversible restoration

- [ ] **Step 1: Write a failing isolated install/rollback test**

Create `tests/codex-profile/test-install-rollback.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export CODEX_HOME="$TMP/codex"
mkdir -p "$CODEX_HOME/skills/using-superpowers" "$CODEX_HOME/skills/personal-sentinel"
printf 'original-superpowers\n' > "$CODEX_HOME/skills/using-superpowers/SKILL.md"
printf 'keep-personal\n' > "$CODEX_HOME/skills/personal-sentinel/SKILL.md"

bash "$ROOT/scripts/install-codex-profile.sh"

for skill in brainstorming dispatching-parallel-agents executing-plans finishing-a-development-branch receiving-code-review requesting-code-review subagent-driven-development systematic-debugging test-driven-development using-git-worktrees using-superpowers verification-before-completion writing-plans writing-skills; do
  test -f "$CODEX_HOME/skills/$skill/SKILL.md"
done
grep -qx 'keep-personal' "$CODEX_HOME/skills/personal-sentinel/SKILL.md"
! grep -qx 'original-superpowers' "$CODEX_HOME/skills/using-superpowers/SKILL.md"

BACKUP="$(cat "$CODEX_HOME/superzhao-last-backup")"
test -f "$BACKUP/skills/using-superpowers/SKILL.md"
printf 'mutated-installed-copy\n' > "$CODEX_HOME/skills/using-superpowers/SKILL.md"

bash "$ROOT/scripts/rollback-codex-profile.sh" "$BACKUP"

grep -qx 'original-superpowers' "$CODEX_HOME/skills/using-superpowers/SKILL.md"
grep -qx 'keep-personal' "$CODEX_HOME/skills/personal-sentinel/SKILL.md"
test ! -e "$CODEX_HOME/skills/brainstorming"
printf 'Install and rollback test passed\n'
```

Run:

```bash
bash tests/codex-profile/test-install-rollback.sh
```

Expected: FAIL because installer and rollback scripts do not exist.

- [ ] **Step 2: Implement atomic staged installation**

Create `scripts/install-codex-profile.sh` with:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_ROOT="${CODEX_HOME:-$HOME/.codex}"
SKILLS_ROOT="$CODEX_ROOT/skills"
BACKUPS_ROOT="$CODEX_ROOT/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKUPS_ROOT/superzhao-$STAMP"
STAGE="$CODEX_ROOT/.superzhao-stage-$$"
SKILLS=(brainstorming dispatching-parallel-agents executing-plans finishing-a-development-branch receiving-code-review requesting-code-review subagent-driven-development systematic-debugging test-driven-development using-git-worktrees using-superpowers verification-before-completion writing-plans writing-skills)

cleanup() { rm -rf "$STAGE"; }
restore_on_error() {
  local skill
  for skill in "${SKILLS[@]}"; do
    if [[ -e "$BACKUP/skills/$skill" ]]; then
      rm -rf "$SKILLS_ROOT/$skill"
      mv "$BACKUP/skills/$skill" "$SKILLS_ROOT/$skill"
    elif [[ -e "$SKILLS_ROOT/$skill" ]]; then
      rm -rf "$SKILLS_ROOT/$skill"
    fi
  done
}
trap 'restore_on_error; cleanup' ERR
trap cleanup EXIT
mkdir -p "$STAGE" "$SKILLS_ROOT" "$BACKUP/skills"

for skill in "${SKILLS[@]}"; do
  test -f "$ROOT/skills/$skill/SKILL.md"
  cp -R "$ROOT/skills/$skill" "$STAGE/$skill"
  if [[ -e "$SKILLS_ROOT/$skill" ]]; then
    mv "$SKILLS_ROOT/$skill" "$BACKUP/skills/$skill"
  fi
done

for skill in "${SKILLS[@]}"; do
  mv "$STAGE/$skill" "$SKILLS_ROOT/$skill"
done

git -C "$ROOT" rev-parse HEAD > "$BACKUP/source-commit.txt"
find "$SKILLS_ROOT" -type f -maxdepth 4 -print0 | sort -z | xargs -0 shasum -a 256 > "$BACKUP/installed-sha256.txt"
printf '%s\n' "$BACKUP" > "$CODEX_ROOT/superzhao-last-backup"
printf 'Installed Superzhao skills. Backup: %s\nStart a new Codex task to refresh discovery.\n' "$BACKUP"
```

- [ ] **Step 3: Implement explicit rollback**

Create `scripts/rollback-codex-profile.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

CODEX_ROOT="${CODEX_HOME:-$HOME/.codex}"
SKILLS_ROOT="$CODEX_ROOT/skills"
BACKUPS_ROOT="$CODEX_ROOT/backups"
BACKUP="${1:-}"
if [[ -z "$BACKUP" ]]; then
  test -f "$CODEX_ROOT/superzhao-last-backup"
  BACKUP="$(cat "$CODEX_ROOT/superzhao-last-backup")"
fi
test -d "$BACKUP/skills"

STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUPS_ROOT/superzhao-current-before-rollback-$STAMP"
mkdir -p "$ARCHIVE/skills" "$SKILLS_ROOT"
SKILLS=(brainstorming dispatching-parallel-agents executing-plans finishing-a-development-branch receiving-code-review requesting-code-review subagent-driven-development systematic-debugging test-driven-development using-git-worktrees using-superpowers verification-before-completion writing-plans writing-skills)

restore_archive_on_error() {
  local skill
  for skill in "${SKILLS[@]}"; do
    rm -rf "$SKILLS_ROOT/$skill"
    if [[ -e "$ARCHIVE/skills/$skill" ]]; then
      mv "$ARCHIVE/skills/$skill" "$SKILLS_ROOT/$skill"
    fi
  done
}
trap restore_archive_on_error ERR

for skill in "${SKILLS[@]}"; do
  if [[ -e "$SKILLS_ROOT/$skill" ]]; then
    mv "$SKILLS_ROOT/$skill" "$ARCHIVE/skills/$skill"
  fi
  if [[ -e "$BACKUP/skills/$skill" ]]; then
    cp -R "$BACKUP/skills/$skill" "$SKILLS_ROOT/$skill"
  fi
done

printf 'Restored Superpowers skills from %s\nCurrent profile archived at %s\nStart a new Codex task to refresh discovery.\n' "$BACKUP" "$ARCHIVE"
```

- [ ] **Step 4: Verify install and rollback in temporary homes**

Run:

```bash
chmod +x scripts/install-codex-profile.sh scripts/rollback-codex-profile.sh tests/codex-profile/test-install-rollback.sh
bash tests/codex-profile/test-install-rollback.sh
bash tests/codex-profile/run-tests.sh
```

Expected: both commands exit 0; personal skill sentinel remains unchanged; original Superpowers sentinel returns after rollback.

- [ ] **Step 5: Commit deployment tooling**

```bash
git add scripts/install-codex-profile.sh scripts/rollback-codex-profile.sh tests/codex-profile
git commit -m "feat: add safe Codex profile deployment"
```

### Task 7: Document the Fork and Maintenance Workflow

**Files:**
- Modify: `README.md`
- Create: `docs/superzhao-maintenance.md`

**Interfaces:**
- Consumes: origin/upstream remote model and deployment scripts
- Produces: visible fork identity, install, rollback, update, and validation commands

- [ ] **Step 1: Add a concise README banner**

Insert at the top of `README.md`:

```markdown
> **Superzhao Codex Profile** — This repository is a risk-tiered Codex distribution based on [obra/superpowers](https://github.com/obra/superpowers). It preserves the upstream R3 workflow for consequential work and uses proportional R0–R2 workflows for everyday Codex tasks. See [maintenance and installation](docs/superzhao-maintenance.md).
```

Keep upstream attribution and documentation intact below the banner.

- [ ] **Step 2: Add maintenance instructions**

Document:

```bash
git fetch upstream
git switch -c "update/upstream-$(date +%Y%m%d)"
git merge upstream/main
bash tests/codex-profile/run-tests.sh
bash tests/shell-lint/test-lint-shell.sh
```

Also document `scripts/install-codex-profile.sh`, `scripts/rollback-codex-profile.sh`, backup location, the requirement to inspect the full diff, and the need to start a new Codex task after activation.

- [ ] **Step 3: Commit documentation**

```bash
git add README.md docs/superzhao-maintenance.md
git commit -m "docs: explain Superzhao maintenance"
```

### Task 8: Run Behavioral Evals, Refine, Activate, and Publish

**Files:**
- Modify as evidence requires: the profile skill files above
- Create outside Git tracking: timestamped backup under `~/.codex/backups/`
- Deploy outside Git tracking: the 14 active directories under `~/.codex/skills/`

**Interfaces:**
- Consumes: completed fork, RED baselines, five fresh runs per routing class
- Produces: behavior evidence, activated profile, rollback proof, and published `origin/main`

- [ ] **Step 1: Run structural verification**

```bash
bash tests/codex-profile/run-tests.sh
bash tests/codex-profile/test-risk-routing-contract.sh
bash tests/shell-lint/test-lint-shell.sh
git diff --check upstream/main...HEAD
```

Expected: all commands exit 0.

These deterministic current-head Codex contracts are the fork acceptance gates. Upstream `tests/claude-code/` behavior tests, including `tests/claude-code/test-worktree-native-preference.sh`, are an optional external harness and are not a fork acceptance gate. Run that harness only when its local dependencies are available and any external Claude/model calls, credentials, and costs have separate explicit authorization; do not treat a skipped external harness as an acceptance failure.

- [ ] **Step 2: Run fresh-context behavior samples**

Run at least five independent samples each for:

- R0 audit: no implementation workflow.
- R1 copy/config edit: direct execution and targeted validation.
- R2 reproducible bug: root-cause analysis, failing regression, affected verification, at most one final review by default.
- R3 migration/security feature: full design approval, isolation, plan, TDD, task review, whole-change review, rollback/compensation.
- Ambiguous request: ask only the minimum question and escalate only when the answer changes scope or risk.

Read every result manually. If a class fails, update only the smallest responsible wording, rerun that class, and preserve the R3 control.

- [ ] **Step 3: Review the complete fork diff**

```bash
git status -sb
git log --oneline upstream/main..HEAD
git diff --stat upstream/main...HEAD
git diff upstream/main...HEAD
```

Confirm there are no unrelated upstream rewrites or unsupported tool names.

- [ ] **Step 4: Exercise install and rollback against an isolated Codex home**

Use `mktemp -d`, run install, record checksums, run rollback, and verify byte-for-byte restoration of seeded active skill files and preservation of an unrelated skill.

- [ ] **Step 5: Activate the verified profile locally**

Run:

```bash
bash scripts/install-codex-profile.sh
```

Record the printed backup path. Compare installed skill checksums to the repository. Do not delete the backup.

- [ ] **Step 6: Commit any evidence-driven refinements**

Stage only intended skill/test/documentation changes and commit with a terse message describing the observed behavior fixed.

- [ ] **Step 7: Publish the initialized repository**

Because `zhaogewudi666/superzhao` is empty and has no base branch, initialize it by pushing the verified customized `main` directly:

```bash
git push -u origin main
```

Verify the remote default branch, commit SHA, and repository file tree after push. Do not open a pull request against `obra/superpowers`.

- [ ] **Step 8: Final evidence report**

Report upstream base, fork HEAD, changed skills, test commands/results, behavior sampling summary, local backup path, rollback command, installed checksum result, and GitHub repository URL.
