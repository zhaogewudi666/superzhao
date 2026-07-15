# Upstream Skill integration source comparison

**Status:** source comparison retained; behavioral treatments corrected after
strict rescore

The original SEB-v1 acceptance claims are superseded by
`2026-07-15-upstream-skill-integration-review-correction.md`. The comparison of
upstream ideas remains useful, but only the corrected strict scores below may
be used as behavioral evidence.

This record compares the pinned upstream ideas before deciding whether they
belong in Superzhao core, an optional plugin, or nowhere. Behavioral verdicts
are filled only from the frozen SEB-v1 evidence; an upstream repository's
popularity is not acceptance evidence.

Unless a row explicitly cites a corrected behavioral score, every comparison
below is **source review only**. A useful pattern, a proposed disposition, or a
future-eval candidate is not evidence that the upstream Skill or a Superzhao
adaptation improves behavior. The strict correction remains authoritative: no
SEB-v1 candidate passed the frozen gate.

## Source binding

- `microsoft/SkillOpt`:
  `57333f3406436a90a2b5feec4aad74ddb33d6e85`
- `mattpocock/skills`:
  `e9fcdf95b402d360f90f1db8d776d5dd450f9234`
- Superzhao baseline:
  `3ce466e67f3c80183566131aeee01aecacd1bffd`
- Frozen scenario contract:
  `ae2480a7ce6635e29ba9b666369b327508943937bcc3f5fc77ea33b42cd78d69`

The two upstream repositories are MIT-licensed. Their full notices are retained
in `THIRD_PARTY_NOTICES.md`; plugin-specific provenance files identify the
source directories used.

## SkillOpt comparison

| Upstream mechanism | Useful property | Superzhao treatment | Reason |
|---|---|---|---|
| Skill document as trainable state | Makes behavior changes measurable rather than aesthetic | Adapt | The Skill Lab treats a source `SKILL.md` as immutable input and emits a candidate only. |
| Bounded add/insert/replace/delete updates | Limits optimizer blast radius | Adapt and harden | Four-edit hard cap, per-edit and total UTF-8 byte budgets, unique immutable-source anchors, overlap rejection, source digest binding, frontmatter protection, and protected-tail markers. |
| Rollout/reflection/aggregation loop | Can discover candidate edits from scored trajectories | Do not embed | It requires provider/model execution and a benchmark adapter. Superzhao core remains zero-dependency and the local tool accepts human- or agent-authored bounded edits instead. |
| Held-out validation gate | Prevents accepting train-only gains | Adapt and harden | Only `selection` rows decide the gate; train/test rows are retained but ignored by the decision. V2 opens and rehashes source, candidate, scenario, rubric, environment, and raw-evidence preimages and stages them together. Actor identity, outcome/failure-code scoring, and opaque scenario/rubric coverage remain human-attested; byte binding cannot prove independence or truth. |
| Strict score improvement | Rejects neutral rewrites | Adapt | At least one important case must strictly improve, every important candidate sample must pass, and controls cannot regress. |
| Rejected-edit memory (`skillopt/engine/trainer.py`) | Its within-epoch step buffer feeds rejected edits to later reflections in that epoch, while each step's trajectory digest persists the entry | Adapt as retained evidence and a human-managed convention | The buffer resets each epoch and `history.json` is not injected as rejected-edit context. Superzhao now instructs proposers to inspect supplied rejections, but still has no searchable cross-campaign memory; the ledger convention below records that distinct gap. |
| Failure analyst (`skillopt/prompts/analyst_error.md`) | Reads a minibatch, classifies common failure types, and proposes only general, non-duplicative edits under a budget | Adapt as agent/human-facing proposer instructions, not an embedded model call | The Skill now instructs a proposer to aggregate repeated TRAIN failures, reject task hardcoding, and permit no edit. The CLI only validates supplied edits; it does not run the analyst. |
| Success analyst (`skillopt/prompts/analyst_success.md`) | Preserves general patterns shared by multiple successful trajectories instead of learning only from errors | Adapt conservatively as proposer instructions | The Skill now requires preserving repeated-success guidance. Success reinforcement remains lower priority than failure repair and cannot itself justify acceptance. |
| Failure/success/final merge (`merge_failure.md`, `merge_success.md`, `merge_final.md`) | Deduplicates independent proposals, carries `support_count` and `source_type`, keeps edit regions independent, and gives failure repair priority | Partially adapt as proposer/reviewer instructions | The Skill retains rationale, exact source case IDs, support count, source type, and ranking criteria; immutable-source overlap is rejected by the CLI. No automatic proposal merger is present. |
| Edit ranking (`skillopt/prompts/ranking.md`) | Orders proposals by systematic impact, complementarity, generality, then actionability | Adapt as proposer review criteria | The Skill now states these criteria. Ranking chooses what is worth testing, never what is accepted; selection evidence and controls remain authoritative. |
| Skill-aware reflection (`skillopt/optimizer/skill_aware.py`) | Separates `SKILL_DEFECT` from `EXECUTION_LAPSE`; when uncertain it protects the body and routes the lapse to an appendix note | Adapt as proposer instructions with a narrower body-preservation rule | The Skill now requires this discrimination and preserves existing sufficient guidance. Automatic appendix mutation is not implemented; reminders would still need a bounded reviewed candidate. |
| Optimizer-side meta memory (`skillopt/prompts/meta_skill.md`) | Uses adjacent-epoch evidence to improve how future proposals are written without adding target-facing rules | Record for a later laboratory | It belongs to the proposer, not the target Skill. The present zero-dependency CLI has no optimizer runtime or epoch scheduler. |
| Slow update (`skillopt/prompts/slow_update.md`) | Compares the same tasks across epochs for regressions, persistent failures, improvements, and stable successes, then replaces a protected guidance block | Narrow future experiment only | A longitudinal proposal may be useful, but automatic target-facing rewrites are excluded. Any protected-block update must become an ordinary reviewed candidate and rerun all controls. |
| Semantic-density bonus (`skillopt/evaluation/gate.py`) | Adds a score bonus for leading words such as `MUST`, `ALWAYS`, `NEVER`, and `VERIFY` when enabled | Reject | It rewards wording density independently of task behavior and can be gamed by stacking imperative tokens. Superzhao gates only observed outcomes; semantic-density gaming is never acceptance evidence. |
| Slow/meta updates and protected appendices | Stabilizes frequently rewritten prompts | Narrow adaptation | Recognized protected regions and Skill frontmatter are immutable. Automatic slow/meta rewriting is excluded. |
| Sleep session harvesting | Mines recurring behavior from past agent sessions | Reject | Archived-conversation and credential/provider inspection would cross Superzhao's privacy and authorization boundary. The CLI has no harvesting path. |
| Replay/dream rollouts and multi-provider backends | Broad automated optimization | Reject from this plugin | These add dependencies, credentials, network behavior, cost, and provider-specific policy. They can remain a separate external laboratory. |
| Candidate staging/consolidation | Separates evaluation from deployment | Adapt and harden | `stage` recomputes apply and gate bindings, emits a hash-bound repository-local bundle, and cannot install or adopt it. The output directory itself is not content-addressed. |
| Automatic adoption/install | Reduces manual deployment work | Reject | A staged candidate is not human approval. Source replacement, active-profile mutation, installation, commit, push, and publication remain outside the tool. |
| Web dashboard | Makes long experiments observable | Reject | It would violate the plugin's zero-dependency, no-server surface and is unnecessary for deterministic local reports. |

