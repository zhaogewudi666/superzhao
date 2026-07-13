# Risk Levels

Use the highest matching level. Ambiguity escalates only when the answer changes scope, architecture, side effects, or risk.

| Level | Observable conditions | Default process |
|---|---|---|
| R0 | Read-only explanation, search, audit, status, or review without requested edits | Inspect directly and support conclusions with evidence. |
| R1 | Localized and reversible; no runtime behavior, data contract, security, deployment, external integration, or production-critical change | Edit directly, inspect the diff, and run targeted validation. |
| R2 | Bug, observable behavior, public API, or coordinated multi-file change without R3 consequences | Investigate bugs first; use test-first when automatable; plan only for three dependent steps or multiple components; review material logic once at the end. |
| R3 | Security, auth, money, migration, concurrency, destructive data action, production deployment, external side effect, or cross-system change | Require approved written design, isolation, plan, TDD/debugging as applicable, independent review, full verification, rollback or compensation, and separate authorization for destructive/publish/deploy actions. |

Explicit user instructions override the default process but do not silently authorize destructive or external actions.
