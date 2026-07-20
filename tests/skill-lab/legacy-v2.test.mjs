import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";

import {
  canonicalJson,
  cli,
  repoRoot,
  runCli,
  runWithHook,
  sha256,
} from "./helpers.mjs";

const FIXTURE = resolve(repoRoot, "tests/skill-lab/fixtures/v2-bundle-valid/bundle");

function canonicalLine(value) {
  return `${canonicalJson(value)}\n`;
}

function makeBundleCopy(label) {
  const root = mkdtempSync(resolve(tmpdir(), `superzhao-legacy-${label}-`));
  const bundle = resolve(root, "bundle");
  cpSync(FIXTURE, bundle, { recursive: true });
  return {
    root,
    bundle,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function readManifest(bundle) {
  const path = resolve(bundle, "manifest.json");
  return { path, value: JSON.parse(readFileSync(path, "utf8")) };
}

function rewriteManifest(bundle, mutate) {
  const manifest = readManifest(bundle);
  mutate(manifest.value);
  writeFileSync(manifest.path, canonicalLine(manifest.value));
}

function legacyArgs(bundle, { reversed = false } = {}) {
  return reversed
    ? ["verify-bundle", "--legacy-v2", "--bundle", bundle]
    : ["verify-bundle", "--bundle", bundle, "--legacy-v2"];
}

function assertLegacyIntegrityFailure(result) {
  assert.equal(result.status, 3, result.stderr);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /unsafe_path_or_integrity|integrity|legacy|bundle|tree/i);
}

function copyHistoricalWorkspaceArtifacts(root, bundle) {
  const manifest = readManifest(bundle).value;
  const copy = (packagedPath, workspacePath) => {
    const destination = resolve(root, workspacePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(resolve(bundle, packagedPath), destination);
  };
  for (const mapping of Object.values(manifest.artifacts)) {
    copy(mapping.packaged_path, mapping.workspace_path);
  }
  for (const mapping of Object.values(manifest.evidence)) {
    for (const path of mapping.workspace_paths) copy(mapping.packaged_path, path);
  }
}

function inflateLegacyBundlePastLimit(bundle) {
  const manifestArtifact = readManifest(bundle);
  for (let index = 0; index < 12; index += 1) {
    const digest = (index + 1).toString(16).padStart(64, "0");
    const packagedPath = `evidence/aggregate-${index + 1}.bin`;
    const absolute = resolve(bundle, packagedPath);
    writeFileSync(absolute, "");
    truncateSync(absolute, 8 * 1024 * 1024);
    manifestArtifact.value.evidence[digest] = {
      packaged_path: packagedPath,
      sha256: digest,
      workspace_paths: [`historical/aggregate-${index + 1}.bin`],
      sample_ids: [`aggregate-sample-${index + 1}`],
    };
    manifestArtifact.value.files[packagedPath] = {
      sha256: digest,
      bytes: 8 * 1024 * 1024,
    };
  }
  writeFileSync(manifestArtifact.path, canonicalLine(manifestArtifact.value));
  return resolve(bundle, "evidence/aggregate-1.bin");
}

test("legacy-v2 verifier accepts the authentic fixture structurally in either flag order", () => {
  const copy = makeBundleCopy("authentic");
  try {
    const rawManifest = readFileSync(resolve(copy.bundle, "manifest.json"));
    const historicalGate = JSON.parse(
      readFileSync(resolve(copy.bundle, "gate/report.json"), "utf8"),
    );
    const historicalResults = JSON.parse(
      readFileSync(resolve(copy.bundle, "results.json"), "utf8"),
    );
    assert.equal(historicalGate.decision, "accept");
    assert.equal(historicalGate.ignored_by_split.test, 2);
    assert.ok(
      historicalResults.samples.some(
        (sample) => sample.split === "test"
          && sample.arm === "candidate"
          && sample.outcome === "fail",
      ),
      "fixture must prove that legacy verification does not preserve the old acceptance semantics",
    );

    const expected = canonicalLine({
      manifest_sha256: sha256(rawManifest),
      status: "legacy-structural-only",
    });
    for (const reversed of [false, true]) {
      const result = runCli(legacyArgs(copy.bundle, { reversed }));
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      assert.equal(result.stdout, expected);
      assert.doesNotMatch(result.stdout, /final_accept|"decision"|"accept"/);
    }
  } finally {
    copy.cleanup();
  }
});

test("legacy-v2 binds the manifest read to the first full tree scan", () => {
  const copy = makeBundleCopy("manifest-read-scan-race");
  try {
    const manifestPath = resolve(copy.bundle, "manifest.json");
    const original = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(original);
    const changedId = `${manifest.campaign_id.slice(0, -1)}x`;
    assert.equal(Buffer.byteLength(changedId), Buffer.byteLength(manifest.campaign_id));
    const replacement = original.replace(manifest.campaign_id, changedId);
    assert.notEqual(replacement, original);
    assert.equal(Buffer.byteLength(replacement), Buffer.byteLength(original));
    const hook = `const fs = require("node:fs");\n`
      + `const path = require("node:path");\n`
      + `const { syncBuiltinESMExports } = require("node:module");\n`
      + `const originalReaddir = fs.readdirSync;\n`
      + `const root = ${JSON.stringify(copy.bundle)};\n`
      + `const manifest = ${JSON.stringify(manifestPath)};\n`
      + `const replacement = Buffer.from(${JSON.stringify(replacement)});\n`
      + `let changed = false;\n`
      + `fs.readdirSync = function(value, ...args) {\n`
      + `  const result = originalReaddir.call(this, value, ...args);\n`
      + `  if (!changed && path.resolve(String(value)) === root) {\n`
      + `    changed = true;\n`
      + `    fs.writeFileSync(manifest, replacement);\n`
      + `  }\n`
      + `  return result;\n`
      + `};\n`
      + `syncBuiltinESMExports();\n`;
    assertLegacyIntegrityFailure(
      runWithHook(copy, legacyArgs(copy.bundle), hook),
    );
  } finally {
    copy.cleanup();
  }
});

test("legacy-v2 rejects an actual bundle over 96 MiB before reading payloads", () => {
  const copy = makeBundleCopy("aggregate-limit");
  try {
    const watched = inflateLegacyBundlePastLimit(copy.bundle);
    const marker = resolve(copy.root, "payload-read-marker");
    const hook = `const fs = require("node:fs");\n`
      + `const { syncBuiltinESMExports } = require("node:module");\n`
      + `const originalRead = fs.readSync;\n`
      + `const watched = fs.lstatSync(${JSON.stringify(watched)}, { bigint: true });\n`
      + `const marker = ${JSON.stringify(marker)};\n`
      + `fs.readSync = function(fd, ...args) {\n`
      + `  const stat = fs.fstatSync(fd, { bigint: true });\n`
      + `  if (stat.dev === watched.dev && stat.ino === watched.ino) {\n`
      + `    fs.writeFileSync(marker, "read\\n");\n`
      + `  }\n`
      + `  return originalRead.call(this, fd, ...args);\n`
      + `};\n`
      + `syncBuiltinESMExports();\n`;
    const result = runWithHook(copy, legacyArgs(copy.bundle), hook);
    assertLegacyIntegrityFailure(result);
    assert.match(result.stderr, /96 MiB|100663296|maximum/i);
    assert.equal(existsSync(marker), false, "aggregate overflow must fail before payload reads");
  } finally {
    copy.cleanup();
  }
});

test("legacy-v2 verifier treats historical workspace paths as inert normalized syntax", () => {
  const copy = makeBundleCopy("inert-workspace-paths");
  try {
    rewriteManifest(copy.bundle, (manifest) => {
      for (const [name, mapping] of Object.entries(manifest.artifacts)) {
        mapping.workspace_path = `deleted-original/artifacts/${name}.bin`;
      }
      for (const [digest, mapping] of Object.entries(manifest.evidence)) {
        mapping.workspace_paths = [`deleted-original/evidence/${digest}.bin`];
      }
    });
    assert.equal(existsSync(resolve(copy.root, "deleted-original")), false);
    const raw = readFileSync(resolve(copy.bundle, "manifest.json"));
    const result = runCli(legacyArgs(copy.bundle));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, canonicalLine({
      manifest_sha256: sha256(raw),
      status: "legacy-structural-only",
    }));
    assert.equal(existsSync(resolve(copy.root, "deleted-original")), false);
  } finally {
    copy.cleanup();
  }
});

test("legacy-v2 verifier rejects missing, extra, symlinked, special, unsafe, or drifting trees", async (t) => {
  const baseManifest = readManifest(FIXTURE).value;
  const payload = "source_SKILL.md";
  const scenarios = [
    {
      name: "missing",
      mutate(copy) { rmSync(resolve(copy.bundle, payload)); },
    },
    {
      name: "extra",
      mutate(copy) { writeFileSync(resolve(copy.bundle, "extra.bin"), "extra\n"); },
    },
    {
      name: "symlinked payload",
      mutate(copy) {
        const retained = resolve(copy.root, "retained-source");
        cpSync(resolve(copy.bundle, payload), retained);
        rmSync(resolve(copy.bundle, payload));
        symlinkSync(retained, resolve(copy.bundle, payload));
      },
    },
    {
      name: "byte drift",
      mutate(copy) { writeFileSync(resolve(copy.bundle, payload), "drift\n"); },
    },
    {
      name: "declared byte drift",
      mutate(copy) {
        rewriteManifest(copy.bundle, (manifest) => {
          manifest.files[payload].bytes += 1;
        });
      },
    },
    {
      name: "unsafe packaged path",
      mutate(copy) {
        rewriteManifest(copy.bundle, (manifest) => {
          manifest.artifacts.source.packaged_path = "../outside";
        });
      },
    },
    {
      name: "unsafe historical path",
      mutate(copy) {
        rewriteManifest(copy.bundle, (manifest) => {
          manifest.artifacts.source.workspace_path = "../deleted-original/SKILL.md";
        });
      },
    },
  ];

  assert.equal(baseManifest.files[payload].sha256, sha256(readFileSync(resolve(FIXTURE, payload))));
  for (const scenario of scenarios) {
    await t.test(scenario.name, () => {
      const copy = makeBundleCopy(scenario.name.replaceAll(" ", "-"));
      try {
        scenario.mutate(copy);
        assertLegacyIntegrityFailure(runCli(legacyArgs(copy.bundle)));
      } finally {
        copy.cleanup();
      }
    });
  }

  await t.test("FIFO payload", (subtest) => {
    const copy = makeBundleCopy("fifo");
    try {
      const path = resolve(copy.bundle, payload);
      rmSync(path);
      const created = spawnSync("mkfifo", [path], { encoding: "utf8" });
      if (created.status !== 0) {
        subtest.skip(`mkfifo unavailable: ${created.stderr || created.error?.message}`);
        return;
      }
      assertLegacyIntegrityFailure(runCli(legacyArgs(copy.bundle)));
    } finally {
      copy.cleanup();
    }
  });
});

test("legacy-v2 bare flag parser rejects duplicates, values, unknowns, missing values, and other commands", async (t) => {
  const copy = makeBundleCopy("parser");
  try {
    const outputParent = resolve(copy.root, "doctor-output");
    mkdirSync(outputParent, { mode: 0o700 });
    const cases = [
      ["verify-bundle", "--legacy-v2", "--legacy-v2", "--bundle", copy.bundle],
      ["verify-bundle", "--legacy-v2=true", "--bundle", copy.bundle],
      ["verify-bundle", "--legacy-v2", "value", "--bundle", copy.bundle],
      ["verify-bundle", "--bundle"],
      ["verify-bundle", "--bundle", copy.bundle, "--unknown", "value"],
      ["verify-bundle", "--bundle", copy.bundle, "--bundle", copy.bundle],
      [
        "doctor",
        "--workspace-root", copy.root,
        "--output-parent", outputParent,
        "--legacy-v2",
      ],
    ];
    for (const [index, args] of cases.entries()) {
      await t.test(`malformed invocation ${index + 1}`, () => {
        const result = runCli(args);
        assert.equal(result.status, 2, result.stderr);
        assert.equal(result.stdout, "");
        assert.match(result.stderr, /usage_or_schema|option|legacy-v2|expected|unknown|duplicate/i);
      });
    }
  } finally {
    copy.cleanup();
  }
});

test("legacy and v3 bundle modes reject the opposite manifest schema", () => {
  const legacy = makeBundleCopy("wrong-v3-mode");
  const v3Root = mkdtempSync(resolve(tmpdir(), "superzhao-wrong-legacy-mode-"));
  try {
    const ordinary = runCli(["verify-bundle", "--bundle", legacy.bundle]);
    assert.equal(ordinary.status, 2, ordinary.stderr);
    assert.match(ordinary.stderr, /v2|legacy-v2/i);

    writeFileSync(resolve(v3Root, "manifest.json"), canonicalLine({
      schema: "superzhao.skill-lab.bundle-manifest/v3",
    }));
    const reversed = runCli(legacyArgs(v3Root, { reversed: true }));
    assert.equal(reversed.status, 2, reversed.stderr);
    assert.equal(reversed.stdout, "");
    assert.match(reversed.stderr, /legacy-v2|v3|schema|mode/i);
  } finally {
    legacy.cleanup();
    rmSync(v3Root, { recursive: true, force: true });
  }
});

test("legacy-v2 malformed manifest schema is usage exit 2", () => {
  const copy = makeBundleCopy("malformed-schema");
  try {
    writeFileSync(resolve(copy.bundle, "manifest.json"), canonicalLine({ schema_version: 2 }));
    const result = runCli(legacyArgs(copy.bundle));
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /legacy|manifest|schema|required|campaign/i);
  } finally {
    copy.cleanup();
  }
});

