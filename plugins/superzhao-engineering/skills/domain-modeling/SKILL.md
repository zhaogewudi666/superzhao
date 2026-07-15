---
name: domain-modeling
description: Use before schema, migration, authorization, workflow, or lifecycle work when unresolved business terms, invariants, or state transitions would change behavior; also use when the user asks to establish domain language or record a durable domain decision. Do not use for a simple implementation-only edit whose semantics are already settled.
---

# Domain Modeling

Turn known business facts into an explicit model before committing them to a
schema or implementation. The model exposes decisions; it does not make product
decisions on the user's behalf.

## Core Rule

When unresolved domain meaning would change behavior, **model before schema,
migration, or code**. The concrete next action is to state the provisional
concepts, invariants, and state transitions already supported by evidence, mark
the open decisions, and then ask one focused, possibly grouped, blocking
question.

Do not jump directly from “the semantics are obvious” to a migration. Do not
invent an entitlement rule, ownership rule, lifecycle transition, or failure
policy merely to keep implementation moving.

Anchor the frame in supplied known invariants and connect each open decision to
the state, transition, or boundary it would change. A generic lifecycle sketch
is not a substitute for concrete task evidence.

## Workflow

### 1. Orient to evidence

Inspect the repository for existing language, behavior, tests, schemas, and
decision records. Resolve discoverable facts yourself. If code and stated
business language disagree, surface the contradiction instead of silently
choosing one.

Classify each relevant statement as:

- **Known** — supported by current product decisions or observable behavior.
- **Inferred** — plausible from code or context but not yet authoritative.
- **Open** — requires a product or domain-owner decision.

### 2. Frame the model in chat first

Use [modeling-frame.md](references/modeling-frame.md) for material lifecycle or
cross-context work. Include only what the current decision needs:

- concepts and their responsibilities;
- canonical terms and ambiguous synonyms;
- invariants that must always hold;
- states, allowed transitions, and forbidden transitions;
- actors and ownership boundaries;
- representative normal, edge, and failure scenarios;
- contradictions and open decisions.

Keep domain meaning separate from implementation detail. A database column or
class name can be evidence, but it is not automatically the domain model.

### 3. Put the blocking choice to its owner

After showing the known frame, ask one focused or grouped blocking question.
Group choices only when they jointly determine the same state machine, schema,
or authorization rule. Give a recommendation when evidence supports one, while
making clear that the owner decides.

Wait when the answer is material. If the user is unavailable, record the open
decision and stop before irreversible or semantics-encoding work.

### 4. Reconcile and stress-test

Update the frame with the decision, then test it against concrete scenarios:

- the ordinary path;
- boundary timing and retries;
- invalid or forbidden transitions;
- partial completion and rollback;
- historical records and migration;
- interactions with neighboring concepts or contexts.

Every scenario should either follow the model or expose a remaining decision.

### 5. Hand the model to design and implementation

Translate settled meaning into schema, API, migration, tests, or an
implementation plan only after the relevant open decisions are closed. Bind
those artifacts back to the terms, invariants, and transitions they implement.

## Persistence Boundary

The response or chat is the default first artifact. Do not automatically create
or update `CONTEXT.md`, a glossary, an ADR, an issue, or any other persistent
artifact. Write or publish one only when the user requested it, an approved plan
requires it, or current repository conventions and authorization clearly place
that write in scope.

A user request or current authorization must cover any persistent write or
published artifact.

Offer a durable decision record only when the choice is hard to reverse,
surprising without context, and the result of a real trade-off. Reference
existing artifacts rather than duplicating them.

## Proportional Controls

- A simple private rename or other R1 edit with fixed semantics takes the direct
  route with targeted validation; no domain-modeling ceremony is needed.
- A decision-complete design proceeds to planning or proportional execution; do
  not reopen settled discovery without contradictory evidence.
- Diagnosis-only work reports the evidenced cause; it does not create a domain
  workshop unless the failure actually reveals conflicting business meaning.
- Never use a glossary or ADR write as a substitute for obtaining the missing
  business decision.

## Completion Check

Domain modeling for the current task is complete when the concepts use one
meaning, relevant invariants and states are explicit, concrete scenarios agree
with them, code contradictions are resolved or recorded, and every
implementation-shaping open decision has an owner and an answer.
