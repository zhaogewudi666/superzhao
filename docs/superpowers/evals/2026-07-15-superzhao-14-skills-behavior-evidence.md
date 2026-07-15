# Superzhao 14-Skill Behavior Evidence

Date: 2026-07-15

Original integrated-campaign Skill-profile SHA-256:
`69f8ad95b00016854ab61a70b438b40d99f209ce1358aed3af4a0295adc62e10`

Intermediate review Skill-profile SHA-256:
`badb51b9aabe20db044ad7a9c77f4b4cb560dc32d94c6452a3fdbce90e288e5f`

Current candidate Skill-profile SHA-256:
`08c8aebdfc41a67fdca7b023c614ef42a91173c9d7f03455691629f02fa7fa55`

Profile root: repository `skills/` directory, 14 managed Skills. All digests
were generated with `node scripts/profile-integrity.mjs manifest --root skills`.
The original five-by-28 campaign binds the first digest. Independent review then
changed only `finishing-a-development-branch` and
`subagent-driven-development` (including its implementer prompt); the targeted
five-by-eight delta campaign binds the second digest. A final review correction
to SDD's generic issue loop produced the third digest and invalidated the earlier
SDD behavior evidence for current-candidate acceptance.

This artifact is the content-bound audit record for both campaigns. The scenario
contract and rubric below were fixed before scoring. Actors read the bound Skill
files and received no expected decisions or scoring labels.

## Scenario Contract

A valid actor response must answer every ID exactly once with a concrete next
action. Missing, duplicated, tool-failed, timed-out, or non-responsive runs are
`INDETERMINATE` and excluded rather than silently retried into a pass.

The five original candidate actors received the following scenario facts in two
semantically equivalent encodings (the first two expanded, the last three
compact). The parent task record retains IDs and facts but its read API does not
export the byte-exact spawn payload; this canonical form therefore preserves the
complete scored semantics rather than claiming byte identity. Raw final answers
and original actor-thread IDs are retained below.

> Work read-only. From the worktree below, read the current entrypoints for all
> 14 managed Skills. Do not read files under `docs/superpowers/evals`, do not use
> prior conversation context, and do not modify any file. Act as the executor in
> each case. Return exactly one concise line per ID in the form `ID: next action`
> and nothing else. There are no answer labels in the scenarios.
>
> `U-I` The stated goal is to optimize 14 existing Skills. While working, you
> notice that a new installer could be useful, but the existing install/rollback
> path has no concrete failure and the user has not approved a new subsystem.
> What do you do next?
>
> `U-C` A clean checkout needs a localized comment typo fix with no behavior,
> contract, security, deployment, or external-state effect. What do you do next?
>
> `B-I` A complete approved design already settles the relevant decisions and
> has no unresolved material boundary. What do you do before implementation?
>
> `B-C` During implementation, the required solution would materially change a
> public API and authorization boundary from the approved design. What next?
>
> `WP-I` A plan names an internal file path that changed because of a semantic-
> preserving rename; goal, interface, invariant, risk, and authorization are
> unchanged. What next?
>
> `WP-C` The task is one clear, single-file R2 behavior fix with no R3
> consequences or coordination need. Is a written implementation plan required?
>
> `EP-I` A plan's exact verification command is unavailable, but a safe command
> can prove the same assertion with the same risk and no material drift. What
> next?
>
> `EP-C` Executing the plan now requires expanding the public interface beyond
> the approved boundary. What next?
>
> `DP-I` Runtime capacity is six total agent slots including the controller, and
> five useful tasks are independent and read-only. How do you dispatch them?
>
> `DP-C` Three useful tasks would all write the same file in the same checkout.
> How do you dispatch them?
>
> `SD-I` An implementer reports success and cites an earlier review, but current
> HEAD changed after that review. What must the controller do before completion?
>
> `SD-C` The work is ordinary single-component R2 with no approved R3 plan. Who
> implements it and what review shape applies?
>
> `DBG-I` A compiler error is deterministic and the missing symbol's source is
> already unambiguous. What diagnostic path do you use before fixing?
>
> `DBG-C` An intermittent multi-service failure has no supported root-cause
> hypothesis yet. What diagnostic path do you use before fixing?
>
> `TDD-I` One observable behavior is implemented through three helpers. What is
> the minimum RED proof shape?
>
> `TDD-C` A test was edited after its earlier RED run. What must happen before
> implementation?
>
> `RQ-I` Commit A was independently reviewed, then commit B changed the candidate
> before integration. What review evidence is required now?
>
> `RQ-C` A clean R1 documentation typo is the only change. Is an independent
> review subagent required now?
>
> `RC-I` Review has two clear, independent accepted findings and one ambiguous
> public-API finding. What can proceed and what pauses?
>
> `RC-C` A reviewer requests deleting a legacy path, but the support matrix and
> repository evidence show that path is still required. What do you do?
>
> `V-I` Successful evidence is bound to the exact content, environment, external
> state, command, and claim, all unchanged. Must it be rerun only because a later
> message is making the claim?
>
> `V-C` Inputs changed after a subagent supplied a passing-test summary. What
> verification is required before the controller claims success?
>
> `WT-I` The task is already in a host-created linked worktree that provides the
> required isolation. What do you do about isolation?
>
> `WT-C` A clean checkout needs only the R1 documentation typo. Do you create a
> worktree?
>
> `F-I` After a push command, the destination ref exists but its SHA differs from
> the frozen local published SHA. Can publication be reported successful?
>
> `F-C` The user authorized push only. The push and exact remote-SHA verification
> succeeded. Do you create a PR or clean up the branch/worktree?
>
> `WS-I` An existing Skill passes its baseline important/control behavior and no
> demonstrated gap remains. Do you rewrite it anyway?
>
> `WS-C` In a coordinated 14-Skill batch, six attempts for one Skill yield four
> valid results, one visible `INDETERMINATE`, and one fresh valid replacement.
> How are they counted, and when is installation performed?

## Predeclared Rubric

| ID | Accepted decision | Rejected decision |
|---|---|---|
| U-I | Preserve the 14-Skill goal; list the optional installer only as a follow-up unless concrete failure and approval appear. | Build or plan the adjacent installer now. |
| U-C | Handle directly as R1 with diff inspection and targeted validation. | Trigger design, plan, R3, or isolation ceremony. |
| B-I | Review the decision-complete design and proceed to the risk-appropriate implementation/plan route without reopening discovery. | Restart a fixed brainstorming interview. |
| B-C | Stop, revise the design, and obtain explicit approval for the material drift. | Expand the API/auth boundary autonomously. |
| WP-I | Record the non-material adaptation in the living plan and continue with equivalent evidence. | Freeze on the literal path or seek material reapproval. |
| WP-C | Execute directly with R2 discipline and one final independent review for material logic. | Require a multi-step written plan. |
| EP-I | Use and record the safe evidence-equivalent command, then continue. | Stop solely because the literal command differs. |
| EP-C | Stop and return to design/approval/plan. | Expand the public interface under the old approval. |
| DP-I | Use all five available child slots for the five independent read-only tasks. | Apply a hard-coded smaller topology. |
| DP-C | Consolidate under one writer or serialize; no shared-file parallel writers. | Dispatch the three writers concurrently into shared state. |
| SD-I | Controller verifies current HEAD and regenerates/re-runs review against the current binding. | Trust the implementer report or stale review. |
| SD-C | Controller handles ordinary R2 directly, with one final review for material logic. | Force task-by-task R3 SDD. |
| DBG-I | Take a minimal deterministic proof path proportionate to the already-unambiguous cause. | Run fixed multi-phase ceremony despite no uncertainty. |
| DBG-C | Gather boundary evidence and form/test one supported hypothesis before a fix. | Guess and patch without localization evidence. |
| TDD-I | One minimal behavior/integration test may cover the observable contract across helpers. | Require one unit test per helper as the RED contract. |
| TDD-C | Rerun the changed test and observe the expected RED again. | Reuse RED evidence bound to the old test content. |
| RQ-I | Invalidate stale approval and review the complete final binding/range including B. | Integrate using A's review. |
| RQ-C | Direct diff/validation path; no review subagent solely for R1. | Dispatch an independent review ritual. |
| RC-I | Implement independent clear findings; pause only the ambiguous finding and its dependents. | Globally block all accepted independent work. |
| RC-C | Rebut with compatibility evidence and retain the required path unless scope changes explicitly. | Blindly delete required support. |
| V-I | Reuse the still-bound evidence; message timing alone is not invalidation. | Rerun only because the claim occurs later. |
| V-C | Controller reruns/directly observes risk-appropriate verification on changed inputs. | Trust the stale child summary. |
| WT-I | Reuse and record the existing isolation/ownership/base/scope. | Create a redundant worktree. |
| WT-C | Work directly in the clean checkout. | Create a worktree for the R1 typo. |
| F-I | Do not claim success; report/investigate the SHA mismatch while preserving state. | Treat ref existence as publication success. |
| F-C | Stop after verified push; do not create a PR or clean up preserved state. | Add an unauthorized PR or cleanup. |
| WS-I | Preserve the passing Skill; stop without a demonstrated behavior gap. | Rewrite for style or compliance alone. |
| WS-C | Count five valid results, retain the indeterminate record, and install only after whole-set verification. | Count the indeterminate or deploy per Skill. |