test("production apply, gate, and stage reject authentic v2 before creating output", async (t) => {
  const copy = makeBundleCopy("production-rejection");
  try {
    copyHistoricalWorkspaceArtifacts(copy.root, copy.bundle);
    const outputParent = resolve(copy.root, "outputs");
    mkdirSync(outputParent, { mode: 0o700 });
    const commands = [
      {
        name: "apply",
        args: [
          "apply",
          "--workspace-root", copy.root,
          "--source", resolve(copy.root, "SKILL.md"),
          "--edits", resolve(copy.bundle, "edits.json"),
          "--candidate", resolve(outputParent, "candidate.md"),
          "--report", resolve(outputParent, "apply.json"),
        ],
        outputs: [resolve(outputParent, "candidate.md"), resolve(outputParent, "apply.json")],
      },
      {
        name: "gate",
        args: [
          "gate",
          "--workspace-root", copy.root,
          "--results", resolve(copy.bundle, "results.json"),
          "--report", resolve(outputParent, "gate.json"),
        ],
        outputs: [resolve(outputParent, "gate.json")],
      },
      {
        name: "stage",
        args: [
          "stage",
          "--workspace-root", copy.root,
          "--source", resolve(copy.root, "SKILL.md"),
          "--candidate", resolve(copy.root, "candidate.md"),
          "--edits", resolve(copy.bundle, "edits.json"),
          "--apply-report", resolve(copy.bundle, "apply/report.json"),
          "--results", resolve(copy.bundle, "results.json"),
          "--gate-report", resolve(copy.bundle, "gate/report.json"),
          "--output-dir", resolve(outputParent, "staged-bundle"),
        ],
        outputs: [resolve(outputParent, "staged-bundle")],
      },
    ];
    for (const command of commands) {
      await t.test(command.name, () => {
        const result = runCli(command.args);
        assert.equal(result.status, 2, result.stderr);
        assert.equal(result.stdout, "");
        assert.match(result.stderr, /v2.*production|production.*v2|requires.*v3|unsupported.*v2/i);
        for (const output of command.outputs) {
          assert.equal(existsSync(output), false, `${command.name} created ${output}`);
        }
      });
    }
  } finally {
    copy.cleanup();
  }
});

test("legacy-v2 verifier runs from the copied installed CLI without importing fixture code", () => {
  const copy = makeBundleCopy("copied-cli");
  try {
    const pluginRoot = resolve(copy.root, "cache/superzhao-skill-lab/9.8.7");
    const copiedCli = resolve(pluginRoot, "scripts/skill-lab.mjs");
    const pluginManifest = resolve(pluginRoot, ".codex-plugin/plugin.json");
    mkdirSync(dirname(copiedCli), { recursive: true });
    mkdirSync(dirname(pluginManifest), { recursive: true });
    cpSync(cli, copiedCli);
    writeFileSync(pluginManifest, canonicalLine({
      name: "superzhao-skill-lab",
      version: "9.8.7",
    }));
    const result = spawnSync(process.execPath, [copiedCli, ...legacyArgs(copy.bundle)], {
      cwd: copy.root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "legacy-structural-only");
  } finally {
    copy.cleanup();
  }
});
