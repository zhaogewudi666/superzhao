# Superzhao Adaptive Control Plane v2

> **SUPERSEDED — HISTORICAL, NON-EXECUTABLE.** The 2026-07-15 user scope override
> canceled Task 2B/2C installation-platform, bound-plan, journal, and SIGKILL
> recovery work. Only timeout support, Task 2A profile integrity, and the 14-Skill
> behavior optimization were retained. The design below records the earlier
> proposal; its unimplemented control-plane provisions are not authorization or
> pending work and must not be resumed.

**Date:** 2026-07-14
**Status:** Superseded historical proposal; non-executable since 2026-07-15
**Risk:** R3 — this changes the behavior-shaping profile installed into Codex
**Base:** `e8e5a618d7f1bfa4b88ec298c8c500e2fda42295`

## Purpose

Superzhao should help a capable model reason and act safely without replacing its
reasoning with a fixed ceremony. The profile therefore becomes a thin adaptive
control plane:

- the model owns exploration, decomposition, implementation choices, and safe
  local recovery;
- the framework owns authorization boundaries, isolation, durable state,
  evidence integrity, independent review, rollback, installation, and publish
  controls.

The target is capability-based rather than tied to one model name. A current
Codex model may be stronger than the model used to author a Skill, so Skills
define triggers, invariants, output contracts, and proof obligations instead of
micromanaging a universal sequence.

## Evidence Considered

This design combines the strongest ideas found in three inspected systems while
rejecting their failure modes:

- Comet `master@4dcf177cf4d65246241e7633bd5ce063bac3a046`:
  deterministic routing, content-addressed Skill snapshots, hash-bound gates,
  file handoffs, checkpointing, dirty-tree attribution, and installation
  preview. We do not adopt its fixed five-stage/nine-blocking-point flow,
  self-reported command evidence, bypass switches, or single-sample benchmark.
- OpenSpec `main@0a99f410457271aa773d8b106f03f637f7c6b3c0`:
  current truth plus change deltas, proposal/spec/design/tasks artifact graph,
  fluid actions, living plans, machine-readable CLI contracts, validation, and
  archival. We do not require every artifact for every task or equate checkbox
  completion with proof.
- HexLM planning archive, SHA-256
  `cb19a0d869f59a264289da72e34b79d05a4e9109f328aebd1e2fdd2596e22061`:
  practical roadmap/proposal/design/spec/tasks examples and validation notes.
  We do not copy its missing canonical-spec layer, ambiguous completion claims,
  static authorization assumptions, or undisclosed AI provenance.

## Design Principles

1. **Safety and complexity are independent.** A security audit can be read-only;
   a harmless refactor can be coordinated and long-running.
2. **Contracts over choreography.** Define what must be understood, preserved,
   produced, and proven; let the model choose an efficient route.
3. **Evidence is directly observed and content-bound.** A model report or a
   receipt file supplied by a task writer is useful context, never sole proof
   that a command ran or a tree was verified. The controller or harness must
   observe the execution and independently check its bound state.
4. **Authorization is narrow and expiring.** Bind it to an action, target,
   content state, scope, authorizer, and time. Reconfirm when any bound field
   changes materially.
5. **One canonical truth.** Git plus approved artifacts are canonical. The
   controller writes events and receipts as an append-only operational log;
   progress views are derived and rebuildable.
6. **Progressive disclosure.** Frequently loaded Skill entrypoints stay short;
   detailed recipes and platform references load only when needed.
7. **Proportional proof, never absent proof.** R1 needs targeted validation, R2
   affected-surface evidence, and R3 whole-change plus rollback evidence.
8. **No hidden bypass.** Urgency, confidence, or a generic request to “just do
   it” cannot waive destructive, publish, deploy, external, or R3 safety gates.

## Two-Axis Routing

### Safety axis

Keep R0–R3. Classify the requested action and its consequences, not the topic.
Use the highest applicable consequence.

| Level | Meaning | Minimum control |
|---|---|---|
| R0 | Read-only inspection, explanation, research, audit, or review | Evidence-backed answer; no implementation workflow |
| R1 | Localized, reversible, non-behavioral local change | Direct edit, diff inspection, targeted validation |
| R2 | Behavior, bug, public contract, or coordinated local change | Root-cause/test discipline as applicable, affected verification, independent final review for material logic |
| R3 | Security/auth, money, migration, concurrency, destructive data, production/private operations, external side effects, or cross-system change | Approved artifacts, isolation, proof-driven implementation, independent review, full verification, rollback/compensation, point-of-execution authorization |