### Proposer protocol: instruction layer implemented, automation excluded

The repository Skill implements the defect/lapse, success-preservation,
prior-rejection, support-metadata, and ranking checks below as instructions for
an agent or human proposer. The CLI does not execute an analyst model, merge or
rank proposals, harvest trajectories, or decide that a proposal is true. The
full protocol records both those implemented instructions and the surrounding
review/CLI boundaries:

1. Freeze TRAIN trajectories and their raw evidence separately from selection
   and control evidence. Read every trajectory in a minibatch before proposing.
2. For each repeated failure, run the `SKILL_DEFECT` / `EXECUTION_LAPSE`
   discrimination test from `skill_aware.py`: if an existing correct rule would
   have prevented the failure, preserve the body and record only a possible
   reminder; when uncertain, default to lapse rather than deleting valid rules.
3. Analyze repeated successes separately. Propose reinforcement only for a
   general pattern shared by multiple successes and missing from the Skill.
4. Normalize every proposal with a rationale, exact source case IDs,
   `support_count`, `source_type` (`failure` or `success`), and its intended
   immutable-source target. Do not hardcode a single task's entities or values.
5. Merge failure proposals and success proposals separately; deduplicate,
   reject conflicting or overlapping targets, preserve non-redundant evidence,
   and never touch a protected region. In the final merge, failure repair takes
   priority over overlapping success reinforcement.
6. Rank the surviving edits by systematic impact, complementarity with current
   guidance, generality, and actionability. Respect the bounded edit budget and
   permit an empty proposal.
7. Query the rejected-candidate ledger before applying edits. Suppress an exact
   repeat unless new evidence or a changed assumption is recorded and linked to
   the prior rejection.
