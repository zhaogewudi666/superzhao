# Codex standalone plugin development

Use a standalone plugin for skills that are domain-specific, tool-specific,
optional, or tied to a third-party workflow. Keep the core profile focused on
general behavior that has passed its integrated eval contract.

The example and validation commands below target Codex. A plugin for another
harness must follow that harness's official manifest and distribution contract.
Adding a new harness integration to Superpowers core is a different task; start
with [Porting Superpowers to a New Agent Harness](porting-to-a-new-harness.md).

## Layout

A repository-local Codex plugin has its own root and manifest:

```text
plugins/example/
├── .codex-plugin/
│   └── plugin.json
├── skills/
│   └── example-skill/
│       ├── SKILL.md
│       └── agents/
│           └── openai.yaml
└── scripts/                  # optional; keep runtime dependencies explicit
```

`.codex-plugin/plugin.json` is required. Each skill is a directory containing
`SKILL.md`; use frontmatter with only `name` and `description`. Put detailed
material in directly linked references rather than duplicating it in multiple
runtime sources.

`agents/openai.yaml` controls presentation and invocation policy. The Codex
field is `policy.allow_implicit_invocation`. For an action that should run only
when the user asks—such as publishing tickets or staging a candidate—set:

```yaml
policy:
  allow_implicit_invocation: false
```

Descriptions should say what observable request triggers the skill. They
should not claim broader capabilities than the plugin actually ships.

Codex namespaces a Skill from an installed plugin as `<plugin-name>:<skill-name>`.
Use that installed name in plugin and Skill `defaultPrompt` values (for example,
`$example-plugin:example-skill`), even though the Skill's own frontmatter name
remains `example-skill`. A short unnamespaced `$example-skill` string does not
simulate selecting an installed plugin Skill.

## Repository marketplace

Optional plugins maintained in this repository can be listed in
`.agents/plugins/marketplace.json` with a repository-relative source such as
`./plugins/example`. A marketplace entry advertises availability; it must not
silently install the plugin into a developer's personal Codex home.

Keep each plugin independently valid. Do not point several plugin entries at
one shared skill tree, use symlinks, or rely on files outside that plugin root.
Third-party adaptations must retain the required license and provenance notice.

## Scaffold and validate

Use Codex's bundled `plugin-creator` and `skill-creator` scripts instead of
inventing manifests or metadata by hand. Their relevant validators are:

```bash
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"

find_yaml_python() {
  for candidate in "${PYTHON:-}" python3 python; do
    [ -n "$candidate" ] || continue
    if command -v "$candidate" >/dev/null 2>&1 &&
      "$candidate" -c 'import yaml' >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
  done
  return 1
}

PYTHON_BIN="$(find_yaml_python)" || {
  printf 'No Python interpreter with PyYAML is available; validators were not run.\n' >&2
  exit 1
}
PLUGIN_VALIDATOR="$CODEX_HOME/skills/.system/plugin-creator/scripts/validate_plugin.py"
SKILL_VALIDATOR="$CODEX_HOME/skills/.system/skill-creator/scripts/quick_validate.py"

for validator in "$PLUGIN_VALIDATOR" "$SKILL_VALIDATOR"; do
  [ -r "$validator" ] || {
    printf 'Codex validator is not readable: %s\n' "$validator" >&2
    exit 1
  }
done

"$PYTHON_BIN" "$PLUGIN_VALIDATOR" plugins/example
"$PYTHON_BIN" "$SKILL_VALIDATOR" plugins/example/skills/example-skill
```

The scaffold helpers live beside `validate_plugin.py` and
`quick_validate.py`. Run their help output first because generator flags can
change with the bundled Codex version.

Also add deterministic repository tests for manifest shape, invocation policy,
source boundaries, and any script behavior. A passing schema validator does not
prove that a behavior-shaping skill improves agent outcomes; use the baseline,
candidate, controls, and whole-profile process in
`skills/writing-skills/SKILL.md` before adoption.

## Safety boundary

Plugin development does not authorize installation, publication, issue or
ticket creation, commits, pushes, or pull requests. Keep generated artifacts in
the repository until the human partner reviews the complete diff and explicitly
requests the relevant external action.
