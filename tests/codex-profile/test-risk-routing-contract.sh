#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
failures=0

require_text() {
  local file="$1" pattern="$2" label="$3"
  local path="$ROOT/$file"
  local status

  if [[ ! -f "$path" || ! -r "$path" ]]; then
    printf 'FAIL: %s (target is not a readable regular file: %s)\n' "$label" "$file" >&2
    failures=$((failures + 1))
    return
  fi

  if grep -Eq "$pattern" "$path"; then
    return
  else
    status=$?
  fi

  if (( status == 1 )); then
    printf 'FAIL: %s\n' "$label" >&2
  else
    printf 'FAIL: %s (grep error %d while reading %s)\n' "$label" "$status" "$file" >&2
  fi
  failures=$((failures + 1))
}

reject_text() {
  local file="$1" pattern="$2" label="$3"
  local path="$ROOT/$file"
  local status

  if [[ ! -f "$path" || ! -r "$path" ]]; then
    printf 'FAIL: %s (target is not a readable regular file: %s)\n' "$label" "$file" >&2
    failures=$((failures + 1))
    return
  fi

  if grep -Eq "$pattern" "$path"; then
    printf 'FAIL: %s\n' "$label" >&2
    failures=$((failures + 1))
  else
    status=$?
    if (( status > 1 )); then
      printf 'FAIL: %s (grep error %d while reading %s)\n' "$label" "$status" "$file" >&2
      failures=$((failures + 1))
    fi
  fi
}

require_before() {
  local file="$1" first_pattern="$2" second_pattern="$3" label="$4"
  local path="$ROOT/$file"
  local first_line
  local second_line

  if [[ ! -f "$path" || ! -r "$path" ]]; then
    printf 'FAIL: %s (target is not a readable regular file: %s)\n' "$label" "$file" >&2
    failures=$((failures + 1))
    return
  fi

  first_line="$(grep -En "$first_pattern" "$path" | sed -n '1s/:.*//p' || true)"
  second_line="$(grep -En "$second_pattern" "$path" | sed -n '1s/:.*//p' || true)"
  if [[ -z "$first_line" || -z "$second_line" \
    || "$first_line" -ge "$second_line" ]]; then
    printf 'FAIL: %s\n' "$label" >&2
    failures=$((failures + 1))
  fi
}

require_text skills/using-superpowers/references/risk-levels.md 'R0.*Read-only.*without requested edits' 'risk reference defines R0 from observable conditions'
require_text skills/using-superpowers/references/risk-levels.md 'R1.*Localized.*reversible.*no runtime behavior.*data contract.*security.*deployment.*external integration.*production-critical' 'risk reference defines R1 from observable conditions'
require_text skills/using-superpowers/references/risk-levels.md 'R2.*Bug.*observable behavior.*public API.*coordinated multi-file.*without R3 consequences' 'risk reference defines R2 from observable conditions'
require_text skills/using-superpowers/references/risk-levels.md 'R3.*Security.*auth.*money.*migration.*concurrency.*destructive.*production deployment.*external side effect.*cross-system' 'risk reference defines R3 from observable conditions'
require_text skills/using-superpowers/references/risk-levels.md 'requested action.*side effects.*subject matter' 'risk routing classifies the requested action rather than a sensitive topic alone'
require_text skills/using-superpowers/references/risk-levels.md 'Read-only.*remain(s)? R0.*security.*auth.*money.*migration.*external' 'read-only sensitive-topic work remains R0'
require_text skills/using-superpowers/references/risk-levels.md 'financial.*money|money.*financial' 'R3 retains non-payment financial logic'
require_text skills/using-superpowers/references/risk-levels.md 'generic shortcut.*urgency.*does not waive.*R3' 'generic urgency does not waive R3 safeguards'
require_text skills/using-superpowers/references/risk-levels.md 'waive.*non-authorization gate.*name.*explicit' 'R3 workflow waivers must name the gate explicitly'
require_text skills/using-superpowers/references/risk-levels.md 'separate action-specific authorization.*point of execution' 'external execution requires action-specific authorization'
require_text skills/using-superpowers/SKILL.md 'risk-levels\.md' 'bootstrap routes through the shared risk reference'
require_text skills/using-superpowers/SKILL.md 'user names it' 'bootstrap loads explicitly named skills'
require_text skills/using-superpowers/SKILL.md 'description clearly matches' 'bootstrap loads clearly matching skills'
require_text skills/using-superpowers/SKILL.md 'stated outcome.*boundaries' 'bootstrap starts from the user outcome and boundaries'
require_text skills/using-superpowers/SKILL.md 'work shape.*clear.*ambiguous.*coordinated.*independent' 'bootstrap separates work shape from action risk'
require_text skills/using-superpowers/SKILL.md 'consequential.*constraints.*invariants.*completion evidence.*(exclusions|out-of-scope).*authorization' 'bootstrap makes consequential task boundaries explicit'
require_text skills/using-superpowers/SKILL.md 'Announce.*only when.*changes the next action.*adds a gate' 'bootstrap announces only behavior-changing skills'
reject_text skills/using-superpowers/SKILL.md '1% chance' 'bootstrap removes one-percent trigger'

