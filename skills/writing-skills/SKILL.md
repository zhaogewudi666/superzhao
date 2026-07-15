---
name: writing-skills
description: Use when creating new skills, editing existing skills, or verifying skills work before deployment
---

# Writing Skills

A Skill is behavior-shaping code expressed as instructions and supporting
artifacts. Change it with observable scenarios, repeated samples, and controls—not
intuition about what a model might need.

**Core principle:** Preserve behavior that already works; add only guidance that
produces a demonstrated improvement without weakening safety or useful autonomy.

Use `test-driven-development` for the RED/GREEN discipline. This Skill defines
what RED and GREEN mean for an instruction artifact. Detailed scenario design is
in [testing-skills-with-subagents.md](testing-skills-with-subagents.md); authoring
conventions are in
[anthropic-best-practices.md](anthropic-best-practices.md).

## Decide Whether the Guidance Belongs in a Skill

Create or retain a Skill when the technique is reusable across projects, needs
judgment, and measurably changes behavior. Prefer another mechanism when the rule
is project-specific, already covered by authoritative documentation, or can be
enforced deterministically by a validator without model judgment.

Skills may teach a technique, shape a decision pattern, enforce a safety
discipline, or provide a reference. Do not turn one successful session, a personal
preference, or an optional adjacent improvement into a general Skill.

## Choose the Correct Baseline

For a new Skill, run a no-Skill baseline to prove that the target behavior is not already reliable.

For an existing Skill, compare current behavior with the candidate on the same important and control scenarios; a no-Skill arm is supplemental evidence, not the baseline.

If the current Skill passes the important and control scenarios, do not rewrite it unless a demonstrated shared-contract change requires an update.

The candidate must not regress any control behavior that the current Skill handles correctly. Controls should include cases where the Skill ought to stay quiet,
permit direct action, or choose a lighter-weight path.

This distinction matters for stronger models: old guidance may now duplicate sound
default reasoning or suppress useful autonomy. Measure that effect directly. Do
not manufacture a failure by pretending an installed Skill is absent, and do not
remove a safety boundary merely because the important case passed once.

## Define the Behavior Contract

Before editing, write a compact evaluation contract:

- target behavior stated as an observable decision or output;
- important scenarios that exercise the real failure;
- control scenarios that detect over-triggering and lost autonomy;
- allowed outcomes and a decision rubric;
- exact current and candidate content identities;
- model, harness, relevant tools/plugins, scenario text, and context window;
- evidence that would invalidate the result.

Keep this in the task's evaluation notes or report. It is evidence, not a new
runtime subsystem.

Static contract tests are useful for required phrases, forbidden regressions, and
file shape. They do not prove that a model follows the instructions, so pair them
with behavior samples whenever behavior is being changed.

## Run RED → GREEN → REFACTOR

### RED: Observe Current Behavior

Run the bound scenarios against the no-Skill condition for a new Skill, or the
current committed Skill for an edit. Record the actual output, decision, and
failure reason. A theoretical concern or reviewer suspicion is not a failing
behavior test.

If current behavior does not exhibit the claimed problem, stop. Keep the Skill as
is or narrow the question; extra wording without a behavioral gap is likely to
become a constraint rather than an improvement.

### GREEN: Make the Smallest Behavior Change

Write only enough guidance to address the observed failure. Keep the target
outcome, scope, invariant, and safety boundary explicit while leaving internal
reasoning and equivalent implementation choices to the model.

Use at least five fresh, independent, valid candidate samples for behavior-shaping changes, with the same scenario and relevant settings used for the baseline.

- Give each sample a fresh context (`fork_turns="none"` or another deliberately
  bounded window) unless inherited context is itself what the Skill controls.
- Do not coach a sample with the expected label, repair its answer, or retry until
  a preferred answer appears.
- Mark every invalid or indeterminate run, report it, and do not count it as a pass or failure; obtain a separately identified fresh sample when the valid-sample target is still unmet.
- Read every output manually. Template echoes, quoted counterexamples, and keyword
  matches are not behavioral compliance.
- Treat convergence as evidence: five incompatible interpretations usually mean
  the contract or wording is still ambiguous.

Reference-only changes may use deterministic retrieval/application checks when
there is no behavior-shaping decision, but still test representative important
and control queries.

### REFACTOR: Remove Accidental Constraint

After GREEN, delete repetition, obsolete examples, fixed ceremony, and rules that
the current model already supplies reliably. Re-run the same behavior samples and
controls after any material wording change. If the candidate content, scenario,
model, tool surface, or scoring rubric changes, the earlier evidence no longer
proves the new candidate.

## Match Wording to the Observed Failure

| Observed failure | Prefer | Avoid |
|---|---|---|
| Skips a known safety rule under pressure | Direct boundary plus concrete counterexample | Vague advice |
| Produces the wrong output shape | Positive output contract | Long prohibition list |
| Omits a required element | Named field in the artifact | Reminder buried in prose |
| Behavior depends on context | Observable conditional predicate | Universal rule plus exceptions |
| Over-applies an existing Skill | Explicit control case and lighter path | More emphasis on the important case |

Rationalization tables and red-flag lists are tools for demonstrated discipline
failures, not mandatory sections. For an output-shaping or over-constraint
failure, adding prohibitions often makes the Skill longer without making its
behavior clearer.

Safety language must remain proportional to demonstrated risk. Keep destructive,
publication, credential, migration, and production boundaries explicit; do not
inflate routine reversible work to the same gate.

## Write a Compact, Discoverable Skill

Use a flat directory with `SKILL.md` and only necessary supporting artifacts.
Frontmatter requires `name` and `description`; keep the description focused on
observable trigger conditions, not a compressed copy of the workflow. Use a
lowercase hyphenated name and searchable terms users or agents would naturally
use.

The entrypoint should contain the decision contract and shortest usable method.
Move long API reference, extended evaluation methodology, reusable scripts, and
large examples to focused supporting files that the entrypoint links when needed.
Do not duplicate another Skill's workflow; name the required Skill and state why
it applies.

Prefer one real example over several variants. Use a diagram only when branching,
state, or dependency is materially clearer than prose. Run `wc -w` as a prompt to
justify size, not as permission to delete required safety content.

## Finish and Deploy

For each Skill, preserve its RED result, static RED/GREEN check, valid candidate
samples, control result, content binding, and any indeterminate samples. Commit a
coherent evaluated change so later review can identify exactly what the evidence
covered.

For a coordinated profile update, deploy the integrated profile only after whole-set verification; do not reinstall the runtime after every individual Skill.

Use the repository's existing install, backup, rollback, and integrity mechanisms
when they are sufficient. A failing behavior or integrity check may justify
investigation, but does not authorize a new deployment platform. Publishing,
pushing, marketplace submission, or upstream contribution remains a separate
external action requiring the applicable authorization.

## Completion Check

- The baseline matches new-versus-existing Skill status.
- The important failure is real and the control behavior is recorded.
- Candidate evidence is bound to exact content and environment.
- Required valid samples pass without hidden retries or coaching.
- Static tests pass and the candidate does not regress controls.
- The entrypoint is concise and supporting detail is referenced, not duplicated.
- Integrated installation happens only after whole-set verification.

Stop when the stated behavior and safety outcome are proven. List optional future
experiments in the handoff instead of implementing them automatically.