8. Apply the bounded patch to an immutable source, then evaluate the whole
   candidate on fresh selection evidence and all paired/cross-cutting controls.
   Proposal support never substitutes for the strict behavioral gate.
9. Keep meta memory optimizer-facing. Treat a slow-update block as a separately
   reviewed candidate; never let an epoch process silently modify or adopt a
   target Skill.

The protocol deliberately excludes provider backends, automatic rollouts,
session harvesting, automatic adoption, and semantic-density bonuses. The
current Skill Lab remains a deterministic validator for supplied human- or
agent-authored proposals. Its OSL-v3 implicit native candidate failed the first
valid important sample and is retained only as explicit-only, unlisted
experimental source; the instruction layer is not claimed as behavior accepted.

## Matt Pocock capability comparison

“Source value” records ideas worth examining even when a duplicate Skill should
not be introduced. “Unsafe/conflicting defaults” records what must not be copied
unchanged.

At the pinned Matt Pocock commit, `find skills -name SKILL.md` returns exactly
40 files: 22 under the stable `engineering/` and `productivity/` surfaces, 4
deprecated, 8 in progress, 4 miscellaneous, and 2 personal. The capability
table below covers 17 stable files (the first row groups two); the complete
40-file, one-path-per-row audit follows it.

| Upstream Skill | Existing Superzhao coverage | Source value | Unsafe or conflicting defaults | SEB-v1 binding | Final treatment |
|---|---|---|---|---|---|
| `productivity/grilling` and `grill-me` | `brainstorming` | One decision at a time; inspect discoverable facts instead of asking; distinguish facts from product decisions | “Relentless” exhaustive interviewing can over-trigger on a small request; a wrapper Skill adds no behavior | 001 / 002 | Preserve current Skill; strict important/control baseline is 5/5 and 5/5, so no duplicate |
| `engineering/tdd` | `test-driven-development` | Public behavior seams, independent expected values, tautology warning, one vertical slice at a time | Mandatory user confirmation of every seam adds ceremony; forbidding refactor inside RED-GREEN conflicts with Superzhao's tested RED-GREEN-REFACTOR discipline | 003 / 004 | Record ideas only; strict baseline is 4/5 important and 0/5 control, and later candidate campaigns were rejected |
| `engineering/diagnosing-bugs` | `systematic-debugging` plus TDD | A tight red-capable feedback command, minimal repro, discriminating instrumentation, tagged cleanup | Fixed 3–5 hypotheses and mandatory user presentation can be excessive when evidence already isolates the cause | 005 / 006, 015 / 022 | Record ideas only; strict baseline is 3/5 and 0/5, and the proposed loop-closure edit failed its cross-control and was removed |
| `engineering/code-review` | `requesting-code-review`, `receiving-code-review`, `verification-before-completion` | Bind a fixed point; distinguish requirements/spec findings from standards findings | Assumes an issue-tracker setup and a fixed two-agent report; its smell list can become generic review noise | 007 / 008 | Do not add a wrapper without new evidence; strict baseline is 5/5 important but 0/5 control |
| `engineering/implement` | `executing-plans`, TDD, review, verification | Regular focused typecheck/test feedback and final whole-suite proof | Always committing and always invoking review cross authorization and proportional-risk routing; wrapper duplicates the router | 009 / 010, 024 | Preserve current execution and authorization routing; strict 009/010 baseline is 5/5 and 5/5 |
| `productivity/writing-great-skills` | `writing-skills` | Invocation/context-load trade-off, checkable completion criteria, progressive disclosure, pruning/no-op vocabulary | Style heuristics are hypotheses, not proof; importing them wholesale would rewrite behavior-shaping content without eval evidence | 013 / 014 | Record ideas only; strict baseline is 1/5 important and 5/5 control, so no rewrite is accepted |
| `productivity/handoff` | No dedicated Skill; current agents can produce transfer records from execution state | Reference durable artifacts instead of duplicating them; redact secrets; tailor transfer to next-session goal | Always writing an OS-temp file creates unnecessary state and can omit repository-local discoverability | 017 / 018 | Record principles only; strict baseline is 0/5 important and 5/5 control, so a new Skill remains unproven |
| `engineering/domain-modeling` | Partial coverage through `brainstorming` | Canonical/fuzzy terms, concrete scenarios, code contradictions, context relationships, and sparing ADR criteria; invariants and state transitions are an independent Superzhao extension, not present in this upstream Skill | Automatic inline `CONTEXT.md`/ADR writes and fixed filenames cross scope; “invent scenarios” must not invent business semantics | 019 / 020 | Adapt only as an optional explicit-use Skill; strict current baseline is 0/5 and 0/5, force-read candidates were rejected, and native NDM-v2 rejected implicit invocation |
| `engineering/research` | Project Context7 rule; no managed core research Skill | Primary/official sources and claim-level citations | Mandatory background agent and repository Markdown output add coordination and writes when a direct answer is enough | 021 / 022 | Record principles only; strict baseline is 0/5 important and 2/5 control, so no new Skill is accepted |
| `engineering/codebase-design` | General design/brainstorming practices | Deep-module vocabulary, deletion test, leverage/locality, interface-as-test-surface | Enforcing one private glossary and banning common words is not a general workflow; examples are TypeScript-oriented | 023 / 024 | Record principles only; strict baseline is 0/5 important and 5/5 control, so no new Skill is accepted |
| `engineering/improve-codebase-architecture` | Brainstorming, review, parallel-agent routing | Scope scans toward actual hot spots; compare before/after candidates; surface ADR conflicts | Mandatory HTML, browser opening, Tailwind/Mermaid CDNs, temp files, fixed subagent type, and follow-on writes violate zero-dependency/proportional execution | 023 / 024 | Record principles only; strict baseline is 0/5 important and 5/5 control, so no audit Skill is accepted |
| `engineering/resolving-merge-conflicts` | Git inspection plus scope/verification rules | Inspect intent and primary sources; preserve compatible intent; verify semantic result | “Always resolve; never abort,” then stage and commit, is unsafe and exceeds the user's request | 027 / 028 | Preserve current semantic route and reject unsafe defaults; strict important/control baseline is 5/5 and 5/5 |
| `engineering/triage` | No dedicated Skill; diagnosis/review cover parts | Explicit issue state machine, claim verification, durable agent brief, resume without re-asking | Immediate labels/comments/closure, tracker assumptions, and “quick override” writes need point-of-execution authorization | 025 / 026 | Record principles only; strict baseline is 1/5 important and 4/5 control, so no project-ops Skill is accepted |
| `engineering/wayfinder` | Planning/brainstorming/parallel-agent primitives | Destination-first maps, decision tickets, fog/frontier, explicit blocking edges, one decision per session | Creates/assigns/comments/closes tracker items by default and can turn planning into a large external state machine | 011 / 018 | Record principles only; the bound strict scores are 2/5 and 5/5, so no project-ops Skill is accepted |
| `engineering/to-spec` | `brainstorming` and `writing-plans` | Synthesize settled context, record user-visible problem/solution, testing and out-of-scope decisions | Publishes and labels without a separate action gate; “extremely extensive” stories and mandatory seam confirmation can bloat work | 011 / 012 | Record principles only; strict baseline is 2/5 important and 5/5 control, so no specification Skill is accepted |
| `engineering/to-tickets` | `writing-plans`; user can request task breakdowns | Independently verifiable tracer-bullet slices, blocking edges, expand-contract exception | Publishes tracker/local files by default, mandates quiz/publish flow, and always applies labels | 011 / 012 | Record principles only; strict baseline is 2/5 important and 5/5 control, so no ticket Skill is accepted |

