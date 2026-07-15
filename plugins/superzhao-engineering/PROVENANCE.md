# Provenance

This optional plugin adapts selected ideas from
[`mattpocock/skills`](https://github.com/mattpocock/skills) at commit
`e9fcdf95b402d360f90f1db8d776d5dd450f9234`.

The included `domain-modeling` Skill adapts concepts from:

- `skills/engineering/domain-modeling`

The pinned source contributes terminology clarification, glossary/code
contradiction checks, concrete scenario probes, and the three-part test for a
sparing ADR. Superzhao independently adds known/inferred/open classification,
explicit invariants and state transitions, a chat-first modeling frame, and a
persistence/authorization boundary. Those extensions must not be attributed to
the upstream Skill.

The repository source review also covers Matt Pocock's remaining stable,
deprecated, in-progress, miscellaneous, and personal Skills. They are not
bundled here: several duplicate existing Superzhao workflows, while others
carry tracker writes, dependencies, tool assumptions, or personal conventions
that do not belong in a general optional plugin.

The directories most directly compared with existing Superzhao capabilities
include:

- `skills/productivity/handoff`
- `skills/engineering/research`
- `skills/engineering/codebase-design`
- `skills/engineering/improve-codebase-architecture`
- `skills/engineering/resolving-merge-conflicts`
- `skills/engineering/triage`
- `skills/engineering/wayfinder`
- `skills/engineering/to-spec`
- `skills/engineering/to-tickets`

The adaptation removes automatic glossary/ADR writes and keeps persistent
artifacts behind Superzhao scope and authorization gates. It is an experimental
manually selected candidate, not a behavior-accepted Skill: two native
discovery profiles failed their first important sample, so this plugin is not
listed in the repository marketplace. Release requires a separate native UI
attachment campaign or a newly frozen candidate campaign.

The repository-level comparison records the disposition of all 40 upstream
`SKILL.md` files and their supporting references. This standalone plugin keeps
the essential decision here so its status is not lost when distributed alone.
The complete Matt Pocock license travels with it in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), and the Superzhao license is
in [`LICENSE`](LICENSE).