### Work-shape axis

A task may acquire more than one flag while it evolves.

| Shape | Observable condition | Adaptive control |
|---|---|---|
| `clear` | Goal, boundaries, and acceptance are already concrete | Execute directly within the risk controls |
| `ambiguous` | An answer can materially change architecture, scope, or outcome | Resolve only the blocking uncertainty; record decisions |
| `coordinated` | Three or more dependent steps, multiple components, or independent workstreams | Living plan, explicit interfaces, capability-scoped delegation |
| `long-running` | Multiple sessions, compaction risk, handoffs, or delayed external state | Context Capsule, append-only events/receipts, resumable derived view |

Risk chooses safety gates. Work shape chooses how much discovery, planning,
coordination, and durable context is useful. Neither axis mechanically expands
the other.

## Minimal Task Contract

Before consequential work, establish only the fields needed to avoid divergence:

```yaml
goal: concrete outcome
context: relevant repository, artifacts, and observed state
constraints_invariants: facts and safety properties that must remain true
done_when: observable acceptance and required evidence
out_of_scope: explicitly excluded work
authorization_state: allowed actions plus actions requiring fresh authorization
```

For R0/R1 this may remain implicit in the request and a short working note. For
coordinated, long-running, or R3 work it becomes a versioned artifact bound to a
base commit and content digest.

## Optional Change Packet

Use a durable packet only when the change is R3, changes a durable contract, or
must survive handoffs. It is a dependency graph, not a mandatory phase list:

```text
proposal -> spec delta -> design -> living tasks
```

- `proposal`: why this outcome belongs in scope.
- `spec delta`: observable behavior added, changed, or removed.
- `design`: consequential decisions, interfaces, failure handling, and rollback.
- `living tasks`: dependency-aware execution and evidence links.

Omit artifacts that add no decision or handoff value. If intent or safety
invariants change, create a new approved version. If only implementation detail
changes, update the living plan and record the reason.

## Evidence Architecture

### ActionReceipt

Commands used as evidence run through a repository-owned, zero-third-party
wrapper. It emits a versioned JSON receipt containing at least:

```json
{
  "schema": "superzhao.action-receipt/v1",
  "id": "sha256 of canonical receipt body",
  "label": "human-readable claim",
  "argv_display": ["tool", "arg", "[REDACTED]"],
  "cwd": "/absolute/path",
  "started_at": "RFC3339",
  "ended_at": "RFC3339",
  "duration_ms": 0,
  "exit_code": 0,
  "stdout": {"bytes": 0, "sha256": "..."},
  "stderr": {"bytes": 0, "sha256": "..."},
  "repository": {
    "root": "/absolute/path",
    "head_before": "...",
    "head_after": "...",
    "workspace_before": "...",
    "workspace_after": "...",
    "changed_paths_before": [],
    "changed_paths_after": []
  },
  "runner": {"name": "superzhao-action-receipt", "version": 1}
}
```

The wrapper captures the process directly, streams its output, and writes the
receipt atomically. Non-sensitive arguments are recorded faithfully. Known
credential flags, authorization headers, and URL user-info are rejected or
redacted without storing a reversible value or digest; secrets belong in a
non-recorded environment or file descriptor.

A repository receipt is an integrity-checked execution record, not a
cryptographic attestation. A same-privilege writer can fabricate a JSON file and
its hash. It becomes acceptable evidence only when the controller or an isolated
harness invokes the runner, directly observes its process result, writes into a
controller-owned `0700` location outside the writer's owned scope, and
immediately verifies the receipt against the current workspace. A child-supplied
receipt never replaces controller re-execution or harness-observed tool events.
This threat-model limit must remain explicit in every Skill that cites receipts.

### Bound artifacts

Approval, review, evaluation, installation, and publication records carry:

- artifact/profile digest;
- base and current commit when applicable;
- changed-path scope;
- authorizer or runner identity;
- timestamp;
- linked receipts;
- invalidation reason when scope or content changes.

### State model

There are only two operational layers:

1. a controller-written event/receipt ledger for directly observed facts;
2. a derived progress view that can be rebuilt from canonical artifacts and the
   ledger.

The ledger is append-only by workflow convention, not tamper-proof against a
same-user malicious process. Checkboxes are a view. They never replace an output
artifact, direct observation, or a freshly verified receipt.

## Skill Profile Integrity

The managed Skill list has one repository source. A deterministic manifest
sorts every managed path, rejects symlinks and unsupported entries, hashes file
bytes and modes, then derives a profile SHA-256. The same digest binds:

- baseline and candidate behavior evaluations;
- installation preview;
- installed backup metadata;
- post-install verification;
- final publish evidence.

The preview reports missing, added, changed, and identical managed Skills before
mutation. Because unrelated personal Skills prevent replacing the whole Skills
root atomically, installation is explicitly **crash-recoverable**, not falsely
described as a single atomic swap. Before the first managed-directory move it
publishes a persistent recovery journal containing the plan, backup path,
original inventory, and per-entry progress. Normal errors/signals roll back
immediately; an uncatchable interruption such as `SIGKILL` is detected and
recovered by the next profile operation before any new mutation. The journal is
cleared only after live-tree verification and backup-pointer publication.

## Behavior Evaluation

Static contract checks catch broken links, unsupported tool names, and missing
invariants, but cannot establish agent behavior. A live harness therefore runs
fresh isolated sessions against a named profile digest.

Each run records the prompt/scenario digest, profile digest, harness and config
overlay digests, requested model or explicit `runtime-default` label, CLI
version, base commit, tool-event transcript digest, filesystem/Git delta,
deterministic assertions, and independent human/agent review notes. A named
model is a pinned evaluation parameter, not a Skill routing rule; availability
is preflighted and the observed value is recorded. Important wording variants
run at least five times. Reports show counts and raw failures; no `pass@1` or
invented `pass^k` statistic is accepted.

The harness copies only the required authentication file into a freshly created
`0700` private root after rejecting symlinks and non-regular files. The copy is
`0600`, is outside fixtures/results, and is never enumerated into receipts. A
separate cleanup supervisor removes it when the harness pipe closes, including
after an uncatchable parent-process termination. Normal success/error/signal
paths also remove it, and every harness startup securely sweeps stale marked
roots left by process-group termination or host failure before creating a new
one. Results are retained only after the credential path is absent.

The suite covers:

- R0 security audit remains read-only and avoids implementation ceremony;
- R1 copy/config change acts directly with targeted proof;
- R2 bug establishes root cause, meaningful RED/GREEN evidence, affected
  verification, and proportionate review;
- R3 security/migration preserves approval, isolation, rollback, review, full
  verification, and execution-time authorization;
- user changes intent after approval;
- dirty overlapping worktree;
- context compaction or handoff;
- tool failure and safe fallback;
- fabricated child-agent test output;
- verification followed by content drift;
- push authorization bound to an earlier commit.

For an existing Skill, RED is its immediate parent profile versus the new
acceptance contract; a no-Skill control is supplemental. Each commit changes one
Skill contract (plus its directly coupled reference/tests), so the parent versus
candidate result is attributable. The original profile versus final integrated
profile campaign separately detects interactions.

Every candidate important scenario and over-trigger control must produce five
valid passes out of five; any valid failure rejects the candidate. Indeterminate
runs remain visible and additional runs are collected until five valid samples
exist. Each scenario declares forbidden side effects/artifacts and an objective
ceremony count; a directness control requires zero forbidden actions in every
candidate run and cannot be worse than its parent. If the parent already passes
5/5, a rewrite proceeds only for a documented shared-contract/integrity reason
and must remain 5/5. Wilson intervals and median cost are descriptive, never a
substitute for these absolute gates.

## Contracts for the 14 Managed Skills