## Supporting-file comparison

These are source-level observations from files adjacent to the pinned Matt
Pocock Skills. They did not receive independent SEB-v1 behavior campaigns.

| Upstream supporting file | Source-reviewed value | Superzhao treatment | Boundary or default not adopted |
|---|---|---|---|
| `skills/engineering/codebase-design/DESIGN-IT-TWICE.md` | Frames constraints before ideation; asks 3+ agents for radically different interfaces; requires concrete calls, hidden implementation, dependency strategy, invariants/error modes, and comparison by depth, locality, and seam placement | Record as a design-exploration pattern for a future, separately evaluated candidate | Do not mandate parallel agents, a fixed number of designs, or a new codebase-design Skill for every interface decision. |
| `skills/engineering/codebase-design/DEEPENING.md` | Classifies dependencies as in-process, local-substitutable, remote-owned, or truly external; distinguishes hypothetical one-adapter seams from real two-adapter seams; replaces shallow tests with behavior tests at the new interface | Record the dependency classification and “replace, do not layer” test question for future architecture/TDD evals | Do not delete old tests or add ports merely because the source says so; prove equivalent coverage and a real seam in the target repository. |
| `skills/engineering/triage/OUT-OF-SCOPE.md` | Preserves concept-level rejection reasons, prior requests, deduplication, and an explicit reconsideration path | Adapt conceptually into the proposed rejected-candidate ledger below | Do not auto-close issues, auto-label, or treat semantic similarity as an irreversible rejection. A human confirms a match or changed decision. |
| `skills/engineering/triage/AGENT-BRIEF.md` | Durable current/desired behavior, key interfaces, independently verifiable acceptance criteria, and explicit out-of-scope boundaries; avoids stale line/file instructions | Record as a strong handoff/spec template and as a possible review shape for staged Skill candidates | Do not auto-post a brief to GitHub or assume the issue comment is authoritative without repository convention and authorization. |
| `skills/engineering/diagnosing-bugs/scripts/hitl-loop.template.sh` | Encodes a repeatable human-in-the-loop reproduction loop with explicit `step` and `capture` points and machine-readable captured values | Record as an optional debugging reference pattern | Do not copy its sample URL, capture secrets, require Bash in core, or claim an interactive loop is automated evidence. |
| `skills/engineering/tdd/mocking.md` | Restricts mocks to system boundaries, prefers dependency injection, and favors operation-specific SDK-style interfaces over a conditional generic fetcher | Mostly covered by Superzhao's real-code/minimal-mock and dependency-injection guidance; record the SDK-style interface example as source value only | Do not introduce a duplicate mocking Skill or reinterpret “system boundary” as permission to mock every external-looking collaborator. |
| `skills/engineering/domain-modeling/CONTEXT-FORMAT.md` | Gives a small glossary format with aliases to avoid and a multi-context map that names relationships between contexts | Consider a minimal optional reference for the engineering plugin after its behavior scope is settled | Do not auto-create `CONTEXT.md`/`CONTEXT-MAP.md`, infer authority from code, or force one repository layout. |
| `skills/engineering/domain-modeling/ADR-FORMAT.md` | Uses a deliberately short decision record, optional status/options/consequences, sequential names, and a three-part test: hard to reverse, surprising without context, real trade-off | Consider as an opt-in durable-decision format; the current persistence boundary remains chat-first | Do not auto-write or number ADRs, and do not turn every decision into an ADR. |