require_text skills/brainstorming/SKILL.md 'material(ly)? ambiguous' 'brainstorming triggers on material ambiguity'
require_text skills/brainstorming/SKILL.md 'consequential (design )?trade-offs' 'brainstorming triggers on consequential trade-offs'
require_text skills/brainstorming/SKILL.md 'R3' 'brainstorming retains the R3 gate'
require_text skills/brainstorming/SKILL.md 'decision-complete' 'brainstorming ends on a decision-complete design'
require_text skills/brainstorming/SKILL.md 'blocking unknowns' 'brainstorming asks only questions that block design completion'
require_text skills/brainstorming/SKILL.md 'already.*decision-complete.*review' 'brainstorming can validate an existing complete design directly'
require_text skills/brainstorming/SKILL.md 'content digest.*base (commit|SHA)' 'R3 approval binds the exact spec and baseline'
require_text skills/brainstorming/SKILL.md 'material change.*(outcome|scope).*(interfaces|invariants).*(risk|authorization).*re-approv' 'material design drift invalidates approval'
reject_text skills/brainstorming/SKILL.md 'EVERY project' 'brainstorming no longer forces every project'
reject_text skills/brainstorming/SKILL.md 'MUST create a task for each.*complete them in order' 'brainstorming removes the fixed R3 stage machine'
reject_text skills/brainstorming/SKILL.md 'Only one question per message' 'brainstorming removes fixed interview cadence'
reject_text skills/brainstorming/SKILL.md 'Propose 2-3' 'brainstorming does not invent alternatives when no real choice exists'
reject_text skills/brainstorming/SKILL.md 'approval after each section|Ask after each section' 'brainstorming uses one decision-complete approval gate'
require_text skills/writing-plans/SKILL.md 'R3' 'planning retains the R3 gate'
require_text skills/writing-plans/SKILL.md '(three or more|at least three) dependent (implementation )?steps' 'planning gates on dependent steps'
require_text skills/writing-plans/SKILL.md 'multiple (coordinated )?components' 'planning gates on multiple components'
require_text skills/test-driven-development/SKILL.md 'observable behavior' 'TDD targets observable behavior'
require_text skills/test-driven-development/SKILL.md '(failing )?regression' 'TDD covers regressions'
require_text skills/test-driven-development/SKILL.md 'public contract' 'TDD covers public contracts'
require_text skills/test-driven-development/SKILL.md 'best available deterministic validation' 'TDD has explicit non-behavior fallback'
require_text skills/subagent-driven-development/SKILL.md 'fork_turns' 'SDD controls inherited context'
reject_text skills/subagent-driven-development/SKILL.md 'must explicitly specify a model|general-purpose subagent' 'SDD does not require unsupported dispatch fields'
reject_text skills/subagent-driven-development/implementer-prompt.md 'Subagent \(general-purpose\)|model: \[MODEL' 'implementer prompt uses available dispatch fields'
reject_text skills/subagent-driven-development/task-reviewer-prompt.md 'Subagent \(general-purpose\)|model: \[MODEL' 'task reviewer prompt uses available dispatch fields'
reject_text skills/requesting-code-review/code-reviewer.md 'Subagent \(general-purpose\)' 'code reviewer prompt is capability-neutral'
reject_text skills/dispatching-parallel-agents/SKILL.md 'Subagent \(general-purpose\)' 'parallel dispatch removes unsupported named agent syntax'
reject_text skills/dispatching-parallel-agents/SKILL.md 'never inherit your session.s context or history' 'parallel dispatch does not overstate context isolation'
require_text skills/dispatching-parallel-agents/SKILL.md 'spawn_agent\(task_name, message, fork_turns\)' 'parallel dispatch uses the current Codex spawn schema'
require_text skills/dispatching-parallel-agents/SKILL.md 'Choose.*fork_turns.*deliberately.*every' 'parallel dispatch requires a deliberate context window'
require_text skills/dispatching-parallel-agents/SKILL.md 'none.*no inherited conversation' 'parallel dispatch documents isolated context'
require_text skills/dispatching-parallel-agents/SKILL.md 'positive integer.*recent conversation' 'parallel dispatch documents bounded inherited context'
require_text skills/dispatching-parallel-agents/SKILL.md 'all.*full conversation' 'parallel dispatch documents full inherited context'
require_text skills/dispatching-parallel-agents/SKILL.md 'multi-part request.*not.*parallel implementation writers' 'parallel dispatch does not mistake request shape for implementation risk'
require_text skills/dispatching-parallel-agents/SKILL.md 'R0.*read-only agents.*material.*benefit.*no side effects.*never.*implementation writers' 'R0 permits only beneficial side-effect-free read parallelism'
require_text skills/dispatching-parallel-agents/SKILL.md 'R1.*direct execution.*default.*implementation writers' 'R1 defaults to direct execution without writer dispatch'
require_text skills/dispatching-parallel-agents/SKILL.md 'R2/R3.*independent.*domains.*reliability benefit.*clear' 'R2 and R3 parallelize only independent domains with clear reliability benefit'
require_text skills/dispatching-parallel-agents/SKILL.md 'team limit.*4 total agents.*controller.*at most 3 child agents concurrently' 'parallel dispatch honors the four-slot team cap'
require_text skills/dispatching-parallel-agents/SKILL.md 'writers.*share.*checkout.*branch.*files.*must not run in parallel' 'parallel writers cannot share mutable checkout state'
require_text skills/dispatching-parallel-agents/SKILL.md 'Before dispatching implementation writers.*separate isolated worktree.*branch.*owned file scope' 'parallel writer prompts carry isolated ownership'
require_text skills/dispatching-parallel-agents/SKILL.md 'spawn_agent.*returns.*child.*running.*not.*sequential' 'parallel dispatch documents asynchronous child lifetime'
reject_text skills/dispatching-parallel-agents/SKILL.md 'One per response = sequential' 'parallel dispatch does not confuse response boundaries with completion'
reject_text skills/dispatching-parallel-agents/SKILL.md 'same response so they run in parallel' 'parallel dispatch defines overlap by child lifetime, not response grouping'

