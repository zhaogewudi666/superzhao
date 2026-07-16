# Superzhao maintenance and installation

Superzhao is a risk-tiered Codex distribution maintained as a fork of
[obra/superpowers](https://github.com/obra/superpowers). It preserves the
upstream R3 workflow for consequential work and uses proportional R0–R2
workflows for everyday Codex tasks.

An upstream merge is an input to review, not proof of compatibility. Inspect
the complete fork diff and pass the relevant validation before installing or
publishing an update.

## Repository model

The expected remotes are:

- `origin`: `https://github.com/zhaogewudi666/superzhao.git`, the Superzhao
  fork and normal push destination.
- `upstream`: `https://github.com/obra/superpowers.git`, the source project.
  Treat this remote as read-only.

Confirm the configuration before an update:

```bash
git remote -v
git status -sb
```

Start from the clean Superzhao integration branch you intend to update
(normally `main`). Preserve local work before continuing; `git switch -c`
branches from the current `HEAD`, so do not run the update flow from an
unrelated feature branch.

## Update from upstream

Fetch upstream and merge it on a dedicated branch:

```bash
git fetch upstream
git switch -c "update/upstream-$(date +%Y%m%d)"
git merge upstream/main
```

Resolve merge conflicts deliberately. Upstream can change skill wording,
hooks, tests, or supported tools in ways that conflict with the Superzhao risk
profile, so a clean merge alone is not sufficient.

Inspect the entire resulting fork delta, not only conflict resolutions:

```bash
git status -sb
git log --oneline upstream/main..HEAD
git diff --stat upstream/main...HEAD
git diff upstream/main...HEAD
git diff --check upstream/main...HEAD
```

Confirm that the diff retains the intended R0–R3 routing, contains no unrelated
upstream rewrites, and introduces no unsupported tool names.

## Validate an update

Run the required structural and shell checks from the repository root:

```bash
bash tests/codex-profile/run-tests.sh
bash tests/shell-lint/test-lint-shell.sh
git diff --check upstream/main...HEAD
```

`run-tests.sh` runs every Bash contract and rehearsal test plus the Node test
suites in `tests/codex-profile/`; Node.js must be available or the runner
fails. For the complete deterministic sweep across the profile, plugins, and
docs, run `bash tests/run-all.sh` (see `docs/testing.md`). Do not install or
publish the update if a check fails. A passing suite is
necessary evidence, but it does not replace manual review of the full diff.
After review and approval, publish the update branch to the fork rather than
to upstream:

```bash
git push -u origin HEAD
```

## Install the Codex profile

The installer reads the managed skills from the current repository checkout.
Run it only from the reviewed commit you intend to activate:

```bash
bash scripts/install-codex-profile.sh
```

By default, this operates on `~/.codex`. Set `CODEX_HOME` to use another Codex
home, including for an isolated rehearsal:

```bash
CODEX_HOME="/absolute/path/to/codex-home" \
  bash scripts/install-codex-profile.sh
```

The installer replaces only the profile's fixed managed-skill set and leaves
unrelated personal skills in place. It stages and verifies the new profile
before changing live managed entries.

Each successful install creates a private v2 backup below:

```text
${CODEX_HOME:-$HOME/.codex}/backups/superzhao-<timestamp>-<pid>[-<suffix>]
```

The backup records the source commit, managed inventory, file and directory
modes, and SHA-256 checksums for both the installed payload and the saved
original managed entries. Backup containers use mode `0700`, and their
metadata files use mode `0600`. The installer writes the selected backup path
to `${CODEX_HOME:-$HOME/.codex}/superzhao-last-backup`.

Start a new Codex task after installation so skill discovery reloads the
activated profile.

## Verify an installed profile

`scripts/profile-integrity.mjs` binds the managed skill set to content
checksums. To confirm that an installed Codex home matches the current
repository checkout exactly, generate a manifest from the checkout and verify
the installed skills against it:

```bash
node scripts/profile-integrity.mjs manifest --root skills --output /tmp/profile-manifest.json
node scripts/profile-integrity.mjs verify \
  --root "${CODEX_HOME:-$HOME/.codex}/skills" \
  --manifest /tmp/profile-manifest.json
```

A successful verification reports `"verified": true` with the profile's
SHA-256. That hash identifies the exact profile content, so it can be compared
against the profile hash recorded in behavior-evaluation reports under
`docs/superpowers/evals/` to confirm the installed profile is the evaluated
one. The managed skill list lives in `config/codex-profile-skills.txt` and
must stay identical to the installer's `SKILLS` array;
`tests/codex-profile/test-managed-set-sync.sh` enforces that.

## Roll back

With no argument, rollback uses the last-backup pointer in the configured
`CODEX_HOME`:

```bash
bash scripts/rollback-codex-profile.sh
```

Use the same `CODEX_HOME` that was used for installation. To select a specific
backup, pass its path explicitly:

```bash
bash scripts/rollback-codex-profile.sh \
  "$HOME/.codex/backups/superzhao-<timestamp>-<pid>"
```

For a custom home, both the environment and explicit path must identify that
same home:

```bash
CODEX_HOME="/absolute/path/to/codex-home" \
  bash scripts/rollback-codex-profile.sh \
  "/absolute/path/to/codex-home/backups/superzhao-<timestamp>-<pid>"
```

An explicit backup must be a direct child of the configured canonical
`CODEX_HOME/backups` directory. Rollback accepts the private v2 schema only;
it rejects obsolete v1, foreign, symlinked, incomplete, or unsafe-container
backups. Metadata must use its required private mode, and the saved originals
must exactly match their recorded type, mode, and SHA-256 manifests before live
mutation.

Before restoring, rollback validates and stages the saved originals. It then
archives the current managed entries at:

```text
${CODEX_HOME:-$HOME/.codex}/backups/superzhao-current-before-rollback-<timestamp>-<pid>[-<suffix>]
```

That archive is recovery evidence for the current profile, not a complete v2
install backup and not interchangeable with a `superzhao-<timestamp>-<pid>`
backup accepted by the rollback command.

Start a new Codex task after rollback so skill discovery reloads the restored
profile.

## Refusal and recovery boundaries

Install and rollback fail before live mutation when a safety boundary cannot
be established:

- The `skills` and `backups` container roots must be physical directories,
  not symlinks.
- Source, live, staged, and backed-up managed trees may contain only physical
  directories and regular files. Internal symlinks and special files are
  refused.
- The installer refuses to publish through a symlinked last-backup pointer,
  and no-argument rollback refuses to read one. Explicit-path rollback does
  not consult the pointer. The v2 backup directory, backup `skills` container,
  and backup metadata must not be symlinks.
- Transaction paths and existing live managed roots must be on the same
  filesystem so the required renames remain atomic.
- Install and rollback share
  `${CODEX_HOME:-$HOME/.codex}/.superzhao-profile.lock`. An active, stale,
  malformed, missing-owner, or otherwise unsafe lock is refused rather than
  removed automatically.

If a lock is reported, first confirm that no profile operation is still
running. Inspect the lock and its `owner` metadata; remove it manually only
when it is demonstrably safe. Starting another install or rollback is not a
substitute for investigating the retained state.

Status `70` means that automatic entry or pointer restoration, or recovery-time
lock release, was detected as incomplete. The diagnostic reports backup,
stage or archive, and lock paths; a printed staging path may already have been
cleaned before a later lock-release failure. Preserve and inspect every
reported path that still exists. Do not treat another failure status as proof
that no transaction remnants remain; review the diagnostics and configured
`CODEX_HOME` before attempting manual repair or another profile operation.

## Open recommendations (2026-07-16 review)

Recorded from the fork review of the 14-Skill profile and the plugin-ecosystem
work. Each item keeps its original recommendation even where a local change
already implements part of it; publication of any of this work remains a
separate, explicitly authorized action.

1. **Bind publication evidence to the exact release candidate.** Before any
   release or push claim, verify that `run-tests.sh` executes the Node suites
   and `test-managed-set-sync.sh` guards installer/config drift in the exact
   candidate SHA. Publication remains a separate action requiring an explicit
   request and fresh evidence for that destination.
2. **Decide the disposition of known inherited failures.** Root-caused
   2026-07-16. Two suites were fixed in this repository and now gate
   `tests/run-all.sh`: Codex plugin packaging (the script rejected linked
   worktrees via a `-d .git` check and let `zip` store local-time DOS
   timestamps; the test also assumed a western-hemisphere rendering of epoch
   0) and OpenCode (the test install layout omitted the package-root
   `package.json`, so Node parsed the ESM plugin as CommonJS). Two remain
   open because fixing them edits `skills/using-superpowers/references/`,
   which changes the managed profile SHA-256 and severs the accepted-eval
   binding: the Pi suite needs Node ≥ 23.6 for TypeScript imports plus
   `read`/`write`/`edit`/`bash` mappings absent from `pi-tools.md`, and the
   Antigravity suite needs a `view_file` mapping absent from
   `antigravity-tools.md`. Both reference files are also unreferenced by the
   rewritten `using-superpowers` Skill and ship as dead weight in the
   installed profile; fixing or removing them belongs to the same deliberate
   profile-rebind decision.
3. **Prevent coverage lists from drifting.** Implemented as
   `bash tests/run-all.sh`, a curated aggregate runner that names every
   skipped or excluded suite. The trade-off is a curated list rather than
   auto-discovery: adding a suite means updating the runner and the
   `docs/testing.md` table together.
4. **Keep marketplace inventories harness-specific.** The repository carries
   `.agents/plugins/marketplace.json` (Codex) and
   `.claude-plugin/marketplace.json` (Claude Code) in different schemas. List
   a plugin only where that harness has a valid package; synchronize shared
   identity and metadata only when a plugin is genuinely distributed on both.
   The exact rule is documented in `docs/plugin-development.md`.