## Complete Matt Pocock 40-Skill source-review appendix

“Stable” below means only that the file is in the upstream `engineering/` or
`productivity/` surface at the pinned commit. It is not a Superzhao behavior
grade. Every disposition is provisional unless the corrected evidence cited in
the earlier capability table independently supports it.

### Stable surfaces (22/22)

| # | Upstream `SKILL.md` | Disposition | Source-reviewed value | Default explicitly not adopted |
|---:|---|---|---|---|
| 1 | `skills/engineering/ask-matt/SKILL.md` | Record the flow map; do not add a second router | Maps a main idea-to-ship flow, on-ramps, vocabulary layers, context hygiene, cross-session handoffs, and a prototype detour | Assumes its whole suite is installed, hard-codes a model-dependent smart-zone estimate, and duplicates Superzhao's existing routing Skills. |
| 2 | `skills/engineering/code-review/SKILL.md` | No duplicate; retain ideas only | Fixed comparison point and separate standards/spec axes reduce review drift | Fixed issue-tracker setup and mandatory two-agent execution are not proportional defaults; source review does not cure its failed stay-quiet evidence. |
| 3 | `skills/engineering/codebase-design/SKILL.md` | Record vocabulary and supporting patterns; no new core Skill | Deep modules, leverage, locality, deletion test, and interface-as-test-surface create useful design questions | Do not mandate one private glossary, ban ordinary synonyms, or generalize TypeScript-flavored examples without a behavior campaign. |
| 4 | `skills/engineering/diagnosing-bugs/SKILL.md` | Preserve current debugging Skills; no wrapper | Tight red-capable loop, minimal reproduction, discriminating instrumentation, cleanup, and post-mortem | Fixed hypothesis counts and mandatory presentation can add ceremony; the prior Superzhao loop-closure candidate failed a cross-control and was removed. |
| 5 | `skills/engineering/domain-modeling/SKILL.md` | Adapt only in the optional engineering experiment under the current explicit-use record | Canonical/fuzzy terms, concrete scenarios, code-contradiction checks, context relationships, and sparing durable decisions; Superzhao added invariants and states/transitions independently | Do not invent business semantics or automatically edit `CONTEXT.md`/ADRs; this source row is not proof that the candidate passed behavior evaluation. |
| 6 | `skills/engineering/grill-with-docs/SKILL.md` | Reject a duplicate one-line composition Skill | Shows that a small composition can reuse an interview primitive plus domain modeling | Its inherited automatic glossary/ADR writes exceed scope, and a wrapper adds no independently demonstrated behavior. |
| 7 | `skills/engineering/implement/SKILL.md` | Preserve Superzhao execution/risk routing | Regular focused checks, a final full suite, TDD, and review are useful orchestration cues | Automatic review, commit, and one universal implementation chain cross authorization and proportional-risk routing. |
| 8 | `skills/engineering/improve-codebase-architecture/SKILL.md` | Record principles only | Explore real hot spots, compare candidates, use deep-module/domain vocabulary, and surface conflicting decisions | Mandatory HTML, browser launch, CDN assets, temp files, fixed agents, and follow-on writes violate the zero-dependency/proportional boundary. |
| 9 | `skills/engineering/prototype/SKILL.md` | Future optional candidate only, with its own baseline and controls | Start from the question; use a small interactive logic model or 3 structurally different UI variants; expose state; keep real mutation/persistence out | Reject “no tests” as a universal rule, automatic throwaway branches/commits, and placing disposable code beside production by default. |
| 10 | `skills/engineering/research/SKILL.md` | Record principles only | Primary sources, claim-level citations, and a durable research artifact | Do not require a background agent or repository write when a direct read-only answer is enough. |
| 11 | `skills/engineering/resolving-merge-conflicts/SKILL.md` | Preserve current semantic-resolution route; reject unsafe defaults | Inspect history and primary intent, preserve compatible changes, and verify the semantic result | “Always resolve, never abort,” automatic staging, and committing exceed user authority. |
| 12 | `skills/engineering/setup-matt-pocock-skills/SKILL.md` | Reject from core; record setup hygiene | Explore existing files/config first, present a full draft before writing, update the existing AGENTS/CLAUDE section in place, and delay multi-context configuration until repository evidence warrants it | Do not assume `gh`/`glab` is usable, select a tracker only from a remote hint, or write tracker/domain docs and agent instructions outside confirmed scope. The upstream Skill records label vocabulary; it does not install CLIs or create real labels. |
| 13 | `skills/engineering/tdd/SKILL.md` | Preserve Superzhao TDD; retain narrower ideas only | Public behavior seams, independent expected values, anti-tautology checks, one vertical red-green slice, and focused mocking guidance | Mandatory confirmation of every seam and a loop that sidelines refactoring conflict with Superzhao's tested RED-GREEN-REFACTOR discipline. |
| 14 | `skills/engineering/to-spec/SKILL.md` | Record principles only | Synthesizes settled context, user-visible problem/solution, test seams, and out-of-scope decisions without re-interviewing | Automatic publication/labels and extremely extensive stories can bloat work and cross the action boundary. |
| 15 | `skills/engineering/to-tickets/SKILL.md` | Record principles only | Independently verifiable tracer-bullet slices, explicit blocking edges, and expand-contract exceptions | Do not publish files/issues, quiz, or label automatically; no ticket Skill passed the corrected gate. |
| 16 | `skills/engineering/triage/SKILL.md` | Record workflow concepts only | Explicit issue states, claim verification, negative-decision memory, and a durable agent brief | Immediate comments, labels, closure, and tracker assumptions require point-of-execution authorization. |
| 17 | `skills/engineering/wayfinder/SKILL.md` | Record large-effort mapping ideas only | Destination-first maps, decision tickets, fog/frontier, blocking edges, and one-decision sessions | Do not create/assign/comment/close tracker items by default or turn every plan into a large external state machine. |
| 18 | `skills/productivity/grill-me/SKILL.md` | Do not add the wrapper | A tiny explicit entry point can compose an existing interview primitive | It adds no behavior beyond `grilling`; a second wrapper increases discovery and maintenance load. |
| 19 | `skills/productivity/grilling/SKILL.md` | Preserve current `brainstorming`; no duplicate | One decision at a time, recommendations with questions, discover facts rather than ask, and wait for shared understanding | “Relentless” exhaustive interviewing can over-trigger for small or already-settled requests. |
| 20 | `skills/productivity/handoff/SKILL.md` | Record handoff principles only | References durable artifacts, tailors to the next session, suggests applicable Skills, and redacts secrets | Always writing to the OS temp directory creates state and weak discoverability; no handoff candidate passed the corrected gate. |
| 21 | `skills/productivity/teach/SKILL.md` | Candidate for a future standalone productivity plugin, not core | Mission grounding, observable learning outcomes, zone of proximal development, retrieval/spacing/interleaving, primary sources, and supersedable learning records | Do not auto-scaffold a whole workspace, require HTML/browser output, or recommend communities/actions by default; it needs a separate behavior campaign. |
| 22 | `skills/productivity/writing-great-skills/SKILL.md` | Record hypotheses only; keep Superzhao `writing-skills` | Invocation versus context load, checkable completion criteria, progressive disclosure, pruning, and no-op vocabulary | Style and leading-word heuristics are not behavioral proof; wholesale restructuring would violate the high bar for behavior-shaping content. |

