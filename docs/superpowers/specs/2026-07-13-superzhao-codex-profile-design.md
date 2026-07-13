# Superzhao Codex Profile Design

**Date:** 2026-07-13
**Status:** Approved direction; awaiting written-spec review
**Upstream baseline:** `obra/superpowers` v6.1.1 (`d884ae04edebef577e82ff7c4e143debd0bbec99`)
**Distribution repository:** `zhaogewudi666/superzhao`

## Purpose

Create a separately maintained Superpowers distribution optimized for the current Codex App. Preserve Superpowers' engineering discipline where it changes outcomes, while removing workflow multiplication for read-only work and small, reversible changes.

The distribution must remain easy to update from `obra/superpowers`, easy to roll back, and explicit about which behavior differs from upstream.

## Observed Problem

The current upstream skills are already optimized relative to older releases, but the default trigger chain still treats every creative change as a full project. A one-line copy change can require project exploration, clarification, multiple approaches, design approval, a committed spec, written-spec approval, a detailed plan, worktree setup, TDD, an implementer subagent, a task reviewer, a final reviewer, repeated full-suite verification, and branch-finishing choices.

That workflow is justified for security, migrations, authentication, production deployment, and cross-system changes. It is disproportionate for read-only questions and low-risk edits. Some Codex-specific instructions also describe capabilities that the current tool surface does not expose, including subagent model selection, named `general-purpose` agent types, and `close_agent`.

## Design Principles

The fork retains these non-negotiable Superpowers principles:

1. Find root cause before changing code for bugs and unexpected behavior.
2. Prefer a failing behavioral test before implementing observable behavior changes.
3. Require fresh verification evidence before any success or completion claim.
4. Protect existing user changes and keep edits scoped.
5. Require explicit authorization for destructive actions, publication, deployment, and external side effects.
6. Use isolation, independent review, and rollback planning when risk warrants them.
7. Treat subagent reports as evidence to inspect, not completion proof.
8. Favor YAGNI, clear interfaces, small independently testable units, and systematic work over guessing.

The fork changes how much process is required, based on observable risk rather than perceived task simplicity.

## Risk Classification

Classify work before choosing process. When a task matches multiple levels, use the highest level.

| Level | Observable conditions | Required process |
|---|---|---|
| R0 — Read-only | Explanation, search, audit, status inspection, review without requested edits | Inspect directly; load only clearly matching domain skills; support conclusions with evidence. No brainstorming, TDD, worktree, spec, plan, or implementation subagent. |
| R1 — Low risk | Localized, reversible edit; no runtime behavior, data-contract, security, deployment, external-integration, or production-critical change; typically copy, comments, formatting, or a non-sensitive local configuration value | Confirm scope from context, edit directly, run the narrowest meaningful validation, inspect the diff. No mandatory spec, plan, worktree, subagent, review agent, or commit. |
| R2 — Medium risk | Bug fix, observable behavior change, public API change, or coordinated multi-file change without production-critical consequences | For bugs, investigate root cause first. Use test-first when behavior is automatable. Create a concise plan only when there are at least three dependent steps or multiple components. Use one independent review at the end when material logic changed. Run affected suites and relevant static/build checks. |
| R3 — High risk | Security, authentication, authorization, money, data migration, concurrency, destructive data operations, production deployment, external side effects, or cross-system change | Require written design and user approval, isolated worktree or equivalent, implementation plan, systematic debugging/TDD as applicable, task-boundary review, final whole-change review, full verification, rollback or compensation plan, and separate authorization for publish/deploy/destructive actions. |

Ambiguity that can materially change scope or outcome is an escalation condition. It does not turn every R1 task into R3; ask only the question needed to resolve the ambiguity.

## Skill Changes

### `using-superpowers`

- Replace the "1% chance" threshold with explicit matching and risk classification.
- Keep user-instruction precedence and the requirement to read a matching skill before acting.
- State that dispatched subagents do not recursively run the bootstrap unless their task explicitly requires a skill.
- Keep the bootstrap concise because its metadata and startup behavior are paid frequently.

### `brainstorming`

- Trigger when requirements are materially ambiguous, multiple viable designs have consequential trade-offs, architecture or interfaces must be chosen, or the work is R3.
- R0 and R1 do not trigger brainstorming.
- R2 may use a concise inline design without a document or approval gate when intent and interfaces are already clear.
- R3 retains the upstream sequence: explore, clarify, compare approaches, present design, obtain approval, write and self-review the spec, obtain written-spec approval, then plan.
- Keep the visual companion opt-in and only offer it for genuinely visual decisions.

### `writing-plans`

- Trigger for R3 and for R2 work with at least three dependent implementation steps or multiple components.
- Keep exact paths, interfaces, constraints, verification, and no-placeholder rules.
- Do not require complete production code inside plans when signatures, pseudocode, or acceptance criteria communicate the design more efficiently.
- Do not require a commit for every mechanical step. Commits should align with coherent, independently verifiable changes.

### `test-driven-development`

- Keep strict RED-GREEN-REFACTOR for observable logic, bug regressions, public contracts, security boundaries, and data behavior.
- Permit proportionate alternative validation for copy, comments, generated artifacts, throwaway exploration, and configuration without a practical automated-test surface.
- Never require deletion of pre-existing user code merely because it predates the current test cycle. Instead establish a failing regression or characterization test before changing the relevant behavior where practical.
- Record the reason whenever test-first is not practical and run the best available deterministic validation.