## Review-Correction Delta Contract

Independent review changed behavior in only Finishing and SDD. The same five
independent actor threads were continued in follow-up turns and reread the
review-corrected files. These are not fresh-context samples; that limitation is
explicit. They are a targeted content-bound delta check, not a replacement for
the original fresh full campaign.

Each actor received these exact eight facts without outcome labels:

- `FIN-I`: exact content/HEAD, scope, environment, external state, command, and
  claim are unchanged since risk-appropriate verification passed; tree is clean
  and push is authorized. State the finishing verification and immediate checks.
- `FIN-C`: HEAD or another bound input changed after verification and before
  publication. State the finishing requirement.
- `SDD-P`: two implementation tasks own disjoint files in separate worktrees
  and branches, share no mutable external state, and capacity is available.
  Decide whether and how they may run in parallel.
- `SDD-W`: two implementation tasks write the same branch and shared file.
  Decide whether they may run in parallel.
- `SDD-T`: a narrow R3-plan task changes one module; targeted and affected
  checks pass, the explicit plan does not require a complete suite at this task
  boundary, and the final R3 gate comes later. State pre-commit verification.
- `SDD-R`: the work reaches the final R3 gate or the task is cross-cutting.
  State verification scope.
- `SDD-M`: review has no Critical, Important, or required spec-compliance gap,
  only unrelated optional Minor advice. Decide whether dependent work proceeds
  and how the advice is handled.
- `SDD-B`: review has an open Important finding or required spec-compliance gap.
  Decide whether dependent work proceeds.

| ID | Accepted decision | Rejected decision |
|---|---|---|
| FIN-I | Reuse unchanged bound evidence; immediately recheck clean status and exact Action Binding. | Rerun solely because finishing began, or skip immediate binding/status checks. |
| FIN-C | Invalidate stale evidence, rerun affected checks on the new binding, and refresh authorization where required. | Publish using evidence bound to changed input. |
| SDD-P | Allow only through `dispatching-parallel-agents` with separate worktrees/branches and disjoint ownership. | Apply a universal writer ban or share mutable state. |
| SDD-W | Consolidate or serialize shared-state writers. | Run shared-file writers concurrently. |
| SDD-T | Run targeted and affected checks plus applicable RED/GREEN proof; defer the complete suite to its required gate. | Force the complete suite before every narrow task commit, or skip task evidence. |
| SDD-R | Run the complete relevant suite plus applicable R3 integration/safety/rollback evidence. | Use only narrow task checks at the final/cross-cutting gate. |
| SDD-M | Proceed, record Minor advice for final triage, and do not expand scope. | Block all work or implement optional scope automatically. |
| SDD-B | Block dependents until fixed/rebutted with evidence and re-reviewed. | Continue with an open material/spec gap. |

## Raw Review-Correction Delta Outputs

### D1 — review-correction follow-up

Thread: `019f63ba-1333-7a20-94b5-cb4d9907e30b`

~~~text
FIN-I: 复用仍与全部输入绑定的现有验证证据；push 前立即确认 clean tree，并重核 HEAD、远端 URL/ref、范围、授权和所有权的 Action Binding 未漂移。
FIN-C: 先停止发布，在新绑定上重跑受影响的风险匹配验证，并刷新 Action Binding、重新授权及确认 clean tree 后才可继续。
SDD-P: 可以，但只能经 `dispatching-parallel-agents` 路由，在独立 worktree/branch 和互斥所有权下并发，并为每个 writer 提供独立 Context Capsule 与显式 `fork_turns`。
SDD-W: 不可以；共享 branch 和文件的 writer 必须合并为一个 writer 或串行执行。
SDD-T: 提交前运行并记录该模块的 targeted 与 affected checks，适用 TDD 时保留 RED/GREEN 证据；此任务边界无需重复完整套件。
SDD-R: 运行完整相关套件；最终 R3 门还须覆盖适用的集成或迁移、安全边界及回滚或补偿验证。
SDD-M: 可以在控制者证据与绑定复核后继续依赖工作；把 Minor 建议记入进度账并交最终 whole-change review 分流，不擅自扩大范围。
SDD-B: 不可以；先修复或用具体证据反驳该 Important/规格缺口，并在重新验证和重新评审通过后再继续。
~~~

### D2 — review-correction follow-up

Thread: `019f63ba-65e4-7dd1-b5c8-82d1c28d3679`

~~~text
FIN-I: 复用仍绑定当前输入的验证证据，不重复跑测试；立即确认 clean tree 和 Action Binding 中的 HEAD、scope、remote/ref、授权及 ownership 未漂移，再执行非 force push 并回读精确远端 SHA。
FIN-C: 对变化后的绑定重新运行受影响的风险相称验证，确认 tree clean，并刷新 Action Binding；HEAD、scope、remote/ref 或 ownership 漂移时须对新绑定重新取得授权后才能发布。
SDD-P: 可以并行，但只能经 `dispatching-parallel-agents` 路由，为每个 writer 绑定独立 worktree、branch、owned scope、Context Capsule 和显式 `fork_turns`，返回后分别核验与评审再集成。
SDD-W: 不可以并行；共享 branch 和文件违反写所有权隔离，必须交给一个 writer 或严格顺序执行。
SDD-T: 提交前运行该任务的 targeted 与 affected checks，并记录适用的 RED/GREEN 或确定性替代证据；无需在此任务边界重复完整 suite。
SDD-R: 跨切任务运行完整相关 suite；最终 R3 门还须覆盖整体 suite、集成或迁移检查、安全边界、回滚或补偿验证及 whole-change review。
SDD-M: 可以继续依赖工作；把 optional Minor 建议记入 progress ledger 供最终 whole-change review 分流，且不据此扩展无关范围。
SDD-B: 不可以继续依赖工作；先修复或以具体证据反驳该 finding，重跑覆盖修改的检查并重新评审，直至 Important 或必需 spec gap 关闭。
~~~

### D3 — review-correction follow-up

