# Testing Superzhao

Superzhao keeps deterministic repository tests separate from model-behavior
evaluations. Run the narrow deterministic suite while iterating, then the
integrated suites affected by the final diff.

## Deterministic repository tests

The main entry points are:

| Area | Command |
|---|---|
| Managed Codex profile, routing contracts, installer/rollback, integrity | `bash tests/codex-profile/run-tests.sh` |
| Codex plugin manifest and packaging | `bash tests/codex/test-marketplace-manifest.sh` and `bash tests/codex/test-package-codex-plugin.sh` |
| Codex fork sync | `bash tests/codex-plugin-sync/test-sync-to-codex-plugin.sh` |
| Kimi plugin | `bash tests/kimi/run-tests.sh` |
| OpenCode plugin | `bash tests/opencode/run-tests.sh` |
| Pi extension | `node --test tests/pi/test-pi-extension.mjs` |
| Brainstorm server | `npm test --prefix tests/brainstorm-server` |
| Optional plugin layout and Skill contracts | `bash tests/optional-plugins/test-plugin-layout.sh`, `bash tests/optional-plugins/test-skill-lab-skill.sh`, and `bash tests/optional-plugins/test-engineering-skills.sh` |
| Skill Lab CLI | `node --test tests/skill-lab/skill-lab.test.mjs` |
| Maintainer docs | `bash tests/docs/test-testing-guide.sh` and `bash tests/docs/test-plugin-development-guide.sh` |
| Shell scripts | `bash tests/shell-lint/test-lint-shell.sh` |

Some Claude Code integration and explicit-request tests launch real agent
sessions and are slower or harness-specific. Read the scripts in
`tests/claude-code/` and `tests/explicit-skill-requests/` before running them;
they are not a substitute for the cross-harness behavior-eval protocol below.

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