require_text skills/subagent-driven-development/SKILL.md 'Point-of-Execution Authorization Gate' 'SDD has an action-time authorization gate'
require_text skills/subagent-driven-development/SKILL.md 'destructive.*publish.*deploy.*private.*production operation.*external (side-effecting|execution) action' 'SDD names every gated side-effect class'
require_text skills/subagent-driven-development/SKILL.md 'public (web|website).*(documentation|docs).*read-only.*R0.*does not require.*authorization' 'SDD does not gate public read-only retrieval'
require_text skills/subagent-driven-development/SKILL.md 'Continuous execution.*missing point-of-execution authorization' 'SDD continuous execution stops for missing authorization'
require_text skills/subagent-driven-development/implementer-prompt.md '^    ## Authorization State$' 'implementer prompt carries authorization state'
require_text skills/subagent-driven-development/implementer-prompt.md 'Gated action:.*destructive.*publish.*deploy.*private.*production operation.*external (side-effecting|execution) action' 'implementer prompt limits the gate to action-time side effects'
require_text skills/subagent-driven-development/implementer-prompt.md 'Authorization status:.*not-required.*authorized.*missing' 'implementer prompt records explicit authorization status'
require_text skills/subagent-driven-development/implementer-prompt.md 'authorization.*missing or stale.*BLOCKED.*before any action' 'implementer blocks instead of inferring authorization'

require_text skills/using-git-worktrees/SKILL.md 'safe isolated mechanism' 'required isolation tries a safe alternative after denial'
require_text skills/using-git-worktrees/SKILL.md 'explicitly named isolation waiver' 'required isolation can proceed only with a named waiver'
require_text skills/using-git-worktrees/SKILL.md 'required for R3 implementation.*parallel writers.*long-lived.*dirty overlapping' 'every required isolation trigger keeps the gate'
reject_text skills/using-git-worktrees/SKILL.md 'working in the current directory instead' 'sandbox denial never silently degrades required isolation'