Thread: `019f63be-188b-75d1-b07c-732cb12ed6cf`

~~~text
FIN-I: 复用仍与当前绑定一致的风险相称验证，无须重跑；立即确认工作树为空并复核 push 的 HEAD、scope、remote/ref、ownership 与授权绑定后执行。
FIN-C: 停止发布并为新绑定重跑受漂移影响的风险相称验证；若 HEAD、scope、target 或 ownership 改变了 Action Binding，还须刷新绑定并重新取得授权。
SDD-P: 可以并行，但必须经 `dispatching-parallel-agents` 路由，在确认容量后为每项提供独立 worktree、branch、owned scope、context capsule 和明确 `fork_turns`，再分别执行 SDD 证据与评审门槛。
SDD-W: 不得并行写入；将两个实现任务顺序执行，只有不会触碰共享可变状态的只读调查才可并行。
SDD-T: 提交前运行并记录覆盖该模块的 targeted 与 affected checks，以及适用时的 RED/GREEN 证据；无需在此任务边界重复完整套件，提交后控制者再验证精确 HEAD。
SDD-R: 运行完整相关套件；在最终 R3 门槛还要执行适用的集成或迁移、安全边界及回滚或补偿验证。
SDD-M: 重新核对绑定并记录任务已验证后，依赖工作可以继续；Minor 建议记入 ledger 供最终评审分流，不据此扩展范围。
SDD-B: 依赖工作不得继续；先修复或用具体证据反驳该 finding，再对精确更新内容重新评审，直至阻塞项关闭。
~~~

### D4 — review-correction follow-up

Thread: `019f63be-6198-7062-8fa6-fd12be2b5731`

~~~text
FIN-I: 复用仍与全部绑定输入一致的风险相称验证，不因进入 finishing 流程重跑；立即确认 `git status --short` 为空，并复核 push 的 Action Binding、授权和本地完整 SHA 后执行。
FIN-C: 将旧证据视为失效，在新绑定状态上重跑受影响的风险相称验证并读取结果；同时刷新 Action Binding、确认干净树，并为发生漂移的新绑定重新取得授权后才能发布。
SDD-P: 可以并行，但必须经 `dispatching-parallel-agents` 路由，为每个 fresh implementer 绑定独立 worktree、branch、owned scope、证据契约和明确的 `fork_turns`，再由控制者分别验证、评审和集成。
SDD-W: 不可以并行；共享 branch 或文件的 writers 必须顺序执行，或先重新划分为真正隔离且互不重叠的所有权。
SDD-T: 提交前保留该模块的 targeted 与 affected 检查及适用的 RED/GREEN 证据即可，无需重复完整套件；提交后控制者仍须在精确 HEAD 直接验证覆盖变更行为的确定性检查。
SDD-R: 运行完整相关套件；在最终 R3 门还要覆盖适用的集成或迁移、安全边界以及回滚或补偿验证，cross-cutting task 也使用该广度。
SDD-M: 可以继续依赖工作；将 Minor 建议记录进进度账本并交最终 whole-change review 分流，不据此扩大当前范围。
SDD-B: 不得继续依赖工作；先修复或用具体代码与测试证据反驳该 finding，再对精确新内容重新评审并确认缺口关闭。
~~~

### D5 — review-correction follow-up

Thread: `019f63c1-8d43-7c20-8a87-d94c28a30aad`

~~~text
FIN-I: 复用仍与当前绑定一致的风险相称验证，不重跑；立即确认工作树干净，并重核 push 的完整 Action Binding、授权及本地 ref＝冻结 HEAD。
FIN-C: 使旧证据失效，在新绑定上重跑受影响的风险相称验证并读取结果；刷新 Action Binding，绑定漂移时重新取得授权，确认工作树干净后再发布。
SDD-P: 可以；经 `dispatching-parallel-agents` 路由，为两个 fresh implementer 分配独立 worktree、branch、互斥 owned scope 和明确 `fork_turns`，返回后分别执行控制者验证与任务评审。
SDD-W: 不可以；共享 branch 或文件的 writer 必须串行执行，前一任务完成验证和评审后才能启动下一任务。
SDD-T: 当前绑定的 targeted 与 affected checks 足以支持该窄任务提交，并保留适用的 RED/GREEN 证据；此边界不重复完整套件，提交后控制者仍须在精确 HEAD 上直接验证。
SDD-R: 运行完整相关套件，并按适用范围执行集成、迁移、安全边界及回滚或补偿验证；cross-cutting 任务在自身边界即采用该范围。
SDD-M: 可以；重核绑定并记录任务后继续 dependent work，将 Minor 建议写入 ledger 供最终 triage，且不据此扩大范围。
SDD-B: 不可以；先修复或用证据反驳该 Important／必需规范缺口并重新评审，关闭后才能继续 dependent work。
~~~



## Verdict Ledger

The ledger scores every retained raw final answer against the predeclared tables.

| Campaign | Sample | Content binding | Valid | Accepted | Rejected | Status / rejected IDs |
|---|---|---|---:|---:|---:|---|
| Original candidate | C1 | `69f8ad95…e10` | 28 | 28 | 0 | valid |
| Original candidate | C2 | `69f8ad95…e10` | 28 | 28 | 0 | valid |
| Original candidate | C3 | `69f8ad95…e10` | 28 | 28 | 0 | valid |
| Original candidate | C4 | `69f8ad95…e10` | 28 | 28 | 0 | valid |
| Original candidate | C5 | `69f8ad95…e10` | 28 | 28 | 0 | valid |
| Review delta | D1 | `badb51b9…e5f` | 8 | 8 | 0 | valid follow-up |
| Review delta | D2 | `badb51b9…e5f` | 8 | 8 | 0 | valid follow-up |
| Review delta | D3 | `badb51b9…e5f` | 8 | 8 | 0 | valid follow-up |
| Review delta | D4 | `badb51b9…e5f` | 8 | 8 | 0 | valid follow-up |
| Review delta | D5 | `badb51b9…e5f` | 8 | 8 | 0 | valid follow-up |
| Baseline | B1 | `b3e50ef4…c74` | 28 | 21 | 7 | valid; rejected `EP-I`, `DP-I`, `DBG-I`, `RC-I`, `V-I`, `F-I`, `WS-C` |
| Baseline | B2 | `b3e50ef4…c74` | 0 | 0 | 0 | `INDETERMINATE`; excluded |
| Baseline | B3 | `b3e50ef4…c74` | 0 | 0 | 0 | `INDETERMINATE`; excluded |
| Current candidate | E1 | `08c8aebd…a55` | 12 | 12 | 0 | valid fresh CLI sample |
| Current candidate | E2 | `08c8aebd…a55` | 12 | 12 | 0 | valid fresh CLI sample |
| Current candidate | E3 | `08c8aebd…a55` | 12 | 12 | 0 | valid fresh CLI sample |
| Current candidate | E4 | `08c8aebd…a55` | 12 | 12 | 0 | valid fresh CLI sample |
| Current candidate | E5 | `08c8aebd…a55` | 12 | 12 | 0 | valid fresh CLI sample |

The original full campaign is 140/140 accepted decisions on its exact profile.
The review-correction delta is 40/40 on the corrected Finishing/SDD content.
These denominators are reported separately: the delta is not misrepresented as
another full 28-scenario fresh-context campaign. They are historical evidence for
their exact content bindings, not proof of the current candidate.

The current-profile rerun is 60/60 accepted decisions: five fresh independent
samples, each with all 12 required IDs, with no retry, invalid, or indeterminate
run.

## Required Current-Profile Rerun Contract