### Deprecated (4/4)

| # | Upstream `SKILL.md` | Disposition | Source-reviewed value | Default explicitly not adopted |
|---:|---|---|---|---|
| 23 | `skills/deprecated/design-an-interface/SKILL.md` | Do not revive; retain its stronger ideas through the `DESIGN-IT-TWICE.md` comparison | Requirements first, multiple radically different interfaces, concrete usage, hidden implementation, and explicit trade-off comparison | Do not add a duplicate Skill or require parallel sub-agents for every interface; upstream itself has moved the pattern into supporting material. |
| 24 | `skills/deprecated/qa/SKILL.md` | Reject as a general Skill; record the issue-writing template | Light clarification, expected/actual behavior, reproducible steps, user-facing language, and splitting independently fixable failures | It says to file with `gh` without review and assumes an Explore agent and GitHub authority; external writes need explicit confirmation. |
| 25 | `skills/deprecated/request-refactor-plan/SKILL.md` | Record planning ideas only | Verify the current repository, compare alternatives, settle scope/testing, name out-of-scope work, and keep each refactor step working | Exhaustive interviewing, a universally tiny-commit plan, and automatic GitHub issue creation are not portable or proportional defaults. |
| 26 | `skills/deprecated/ubiquitous-language/SKILL.md` | Fold source ideas into domain-modeling review; no separate Skill | Aliases to avoid, relationships/cardinality, example dialogue, ambiguity flags, and updates as understanding evolves | Do not automatically create `UBIQUITOUS_LANGUAGE.md`, force a canonical term without the domain owner, or treat code names as domain truth. |

