---
name: brainstorming
description: Use when requirements are materially ambiguous, consequential design trade-offs exist, architecture or interfaces must be chosen, or work is high risk (R3), before implementation
---

# Brainstorming Ideas Into Designs

Turn materially ambiguous or consequential ideas into decision-complete designs, with rigor scaled to risk.

<HARD-GATE>
R3 implementation waits for explicit approval of the final written design. R2 may use a concise inline design once its consequential decisions are clear. R0 and R1 do not use this skill.
</HARD-GATE>

## Decision-Complete Output

A design is ready when it makes the relevant decisions explicit:

- outcome, success evidence, current context, and base state;
- in-scope and out-of-scope behavior, constraints, and invariants;
- chosen approach, interfaces, and data flow;
- real alternatives and trade-offs when a consequential choice exists;
- failure handling, security boundaries, rollback or compensation;
- validation strategy and unresolved questions with a decision owner.

Not every item needs its own section. Include only what affects this decision.

## Adaptive Process

1. Inspect the current project, instructions, and relevant history.
2. Compare what is known with the decision-complete output above.
3. Ask only blocking unknowns. Group independent questions when that helps the user answer efficiently; ask sequentially when later questions depend on earlier answers.
4. Explain real alternatives with a recommendation. Do not invent options when one approach is already required by evidence or constraints.
5. Synthesize the design, check it for gaps and contradictions, then request approval at the appropriate risk gate.

If the user already supplied a decision-complete design, review it directly and ask only about material gaps. There is no fixed interview count, option count, section order, or approval cadence.

## Risk-Proportional Gate

- **R2:** An inline design is enough when scope, interfaces, failure handling, and validation are clear. Do not create a spec unless the user or project requires one.
- **R3:** Write the validated spec to the user- or project-preferred location (default `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`). Self-review placeholders, consistency, ambiguity, scope, failure handling, and validation before approval.

For R3 approval, name the exact spec path, its content digest, and the base commit or state. Ask for approval once the complete artifact is ready. A material change to outcome or scope, interfaces or invariants, risk, or authorization invalidates approval and requires re-approval; implementation-only detail that preserves them does not.

## Design Quality

- Decompose only when independent subsystems cannot be understood or validated as one design.
- Prefer cohesive units with explicit responsibilities, interfaces, and dependencies.
- Follow existing codebase patterns unless a directly relevant problem requires a targeted change.
- Remove unrequested features and unrelated refactors.
- Surface unresolved decisions honestly; do not manufacture certainty.

After an approved R3 design, invoke `writing-plans`. Do not begin implementation from this skill.

## Visual Companion

A browser-based companion for showing mockups, diagrams, and visual options during brainstorming. Available as a tool — not a mode. Accepting the companion means it's available for questions that benefit from visual treatment; it does NOT mean every question goes through the browser.

**Offering the companion (just-in-time):** Do NOT offer it upfront. Wait until a question would genuinely be clearer shown than told — a real mockup / layout / diagram question, not merely a UI *topic*. The first time that happens, offer it then, as its own message:
> "This next part might be easier if I show you — I can put together mockups, diagrams, and comparisons in a browser tab as we go. It's still new and can be token-intensive. Want me to? I'll open it for you."

**This offer MUST be its own message.** Only the offer — no clarifying question, summary, or other content. Wait for the user's response. If they accept, start the server with `--open` so their browser opens to the first screen automatically. If they decline, continue text-only and don't offer again unless they raise it.

**Per-question decision:** Even after the user accepts, decide FOR EACH QUESTION whether to use the browser or the terminal. The test: **would the user understand this better by seeing it than reading it?**

- **Use the browser** for content that IS visual — mockups, wireframes, layout comparisons, architecture diagrams, side-by-side visual designs
- **Use the terminal** for content that is text — requirements questions, conceptual choices, tradeoff lists, A/B/C/D text options, scope decisions

A question about a UI topic is not automatically a visual question. "What does personality mean in this context?" is a conceptual question — use the terminal. "Which wizard layout works better?" is a visual question — use the browser.

If they agree to the companion, read the detailed guide before proceeding:
`skills/brainstorming/visual-companion.md`