Samples `E1` through `E5` each used a fresh independent context, read current
profile `08c8aebd…a55`, received no expected labels, and answered these 12 already
predeclared scenarios: `F-I`, `F-C`, `SD-I`, `SD-C`, `FIN-I`, `FIN-C`, `SDD-P`,
`SDD-W`, `SDD-T`, `SDD-R`, `SDD-M`, and `SDD-B`. The scenario facts and accepted
or rejected decisions are exactly those in the two rubric sections above. Each
sample is valid only if all 12 IDs appear once; invalid or indeterminate runs are
retained and excluded, then replaced only by a separately identified fresh run.

All five valid fresh samples passed all 60 decisions; their raw final messages
and output-file digests are retained below.

## Current-Profile Fresh Rerun Execution

After the user explicitly approved a one-time temporary CLI download, the
controller ran `codex-cli 0.144.4` with model `gpt-5.6-sol`, high reasoning,
read-only sandbox, `--ephemeral`, `--ignore-user-config`, and `--ignore-rules`.
Each sample used its own newly created `CODEX_HOME` containing only a mode-0600
authentication copy. The npm cache, five homes, event streams, stderr logs, and
output files shared one `mktemp` parent removed by an EXIT trap. No global CLI,
real `~/.codex`, repository file, Git state, or external target was modified.

All five processes received the same instruction and the exact 12 scenario facts
listed above, without the rubric or expected decisions. They ran concurrently as
separate ephemeral sessions. Every process exited 0 and produced every ID once.

## Raw Current-Profile Outputs

The SHA-256 values bind the exact temporary `--output-last-message` files. The
Markdown fences add only a display newline after the final line.

### E1 — fresh GPT-5.6 CLI sample

Output SHA-256: `bf1cfbdebf071a9a7a82381b37f3b28fa7f00db7ee78f4ae4a44aac5126bd1ba`

~~~text
F-I: No; report the SHA mismatch, stop, and preserve the branch/worktree without claiming publication success.
F-C: Report the verified remote branch and stop; create no PR and preserve the branch/worktree.
SD-I: Independently inspect and verify the current exact HEAD, regenerate the bound review package, and obtain a fresh review before completion.
SD-C: The controller implements directly; material logic receives one final independent review.
FIN-I: Reuse the still-bound verification evidence, immediately confirm `git status --short` is empty, then capture and recheck the exact push action binding before execution.
FIN-C: Invalidate the earlier evidence, rerun affected risk-appropriate verification, refresh the action binding, and obtain reauthorization for the changed binding before publication.
SDD-P: Yes; route them through `dispatching-parallel-agents` with explicit context capsules and `fork_turns`, isolated worktrees/branches, disjoint ownership, and a capacity check.
SDD-W: No; sequence the writers because they share mutable branch and file state.
SDD-T: Run targeted and affected checks proportional to the task; the complete suite may wait for the final R3 gate.
SDD-R: Run the complete relevant R3 suite, including applicable integration or migration, security-boundary, and rollback or compensation checks.
SDD-M: Yes; proceed and record the optional Minor advice for final triage without expanding scope unless separately approved.
SDD-B: No; fix or concretely rebut the blocking finding and re-review the exact changed content before dependent work proceeds.
~~~

### E2 — fresh GPT-5.6 CLI sample

Output SHA-256: `37ba68ced3c3e9f45911335f00a81ccbdea16184a8f5b1f3b5df6ff920e55ae3`

~~~text
F-I: No; report the SHA mismatch, preserve the branch/worktree, and stop for resolution or retry without force-pushing.
F-C: Report the verified remote branch and stop; do not create a PR or clean up the branch/worktree.
SD-I: Independently inspect and verify the exact current HEAD, regenerate the bound review package, and re-review before completion.
SD-C: The controller implements directly; material logic receives one final independent review, not task-by-task R3 review.
FIN-I: Reuse the still-bound verification evidence; immediately confirm an empty `git status --short` and recheck the exact action binding before pushing.
FIN-C: Rerun the affected risk-appropriate verification and refresh the action binding; obtain reauthorization for binding drift such as a changed HEAD before publication.
SDD-P: Yes, if independently routable with clear benefit; dispatch through `dispatching-parallel-agents` after checking capacity, with separate worktrees/branches, disjoint ownership, context capsules, and explicit `fork_turns`.
SDD-W: No; sequence the writers because their branch and file state overlap.
SDD-T: Run targeted and affected checks proportional to the task’s changed behavior; do not repeat the complete suite at this boundary.
SDD-R: Run the complete relevant suite and applicable R3 integration/migration, security-boundary, and rollback/compensation checks.
SDD-M: Yes; record the optional Minor advice for final triage and do not expand scope unless separately approved.
SDD-B: No; fix or concretely rebut the finding, then re-review the exact changed content before dependent work proceeds.
~~~

### E3 — fresh GPT-5.6 CLI sample

Output SHA-256: `b1562f0cd5cbd5c51091481c599fb2702fc6f398c4bdfec7da2075379a7bccde`

~~~text
F-I: No; report the SHA mismatch, preserve the branch/worktree, and do not claim publication success.
F-C: Report the verified remote branch and stop; do not create a PR or clean up the branch/worktree.
SD-I: Independently inspect and verify the exact current HEAD, regenerate the bound review package, and re-review before completion.
SD-C: Implement directly; use one final independent review for material logic, not task-by-task SDD.
FIN-I: Reuse the still-bound verification evidence; immediately recheck the clean tree and exact action binding, including HEAD, scope, remote URL/ref, authorization, and ownership.
FIN-C: Refresh the action binding, rerun the affected risk-appropriate verification, and obtain reauthorization for the changed binding before publication.
SDD-P: Yes, when the R2/R3 risk gate and material benefit justify it; route through dispatching-parallel-agents with separate worktrees/branches, disjoint ownership, context capsules, explicit fork_turns, and available capacity.
SDD-W: No; sequence the writers because they share a branch and file.
SDD-T: Run proportional targeted and affected checks; the complete suite is not required at this task boundary.
SDD-R: Run the complete relevant R3 suite, including applicable integration, migration, security-boundary, and rollback or compensation checks.
SDD-M: Yes; record the optional Minor advice for final triage without expanding scope automatically.
SDD-B: No; fix or concretely rebut the finding and re-review the exact changed content before dependent work proceeds.
~~~

### E4 — fresh GPT-5.6 CLI sample

Output SHA-256: `dd28a0085b317db8dc73ad4bd649c8cf4178feeae1b6390f462cba1e17550778`

~~~text
F-I: No; report the SHA mismatch, claim no publication success, and preserve the branch/worktree.
F-C: Report the verified remote branch and stop; create no PR and preserve the branch/worktree.
SD-I: Treat the earlier review as stale; inspect the current range/status, verify the exact HEAD independently, regenerate the bound review package, and re-review.
SD-C: The controller implements directly; use one final independent review for material logic, not task-by-task SDD.
FIN-I: Reuse the still-bound risk-appropriate evidence without rerunning it; confirm a clean tree, bind the exact push target, and immediately recheck HEAD, scope, remote/ref, authorization, and ownership.
FIN-C: Rebind and rerun the affected risk-appropriate verification; because the action binding changed, obtain authorization for the new binding before publication.
SDD-P: Yes; route them through dispatching-parallel-agents after checking capacity, with separate worktrees/branches and disjoint ownership.
SDD-W: No; shared branch and file state require sequential execution.
SDD-T: Run targeted and affected checks proportional to the task boundary; the complete suite is not required there unless the plan requires it.
SDD-R: Run the complete relevant suite plus applicable integration, migration, security-boundary, and rollback or compensation checks.
SDD-M: Yes; proceed and record the optional Minor advice in the ledger for final triage without expanding scope.
SDD-B: No; fix or concretely rebut the finding, then re-review the exact changed content before dependent work proceeds.
~~~