### In progress (8/8)

| # | Upstream `SKILL.md` | Disposition | Source-reviewed value | Default explicitly not adopted |
|---:|---|---|---|---|
| 27 | `skills/in-progress/claude-handoff/SKILL.md` | Do not import; retain portable handoff principles in the existing comparison | Compact summaries, artifact references, redaction, next-session focus, and descriptive task names | It invokes `claude --bg` immediately and assumes Claude Code's background-agent surface; that is harness-specific execution without a portable authorization gate. |
| 28 | `skills/in-progress/loop-me/SKILL.md` | Do not import into core; source note for a possible personal-workflow plugin | Trigger/event distinction, human checkpoints, “push right,” decision-ready briefs, and implementable workflow specs | Do not automatically create/edit/delete `workflows/*.md` or impose its personal-life loop ontology on general engineering work. |
| 29 | `skills/in-progress/setup-ts-deep-modules/SKILL.md` | Reject from general core; evaluate only as a separate TypeScript/tool plugin if demanded | Inspect the environment, merge existing config, define public entry points, prove pass/fail/pass, and leave a discoverable convention pointer | Installs `dependency-cruiser`, imposes one package layout, scaffolds code, edits AGENTS/CLAUDE, and adds dependencies; all are domain/tool-specific writes. |
| 30 | `skills/in-progress/to-questionnaire/SKILL.md` | Record as an async decision-owner handoff candidate | “Grill the send, not the subject,” identify recipient and needed decisions, ask most-important-first, and welcome partial/unknown answers | Do not write a fixed `to-questionnaire-<slug>.md` automatically or assume one questionnaire template fits every domain; authorization and behavior eval are required. |
| 31 | `skills/in-progress/wizard/SKILL.md` | Do not import; possible separate setup-automation plugin after safety review | Map stages and captured values, verify current UI/docs rather than invent steps, hide secrets, confirm irreversible actions, and statically trace value destinations | Browser opening, `.env` mutation, GitHub secret writes, copied Bash runtime, and optional commit are high-impact/tool-specific operations, not core defaults. |
| 32 | `skills/in-progress/writing-beats/SKILL.md` | Keep outside engineering core; possible writing plugin source | Ground concepts before depending on them, offer 2–3 reachable next beats, write one chosen beat, and reread before each edit | Do not force a choose-your-own-adventure authoring loop or incremental file writes for ordinary documentation tasks. |
| 33 | `skills/in-progress/writing-fragments/SKILL.md` | Keep outside engineering core; possible writing plugin source | Cleanly separates exploration from exploitation, captures heterogeneous fragments, rereads before append, and preserves user edits | Silent append-by-default and a fixed fragment-file format are out of scope without explicit artifact authorization. |
| 34 | `skills/in-progress/writing-shape/SKILL.md` | Keep outside engineering core; possible writing plugin source | Treats source material as read-only, compares openings, grows agreed blocks incrementally, grounds concepts, and chooses formats deliberately | Do not mandate adversarial paragraph-by-paragraph interaction or create a separate article file for every editing request. |

### Miscellaneous (4/4)

