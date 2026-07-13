# Risk Levels

Classify the requested action and side effects, not merely the subject matter. Read-only work remains R0 even when it concerns security, auth, money, migration, production, or external systems; public research or inspection of local or user-provided evidence is not an external side effect. Operating on a production or private external system is a requested action and routes by its effects. For requested changes and actions, use the highest matching level. Ambiguity escalates only when the answer changes scope, architecture, side effects, or risk.

| Level | Observable conditions | Default process |
|---|---|---|
| R0 | Read-only explanation, search, audit, status, or review without requested edits | Inspect directly and support conclusions with evidence. |
| R1 | Localized and reversible; no runtime behavior, data contract, security, deployment, external integration, or production-critical change | Edit directly, inspect the diff, and run targeted validation. |
| R2 | Bug, observable behavior, public API, or coordinated multi-file change without R3 consequences | Investigate bugs first; use test-first when automatable; plan only for three dependent steps or multiple components; review material logic once at the end. |
| R3 | Security or auth change/action, financial or money-impacting logic, migration, concurrency-sensitive behavior, destructive data action, production deployment or another production/private-system operation, external side effect, or cross-system change | Require approved written design, isolation, plan, TDD/debugging as applicable, independent review, full verification, rollback or compensation, and separate authorization for destructive/publish/deploy actions. |

Explicit user instructions override workflow preferences, but a generic shortcut or urgency does not waive R3 gates. To waive a non-authorization gate, the instruction must name that gate explicitly. Destructive, publish, deploy, or other external execution always requires separate action-specific authorization at the point of execution.