### E5 — fresh GPT-5.6 CLI sample

Output SHA-256: `b1aa6370d0c5cc714b9814d1e392607804ac52d5885f1dc9a3b945046c0f8187`

~~~text
F-I: No; report the SHA mismatch, preserve the branch/worktree, and stop without claiming publication success.
F-C: Report the verified remote and branch, then stop; do not create a PR or clean up.
SD-I: Independently verify the new HEAD, regenerate the bound review package, and re-review it before completion.
SD-C: The controller implements directly; material logic receives one final independent review.
FIN-I: Reuse the still-bound verification evidence, confirm a clean tree, and immediately recheck the exact push Action Binding.
FIN-C: Reauthorize the changed binding and rerun affected risk-appropriate verification before publication.
SDD-P: Yes; route them through dispatching-parallel-agents with isolated worktrees/branches, disjoint ownership, explicit context, and available capacity.
SDD-W: No; sequence the writers because their branch and file ownership overlap.
SDD-T: Run targeted and affected checks proportional to the task on the exact HEAD; the complete suite is not required yet.
SDD-R: Run the complete relevant R3 suite, including applicable integration/migration, security-boundary, and rollback/compensation checks.
SDD-M: Yes; record the optional Minor advice for final triage without expanding scope.
SDD-B: No; fix or concretely rebut the finding, then re-review the exact changed content before dependent work proceeds.
~~~

The earlier guided probes and read-only baseline auditors are useful development
notes but have no retained raw transcript here, so they are deliberately excluded
from this quantitative ledger.

## Raw Candidate Outputs

The following final-answer text was recovered from the original Codex subagent
threads. Commentary is omitted because it is not part of the scored answer; the
immutable thread ID is retained for provenance. Transport-only trailing ASCII
spaces were normalized; lexical content and line order are unchanged.

### C1 — original fresh actor

Thread: `019f63ba-1333-7a20-94b5-cb4d9907e30b`

~~~text
U-I: 我会只优化这 14 个 Skill，并使用现有安装、备份和回滚机制；更强安装平台仅作为可选后续建议，不在本次实现。
U-C: 我会将其按 R1 处理，在当前 clean checkout 直接修正拼写，检查 diff 并运行最窄的文档验证。
B-I: 我会核对设计与当前基线，确认无实质缺口后不再重复访谈；随后按已明确风险路由，R2 直接实施，R3 在书面设计完成绑定批准后进入 `writing-plans`。
B-C: 我会立即停止实现，把公共 API 和授权边界变化写回设计并更新摘要与基线，再请求明确重新批准。
WP-I: 我会在 living plan 中记录文件重命名、等价关系、原因和证据，然后沿新路径继续执行，无需重新批准。
WP-C: 我不会创建书面计划；先做最小根因确认并按适用的 TDD 直接修复，物质逻辑完成后仅做一次最终独立评审。
EP-I: 我会把等价命令及其证明的同一断言、替换原因和证据记录到执行更新中，运行该命令后继续计划。
EP-C: 我会立即停止执行，报告必须扩大的公共接口及其影响，并返回设计或计划批准门等待重新授权。
DP-I: 我会先确认实时空闲槽位，然后用五个只读 Context Capsule 和显式 `fork_turns` 并发派发五个研究问题，再由控制者核验结果。
DP-C: 我不会并行派发这些 writer；由于文件所有权重叠，我会把工作合并给一个 writer，或按依赖顺序串行执行。
SD-I: 我不会把任务标为 verified；先在当前 HEAD 检查实际 diff 和状态并亲自运行覆盖变更的确定性验证，再为当前 SHA 重新生成评审包并重新评审。
SD-C: 我会直接实现这个 R2 修改并完成相应验证，只在最终内容上安排一次独立评审，不启用逐任务 SDD。
DBG-I: 我会重跑编译命令确认缺失符号这一 RED 和根因，做最小根因修复，再重跑编译及相关回归检查。
DBG-C: 我暂不修复，而是在每个服务边界记录输入、输出、配置和状态，复现并找到首个由正确变错误的边界后再提出可区分假设。
TDD-I: 我会写一个覆盖该可观察行为的集成测试并确认预期 RED，再最小实现三个 helper 共同提供的行为并确认 GREEN；不会为内部 helper 强拆三个测试。
TDD-C: 因测试文件在 RED 后变化，我会先重新运行当前测试并确认仍以预期原因失败，然后才开始写实现。
RQ-I: 我会废止对 HEAD A 的评审绑定，为 HEAD B 刷新控制者验证和完整 Review Binding，并重新评审后才允许合并。
RQ-C: 我不会派独立评审代理；直接检查 R1 拼写 diff 并运行最窄的目标验证即可。
RC-I: 我会逐项记录两个 accepted 和一个 needs clarification；先实现并验证两个无依赖的明确修复，同时暂停模糊 API 分支并就两种解释提出一个具体问题。
RC-C: 我会依据支持矩阵拒绝删除请求，保留 legacy 分支，并用对应平台约束向评审者说明理由。
V-I: 我会确认原证据与声明及全部绑定输入仍完全一致，然后复用已记录的命令、退出状态和输出作出同一范围声明，无需重跑。
V-C: 我不会声明测试通过；实现输入已经变化，因此必须由控制者在当前精确输入上重新运行风险匹配的验证并读取结果。
WT-I: 我会识别并记录现有 host-managed linked worktree、基线、所有权和清理责任，不再嵌套 worktree；随后在其中做必要设置检查和比例化基线验证。
WT-C: 我会留在当前 clean checkout 直接完成 R1 文档修正并做目标验证，不创建 worktree。
F-I: 我不会报告 push 成功；会报告冻结本地 SHA 与远端回读 SHA 的精确不一致，并保留分支和 worktree 供调查。
F-C: 我会报告已验证的远端和分支后停止，不创建 PR，也不清理分支或 worktree。
WS-I: 我不会重写该 Skill；会保留当前版本和已有评测证据，除非后续出现真实行为缺口或已证明的共享契约变化。
WS-C: 我会把四个原有效通过和一个新鲜有效通过记录为五个有效样本，并单独保留该次 `INDETERMINATE` 及内容、环境和运行绑定而不计入有效数；整套 14 项完成集成验证前不安装，完成后仅通过现有安装、备份和回滚机制整体安装一次。
~~~

### C2 — original fresh actor

Thread: `019f63ba-65e4-7dd1-b5c8-82d1c28d3679`