require_text skills/writing-plans/SKILL.md 'R2.*direct execution.*one final review' 'R2 plan handoff defaults to direct execution and one final review'
require_text skills/writing-plans/SKILL.md 'R3.*Subagent-Driven.*default' 'R3 plan handoff defaults to SDD when available'
require_text skills/writing-plans/SKILL.md '^\*\*Risk Level:\*\*.*R2.*R3' 'every plan records its routing risk explicitly'
require_text skills/writing-plans/SKILL.md 'living plan' 'plans are updated views of dependencies and outputs'
require_text skills/writing-plans/SKILL.md '[Ss]ource (requirements|artifact).*(content digest|hash).*base (commit|SHA|state)' 'plans bind source requirements and baseline'
require_text skills/writing-plans/SKILL.md 'Depends on.*Produces.*Completion evidence' 'tasks carry dependency, output, and proof fields'
require_text skills/writing-plans/SKILL.md 'checkbox.*(view|tracking).*(not|never).*evidence' 'plan checkboxes do not prove completion'
require_text skills/writing-plans/SKILL.md 'non-material.*(adjustment|adaptation).*(reason|evidence)' 'plans record safe implementation adaptations'
require_text skills/writing-plans/SKILL.md 'R2.*task boundaries.*one final review.*not.*review gate' 'R2 task sizing does not force per-task review'
reject_text skills/writing-plans/SKILL.md '^A task is.*worth a fresh reviewer.s gate' 'plan granularity does not force R2 task reviews'
reject_text skills/writing-plans/SKILL.md 'subagent-driven-development \(recommended\) or superpowers:executing-plans' 'plan header does not recommend SDD without regard to risk'
reject_text skills/writing-plans/SKILL.md 'decomposition decisions get locked in' 'plans do not freeze implementation details prematurely'
reject_text skills/writing-plans/SKILL.md 'Exact file paths always' 'plans require precision only where ambiguity is dangerous'
require_text skills/executing-plans/SKILL.md 'Risk-Specific Execution Gate' 'inline execution distinguishes R2 and R3'
require_text skills/executing-plans/SKILL.md 'R2.*one final independent review' 'inline R2 avoids task-boundary review expansion'
require_text skills/executing-plans/SKILL.md 'R3.*meaningful task-boundary reviews.*whole-change review' 'inline R3 preserves both review layers'
require_text skills/executing-plans/SKILL.md 'Point-of-Execution Authorization Gate' 'inline execution checks action-time authorization'
require_text skills/executing-plans/SKILL.md 'destructive.*publish.*deploy.*private.*production operation.*external (side-effecting|execution) action' 'inline execution gates every external side-effect class'
require_text skills/executing-plans/SKILL.md 'public (web|website).*(documentation|docs).*read-only.*R0.*does not require.*authorization' 'inline execution does not gate public read-only retrieval'
require_text skills/executing-plans/SKILL.md 'goal.*scope.*interfaces.*invariants.*risk.*authorization' 'plan execution preserves material boundaries rather than literal steps'
require_text skills/executing-plans/SKILL.md 'non-material.*(file paths|paths).*internal symbols.*equivalent commands.*record.*continue' 'plan execution permits evidence-backed local adaptation'
require_text skills/executing-plans/SKILL.md '[Mm]aterial.*drift.*stop.*re-approv' 'material execution drift returns to approval'
require_text skills/executing-plans/SKILL.md 'source (digest|binding).*base (commit|state).*current' 'plan execution validates source and base bindings'
reject_text skills/executing-plans/SKILL.md 'Follow (each|plan) step(s)? exactly' 'plan execution does not freeze safe implementation details'
reject_text skills/executing-plans/SKILL.md 'Follow that skill to verify tests, present options, execute choice' 'inline handoff does not contradict action-specific finishing gates'
require_text skills/executing-plans/SKILL.md 'using-git-worktrees.*required for R3.*isolation trigger.*ordinary R2' 'inline integration keeps worktrees risk-qualified'
reject_text skills/executing-plans/SKILL.md 'using-git-worktrees.*Ensures isolated workspace \(creates one or verifies existing\)' 'inline integration does not force isolation for every R2 plan'

require_before skills/finishing-a-development-branch/SKILL.md \
  '### Step 1: Identify.*Action' '### Step 2: Detect Environment' \
  'finishing identifies the requested action before environment and test gates'