| # | Upstream `SKILL.md` | Disposition | Source-reviewed value | Default explicitly not adopted |
|---:|---|---|---|---|
| 35 | `skills/misc/git-guardrails-claude-code/SKILL.md` | Reject from core; possible standalone Claude Code harness plugin | Enforce safety at the command boundary, choose project/global scope, merge existing settings, and test a denied command | Claude-specific hook JSON and a blanket block on every push are not portable; Superzhao keeps authorization at the point of action. |
| 36 | `skills/misc/migrate-to-shoehorn/SKILL.md` | Reject | Provides a narrow migration table and typecheck-after-rewrite workflow | It promotes and installs `@total-typescript/shoehorn`, assumes TypeScript test conventions, and replaces assertions by policy; this is third-party/tool-specific. |
| 37 | `skills/misc/scaffold-exercises/SKILL.md` | Reject | Validate generated structure, keep stubs minimally meaningful, use `git mv`, and rerun the repository's own linter | AI Hero course paths, its private lint command, exercise numbering, and automatic commit are project-specific. |
| 38 | `skills/misc/setup-pre-commit/SKILL.md` | Reject from core | Detect package manager/config, preserve existing config where possible, and verify the hook | Installing Husky/lint-staged/Prettier, creating opinionated formatting config, running full tests on every commit, and auto-committing violate zero-dependency/project-choice boundaries. |

### Personal (2/2)

| # | Upstream `SKILL.md` | Disposition | Source-reviewed value | Default explicitly not adopted |
|---:|---|---|---|---|
| 39 | `skills/personal/edit-article/SKILL.md` | Reject from shared distribution | Ordering information by dependency and confirming the section map before rewriting are useful editing prompts | The fixed maximum of 240 characters per paragraph is an author's personal style, not a general correctness rule. |
| 40 | `skills/personal/obsidian-vault/SKILL.md` | Reject | Wikilinks, backlinks, and index notes are useful patterns inside a configured Obsidian workflow | It hard-codes `/mnt/d/Obsidian Vault/AI Research/`, flat layout, title conventions, and personal note taxonomy. |

The appendix therefore covers **40/40** upstream `SKILL.md` paths: 22 stable,
4 deprecated, 8 in progress, 4 miscellaneous, and 2 personal. This is coverage
of source inspection, not a 40/40 behavioral score.

## Cross-repository fusion: rejected-candidate ledger

The strongest direct fusion is Matt Pocock's concept-level negative knowledge
in `skills/engineering/triage/OUT-OF-SCOPE.md` plus SkillOpt's retained rejected
edits. The Skill and campaign reference now require consulting supplied prior
rejections and document `.skill-lab/rejected-candidates/` as a human-managed
storage convention. The CLI does **not** implement searchable cross-campaign
memory, similarity matching, or automatic suppression, and the design has not
passed a native behavior gate.

Each future ledger record should bind the source, candidate, scenario, rubric,
environment, and gate-report digests, then retain:

- the normalized failure pattern or proposal concept;
- rationale, exact source case IDs, `support_count`, and `source_type`;
- proposed bounded edits and their immutable-source targets;
- a reason class such as `EXECUTION_LAPSE`, `DUPLICATE_GUIDANCE`,
  `NO_IMPORTANT_IMPROVEMENT`, `IMPORTANT_FAILURE`, `CONTROL_REGRESSION`, or
  `EVIDENCE_INVALID`;
- the human-readable reason, affected controls, and links to the campaign's
  retained evidence;
- prior equivalent attempts and, when reconsidered, the new evidence or changed
  assumption that justifies another proposal.

Before proposing, an optimizer would check exact digest matches and surface
conceptually similar records. Exact repeats with no new evidence should be
suppressed; similarity should only warn a human, never auto-reject. A human may
confirm, distinguish, or reconsider the prior decision. Records should preserve
digests and safe references rather than copy credentials or sensitive raw
session text, and nothing in the ledger may stage, adopt, install, delete, or
publish a candidate automatically.

## Decision standard

- `5/5` important and its control: preserve current behavior; no duplicate Skill.
- Same material current failure in at least `2/5`: a narrow candidate is allowed.
- One failure: inconclusive; run a separately identified confirmation set.
- A candidate must pass `5/5` on every targeted important case, have no valid
  important failure, and not regress its paired or cross-cutting controls.
- Static prose similarities never substitute for behavior evidence.

The baseline, development candidate, rejected exact profile, and formerly
accepted exact-profile records retain every raw actor output. Their strict
rescores are respectively 82/140, 22/40, 13/28, and 19/40. No candidate passed
the frozen gate. The native implicit domain-modeling and Skill Lab candidates
were also rejected; see `2026-07-15-domain-modeling-native-v2-results.md` and
`2026-07-15-skill-lab-native-v3-results.md`.