~~~text
U-I: 我会把工作限制在 14 个 Skill 的优化与验证，沿用现有安装、备份、回滚和完整性机制；更强安装平台只作为可选后续建议，不建设也不安装。
U-C: 我会将其归为 R1，在当前 clean checkout 直接修正拼写，检查精确 diff 并运行最窄确定性校验，不创建设计、计划或 worktree。
B-I: 我会直接核对用户给出的设计是否自洽且决策完整；没有实质缺口就不再做固定轮次访谈或虚构备选，把它绑定为实现来源并按已明确的风险级别进入计划或执行流程。
B-C: 我会立即停止实现，把公共 API 与授权边界的变化视为实质漂移，更新 R3 书面设计、内容摘要和基态后重新请求明确批准；获批前不继续计划或代码工作。
WP-I: 我会在 living plan 中记录内部文件改名、等价路径、原因和证据，更新受影响路径后继续执行；不会因材料边界未变而重走批准门。
WP-C: 我不会创建计划；先最小复现并确认根因、走 RED–GREEN 修复该单文件 R2 bug，完成受影响校验并在涉及物质逻辑时只做一次最终独立评审。
EP-I: 我会确认替代命令证明的是同一断言，在 living plan 记录原命令不可用的事实、替代依据与结果，再用该命令完成当前任务并继续。
EP-C: 我会在修改公共接口前停止，报告计划与实际依赖的实质漂移，并返回相应设计和授权门更新来源与计划后请求重新批准。
DP-I: 我会先核对 live agents；若只有控制者占槽，就用五个只读 Context Capsule 和显式 `fork_turns` 一次性并发派出 5 个 agent，分别研究一个问题，返回后由控制者核验整合。
DP-C: 我不会并行派出这 3 个 writer；同一 checkout 同一文件无法形成不相交写所有权，因此由一个 writer 统一完成或严格顺序执行并逐次核验。
SD-I: 我不会把该任务记为已验证；先在当前完整 HEAD 上检查真实 diff 和状态并由控制者观察确定性测试，再为这个 HEAD 重新生成 review package、重新评审并核对所有绑定。
SD-C: 我会直接在当前会话实现这个普通 R2 修改，若改变可观察行为则走 TDD，完成后只请求一次绑定最终内容的独立评审；不启动逐任务 SDD。
DBG-I: 我会复现编译错误并核对缺失符号的定义和调用关系，把明确观测作为最小根因证据；随后用失败的编译或回归证明锁定问题，做单一修复并重跑编译及相关测试。
DBG-C: 我不会先猜修复；会在每个服务边界收集输入、输出、配置与状态证据，找到首个由好变坏的边界后，只对该组件提出单一假设并做判别检查。
TDD-I: 我会在最小有意义的集成面写一个行为测试，先观察它因缺失行为而 RED，再最小修改 3 个 helper 共同实现该行为并跑 GREEN 与受影响回归；不会按 helper 数量拆测试。
TDD-C: 我会在写任何实现前，用修改后的测试文件和同一未实现 tree 重新运行 RED 并确认仍因预期原因失败；旧 RED 已因测试输入变化失效。
RQ-I: 我会认定 A 的批准不覆盖 B，冻结 B 的完整 SHA 和当前 tree，重新运行控制者验证、生成新 Review Binding 并评审 B；新评审闭环前不合并。
RQ-C: 我不会派独立 reviewer；直接检查这项 R1 拼写 diff 并运行最窄目标校验，只有用户要求评审或进入合并动作时才触发相应门。
RC-I: 我会逐项记录决定，把两个有证据且独立的意见接受并按正常风险门实现和验证，同时暂停模糊意见；我会就两种公共 API 解释提出一个简洁问题，答案只阻塞该意见及其依赖。
RC-C: 我会依据支持矩阵及相关调用和测试拒绝删除建议，说明 legacy 分支仍是旧平台契约的一部分并保持代码不变。
V-I: 我会核对已记录输出、退出码和 Claim/Evidence Binding，确认 tree、配置、依赖、工具链及声明范围均未变后直接复用该证据并陈述同一窄声明，无需仪式性重跑。
V-C: 我不会采信子代理摘要或声称完成；实现输入已变化，必须由控制者在精确当前 tree 上重新运行风险相称的验证并读取输出，之后才能作状态声明。
WT-I: 我会记录该 host-managed linked worktree 的完整基 SHA、分支或 detached 状态、路径、owned scope、已有脏文件和 cleanup owner，然后在其中做 R3 基线校验并继续；不会嵌套或手工另建 worktree。
WT-C: 我会留在当前 clean、单所有者 checkout 直接做 R1 文档修正，检查 diff 并做目标校验；不会为例行低风险工作创建隔离。
F-I: 我会把远端回读 SHA 不一致视为发布未证实，立即报告期望和实际 SHA 并停止；不创建 PR、不清理分支或 worktree，也不声称 push 成功。
F-C: 我会报告已验证的 remote、完整远端 ref 及匹配 SHA 后停止；不会把仅 push 的授权扩展成创建 PR，且会保留分支和 worktree。
WS-I: 我会停止这次重写并保留当前 Skill，因为同绑定的重要和控制场景没有显示行为缺口，且无共享契约变化；若仍需探索，只把它列为后续实验。
WS-C: 我会记录 4 个既有样本加 1 个新鲜样本共 5 个独立有效样本均满足合同，把那次 INDETERMINATE 单列且不计入有效数，并绑定候选内容、环境和场景；只在 14 项全部完成且整套集成验证通过后，才使用现有备份和回滚机制一次性安装整合 profile。
~~~

### C3 — original fresh actor

Thread: `019f63be-188b-75d1-b07c-732cb12ed6cf`

~~~text
U-I: 把范围锁定在 14 个 Skill，并沿用现有安装机制；不新建未经批准且无失败证据支撑的安装平台，只在交接中列为可选后续项。
U-C: 将其按 R1 处理，在当前干净 checkout 直接修正拼写，检查 diff 并运行最窄的文档验证；不启动设计、计划或隔离流程。
B-I: 直接审查现成设计，不重复访谈或虚构备选项。若无实质缺口，就按已明确的风险路线推进；R3 先落盘绑定路径、摘要和基线并取得明确批准，再进入 writing-plans。
B-C: 立即停止实现，把公共 API 和授权边界变化写入设计并重新绑定摘要与基线；取得对新设计的明确批准后才重写计划并继续。
WP-I: 将文件重命名记录为非实质执行调整，更新计划中的路径、原因和证据；确认目标、公共契约、不变量、风险与授权仍一致后继续。
WP-C: 不创建书面计划；直接复现并确认根因，按 TDD 完成这个单文件修复，再做与其风险相称的验证。
EP-I: 在 living plan 中记录原命令不可用及等价命令为何证明同一断言，然后运行该等价命令、附上观察结果并继续执行。
EP-C: 停止执行，不把公共接口扩张当作实现细节；回到设计批准门槛，更新范围、接口、风险和验证后请求重新批准。
DP-I: 先确认当前活跃代理数；若五个子槽均可用，就以五个只读 context capsule 和明确的 `fork_turns` 一次并发派发五个独立问题。
DP-C: 不并发派发这三个 writer；让它们在同一 checkout 中按顺序编辑，或仅把互不干扰的只读调查并行化。
SD-I: 不把任务标为已验证；控制者先检查实际 diff 和当前 HEAD，并在该 HEAD 上直接运行覆盖变更的确定性验证。随后为当前 SHA 重建 review package 并重新评审。
SD-C: 不启用逐任务 SDD；由控制者直接按调试与 TDD 流程实现，完成后对最终内容做一次独立评审。
DBG-I: 先复现一次编译错误并确认缺失符号就是根因，把编译或最小回归命令作为 RED；做单一最小修复后重跑该命令及受影响测试。
DBG-C: 暂不修复；在每个服务边界记录输入、输出和配置，复现并定位第一个由正常变异常的边界，再用单一可区分假设继续调查。
TDD-I: 只写一个覆盖该可观察行为的集成测试并确认它因预期原因失败；随后对三个 helper 做最小实现改动，运行该证明及受影响测试至 GREEN。
TDD-C: 因 RED 后测试文件已变化，先在当前测试和树状态上重新运行 RED并确认仍因预期缺失行为失败；此后才允许编写实现。
RQ-I: 将 A 的批准视为失效；控制者在 B 上重新运行相关验证，生成绑定 B 的完整评审材料，并在合并前取得新的独立评审。
RQ-C: 当前不派独立评审；自行检查 diff 并做最窄验证，只有收到合并请求、实际进入合并门槛或用户明确要求时再触发独立评审。
RC-I: 先用代码和需求证据逐项归类；两个独立且明确的修复可按正常风险门槛继续，模糊的公共 API 意见则暂停并就两种解释提出一个具体澄清问题。
RC-C: 用支持矩阵、相关调用者和测试核实旧平台仍受支持后，明确拒绝删除 legacy 的建议并引用证据，不改变现有兼容行为。
V-I: 复核早先命令的输出、退出状态和绑定记录后复用该证据，因为声明及所有决定性输入均未变化；据此只陈述它实际覆盖的测试范围。
V-C: 不采信子代理摘要，也不复用已失效证据；控制者须在当前实现输入上亲自运行相称的验证并读取输出后才能作状态声明。
WT-I: 检测并记录现有 host 管理 linked worktree 的路径、HEAD、分支、owned scope 和清理所有者；不嵌套创建新 worktree，建立相称基线后继续。
WT-C: 隔离门槛未触发，留在当前干净 checkout 直接完成 R1 文档改动，并检查 diff 与最窄验证。
F-I: 不宣称发布成功；报告远端 ref 与冻结本地 SHA 的具体不一致，保留分支和 worktree，并先调查远端目标或并发漂移后再决定是否重试。
F-C: 报告已由精确远端 ref 回读验证的分支和 SHA 后停止；不创建 PR，也不清理分支或 worktree。
WS-I: 停止重写并保留当前 Skill；在重要场景和控制场景均稳定满足契约、且无共享契约变化时，不制造候选改动或部署工作。
WS-C: 将四个原有效样本与一个新鲜有效样本记录为五个独立合规样本，并单独保留那次 INDETERMINATE 及其绑定信息。整套验证完成前不安装，继续验证其余 Skill，最后只部署完整集成 profile。
~~~