require_text skills/finishing-a-development-branch/SKILL.md 'merge.*push.*publish_pr.*fresh tests' 'only integration and publication actions require fresh tests'
require_text skills/finishing-a-development-branch/SKILL.md 'merge.*push.*publish_pr.*fresh tests.*git status --short.*empty' 'published or integrated tests match a clean committed tree'
require_text skills/finishing-a-development-branch/SKILL.md 'keep.*does not require.*tests' 'keep is never blocked by failing tests'
require_text skills/finishing-a-development-branch/SKILL.md 'discard.*does not require.*tests' 'discard is never blocked by failing tests'
require_text skills/finishing-a-development-branch/SKILL.md 'normal checkout.*switch.*safe base.*before.*delet' 'normal-checkout discard leaves the feature branch before deletion'
require_text skills/finishing-a-development-branch/SKILL.md 'harness-owned.*preserve.*report' 'discard preserves harness-owned workspaces'
require_text skills/finishing-a-development-branch/SKILL.md 'merge in a harness-owned workspace.*preserve.*branch.*worktree.*report' 'merge preserves harness-owned workspace state'
require_text skills/finishing-a-development-branch/SKILL.md 'GIT_DIR == GIT_COMMON.*detached HEAD.*Reduced 3 options' 'normal detached checkout cannot expose merge'
require_text skills/finishing-a-development-branch/SKILL.md 'Named-branch normal checkout and named-branch worktree.*4 options' 'standard menu excludes detached normal checkout'
reject_text skills/finishing-a-development-branch/SKILL.md 'Normal repo and named-branch worktree.*4 options' 'normal checkout menu is branch-state aware'
require_text skills/finishing-a-development-branch/SKILL.md 'detached normal checkout.*discard.*switch.*safe base.*do not delete.*branch' 'normal detached discard abandons only the confirmed commit'
require_text skills/finishing-a-development-branch/SKILL.md 'normal checkout.*git status --short.*empty.*before.*switch' 'normal discard cannot carry dirty state onto the base'
require_text skills/finishing-a-development-branch/SKILL.md 'For confirmed discard.*task-owned.*git worktree remove --force.*WORKTREE_PATH' 'confirmed dirty task-owned discard can remove its worktree'
require_text skills/finishing-a-development-branch/SKILL.md 'For merge.*clean.*git worktree remove.*WORKTREE_PATH' 'merge uses clean worktree removal'
reject_text skills/finishing-a-development-branch/SKILL.md 'For merge.*git worktree remove --force' 'merge never force-removes a worktree'
reject_text skills/finishing-a-development-branch/SKILL.md '^git pull$' 'local merge does not silently update from a remote'
reject_text skills/finishing-a-development-branch/SKILL.md 'git worktree prune' 'finishing never prunes unrelated worktree registrations'
reject_text skills/finishing-a-development-branch/SKILL.md 'Before presenting options, verify tests pass' 'finishing no longer blocks keep and discard before action selection'

require_text docs/superpowers/plans/2026-07-13-superzhao-codex-profile.md 'test-worktree-native-preference.*optional external harness.*not.*acceptance gate' 'plan marks upstream Claude behavior checks optional'
reject_text docs/superpowers/plans/2026-07-13-superzhao-codex-profile.md '^bash tests/claude-code/test-worktree-native-preference\.sh$' 'plan removes external Claude behavior test from required gates'
reject_text docs/superpowers/plans/2026-07-13-superzhao-codex-profile.md '^bash tests/claude-code/' 'plan has no required upstream Claude behavior gate'

reject_text skills/using-superpowers/references/codex-tools.md 'close_agent' 'Codex reference removes unavailable close_agent'
require_text skills/using-superpowers/references/codex-tools.md 'fork_turns' 'Codex reference documents fork_turns'
require_text skills/using-superpowers/references/codex-tools.md 'followup_task' 'Codex reference documents follow-up turns'
require_text skills/using-superpowers/references/codex-tools.md 'interrupt_agent' 'Codex reference documents interruption'

require_text skills/verification-before-completion/SKILL.md '(R1.*targeted|targeted.*R1)' 'verification couples R1 with targeted checks'
require_text skills/verification-before-completion/SKILL.md '(R2.*affected|affected.*R2)' 'verification couples R2 with affected checks'
require_text skills/verification-before-completion/SKILL.md 'R3.*(complete relevant suite|full verification)|(complete relevant suite|full verification).*R3' 'verification couples R3 with complete checks'
require_text skills/verification-before-completion/SKILL.md 'Claim/Evidence Map' 'verification maps each claim to exact evidence'
require_text skills/verification-before-completion/SKILL.md 'fresh across messages.*bound inputs.*unchanged' 'verification freshness follows unchanged inputs rather than message boundaries'
require_text skills/verification-before-completion/SKILL.md 'Rerun.*claim (broadens|expands).*bound input.*changes.*external state' 'verification names evidence invalidation conditions'
reject_text skills/verification-before-completion/SKILL.md 'in this message' 'verification does not tie freshness to the current message'
reject_text skills/verification-before-completion/SKILL.md 'Moving to next task|Delegating to agents' 'verification does not gate task switching without a claim'

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