| Skill | Optimized contract |
|---|---|
| `using-superpowers` | Short two-axis router plus Task Contract entrypoint; announce only when a Skill changes action or adds a gate |
| `brainstorming` | Produce decision-complete design output; no fixed interview count or universal phase order; hash-bound R3 approval |
| `writing-plans` | Living dependency/output plan; exact detail only where ambiguity is dangerous; proof links, not checkbox faith |
| `executing-plans` | Adapt implementation details safely; reapprove only material intent/scope/invariant/authorization drift |
| `dispatching-parallel-agents` | Capability-scoped Context Capsules; dynamic capacity; parallel writers only with real isolation |
| `subagent-driven-development` | Implement/verify/review/integrate capabilities, hash-bound handoffs, controller proof, resumable ledger |
| `systematic-debugging` | Root-cause evidence contract scaled to uncertainty; no arbitrary phase or attempt count |
| `test-driven-development` | RED/GREEN receipts bound to content; one proof per changed observable behavior, not per function |
| `requesting-code-review` | Review manifest bound to full diff, requirements, profile/tree, open questions, and verification receipts |
| `receiving-code-review` | Finding decision record; independently actionable findings need not wait for unrelated ambiguity |
| `verification-before-completion` | Claim/evidence map; freshness means unchanged bound inputs, not “same message” |
| `using-git-worktrees` | Ownership/base/scope record, safe default isolation, dependency preview, risk-appropriate clean baseline |
| `finishing-a-development-branch` | State-by-action contract, content-bound authorization, remote-ref proof, ownership-safe cleanup |
| `writing-skills` | Compact authoring/eval contract; current-vs-candidate behavior evidence; crash-recoverable profile deployment after per-Skill results |

## Authorization and Publication

Generic authorization to work does not imply authorization to destroy, publish,
deploy, operate on private/production systems, or create external side effects.
At execution time, record the requested action, remote/target, branch/ref,
current HEAD, profile/tree digest, scope, and authorizer. If any bound value
changes, authorization must be reassessed.

For this implementation, the user explicitly requested updating the local
Skills, committing, and pushing this repository. A repository approval record
binds that instruction to the finalized design digest and records that it was
transcribed by the agent rather than cryptographically signed by the user. At
execution time the actual integration branch, remote URL, destination ref, and
HEAD are detected and checked against the record's authorized repository URL and
destination ref. This authorizes only an
ordinary non-force push of the completed reviewed scope to the user's fork. It
does not authorize an upstream PR, force-push, deployment, or destructive
cleanup of user-owned work.

## Compatibility and Failure Handling

- Runtime dependencies remain repository/platform built-ins; no third-party
  package is added.
- macOS and Linux command differences are handled explicitly. Tests must not
  assume GNU `timeout` exists.
- Receipt or manifest failure is fail-closed for any claim that depends on it;
  a receipt is never treated as an adversarial trust boundary.
- A failed install restores the prior profile immediately when possible. A
  persistent journal makes partial installation discoverable and recoverable
  after uncatchable interruption, while preserving diagnostics on failure.
- A failed live eval is reported as a failed run, never silently retried into a
  passing statistic.
- Tool unavailability chooses a safe equivalent or produces a precise blocker;
  the model must not invent a result.

## Success Criteria

The work is complete only when:

1. all 14 managed Skill entrypoints implement the contracts above and retain
   their safety invariants;
2. entrypoints are materially shorter or route detail progressively, without
   hiding required gates;
3. static tests, receipt/manifest tests, install/rollback tests, shell checks,
   and relevant upstream tests pass on the final tree;
4. each Skill has immediate-parent-versus-candidate behavior evidence with 5/5
   valid passes for its important and over-trigger-control scenarios;
5. every R0/R1 directness control has zero forbidden ceremony, every R2 proof
   obligation passes 5/5, and every R3 safety scenario passes 5/5;
6. local installation preview names the exact profile digest, transactional
   install succeeds, and installed managed files reproduce that digest;
7. rollback is rehearsed in isolation before the real local update;
8. an independent whole-change review closes all material findings;
9. the detected, authorized integration ref is pushed without force to the
   detected fork remote, and an explicit equality assertion proves the remote
   ref equals the local pushed SHA.

## Explicit Non-Goals

- A fixed stage machine, mandatory artifact bundle, or universal agent topology.
- Automatic production deployment, destructive cleanup, upstream PR creation,
  or force-push.
- Replacing model judgment with keyword routing.
- Treating prose claims, checkboxes, or child-agent summaries as execution proof.
- Hard-coding a model name, concurrency count, branch layout, authentication
  state, or platform command into Skill behavior when the runtime can detect it.
  A named model may be pinned as an explicit, recorded evaluation variant.