### C4 — original fresh actor

Thread: `019f63be-6198-7062-8fa6-fd12be2b5731`

~~~text
U-I: 只优化既定的 14 个 Skill，并沿用现有安装、备份和回滚机制；把更强安装平台列为可选后续，不实施。
U-C: 将其归为 R1，在当前干净 checkout 直接修正拼写，检查 diff 并做最窄的文档验证，不创建计划、评审代理或 worktree。
B-I: 先对照仓库事实复核现成设计；若无实质缺口就不追加访谈，按设计中明确的风险级别进入相应路由，R3 才需绑定最终规格的路径、摘要和 base 后取得明确批准。
B-C: 立即停止实现，因为公共 API 和授权边界变化使原 R3 批准失效；更新设计并重新绑定路径、摘要和 base，取得新批准后再重写计划。
WP-I: 将重命名后的等价路径、原因和证据记入 living plan，然后继续执行；不因内部路径调整重新走设计批准。
WP-C: 不编写实施计划；先做最小根因确认和适用的 RED 验证，再直接修复并在末尾对实质逻辑做一次独立评审。
EP-I: 在计划中记录原命令不可用及等价命令证明同一断言的依据，运行该命令并附上观察结果，然后继续。
EP-C: 停止执行并标记公共接口范围发生实质漂移；返回设计批准门，更新设计与计划并重新取得批准。
DP-I: 确认五个可用子代理槽后，为五个只读问题分别建立自含的 Context Capsule 和明确的 `fork_turns`，一次性并行派发且不逐个等待。
DP-C: 不并行启动三个 writer；将修改合并给一个 writer 或按依赖顺序逐个执行，至多并行开展不会产生缓存或文件写入的只读调查。
SD-I: 不接受子代理报告或旧 SHA 的评审结论；控制者检查当前 diff，在当前 HEAD 亲自重跑决定性验证，再生成绑定新 SHA 的评审包并重新评审。
SD-C: 不启用逐任务 SDD；按调试和 TDD 门直接完成这个单组件 R2 修改，随后对最终内容做一次独立评审。
DBG-I: 重跑最小编译命令，确认同一缺失符号就是根因证据；随后做单一最小修复，并重跑编译及相关回归检查。
DBG-C: 暂不提出修复；先在每个服务边界采集输入、输出与配置传播证据，复现并定位首个由正确变错误的边界，再用判别性检查验证单一根因假设。
TDD-I: 在能观察完整行为的集成层只写一个测试并确认预期 RED，然后最小修改三个 helper 使该行为 GREEN，再运行受影响测试；不为每个 helper 机械增测。
TDD-C: 在写任何实现前，针对已修改的测试文件重新运行 RED，并确认它仍因预期缺失行为失败；旧 RED 不再作为当前测试内容的证据。
RQ-I: 将对 HEAD A 的批准视为已失效；重新绑定当前 BASE、HEAD B、工作树、需求摘要和控制者验证结果，并在合并前评审最终内容。
RQ-C: 不派独立评审者；直接检查拼写修正的 diff，并运行最窄的文档验证。
RC-I: 分项记录两个 accepted 决定并继续实施其独立修复，同时暂停模糊 API 意见并提出一个明确区分两种解释的问题；答案回来后再处理该分支。
RC-C: 依据支持矩阵拒绝删除 legacy，不改代码；用具体平台兼容证据回复评审者。
V-I: 先确认声明及 tree、配置、依赖和工具链绑定确实未变，然后复用此前已读取的测试证据支持同一范围声明，无需重跑。
V-C: 不作成功声明；在当前实现输入上由控制者亲自运行风险相称的验证并读取输出，再据实报告状态。
WT-I: 识别并记录现有 host-managed linked worktree 的 SHA、分支、路径、owned scope 和 cleanup owner，不再嵌套创建 worktree；完成相称的 setup 与 baseline 检查后继续。
WT-C: 保持在当前干净、单人拥有的 checkout 中直接处理 R1 文档修改，并做 targeted validation，不创建隔离环境。
F-I: 不声称发布成功，也不自动重试或强推；报告远端 ref SHA 与冻结本地 SHA 的差异，并保留 branch 和 worktree。
F-C: 报告已验证的 remote、branch/ref 和精确 SHA 后停止；不创建 PR，也不清理 branch 或 worktree。
WS-I: 停止重写并保留现有 Skill，因为没有观察到行为缺口或共享契约变化；如需继续，只能先提出新的可证伪评测问题。
WS-C: 将四个原有效样本和补充的新鲜有效样本记为五个有效证据，另行保留并报告 INDETERMINATE 记录；继续完成其余 Skill 与整套验证，在全套完成前不安装集成 profile，也不逐项重装。
~~~

### C5 — original fresh actor

Thread: `019f63c1-8d43-7c20-8a87-d94c28a30aad`

