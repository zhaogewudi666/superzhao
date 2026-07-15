---
name: receiving-code-review
description: Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation
---

# Code Review Reception

Review feedback is a set of technical claims, not an order and not a social
performance. Verify each claim against the requirements and current code before
changing behavior.

**Core principle:** Evaluate per finding, preserve dependencies, and respond with
evidence.

## Triage the Findings

Read the complete review so dependencies and duplicate findings are visible. For
each item, identify the claimed problem, affected requirement or invariant,
severity, and supporting code or test evidence.

Record one per-finding decision: accepted, rejected, or needs clarification, with the evidence and dependencies that justify it.

- **Accepted:** the finding is reproducible or follows from an applicable
  requirement. State the behavior to change.
- **Rejected:** code, tests, compatibility constraints, or scope show that the
  proposed change is wrong or unnecessary. Cite that evidence.
- **Needs clarification:** multiple materially different interpretations remain,
  or the required product/architecture choice is not authorized.

A reviewer's severity label is an input, not a fact. Reclassify it when impact
evidence warrants that, and never silently downgrade a security, data-loss, or
contract issue.

## Handle Ambiguity by Dependency

An unclear finding pauses that finding and anything that depends on it; continue verifying or implementing independent accepted findings when safe.

Ask one concise grouped question when the missing answer changes scope, public
behavior, invariants, or the implementation of dependent findings. Do not invent
the answer. If feedback conflicts with the user's prior decision, pause that
affected branch and surface the conflict before changing it.

Do not manufacture dependencies merely because findings arrived in one review.
Likewise, do not proceed with an apparently independent fix when shared code or an
unresolved requirement makes it dependent in practice.

## Verify Against This Codebase

Before accepting external feedback, check the current implementation, relevant
requirements, callers, supported platforms or versions, tests, and the reason the
existing behavior exists. For a request to add a "proper" or generalized feature,
confirm real usage and scope; otherwise keep it out as YAGNI.

Feedback from the user expresses intent, but ambiguity and conflicts still need to
be resolved. External feedback deserves the same technical inspection without
assuming either correctness or error.

If evidence cannot be obtained safely, state what is missing and what decision it
prevents. Do not convert uncertainty into implementation confidence.

## Implement Accepted Findings

- Address truly blocking findings first.
- Work in dependency order. Independent mechanical findings may be handled as a
  coherent batch; behavior changes need behavior-scoped proof.
- Run the narrowest deterministic validation that proves each changed behavior,
  then the relevant regression checks.
- Re-evaluate downstream decisions when a fix changes the code or requirements
  they were based on.
- Keep optional adjacent improvements out of the patch unless the user expands
  scope.

Use the normal risk gates for the resulting changes. Material fixes may require a
fresh review of their exact final content; a prior reviewer verdict does not prove
the corrected tree.

## Respond Technically

Prefer compact, falsifiable outcomes:

- `Fixed: <behavior>; verified with <evidence>.`
- `Not changing this: <code/requirement evidence>.`
- `Need clarification on <specific choice>; findings 2 and 5 depend on it.`

Do not substitute praise, gratitude, or automatic agreement for evaluation. If
your earlier pushback was wrong, state the new evidence and corrected decision
without defending the old position.

## GitHub Thread Replies

When authorized to reply to inline GitHub review comments, reply in the existing
thread rather than creating an unrelated top-level comment.

## The Bottom Line

Evaluate each finding, clarify only what is genuinely ambiguous, and implement the
supported decisions with current evidence.
