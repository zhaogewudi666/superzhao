# Codex Tools

## Collaboration

When collaboration tools are available, dispatch with `spawn_agent(task_name, message, fork_turns)`. Always choose `fork_turns` deliberately:

- `none` for isolated validation and narrowly scoped work with a self-contained prompt.
- a small numeric window when recent conversation context is required.
- `all` only when the subagent truly needs the full session.

Use `followup_task` for another turn on an existing agent, `send_message` for non-triggering context, `wait_agent` for mailbox updates, and `interrupt_agent` only to interrupt active work. Do not invent model, agent-type, or cleanup parameters absent from the current schema.

## Environment Detection

Inspect `git rev-parse --git-dir`, `git rev-parse --git-common-dir`, `git branch --show-current`, remotes, authentication, and actual permissions before choosing worktree or publish behavior. Detached HEAD is a state to handle, not proof that branch, push, or PR operations are impossible.

Prefer native isolation when the runtime exposes it; otherwise use the guarded Git fallback from `using-git-worktrees`.

## Codex App Finishing

Use available Codex App controls when they are relevant. If branch or publish commands fail, report the observed restriction and the safe next action; do not assume a sandbox restriction before testing it.

## Visual Companion

The brainstorming visual companion is a bundled local server workflow, not a native Codex tool. Offer it only when the visual decision benefits from it and follow the skill's consent rule.