### `subagent-driven-development`

- Use only when task isolation materially improves reliability: R3, multiple independent implementation domains, or a written plan whose tasks benefit from fresh contexts.
- R1 uses no implementation or review subagent by default.
- R2 defaults to direct implementation plus one independent final review for material logic.
- R3 retains a fresh implementer and task review at meaningful task boundaries, plus a final whole-change review.
- Always pass an explicit `fork_turns` value. Do not reference unsupported model selection, named agent types, or `close_agent`.
- Respect the current four-slot team limit and do not parallelize writers against shared files or a shared branch.

### Worktree, review, finishing, and verification skills

- Require a worktree for R3, parallel writers, dirty overlapping work, or long-lived isolated changes; otherwise detect existing isolation and continue in place.
- Keep technical evaluation of review feedback and allow evidence-backed disagreement.
- Do not force branch-finishing menus for a task that did not create or manage a branch.
- Keep fresh verification mandatory, but scale scope: targeted checks for R1, affected suites for R2, complete suites and rollback/compensation checks for R3.

### Codex platform reference

- Remove `close_agent` guidance.
- Do not require `[features] multi_agent = true` when the runtime already exposes collaboration tools.
- Document `spawn_agent(task_name, message, fork_turns)` as the available dispatch shape.
- Use `followup_task` for another turn on an existing agent and `interrupt_agent` only for interruption, not cleanup.
- Detect worktree, branch, remote, authentication, and sandbox capabilities instead of assuming detached HEAD universally prevents branch, push, or PR operations.
- Describe the visual companion as a bundled local workflow, not a native tool.

## Repository and Update Model

- `origin` points to `zhaogewudi666/superzhao` and publishes the customized stable distribution.
- `upstream` points to `obra/superpowers` and is fetch-only in normal maintenance.
- `main` is the tested Superzhao distribution.
- Each upstream update starts by fetching and inspecting `upstream/main`, merging it into a temporary update branch, preserving upstream changes first, then reapplying or reconciling the small Codex profile patch.
- Custom behavior should stay concentrated in the minimum number of skills and Codex references. Avoid unrelated reformatting so future upstream diffs remain reviewable.
- Do not open fork-specific pull requests against `obra/superpowers`.

## Installation and Rollback

Before activating the fork:

1. Copy all currently active Superpowers skill directories to a timestamped backup under `~/.codex/backups/`.
2. Record the active source SHA and a checksum manifest.
3. Validate the customized checkout before copying its skill directories into `~/.codex/skills`.
4. Preserve non-Superpowers personal skills.

Rollback restores the timestamped directory snapshot, revalidates checksums, and starts a new Codex task so skill discovery is refreshed.

## Evaluation Strategy

Skill changes follow RED-GREEN-REFACTOR for process documentation.

### Existing RED baseline

- Small copy-change scenario: upstream routes through the full design, spec, plan, worktree, TDD, three subagent roles, repeated verification, and branch-finishing chain.
- High-risk multi-tenant billing scenario: upstream correctly demands decomposition, design approval, migration and rollback planning, TDD, task review, whole-branch review, and full verification, but refers to unsupported Codex agent model/type/cleanup controls.

### GREEN routing tests

Use fresh-context runs, with at least five repetitions for each behavior-shaping variant:

1. R0 explanation or audit does not trigger implementation workflows.
2. R1 copy/config edit proceeds directly with targeted validation.
3. R2 bug fix triggers root-cause analysis, regression testing, affected-suite verification, and at most one final review by default.
4. R3 security or migration feature retains the full design, isolation, TDD, review, verification, and rollback chain.
5. Ambiguous work asks the minimum blocking question and escalates only when the answer changes risk or architecture.

Manually inspect every run for false-positive triggers, missing safeguards, invented Codex tools, and unnecessary user gates. Single samples are not sufficient.

### Structural and regression checks

- Validate YAML frontmatter and skill directory names.
- Check internal links and referenced files.
- Search for removed Codex tool names and unsupported dispatch parameters.
- Run upstream plugin and skill tests that are available without unrelated external credentials.
- Compare word counts and startup metadata size with upstream.
- Run `git diff --check` and inspect the complete fork diff.
- Forward-test the installed skills in a new Codex task after activation.

## Success Criteria

The fork is ready to publish and activate when:

1. The checkout is based on the latest verified upstream release.
2. R0/R1 scenarios avoid full planning and multi-agent chains in all evaluated runs.
3. R2 scenarios retain root-cause, test, review, and verification discipline without mandatory spec/plan overhead when the task is already clear.
4. R3 scenarios retain all safety gates in all evaluated runs.
5. No customized skill instructs Codex to use unavailable tools or parameters.
6. Upstream structural tests and all local validations pass.
7. A complete backup and tested rollback path exist before activation.
8. The full diff is committed to `zhaogewudi666/superzhao`, with `obra/superpowers` retained as the upstream remote.

## Non-Goals

- Rewriting every upstream skill.
- Removing TDD, systematic debugging, independent review, or evidence-based completion.
- Optimizing for the shortest possible response at the cost of correctness.
- Adding third-party runtime dependencies.
- Publishing fork-specific changes back to the upstream project.
