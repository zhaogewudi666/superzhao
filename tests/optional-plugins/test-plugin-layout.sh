#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

python3 - "$ROOT" <<'PY'
import json
import os
import sys
from pathlib import Path

root = Path(sys.argv[1])
names = [
    "superzhao-skill-lab",
    "superzhao-engineering",
]
marketplace_names = set()
local_notice_requirements = {
    "superzhao-skill-lab": [
        "57333f3406436a90a2b5feec4aad74ddb33d6e85",
        "Copyright (c) 2026 Microsoft Corporation",
        "Permission is hereby granted, free of charge",
    ],
    "superzhao-engineering": [
        "e9fcdf95b402d360f90f1db8d776d5dd450f9234",
        "Copyright (c) 2026 Matt Pocock",
        "Permission is hereby granted, free of charge",
    ],
}

marketplace = json.loads(
    (root / ".agents/plugins/marketplace.json").read_text(encoding="utf-8")
)
entries = marketplace.get("plugins")
if not isinstance(entries, list):
    raise AssertionError("marketplace plugins must be a list")

for name in names:
    plugin_root = root / "plugins" / name
    manifest_path = plugin_root / ".codex-plugin" / "plugin.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    if (plugin_root / "LICENSE").read_bytes() != (root / "LICENSE").read_bytes():
        raise AssertionError(f"{name}: independently distributed plugin must carry the project license")

    if manifest.get("name") != name:
        raise AssertionError(f"{name}: manifest name mismatch")
    if manifest.get("skills") != "./skills/":
        raise AssertionError(f"{name}: manifest must expose only its local skills tree")

    matching = [entry for entry in entries if entry.get("name") == name]
    if name in marketplace_names:
        if len(matching) != 1:
            raise AssertionError(f"{name}: expected one marketplace entry")
        entry = matching[0]
        if entry.get("source") != {
            "source": "local",
            "path": f"./plugins/{name}",
        }:
            raise AssertionError(f"{name}: marketplace source must stay repository-local")
        if entry.get("policy", {}).get("installation") != "AVAILABLE":
            raise AssertionError(f"{name}: optional plugin must not install by default")
        if entry.get("policy", {}).get("authentication") != "ON_INSTALL":
            raise AssertionError(
                f"{name}: marketplace authentication must use the scaffold default"
            )
    elif matching:
        raise AssertionError(
            f"{name}: behavior-unaccepted candidate must not be listed in marketplace"
        )

    local_notice_path = plugin_root / "THIRD_PARTY_NOTICES.md"
    local_notice = local_notice_path.read_text(encoding="utf-8")
    for required in local_notice_requirements[name]:
        if required not in local_notice:
            raise AssertionError(f"{name}: local third-party notice missing {required}")

    provenance = (plugin_root / "PROVENANCE.md").read_text(encoding="utf-8")
    if "[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)" not in provenance:
        raise AssertionError(f"{name}: provenance must link its local notice")

    for current, dirs, files in os.walk(plugin_root):
        for child in [*dirs, *files]:
            path = Path(current) / child
            if path.is_symlink():
                raise AssertionError(f"{name}: symlinks are not allowed: {path}")

if any(entry.get("name") == "superzhao-project-ops" for entry in entries):
    raise AssertionError("empty, behavior-unjustified project-ops plugin must not be listed")

notice = (root / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")
for required in [
    "57333f3406436a90a2b5feec4aad74ddb33d6e85",
    "e9fcdf95b402d360f90f1db8d776d5dd450f9234",
    "Copyright (c) 2026 Microsoft Corporation",
    "Copyright (c) 2026 Matt Pocock",
]:
    if required not in notice:
        raise AssertionError(f"third-party notice missing {required}")

print("Optional plugin layout and provenance look good")
PY
