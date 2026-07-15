---
name: dispatching-parallel-agents
description: Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies
---

# Dispatching Parallel Agents

## Overview

You delegate tasks to specialized agents with deliberately selected context. By precisely crafting their instructions and context window, you keep them focused while providing any history they genuinely need. This also preserves your own context for coordination work.

When you have multiple unrelated failures (different test files, different subsystems, different bugs), investigating them sequentially wastes time. Each investigation is independent and can happen in parallel.

**Core principle:** Dispatch one agent per independent problem domain. Let them work concurrently.

## Risk and Concurrency Gate

A multi-part request is not by itself a reason to start parallel implementation writers. Route by risk before dispatching:

- **R0:** Use read-only agents in parallel only for material reliability or latency benefit, with no side effects; never start implementation writers.
- **R1:** direct execution is the default; do not dispatch implementation writers merely because the request has several parts.
- **R2/R3:** Dispatch in parallel only when tasks belong to independent domains and the reliability benefit is clear; otherwise keep the work with one agent or sequence it.

Detect runtime capacity and current live agents before every dispatch batch. Use only available slots and reduce the batch when the tool reports a lower limit; never encode one harness's topology as a universal rule.

Implementation writers that share a checkout, branch, or files must not run in parallel. Give writers separate isolated worktrees with disjoint ownership, or sequence them. Read-only investigation can share a checkout only when it cannot mutate generated files, caches, locks, or other state.

## When to Use

Use parallel agents only when domains can be understood independently, simultaneous work has a material reliability or latency benefit, and their reads or writes cannot interfere. Sequence related failures, dependent tasks, shared external state, or work that needs one coherent system model.

## The Pattern

### 1. Identify Independent Domains

Group failures by what's broken:
- File A tests: Tool approval flow
- File B tests: Batch completion behavior
- File C tests: Abort functionality

Each domain is independent - fixing tool approval doesn't affect abort tests.

### 2. Create Context Capsules

Every task gets a **Context Capsule**: capability, goal, inputs, invariants, owned paths, expected artifacts, evidence, authorization, and a deliberate `fork_turns` choice. Include only the context needed to satisfy that contract.

Before dispatching implementation writers, assign each a separate isolated worktree and branch plus an owned file scope, and put those exact boundaries in the prompt. If separate isolation is unavailable, dispatch read-only investigators or run the writers sequentially.

### 3. Dispatch in Parallel

Use `spawn_agent(task_name, message, fork_turns)` for each dispatch. Choose `fork_turns` deliberately for every call:

- `"none"`: no inherited conversation; the message and referenced files are self-contained.
- A positive integer string: only that recent conversation window is inherited.
- `"all"`: the full conversation is inherited because the task genuinely requires it.

Spawn the batch without waiting for any child to finish:

```text
spawn_agent(task_name="fix_abort", message="In isolated worktree <abort-path> on <abort-branch>, fix agent-tool-abort.test.ts only", fork_turns="none")
spawn_agent(task_name="fix_batch", message="In isolated worktree <batch-path> on <batch-branch>, fix batch-completion-behavior.test.ts only", fork_turns="none")
spawn_agent(task_name="fix_approval", message="In isolated worktree <approval-path> on <approval-branch>, fix tool-approval-race-conditions.test.ts only", fork_turns="none")
# All three run concurrently.
```

`spawn_agent` returns while its child may keep running, so one call per response is not sequential by itself. Sequential execution means waiting for the current child to finish before spawning the next; a parallel batch spawns without waiting, then checks live capacity and status.

### 4. Review and Integrate

When agents return:
- A child report is not proof; the controller inspects the actual diff, current evidence, and ownership boundaries
- Verify fixes do not conflict and run the integration-appropriate checks
- Integrate only the verified artifacts

## Agent Prompt Structure

```markdown
Capability: [investigate | implement | review | verify]
Goal: [one observable outcome]
Inputs: [paths, failures, source state]
Invariants: [behavior and safety boundaries]
Owned paths/state: [exact write ownership, or read-only]
Expected artifacts: [patch, findings, proof]
Evidence: [commands or observations required]
Authorization: [allowed actions and explicit exclusions]
Context inheritance: fork_turns=[none | N | all] because [reason]
```

## Guardrails

- Do not split related failures merely because they appear in different files.
- Do not let multiple writers share a checkout, branch, owned path, lock, generated output, or external target.
- Do not use a broad prompt to compensate for unclear task boundaries; investigate the dependency first.
- Do not accept a summary as integration proof or let a child perform an unauthorized external action.

After children return, inspect their actual artifacts and current state, resolve overlap, and run the checks needed for the integrated claim. The controller owns the final result.
