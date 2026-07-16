# Testing Superzhao

Superzhao keeps deterministic repository tests separate from model-behavior
evaluations. Run the narrow deterministic suite while iterating, then the
integrated suites affected by the final diff.

## Deterministic repository tests

The aggregate entry point runs every currently passing deterministic suite and
names anything it skips or excludes:

```bash
bash tests/run-all.sh
```

The per-area commands below remain the right tool while iterating on one area.
Adding a suite means updating both this table and `tests/run-all.sh`; the
runner's output lists its exclusions so the two cannot drift silently.

| Area | Command |
|---|---|
| Managed Codex profile, routing contracts, installer/rollback, integrity | `bash tests/codex-profile/run-tests.sh` |
| Codex plugin manifest and packaging | `bash tests/codex/test-marketplace-manifest.sh` and `bash tests/codex/test-package-codex-plugin.sh` |
| Codex fork sync | `bash tests/codex-plugin-sync/test-sync-to-codex-plugin.sh` |
| Kimi plugin | `bash tests/kimi/run-tests.sh` |
| OpenCode plugin | `bash tests/opencode/run-tests.sh` |
| Brainstorm server (run `npm ci --prefix tests/brainstorm-server` once first) | `npm test --prefix tests/brainstorm-server` |
| Optional plugin layout and Skill contracts | `bash tests/optional-plugins/test-plugin-layout.sh`, `bash tests/optional-plugins/test-skill-lab-skill.sh`, and `bash tests/optional-plugins/test-engineering-skills.sh` |
| Session-start hook output | `bash tests/hooks/test-session-start.sh` |
| SDD workspace artifacts | `bash tests/claude-code/test-sdd-workspace.sh` |
| Skill Lab CLI | `node --test tests/skill-lab/*.test.mjs` |
| Maintainer docs | `bash tests/docs/test-testing-guide.sh` and `bash tests/docs/test-plugin-development-guide.sh` |
| Shell scripts | `bash tests/shell-lint/test-lint-shell.sh` |

### Known inherited failures

The following upstream-inherited suites fail for root causes established on
2026-07-16. They are excluded from `tests/run-all.sh` so the aggregate gate
stays meaningful, and they are retained here rather than deleted so the
disposition stays a visible decision. (The Codex packaging and OpenCode suites
previously listed here were root-caused to a worktree/timezone script bug and
an unfaithful test install layout, fixed in this repository; both now gate the
aggregate runner.)

| Suite | Command | Root cause |
|---|---|---|
| Pi extension | `node --test tests/pi/test-pi-extension.mjs` | 4 of 6 tests `import()` the TypeScript extension and need a Node with default type stripping (≥ 23.6; 5 of 6 pass under Node 26). The last test requires `pi-tools.md` to document `read`/`write`/`edit`/`bash` tool mappings that the current upstream file does not contain. |
| Antigravity mapping | `bash tests/antigravity/test-antigravity-tools.sh` | The test requires the mapping to document `view_file` as the file/skill-read tool; the upstream mapping file never mentions it. Superzhao's rewritten `using-superpowers` also no longer references the mapping file. |

The Pi and Antigravity fixes would edit files under
`skills/using-superpowers/references/`, changing the managed profile digest and
requiring a deliberate profile rebind. Until decided, do not cite these suites
as passing coverage.

### Known local contract mismatch

`bash tests/claude-code/test-worktree-path-policy.sh` still requires the exact
legacy sentence “default to `.worktrees/` at the project root”; the accepted
`using-git-worktrees` profile instead prefers a host-native workspace and uses
an existing project-local convention only for manual fallback. Updating or
retiring the stale test does not change the managed profile digest. Changing
the Skill behavior does, and therefore requires fresh behavior evaluation and
a profile rebind. Until that disposition is made, the aggregate runner names
the mismatch without treating it as passing coverage.

### Slow deterministic exclusion

`bash tests/brainstorm-server/windows-lifecycle.test.sh` is a deterministic
platform-lifecycle suite, but its non-Windows path deliberately includes two
75-second survival windows. The aggregate runner names it without executing
it; run it explicitly when changing brainstorm server startup, ownership, or
shutdown behavior.

The deterministic SDD workspace test gates the aggregate runner, and the known
path-policy contract failure is listed above. Other Claude Code integration and
explicit-request tests launch real agent sessions and are slower or
harness-specific. Read the scripts in `tests/claude-code/` and
`tests/explicit-skill-requests/` before running them; they are not a substitute
for the cross-harness behavior-eval protocol below.

## Skill-behavior evaluations

The external eval harness is checked out separately at `evals/` from
[`superpowers-evals`](https://github.com/prime-radiant-inc/superpowers-evals/).
Its scenarios drive real harness sessions and use an independent verifier. See
`evals/README.md` in that checkout for setup and commands.

Accepted Superzhao behavior records are committed under
`docs/superpowers/evals/`. Those records bind the evaluated skill content,
environment, raw actor outputs, scoring, and result. A committed report is
evidence for only the exact content and environment it names; it is not a live
test runner.

For a new skill, capture a no-skill baseline. For an existing skill, compare
the exact current profile with one candidate at a time and include important
cases plus over-trigger/safety controls. Follow `skills/writing-skills/SKILL.md`
for sample counts, invalid-sample handling, candidate acceptance, and final
whole-profile verification.

Behavior evals are slow and may require model credentials. They are not part of
the fast deterministic suite, but behavior-shaping skill changes are not ready
for adoption without their required before/after evidence.
