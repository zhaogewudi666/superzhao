---
name: optimize-agent-skill
description: Use when the user explicitly asks to use Superzhao Skill Lab to optimize, compare, gate, or stage a body-only candidate for an existing Agent Skill. You MUST read this Skill and its campaign-format reference before answering that request. Do not use for ordinary Skill creation or editing, frontmatter changes, or requests that do not name Superzhao Skill Lab.
---

# Optimize Agent Skill

Build and evaluate a body-only candidate beside an existing source Skill. This
workflow turns supplied evidence into a reviewable proposal; it never changes
the source Skill or active profile.
It never changes an active Skill.

## Scope and safety boundary

- Work only on an existing, valid `SKILL.md` in a trusted single-writer
  workspace. New Skill creation belongs to `writing-skills`, whose external
  behavior campaign may use a no-Skill baseline; this CLI does not model an
  absent-source arm.
- Frontmatter is immutable. Trigger, name, description, or other metadata
  changes require a separate reviewed workflow and behavior campaign.
- Do not inspect session histories, credentials, or provider state.
- Do not install, activate, adopt, publish, commit, push, or replace a source or
  active Skill.
- Do not expose selection answers or scorer expectations to proposal authors or
  actors.
- Do not run against a workspace where an untrusted same-user process can swap
  directories during publication. Node standard-library path checks do not
  claim protection from a malicious concurrent parent-directory replacement.

## Proposer protocol

Before writing an edit, inspect only the proposal/training evidence and prior
rejections supplied by the user:

1. Separate repeated `SKILL_DEFECT` evidence from an `EXECUTION_LAPSE`. If the
   current Skill already contains correct, sufficient guidance that an actor
   ignored, preserve the body instead of accumulating louder duplicate rules.
2. Preserve useful patterns supported by repeated successes. Failure repair has
   priority, but a candidate must not erase working guidance.
3. Read earlier rejected gate reports. Do not repeat the same proposal unless
   new evidence or a changed assumption is recorded.
4. For each proposed edit, retain its rationale, supporting case IDs, support
   count, and source type. Reject task-specific hardcoding and permit no edit.
5. Rank surviving proposals by systematic impact, complementarity with current
   guidance, generality, and actionability. Ranking selects what to test; it
   never selects what to adopt.

## Workflow

1. Read [campaign-format.md](references/campaign-format.md) completely before
   responding or constructing campaign artifacts.
2. Bind the exact source and candidate bytes plus the physical scenario,
   rubric, environment, and raw-evidence files. Review the scenario and rubric
   case inventory manually; hashes prove byte identity, not coverage quality.
3. Express the smallest body-only candidate as immutable-source operations.
   Stay within the four-operation hard cap, per-edit UTF-8 cap, and declared
   total added/removed byte budgets. Never weaken anchors or protected regions
   merely to make `apply` succeed.
4. Run `apply`. A handled failure may leave a complete orphan only when safe
   ownership cannot be proved; inspect reported paths instead of deleting by a
   guessed name.
5. Set `required_valid` to at least five fresh samples, then collect exactly
   that many current and candidate samples for each selection case. Retain invalid and
   indeterminate samples with reasons.
   Keep actor/evidence identities paired and separate across arms and splits.
6. Have a human or independent scorer assign outcomes and stable failure codes,
   then run `gate`. The CLI recomputes artifact hashes and structural
   consistency; it cannot prove actor independence or scoring truth.
7. Run `stage` only after an accepted gate. Staging recomputes both reports and
   packages source, candidate, edits, results, campaign inputs, and deduplicated
   raw evidence. `manifest.json` is the completion marker.
8. Treat a stage directory without `manifest.json` as incomplete. Do not review,
   adopt, or delete it automatically; inspect it first, then let the user decide
   whether to remove it or choose a new output directory.
9. Present the manifest, complete candidate diff, human-attested limitations,
   prior rejection relationship, and full evidence location for human review.

## Decision rules

- Current behavior passes important and control cases: preserve it.
- One current failure is inconclusive. A strict improvement counts only when at
  least two current failures in the same case share a `failure_code`.
- Every selection case must have exactly the declared valid count in both arms.
- Any candidate important failure, control regression, stale/missing preimage,
  mismatched actor/evidence pairing, or inconsistent report rejects staging.
- Several candidates that pass separately must be combined once and rerun on
  whole-profile important, safety, and over-trigger controls.

The resulting bundle is a proposal. SHA-256 bindings establish which bytes were
reviewed; they do not establish that a person was independent, a score was
correct, or the candidate should be installed.