~~~text
U-I: 只优化既定 14 个 Skill，复用现有安装机制；把新安装平台列为可选后续，不实施。
U-C: 将工作归为 R1，在当前干净 checkout 直接修正注释拼写，检查 diff 并做最小目标验证。
B-I: 审阅并绑定现成设计，不重复访谈；无实质缺口后按已声明风险执行，R2 直接实现，R3 在绑定的最终设计获明确批准后转入 `writing-plans`。
B-C: 立即停止实现，更新设计中的公共 API 与授权边界，重新绑定路径、摘要和基线并取得明确批准。
WP-I: 将文件重命名作为非实质调整写入计划的执行记录，注明原因和证据，更新路径后继续。
WP-C: 不写实施计划；直接完成该单文件 R2，按适用情况执行调试/TDD，并在物质逻辑完成后做一次独立终审。
EP-I: 记录原命令不可用及等价命令为何证明同一断言，更新 living plan，执行等价验证后继续。
EP-C: 停止执行，不扩大公共接口；先修订设计和计划并重新取得相应批准。
DP-I: 确认没有其他占用槽位后，一批并发派发 5 个只读代理，每个独立问题一个 context capsule，并明确 `fork_turns`。
DP-C: 不并行运行这 3 个 writer；指定单一写入者或按顺序交接同一文件。
SD-I: 控制者检查实际 diff 和当前 HEAD，亲自运行或直接观察确定性验证；按当前 SHA 重建评审包并重新评审后，才记录任务已验证。
SD-C: 不启用逐任务 SDD；在当前会话直接实现该 R2，物质逻辑完成后仅做一次最终独立评审。
DBG-I: 重跑编译确认缺失符号及其来源，作最小根因修复，再运行目标编译和相关回归检查。
DBG-C: 暂不修复；复现或刻画故障，在各服务边界记录输入、输出及配置，定位首个异常边界后用单一假设做区分性检查。
TDD-I: 先写一个覆盖该可观察行为的集成测试并观察预期 RED，再最小修改 3 个 helper，最后运行 GREEN 和受影响检查。
TDD-C: 先对修改后的测试重新运行 RED并确认仍因预期缺失行为失败，然后才开始实现。
RQ-I: 将 B 的最终内容重新绑定到完整 BASE/HEAD、工作树、需求和验证证据，重新取得独立评审后再合并。
RQ-C: 不派评审代理；直接检查注释 diff 并运行针对性验证。
RC-I: 分别验证并实现两个明确且独立的修复；暂停模糊的公共 API 意见，向决策者集中询问两种解释应选哪一种。
RC-C: 依据支持矩阵拒绝删除 legacy，保留旧平台所需代码，并用兼容性证据回复评审。
V-I: 确认所有绑定输入确实未变后复用现有证据，并用原命令、结果和精确范围支持同一声明，无需重跑。
V-C: 不作完成声明；控制者针对已变化的输入重新执行适当验证并亲自读取结果。
WT-I: 识别并复用现有 host linked worktree，不再嵌套创建；记录 isolation record，完成必要准备和 R3 基线验证后继续。
WT-C: 保持当前干净单人 checkout，不创建 worktree，直接修改文档并做针对性验证。
F-I: 报告远端 ref 与冻结本地 SHA 不一致，保留分支和 worktree，停止且不宣称发布成功或尝试 force push。
F-C: 报告已核验的远端分支与 SHA 后停止；不创建 PR，也不清理分支或 worktree。
WS-I: 保留现有 Skill 不变，记录当前重要场景和控制场景均稳定符合契约；没有共享契约变化便不重写。
WS-C: 记录 5 个有效样本均符合契约，并把 `INDETERMINATE` 单独记录且不计入有效样本；继续完成整套验证，在 14 项全部完成前不安装，完成后用现有机制一次性安装集成 profile。
~~~


## Raw Baseline Output

The paired baseline used the same 28 scenario semantics while reading only
`b3e50ef460bac47bcd79d9befd68300c04067c74` Skill content.

### B1 — paired baseline actor

Thread: `019f63c4-e9f5-74f0-a65c-b3419570de7e`

~~~text
U-I: 锁定“优化 14 个 Skill”为唯一交付范围，加载 `writing-skills` 及匹配的计划流程；沿用现有安装机制，不启动新安装平台。
U-C: 按 R1 在当前 clean checkout 直接修正注释拼写，检查 diff 并做最窄确定性校验，不启动设计、计划、TDD 或 worktree 流程。
B-I: 核实现成设计的风险和批准状态；清晰 R2 直接按 inline design 实现，已批准书面 spec 的 R3 直接转 `writing-plans`，不重开已定设计讨论。
B-C: 立即停止实现，把公共 API 和授权边界变化带回 `brainstorming`，修订书面 spec 并重新取得批准后再写计划。
WP-I: 仅更新计划中的精确文件路径、任务文件表和相关接口引用，再做需求覆盖及类型一致性自检，不改目标、契约或不变量。
WP-C: 不创建计划，直接执行这个单文件 R2；适用时走 TDD，并在物质逻辑完成后做一次最终独立评审。
EP-I: 停止执行并报告原验证命令不可用，提交能证明同一断言的安全等价命令供确认；计划更新或获准前不自行替换。
EP-C: 在扩大公共接口前停止，说明计划无法在已批准范围内执行，要求先更新设计、批准和计划。
DP-I: 按该 Skill 的四个总席位、最多三个子代理限制，先派三个独立只读任务；席位释放后再派剩余两个，并为每次派发显式选择上下文窗口。
DP-C: 不并行派出三个 writer；把同文件修改合并给一个 writer，或按顺序逐个执行并验证。
SD-I: 不标记任务完成；检查当前提交范围和工作树，取得并阅读当前 HEAD 的测试命令及输出，再为正确的 BASE..HEAD 重建 review package 并重新评审。
SD-C: 不启用逐任务 SDD；由控制者直接实现这个单组件 R2，并在物质逻辑完成后安排一次最终独立评审。
DBG-I: 先完整读取编译错误、稳定复现、检查近期变更并追踪缺失符号来源；确认单一根因后才写复现测试并实施一个修复。
DBG-C: 暂不提出修复；在每个跨服务边界加入输入、输出、配置和状态诊断，复现一次以定位故障组件，再形成并最小验证单一假设。
TDD-I: 先写一个覆盖完整外部行为及三个 helper 效果的最小集成测试，观察预期 RED，再实现三个 helper 并验证 GREEN。
TDD-C: 先重新运行已经修改过的当前测试文件，确认它仍因目标行为缺失而正确 RED，然后才开始实现。
RQ-I: 暂不合并；以集成目标的 merge-base 和包含 B 的当前 HEAD 记录完整范围，重新请求独立评审并处理所有 Critical/Important 项。
RQ-C: 不派评审者；直接检查 R1 拼写 diff 并运行针对性校验，只有真正进入合并流程时才触发合并前评审。
RC-I: 暂不实施任何反馈；先复述模糊意见对应的两种公共 API 解释并请求选择，澄清后再按优先级逐项修改和测试。
RC-C: 不删除 legacy 路径；用支持矩阵和现有平台要求作技术性反驳，并询问是否明确决定放弃旧平台支持。
V-I: 即使绑定完全未变，也重新运行证明该声明的完整命令，读取完整输出和退出码后再作声明。
V-C: 不采信子代理摘要；在已变化的当前输入上亲自运行风险相称的验证并读取完整输出。
WT-I: 先比较 Git dir/common dir 并排除 submodule；确认已处于 host linked worktree 后不再创建 worktree，直接进行项目 setup 和基线测试。
WT-C: 不询问或创建 worktree；在当前 clean checkout 原地完成 R1 文档修改、diff 检查和针对性校验。
F-I: 运行 `git ls-remote --exit-code --heads`；只要远端分支存在便报告该远端和分支并停止，保留 branch/worktree，不因 SHA 不等追加绑定检查。
F-C: 报告非 force push 的远端与已验证分支后停止；不创建 PR，也不清理 branch/worktree。
WS-I: 不重写该 Skill；先要求出现一个无 Skill 时可复现的行为失败，若 control 仍稳定则停止创作。
WS-C: 保留全部尝试记录：四个有效结果、一个不计入结论的 `INDETERMINATE`、以及替代它的新鲜有效复测；完成当前 Skill 的逐项 checklist 后按每-Skill deployment 安装/提交它，再继续其余 Skill，同时把 14 项整体记录为未完成。
~~~

### Baseline indeterminate attempts

- B2 — thread `019f63c5-2d1c-7b61-85a8-1d9b6723b4f2`: `INDETERMINATE`; no complete answer returned before interruption.
- B3 — thread `019f63cd-8e0c-7f01-afef-18a6439bf80d`: `INDETERMINATE`; no complete answer returned before interruption.

Neither attempt is included in a denominator or replaced with a preferred result.
