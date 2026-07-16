import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const cli = resolve(
  repoRoot,
  "plugins/superzhao-skill-lab/scripts/skill-lab.mjs",
);

const SOURCE = `---
name: fixture-skill
description: Use when exercising the Skill Lab fixture.
---

# Fixture

## Workflow

old text
remove me

<!-- SLOW_UPDATE_START -->
protected text
<!-- SLOW_UPDATE_END -->
`;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function listFiles(root, prefix = "") {
  const files = [];
  for (const entry of readdirSync(resolve(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listFiles(root, relative));
    else files.push(relative);
  }
  return files.sort();
}

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "superzhao-skill-lab-"));
  const source = resolve(root, "SKILL.md");
  const edits = resolve(root, "edits.json");
  const candidate = resolve(root, "candidate.md");
  const applyReport = resolve(root, "apply-report.json");
  const results = resolve(root, "results.json");
  const gateReport = resolve(root, "gate-report.json");
  writeFileSync(source, SOURCE);
  return {
    root,
    source,
    edits,
    candidate,
    applyReport,
    results,
    gateReport,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function run(args) {
  return runWithCli(cli, args);
}

function runWithCli(cliPath, args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });
}

function runWithFsHook(f, args, hookSource, extraEnv = {}) {
  const hook = resolve(f.root, `fs-hook-${Math.random().toString(16).slice(2)}.cjs`);
  writeFileSync(hook, hookSource);
  return runWithCli(cli, args, {
    env: {
      ...process.env,
      ...extraEnv,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=${hook}`.trim(),
    },
  });
}

function applyArgs(f) {
  return [
    "apply",
    "--workspace-root",
    f.root,
    "--source",
    f.source,
    "--edits",
    f.edits,
    "--candidate",
    f.candidate,
    "--report",
    f.applyReport,
  ];
}

function applySuccessfulCandidate(f) {
  writeFileSync(
    f.edits,
    JSON.stringify(
      {
        schema_version: 2,
        source_sha256: sha256(SOURCE),
        max_edits: 4,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [
          { op: "replace", target: "old text", content: "new text" },
          { op: "delete", target: "remove me\n", content: "" },
          { op: "insert_after", target: "## Workflow\n", content: "\ninserted guidance\n" },
          { op: "append", target: "", content: "## Added\n\nappended guidance\n\n" },
        ],
      },
      null,
      2,
    ),
  );
  const result = run(applyArgs(f));
  assert.equal(result.status, 0, result.stderr);
  return readFileSync(f.candidate, "utf8");
}

function campaign(f, overrides = {}) {
  const importantCurrent = overrides.importantCurrent ?? "fail";
  const importantCandidate = overrides.importantCandidate ?? "pass";
  const controlCurrent = overrides.controlCurrent ?? "pass";
  const controlCandidate = overrides.controlCandidate ?? "pass";
  const requiredValid = overrides.requiredValid ?? 5;
  const samples = [];

  const materialize = (relativePath, bytes) => {
    const absolute = resolve(f.root, relativePath);
    mkdirSync(dirname(absolute), { recursive: true });
    if (!existsSync(absolute)) writeFileSync(absolute, bytes);
    return { path: relativePath, sha256: sha256(bytes) };
  };
  const scenario = materialize("campaign/scenario.bin", "frozen-scenarios");
  const rubric = materialize("campaign/rubric.bin", "frozen-rubric");
  const environment = materialize("campaign/environment.bin", "frozen-environment");

  const sample = ({ id, actor, evidence, split, caseId, caseType, arm, outcome }) => {
    const artifact = materialize(`raw-evidence/${evidence}.bin`, `${evidence}\n`);
    return {
      id,
      actor_id: actor,
      evidence_path: artifact.path,
      evidence_sha256: artifact.sha256,
      split,
      case_id: caseId,
      case_type: caseType,
      arm,
      outcome,
      ...(outcome === "fail" ? { failure_code: caseType === "important" ? "KNOWN_GAP" : "CONTROL_GAP" } : {}),
    };
  };

  for (let index = 1; index <= 5; index += 1) {
    samples.push(
      sample({
        id: `important-current-${index}`,
        actor: `current-actor-${index}`,
        evidence: `selection-current-${index}`,
        split: "selection",
        caseId: "important-1",
        caseType: "important",
        arm: "current",
        outcome: importantCurrent,
      }),
      sample({
        id: `important-candidate-${index}`,
        actor: `candidate-actor-${index}`,
        evidence: `selection-candidate-${index}`,
        split: "selection",
        caseId: "important-1",
        caseType: "important",
        arm: "candidate",
        outcome: importantCandidate,
      }),
      sample({
        id: `control-current-${index}`,
        actor: `current-actor-${index}`,
        evidence: `selection-current-${index}`,
        split: "selection",
        caseId: "control-1",
        caseType: "control",
        arm: "current",
        outcome: controlCurrent,
      }),
      sample({
        id: `control-candidate-${index}`,
        actor: `candidate-actor-${index}`,
        evidence: `selection-candidate-${index}`,
        split: "selection",
        caseId: "control-1",
        caseType: "control",
        arm: "candidate",
        outcome: controlCandidate,
      }),
    );
  }

  samples.push(
    sample({
      id: "ignored-test-current",
      actor: "test-current-actor",
      evidence: "test-current-evidence",
      split: "test",
      caseId: "important-1",
      caseType: "important",
      arm: "current",
      outcome: "pass",
    }),
    sample({
      id: "ignored-test-candidate",
      actor: "test-candidate-actor",
      evidence: "test-candidate-evidence",
      split: "test",
      caseId: "important-1",
      caseType: "important",
      arm: "candidate",
      outcome: "fail",
    }),
  );

  if (overrides.extraSamples) samples.push(...overrides.extraSamples);

  return {
    schema_version: 2,
    campaign_id: "fixture-campaign",
    artifacts: {
      source: { path: "SKILL.md", sha256: sha256(readFileSync(f.source)) },
      candidate: { path: "candidate.md", sha256: sha256(readFileSync(f.candidate)) },
      scenario,
      rubric,
      environment,
    },
    required_valid: requiredValid,
    samples,
  };
}

function changeOutcome(sample, outcome, detail) {
  const next = { ...sample, outcome };
  delete next.failure_code;
  delete next.reason;
  if (outcome === "fail") next.failure_code = detail ?? "KNOWN_GAP";
  if (outcome === "invalid" || outcome === "indeterminate") {
    next.reason = detail ?? "retained non-valid sample";
  }
  return next;
}

function gateArgs(f) {
  return [
    "gate",
    "--workspace-root",
    f.root,
    "--results",
    f.results,
    "--report",
    f.gateReport,
  ];
}

function stageArgs(f, out) {
  return [
    "stage",
    "--workspace-root",
    f.root,
    "--source",
    f.source,
    "--candidate",
    f.candidate,
    "--edits",
    f.edits,
    "--apply-report",
    f.applyReport,
    "--results",
    f.results,
    "--gate-report",
    f.gateReport,
    "--output-dir",
    out,
  ];
}

function acceptCandidate(f, candidate) {
  writeFileSync(
    f.results,
    JSON.stringify(campaign(f), null, 2),
  );
  const result = run(gateArgs(f));
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(readFileSync(f.gateReport, "utf8"));
}

test("apply executes all four bounded operations and binds hashes", () => {
  const f = fixture();
  try {
    const candidate = applySuccessfulCandidate(f);
    const sourceAfter = readFileSync(f.source, "utf8");
    const report = JSON.parse(readFileSync(f.applyReport, "utf8"));

    assert.equal(sourceAfter, SOURCE, "source Skill must remain immutable");
    assert.match(candidate, /inserted guidance/);
    assert.match(candidate, /new text/);
    assert.doesNotMatch(candidate, /old text|remove me/);
    assert.ok(
      candidate.indexOf("## Added") < candidate.indexOf("<!-- SLOW_UPDATE_START -->"),
      "append must stay outside the protected tail",
    );
    assert.equal(report.decision, "applied");
    assert.equal(report.source_sha256, sha256(SOURCE));
    assert.equal(report.candidate_sha256, sha256(candidate));
    assert.equal(report.schema_version, 2);
    assert.equal(
      report.actual_added_bytes,
      Buffer.byteLength("new text\ninserted guidance\n## Added\n\nappended guidance\n\n"),
    );
    assert.equal(report.actual_removed_bytes, Buffer.byteLength("old textremove me\n"));
    assert.deepEqual(
      report.applied_edits.map((edit) => edit.op),
      ["replace", "delete", "insert_after", "append"],
    );
  } finally {
    f.cleanup();
  }
});

test("apply enforces v2 byte budgets and per-field UTF-8 limits", () => {
  const cases = [
    {
      label: "legacy schema",
      patch: {
        schema_version: 1,
        source_sha256: sha256(SOURCE),
        max_edits: 1,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [{ op: "append", target: "", content: "x" }],
      },
      reason: /schema_version must be 2/,
    },
    {
      label: "added-byte budget",
      patch: {
        schema_version: 2,
        source_sha256: sha256(SOURCE),
        max_edits: 1,
        max_added_bytes: 1,
        max_removed_bytes: 1,
        edits: [{ op: "append", target: "", content: "é" }],
      },
      reason: /added bytes 2.*max_added_bytes 1/,
    },
    {
      label: "removed-byte budget",
      patch: {
        schema_version: 2,
        source_sha256: sha256(SOURCE),
        max_edits: 1,
        max_added_bytes: 1,
        max_removed_bytes: 1,
        edits: [{ op: "delete", target: "old text", content: "" }],
      },
      reason: /removed bytes 8.*max_removed_bytes 1/,
    },
    {
      label: "per-edit field limit",
      patch: {
        schema_version: 2,
        source_sha256: sha256(SOURCE),
        max_edits: 1,
        max_added_bytes: 8192,
        max_removed_bytes: 1,
        edits: [{ op: "append", target: "", content: "é".repeat(2049) }],
      },
      reason: /content exceeds 4096 UTF-8 bytes/,
    },
    {
      label: "hard campaign budget",
      patch: {
        schema_version: 2,
        source_sha256: sha256(SOURCE),
        max_edits: 1,
        max_added_bytes: 8193,
        max_removed_bytes: 1,
        edits: [{ op: "append", target: "", content: "x" }],
      },
      reason: /max_added_bytes.*between 1 and 8192/,
    },
  ];
  for (const entry of cases) {
    const f = fixture();
    try {
      writeFileSync(f.edits, JSON.stringify(entry.patch));
      const result = run(applyArgs(f));
      assert.equal(result.status, 2, `${entry.label}: ${result.stderr}`);
      assert.match(result.stderr, entry.reason);
      assert.equal(existsSync(f.candidate), false);
      assert.equal(existsSync(f.applyReport), false);
    } finally {
      f.cleanup();
    }
  }
});

test("apply rejects budget overflow and leaves no partial artifacts", () => {
  const f = fixture();
  try {
    writeFileSync(
      f.edits,
      JSON.stringify({
        schema_version: 2,
        source_sha256: sha256(SOURCE),
        max_edits: 1,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [
          { op: "replace", target: "old text", content: "new text" },
          { op: "delete", target: "remove me", content: "" },
        ],
      }),
    );
    const result = run(applyArgs(f));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /max_edits/);
    assert.equal(readFileSync(f.source, "utf8"), SOURCE);
    assert.throws(() => readFileSync(f.candidate));
    assert.throws(() => readFileSync(f.applyReport));
  } finally {
    f.cleanup();
  }
});

test("apply rejects missing or non-unique targets instead of falling back", () => {
  for (const edit of [
    { op: "insert_after", target: "missing target", content: "unsafe fallback" },
    { op: "replace", target: "text", content: "ambiguous" },
  ]) {
    const f = fixture();
    try {
      writeFileSync(
        f.edits,
        JSON.stringify({
          schema_version: 2,
          source_sha256: sha256(SOURCE),
          max_edits: 1,
          max_added_bytes: 1024,
          max_removed_bytes: 1024,
          edits: [edit],
        }),
      );
      const result = run(applyArgs(f));
      assert.equal(result.status, 2);
      assert.match(result.stderr, /exactly once/);
      assert.throws(() => readFileSync(f.candidate));
    } finally {
      f.cleanup();
    }
  }
});

test("apply protects YAML frontmatter, protected regions, and marker integrity", () => {
  const unsafeEdits = [
    { op: "replace", target: "name: fixture-skill", content: "name: hijacked" },
    { op: "delete", target: "protected text", content: "" },
    {
      op: "append",
      target: "",
      content: "<!-- APPENDIX_START -->injected<!-- APPENDIX_END -->",
    },
  ];

  for (const edit of unsafeEdits) {
    const f = fixture();
    try {
      writeFileSync(
        f.edits,
        JSON.stringify({
          schema_version: 2,
          source_sha256: sha256(SOURCE),
          max_edits: 1,
          max_added_bytes: 1024,
          max_removed_bytes: 1024,
          edits: [edit],
        }),
      );
      const result = run(applyArgs(f));
      assert.equal(result.status, 2);
      assert.match(result.stderr, /protected|marker/i);
      assert.equal(readFileSync(f.source, "utf8"), SOURCE);
      assert.throws(() => readFileSync(f.candidate));
    } finally {
      f.cleanup();
    }
  }
});

test("apply rejects protected markers embedded in frontmatter before append", () => {
  const f = fixture();
  try {
    const source = `---
name: fixture-skill
description: x <!-- SLOW_UPDATE_START --> guarded <!-- SLOW_UPDATE_END -->
---

# Fixture
`;
    writeFileSync(f.source, source);
    writeFileSync(
      f.edits,
      JSON.stringify({
        schema_version: 2,
        source_sha256: sha256(source),
        max_edits: 1,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [{ op: "append", target: "", content: "INJECTED" }],
      }),
    );
    const result = run(applyArgs(f));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /frontmatter.*protected|protected.*frontmatter/i);
    assert.equal(readFileSync(f.source, "utf8"), source);
    assert.throws(() => readFileSync(f.candidate));
  } finally {
    f.cleanup();
  }
});

test("apply validates Skill frontmatter before creating a candidate", () => {
  const f = fixture();
  try {
    writeFileSync(f.source, "---\nname: missing-description\n---\n\n# Bad\n");
    writeFileSync(
      f.edits,
      JSON.stringify({
    schema_version: 2,
        source_sha256: sha256("---\nname: missing-description\n---\n\n# Bad\n"),
        max_edits: 1,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [{ op: "append", target: "", content: "more" }],
      }),
    );
    const result = run(applyArgs(f));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /frontmatter|description/i);
    assert.throws(() => readFileSync(f.candidate));
  } finally {
    f.cleanup();
  }
});

test("apply rejects invalid YAML scalars and non-portable Skill names", () => {
  const invalidSources = [
    `---\nname: [\ndescription: Valid description\n---\n\n# Bad\n`,
    `---\nname: fixture-skill\ndescription: null\n---\n\n# Bad\n`,
    `---\nname: invalid--name\ndescription: Valid description\n---\n\n# Bad\n`,
    `---\nname: fixture-skill\ndescription: invalid trailing colon:\n---\n\n# Bad\n`,
    `---\nname: fixture-skill\ndescription: invalid\ttab\n---\n\n# Bad\n`,
    `---\nname: fixture-skill\ndescription: invalid\u0000control\n---\n\n# Bad\n`,
    `---\nname: fixture-skill\ndescription: invalid\u0085separator\n---\n\n# Bad\n`,
    `---\nname: fixture-skill\ndescription: invalid\u2028separator\n---\n\n# Bad\n`,
  ];

  for (const source of invalidSources) {
    const f = fixture();
    try {
      writeFileSync(f.source, source);
      writeFileSync(
        f.edits,
        JSON.stringify({
          schema_version: 2,
          source_sha256: sha256(source),
          max_edits: 1,
          max_added_bytes: 1024,
          max_removed_bytes: 1024,
          edits: [{ op: "append", target: "", content: "more" }],
        }),
      );
      const result = run(applyArgs(f));
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /frontmatter|YAML|name|description/i);
      assert.throws(() => readFileSync(f.candidate));
    } finally {
      f.cleanup();
    }
  }
});

test("apply rejects UTF-8 BOM and CRLF Skill inputs", () => {
  const variants = [
    { bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(SOURCE)]), reason: /BOM/ },
    { bytes: Buffer.from(SOURCE.replaceAll("\n", "\r\n")), reason: /LF line endings|carriage/ },
  ];
  for (const entry of variants) {
    const f = fixture();
    try {
      writeFileSync(f.source, entry.bytes);
      writeFileSync(
        f.edits,
        JSON.stringify({
          schema_version: 2,
          source_sha256: sha256(entry.bytes),
          max_edits: 1,
          max_added_bytes: 16,
          max_removed_bytes: 16,
          edits: [{ op: "append", target: "", content: "x" }],
        }),
      );
      const result = run(applyArgs(f));
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, entry.reason);
      assert.equal(existsSync(f.candidate), false);
    } finally {
      f.cleanup();
    }
  }
});

test("apply preserves adjacent insert and replacement semantics", () => {
  const f = fixture();
  try {
    const source = `---\nname: adjacent-edits\ndescription: Exercise adjacent edit ordering.\n---\n\n# Fixture\n\nAABB\n`;
    writeFileSync(f.source, source);
    writeFileSync(
      f.edits,
      JSON.stringify({
        schema_version: 2,
        source_sha256: sha256(source),
        max_edits: 2,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [
          { op: "replace", target: "BB", content: "XX" },
          { op: "insert_after", target: "AA", content: "I" },
        ],
      }),
    );
    const result = run(applyArgs(f));
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(f.candidate, "utf8"), /\nAAIXX\n$/);
  } finally {
    f.cleanup();
  }
});

test("apply never removes a pre-existing legacy temporary path", () => {
  const f = fixture();
  try {
    const wrapper = resolve(f.root, "legacy-temp-collision.mjs");
    const sentinel = "must survive";
    writeFileSync(
      wrapper,
      `import { writeFileSync } from "node:fs";\n`
        + `import { spawn } from "node:child_process";\n`
        + `const [node, cli, report, ...args] = process.argv.slice(2);\n`
        + `const child = spawn(node, [cli, ...args], { stdio: ["ignore", "pipe", "pipe"] });\n`
        + `const legacy = report + ".tmp-" + child.pid;\n`
        + `writeFileSync(legacy, ${JSON.stringify(sentinel)});\n`
        + `let stdout = ""; let stderr = "";\n`
        + `child.stdout.on("data", (chunk) => { stdout += chunk; });\n`
        + `child.stderr.on("data", (chunk) => { stderr += chunk; });\n`
        + `child.on("close", (code) => { process.stdout.write(JSON.stringify({ code, stdout, stderr, legacy })); });\n`,
    );

    const largeSource = SOURCE.replace("old text", `old text\n${"x".repeat(32 * 1024 * 1024)}`);
    writeFileSync(f.source, largeSource);
    writeFileSync(
      f.edits,
      JSON.stringify({
    schema_version: 2,
        source_sha256: sha256(largeSource),
        max_edits: 1,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [{ op: "replace", target: "old text", content: "new text" }],
      }),
    );
    const wrapped = spawnSync(
      process.execPath,
      [wrapper, process.execPath, cli, f.applyReport, ...applyArgs(f)],
      { cwd: repoRoot, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    );
    assert.equal(wrapped.status, 0, wrapped.stderr);
    const childResult = JSON.parse(wrapped.stdout);
    assert.equal(readFileSync(childResult.legacy, "utf8"), sentinel);
  } finally {
    f.cleanup();
  }
});

test("apply rollback never deletes a foreign concurrently-created output", () => {
  const f = fixture();
  try {
    writeFileSync(
      f.edits,
      JSON.stringify({
        schema_version: 2,
        source_sha256: sha256(SOURCE),
        max_edits: 1,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [{ op: "replace", target: "old text", content: "new text" }],
      }),
    );
    const result = runWithFsHook(
      f,
      applyArgs(f),
      `const fs = require("node:fs");\n`
        + `const { syncBuiltinESMExports } = require("node:module");\n`
        + `const original = fs.linkSync;\n`
        + `fs.linkSync = function(source, destination) {\n`
        + `  const result = original.call(this, source, destination);\n`
        + `  if (destination === process.env.SKILL_LAB_TEST_CANDIDATE) {\n`
        + `    fs.writeFileSync(process.env.SKILL_LAB_TEST_REPORT, "foreign owner", { flag: "wx" });\n`
        + `  }\n`
        + `  return result;\n`
        + `};\n`
        + `syncBuiltinESMExports();\n`,
      {
        SKILL_LAB_TEST_CANDIDATE: f.candidate,
        SKILL_LAB_TEST_REPORT: f.applyReport,
      },
    );
    assert.equal(result.status, 2, result.stderr);
    assert.equal(readFileSync(f.applyReport, "utf8"), "foreign owner");
    assert.equal(existsSync(f.candidate), false, "only the CLI-owned candidate is rolled back");
  } finally {
    f.cleanup();
  }
});

test("apply rejects non-UTF-8 Skill bytes and duplicate JSON keys", () => {
  const invalidUtf8 = fixture();
  try {
    const bytes = Buffer.concat([Buffer.from(SOURCE), Buffer.from([0xc3])]);
    writeFileSync(invalidUtf8.source, bytes);
    writeFileSync(
      invalidUtf8.edits,
      JSON.stringify({
        schema_version: 2,
        source_sha256: sha256(bytes),
        max_edits: 1,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [{ op: "append", target: "", content: "new guidance" }],
      }),
    );
    const result = run(applyArgs(invalidUtf8));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /valid UTF-8/);
    assert.throws(() => readFileSync(invalidUtf8.candidate));
  } finally {
    invalidUtf8.cleanup();
  }

  const duplicateKey = fixture();
  try {
    writeFileSync(
      duplicateKey.edits,
      `{"schema_version":2,"source_sha256":"${"0".repeat(64)}","source_sha256":"${sha256(SOURCE)}","max_edits":1,"max_added_bytes":1024,"max_removed_bytes":1024,"edits":[{"op":"append","target":"","content":"new guidance"}]}`,
    );
    const result = run(applyArgs(duplicateKey));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /duplicate JSON key.*source_sha256/i);
    assert.throws(() => readFileSync(duplicateKey.candidate));
  } finally {
    duplicateKey.cleanup();
  }
});

test("apply binds the patch to the source and validates all anchors against the immutable original", () => {
  const cases = [
    {
      label: "stale source digest",
      source: SOURCE,
      patch: {
          schema_version: 2,
        source_sha256: "0".repeat(64),
        max_edits: 1,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [{ op: "replace", target: "old text", content: "new text" }],
      },
      reason: /source_sha256/,
    },
    {
      label: "anchor introduced by an earlier edit",
      source: SOURCE,
      patch: {
    schema_version: 2,
        source_sha256: sha256(SOURCE),
        max_edits: 2,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [
          { op: "replace", target: "old text", content: "new anchor" },
          { op: "replace", target: "new anchor", content: "late binding" },
        ],
      },
      reason: /original source|exactly once/,
    },
    {
      label: "overlapping target spans",
      source: SOURCE.replace("old text", "abcdef"),
      patch: null,
      reason: /overlap/,
    },
  ];
  cases[2].patch = {
    schema_version: 2,
    source_sha256: sha256(cases[2].source),
    max_edits: 2,
    max_added_bytes: 1024,
    max_removed_bytes: 1024,
    edits: [
      { op: "replace", target: "abcd", content: "left" },
      { op: "delete", target: "cdef", content: "" },
    ],
  };

  for (const entry of cases) {
    const f = fixture();
    try {
      writeFileSync(f.source, entry.source);
      writeFileSync(f.edits, JSON.stringify(entry.patch));
      const result = run(applyArgs(f));
      assert.equal(result.status, 2, `${entry.label}: ${result.stderr}`);
      assert.match(result.stderr, entry.reason);
      assert.equal(readFileSync(f.source, "utf8"), entry.source);
      assert.throws(() => readFileSync(f.candidate));
    } finally {
      f.cleanup();
    }
  }
});

test("gate uses selection evidence only and accepts strict improvement without control regression", () => {
  const f = fixture();
  try {
    const candidate = applySuccessfulCandidate(f);
    const report = acceptCandidate(f, candidate);
    assert.equal(report.decision, "accept");
    assert.equal(report.ignored_by_split.test, 2);
    assert.equal(report.important[0].current.pass_rate, 0);
    assert.equal(report.important[0].candidate.pass_rate, 1);
    assert.equal(report.controls[0].candidate.pass_rate, 1);
    const reused = report.ledger.filter((sample) => sample.actor_id === "current-actor-1");
    assert.equal(reused.length, 2, "the same actor/evidence pair may be reused across cases");
    assert.equal(reused[0].evidence_sha256, reused[1].evidence_sha256);
  } finally {
    f.cleanup();
  }
});

test("gate re-reads every v2 artifact and rejects unphysical or unbound preimages", () => {
  const cases = [
    {
      label: "artifact digest mismatch",
      mutate: (_f, value) => { value.artifacts.scenario.sha256 = "0".repeat(64); },
      reason: /artifacts\.scenario.*sha256 mismatch/,
    },
    {
      label: "evidence content drift",
      mutate: (f, value) => {
        writeFileSync(resolve(f.root, value.samples[0].evidence_path), "drifted evidence\n");
      },
      reason: /evidence.*sha256 mismatch/,
    },
    {
      label: "absolute artifact path",
      mutate: (f, value) => { value.artifacts.rubric.path = f.source; },
      reason: /workspace-relative/,
    },
    {
      label: "traversal artifact path",
      mutate: (_f, value) => { value.artifacts.environment.path = "../outside.bin"; },
      reason: /traversal/,
    },
    {
      label: "symlink evidence",
      mutate: (f, value, outside) => {
        const target = resolve(outside, "evidence.bin");
        writeFileSync(target, "linked evidence\n");
        const link = resolve(f.root, "raw-evidence/link.bin");
        symlinkSync(target, link);
        value.samples[0].evidence_path = "raw-evidence/link.bin";
        value.samples[0].evidence_sha256 = sha256("linked evidence\n");
      },
      reason: /symbolic link/,
    },
    {
      label: "symlink parent",
      mutate: (f, value, outside) => {
        writeFileSync(resolve(outside, "scenario.bin"), "frozen-scenarios");
        symlinkSync(outside, resolve(f.root, "linked-campaign"));
        value.artifacts.scenario.path = "linked-campaign/scenario.bin";
      },
      reason: /symbolic link/,
    },
    {
      label: "invalid source Skill with matching digest",
      mutate: (f, value) => {
        const invalid = "not a Skill\n";
        writeFileSync(f.source, invalid);
        value.artifacts.source.sha256 = sha256(invalid);
      },
      reason: /frontmatter/,
    },
    {
      label: "invalid candidate Skill with matching digest",
      mutate: (f, value) => {
        const invalid = "not a candidate Skill\n";
        writeFileSync(f.candidate, invalid);
        value.artifacts.candidate.sha256 = sha256(invalid);
      },
      reason: /frontmatter/,
    },
  ];

  for (const entry of cases) {
    const f = fixture();
    const outside = mkdtempSync(resolve(tmpdir(), "skill-lab-preimage-outside-"));
    try {
      applySuccessfulCandidate(f);
      const value = campaign(f);
      entry.mutate(f, value, outside);
      writeFileSync(f.results, JSON.stringify(value, null, 2));
      const result = run(gateArgs(f));
      assert.equal(result.status, 2, `${entry.label}: ${result.stderr}`);
      assert.match(result.stderr, entry.reason);
      assert.equal(existsSync(f.gateReport), false);
    } finally {
      f.cleanup();
      rmSync(outside, { recursive: true, force: true });
    }
  }
});

test("gate rejects ties, insufficient valid samples, and control regressions with retained reports", () => {
  const cases = [
    {
      label: "tie",
      build: (f) => campaign(f, { importantCurrent: "pass" }),
      reason: /strict improvement/,
    },
    {
      label: "insufficient",
      build: (f) => {
        const value = campaign(f);
        value.samples = value.samples.map((sample) =>
          sample.id === "important-candidate-5"
            ? changeOutcome(sample, "indeterminate", "actor did not finish")
            : sample,
        );
        return value;
      },
      reason: /required valid/,
    },
    {
      label: "control regression",
      build: (f) => campaign(f, { controlCandidate: "fail" }),
      reason: /control regression/,
    },
    {
      label: "candidate important failure",
      build: (f) => {
        const value = campaign(f);
        value.samples = value.samples.map((sample) =>
          sample.id === "important-candidate-5"
            ? changeOutcome(sample, "fail", "CANDIDATE_GAP")
            : sample,
        );
        return value;
      },
      reason: /candidate failure.*important-1/,
    },
  ];

  for (const entry of cases) {
    const f = fixture();
    try {
      const candidate = applySuccessfulCandidate(f);
      writeFileSync(
        f.results,
        JSON.stringify(entry.build(f), null, 2),
      );
      const result = run(gateArgs(f));
      assert.equal(result.status, 3, `${entry.label}: ${result.stderr}`);
      const report = JSON.parse(readFileSync(f.gateReport, "utf8"));
      assert.equal(report.decision, "reject");
      assert.match(report.reasons.join("\n"), entry.reason);
      if (entry.label === "insufficient") {
        assert.ok(
          report.ledger.some(
            (sample) => sample.id === "important-candidate-5"
              && sample.reason === "actor did not finish",
          ),
          "gate report must retain indeterminate evidence and reason",
        );
      }
    } finally {
      f.cleanup();
    }
  }
});

test("gate rejects a one-off current failure as inconclusive", () => {
  const f = fixture();
  try {
    const candidate = applySuccessfulCandidate(f);
    const value = campaign(f, {
      importantCurrent: "pass",
    });
    value.samples = value.samples.map((sample) =>
      sample.id === "important-current-5"
        ? changeOutcome(sample, "fail", "ONE_OFF_GAP")
        : sample,
    );
    writeFileSync(f.results, JSON.stringify(value, null, 2));
    const result = run(gateArgs(f));
    assert.equal(result.status, 3, result.stderr);
    const report = JSON.parse(readFileSync(f.gateReport, "utf8"));
    assert.match(report.reasons.join("\n"), /repeated|inconclusive|two current failures/i);
  } finally {
    f.cleanup();
  }
});

test("gate requires valid failures to carry stable ASCII failure codes", () => {
  const mutations = [
    {
      label: "missing fail code",
      mutate: (sample) => {
        const next = { ...sample };
        delete next.failure_code;
        return next;
      },
      reason: /failure_code.*stable ASCII/,
    },
    {
      label: "non-ASCII fail code",
      mutate: (sample) => ({ ...sample, failure_code: "失败" }),
      reason: /failure_code.*stable ASCII/,
    },
    {
      label: "pass with fail code",
      target: "important-candidate-1",
      mutate: (sample) => ({ ...sample, failure_code: "NOT_ALLOWED" }),
      reason: /pass must not attach failure_code/,
    },
    {
      label: "non-ASCII sample id",
      mutate: (sample) => ({ ...sample, id: "样本-1" }),
      reason: /id.*stable ASCII/,
    },
  ];
  for (const entry of mutations) {
    const f = fixture();
    try {
      applySuccessfulCandidate(f);
      const value = campaign(f);
      const target = entry.target ?? "important-current-1";
      value.samples = value.samples.map((sample) =>
        sample.id === target ? entry.mutate(sample) : sample,
      );
      writeFileSync(f.results, JSON.stringify(value, null, 2));
      const result = run(gateArgs(f));
      assert.equal(result.status, 2, `${entry.label}: ${result.stderr}`);
      assert.match(result.stderr, entry.reason);
      assert.equal(existsSync(f.gateReport), false);
    } finally {
      f.cleanup();
    }
  }
});

test("gate recognizes only repeated identical failure codes as a candidate gap", () => {
  const f = fixture();
  try {
    applySuccessfulCandidate(f);
    const value = campaign(f);
    let gap = 0;
    value.samples = value.samples.map((sample) => {
      if (sample.split !== "selection"
          || sample.case_id !== "important-1"
          || sample.arm !== "current") return sample;
      gap += 1;
      return { ...sample, failure_code: `DISTINCT_GAP_${gap}` };
    });
    writeFileSync(f.results, JSON.stringify(value, null, 2));
    const result = run(gateArgs(f));
    assert.equal(result.status, 3, result.stderr);
    const report = JSON.parse(readFileSync(f.gateReport, "utf8"));
    assert.deepEqual(report.important[0].repeated_current_failure_codes, []);
    assert.match(report.reasons.join("\n"), /sharing one failure_code/);
  } finally {
    f.cleanup();
  }
});

test("gate requires exactly required_valid per selection arm while retaining extra non-valid samples", () => {
  for (const extraOutcome of ["pass", "invalid"]) {
    const f = fixture();
    try {
      applySuccessfulCandidate(f);
      const value = campaign(f);
      const evidencePath = `raw-evidence/extra-${extraOutcome}.bin`;
      const evidence = `extra-${extraOutcome}\n`;
      writeFileSync(resolve(f.root, evidencePath), evidence);
      value.samples.push({
        id: `important-current-extra-${extraOutcome}`,
        actor_id: `extra-actor-${extraOutcome}`,
        evidence_path: evidencePath,
        evidence_sha256: sha256(evidence),
        split: "selection",
        case_id: "important-1",
        case_type: "important",
        arm: "current",
        outcome: extraOutcome,
        ...(extraOutcome === "invalid" ? { reason: "retained invalid run" } : {}),
      });
      writeFileSync(f.results, JSON.stringify(value, null, 2));
      const result = run(gateArgs(f));
      if (extraOutcome === "pass") {
        assert.equal(result.status, 3, result.stderr);
        const report = JSON.parse(readFileSync(f.gateReport, "utf8"));
        assert.match(report.reasons.join("\n"), /current has 6 valid.*exactly 5/);
        assert.match(report.reasons.join("\n"), /valid counts must be equal/);
      } else {
        assert.equal(result.status, 0, result.stderr);
        const report = JSON.parse(readFileSync(f.gateReport, "utf8"));
        assert.equal(report.important[0].current.invalid, 1);
        assert.equal(report.important[0].current.valid, 5);
      }
    } finally {
      f.cleanup();
    }
  }
});

test("gate rejects actor and evidence reuse across current and candidate arms", () => {
  const f = fixture();
  try {
    const candidate = applySuccessfulCandidate(f);
    const value = campaign(f);
    value.samples = value.samples.map((sample) => {
      if (sample.split !== "selection" || sample.arm !== "candidate") return sample;
      const index = sample.id.match(/-(\d+)$/)?.[1];
      return {
        ...sample,
        actor_id: `current-actor-${index}`,
        evidence_path: `raw-evidence/selection-current-${index}.bin`,
        evidence_sha256: sha256(`selection-current-${index}\n`),
      };
    });
    writeFileSync(f.results, JSON.stringify(value, null, 2));
    const result = run(gateArgs(f));
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /reuses (an )?(actor|evidence).*across arms/i);
    assert.throws(() => readFileSync(f.gateReport));
  } finally {
    f.cleanup();
  }
});

test("gate rejects actor and evidence reuse across held-out splits", () => {
  const f = fixture();
  try {
    const candidate = applySuccessfulCandidate(f);
    const value = campaign(f);
    value.samples = value.samples.map((sample) =>
      sample.id === "ignored-test-current"
        ? {
            ...sample,
            actor_id: "current-actor-1",
            evidence_path: "raw-evidence/selection-current-1.bin",
            evidence_sha256: sha256("selection-current-1\n"),
          }
        : sample,
    );
    writeFileSync(f.results, JSON.stringify(value, null, 2));
    const result = run(gateArgs(f));
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /reuses (an )?(actor|evidence).*split/i);
    assert.throws(() => readFileSync(f.gateReport));
  } finally {
    f.cleanup();
  }
});

test("gate preserves one actor-to-evidence pairing across case rows", () => {
  const mismatches = [
    {
      id: "control-current-1",
      patch: {
        evidence_path: "raw-evidence/different-evidence.bin",
        evidence_sha256: sha256("different-evidence\n"),
      },
      reason: /actor.*different evidence/i,
    },
    {
      id: "control-current-1",
      patch: { actor_id: "different-actor" },
      reason: /evidence.*different actors/i,
    },
  ];

  for (const mismatch of mismatches) {
    const f = fixture();
    try {
      const candidate = applySuccessfulCandidate(f);
      const value = campaign(f);
      writeFileSync(resolve(f.root, "raw-evidence/different-evidence.bin"), "different-evidence\n");
      value.samples = value.samples.map((sample) =>
        sample.id === mismatch.id ? { ...sample, ...mismatch.patch } : sample,
      );
      writeFileSync(f.results, JSON.stringify(value, null, 2));
      const result = run(gateArgs(f));
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, mismatch.reason);
      assert.throws(() => readFileSync(f.gateReport));
    } finally {
      f.cleanup();
    }
  }
});

test("stage writes a self-contained, digest-deduplicated review package", () => {
  const f = fixture();
  try {
    const candidate = applySuccessfulCandidate(f);
    acceptCandidate(f, candidate);
    const out = resolve(f.root, "staged", "candidate-1");
    const result = run([
      "stage",
      "--workspace-root",
      f.root,
      "--source",
      f.source,
      "--candidate",
      f.candidate,
      "--edits",
      f.edits,
      "--apply-report",
      f.applyReport,
      "--results",
      f.results,
      "--gate-report",
      f.gateReport,
      "--output-dir",
      out,
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(f.source, "utf8"), SOURCE);
    assert.equal(readFileSync(resolve(out, "proposed_SKILL.md"), "utf8"), candidate);

    const manifest = JSON.parse(readFileSync(resolve(out, "manifest.json"), "utf8"));
    const expectedFixed = [
      "apply/report.json",
      "campaign/environment.bin",
      "campaign/rubric.bin",
      "campaign/scenario.bin",
      "edits.json",
      "gate/report.json",
      "proposed_SKILL.md",
      "results.json",
      "source_SKILL.md",
    ];
    assert.equal(manifest.schema_version, 2);
    assert.equal(Object.keys(manifest.evidence).length, 12, "case-row reuse must deduplicate evidence");
    assert.deepEqual(
      listFiles(out),
      [...Object.keys(manifest.files), "manifest.json"].sort(),
    );
    assert.deepEqual(
      Object.keys(manifest.files).filter((name) => !name.startsWith("evidence/")),
      expectedFixed,
    );
    assert.equal(manifest.artifacts.source.sha256, sha256(SOURCE));
    assert.equal(manifest.artifacts.candidate.sha256, sha256(candidate));
    for (const [name, record] of Object.entries(manifest.files)) {
      const bytes = readFileSync(resolve(out, name));
      assert.equal(record.sha256, sha256(bytes));
      assert.equal(record.bytes, bytes.length);
    }
  } finally {
    f.cleanup();
  }
});

test("stage rejects results whose source or candidate path is a same-byte substitute", () => {
  for (const artifactName of ["source", "candidate"]) {
    const f = fixture();
    try {
      applySuccessfulCandidate(f);
      const value = campaign(f);
      const duplicatePath = `duplicates/${artifactName}.md`;
      mkdirSync(resolve(f.root, "duplicates"), { recursive: true });
      copyFileSync(
        artifactName === "source" ? f.source : f.candidate,
        resolve(f.root, duplicatePath),
      );
      value.artifacts[artifactName].path = duplicatePath;
      writeFileSync(f.results, JSON.stringify(value, null, 2));
      assert.equal(run(gateArgs(f)).status, 0);
      const out = resolve(f.root, `staged-mismatched-${artifactName}`);
      const result = run(stageArgs(f, out));
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, new RegExp(`artifacts\\.${artifactName} path.*staged`));
      assert.equal(existsSync(out), false);
    } finally {
      f.cleanup();
    }
  }
});

test("stage reserves the final directory without replacing a concurrent empty directory", () => {
  const f = fixture();
  try {
    const candidate = applySuccessfulCandidate(f);
    acceptCandidate(f, candidate);
    const out = resolve(f.root, "concurrent-empty-output");
    const result = runWithFsHook(
      f,
      stageArgs(f, out),
      `const fs = require("node:fs");\n`
        + `const { syncBuiltinESMExports } = require("node:module");\n`
        + `const original = fs.mkdtempSync;\n`
        + `fs.mkdtempSync = function(prefix, ...args) {\n`
        + `  const result = original.call(this, prefix, ...args);\n`
        + `  if (String(prefix).includes(".skill-lab-stage-")) fs.mkdirSync(process.env.SKILL_LAB_TEST_OUT);\n`
        + `  return result;\n`
        + `};\n`
        + `syncBuiltinESMExports();\n`,
      { SKILL_LAB_TEST_OUT: out },
    );
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /could not stage candidate.*exist/i);
    assert.deepEqual(readdirSync(out), [], "the concurrent owner's empty directory must survive");
  } finally {
    f.cleanup();
  }
});

test("stage publishes manifest last and leaves an incomplete directory on publication failure", () => {
  const f = fixture();
  try {
    const candidate = applySuccessfulCandidate(f);
    acceptCandidate(f, candidate);
    const out = resolve(f.root, "incomplete-stage");
    const result = runWithFsHook(
      f,
      stageArgs(f, out),
      `const fs = require("node:fs");\n`
        + `const { syncBuiltinESMExports } = require("node:module");\n`
        + `const original = fs.linkSync;\n`
        + `fs.linkSync = function(source, destination) {\n`
        + `  if (String(destination).endsWith("/gate/report.json")) throw new Error("injected short publish");\n`
        + `  return original.call(this, source, destination);\n`
        + `};\n`
        + `syncBuiltinESMExports();\n`,
    );
    assert.equal(result.status, 2, result.stderr);
    assert.equal(existsSync(out), true);
    assert.equal(existsSync(resolve(out, "manifest.json")), false);
    assert.ok(listFiles(out).length > 0, "reviewers can identify the retained incomplete output");
  } finally {
    f.cleanup();
  }
});

test("post-publication stage temp cleanup failure does not reverse success", () => {
  const f = fixture();
  try {
    const candidate = applySuccessfulCandidate(f);
    acceptCandidate(f, candidate);
    const out = resolve(f.root, "cleanup-failure-stage");
    const result = runWithFsHook(
      f,
      stageArgs(f, out),
      `const fs = require("node:fs");\n`
        + `const { syncBuiltinESMExports } = require("node:module");\n`
        + `const original = fs.rmSync;\n`
        + `fs.rmSync = function(path, ...args) {\n`
        + `  if (String(path).includes(".skill-lab-stage-")) throw new Error("injected cleanup failure");\n`
        + `  return original.call(this, path, ...args);\n`
        + `};\n`
        + `syncBuiltinESMExports();\n`,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(resolve(out, "manifest.json")), true);
  } finally {
    f.cleanup();
  }
});

test("stage rejects a short gate report before creating the final directory", () => {
  const f = fixture();
  try {
    const candidate = applySuccessfulCandidate(f);
    acceptCandidate(f, candidate);
    const full = readFileSync(f.gateReport);
    writeFileSync(f.gateReport, full.subarray(0, Math.floor(full.length / 2)));
    const out = resolve(f.root, "short-gate-stage");
    const result = run(stageArgs(f, out));
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /gate report is not valid JSON/);
    assert.equal(existsSync(out), false);
  } finally {
    f.cleanup();
  }
});

test("apply and gate reject inputs or outputs outside their workspace root", () => {
  const f = fixture();
  const outside = mkdtempSync(resolve(tmpdir(), "superzhao-skill-lab-outside-"));
  try {
    writeFileSync(
      f.edits,
      JSON.stringify({
        schema_version: 2,
        source_sha256: sha256(SOURCE),
        max_edits: 1,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [{ op: "replace", target: "old text", content: "new text" }],
      }),
    );
    const applyResult = run([
      ...applyArgs(f).slice(0, -4),
      "--candidate",
      resolve(outside, "candidate.md"),
      "--report",
      resolve(outside, "apply.json"),
    ]);
    assert.equal(applyResult.status, 2);
    assert.match(applyResult.stderr, /outside the workspace/);

    const candidate = applySuccessfulCandidate(f);
    writeFileSync(
      f.results,
      JSON.stringify(campaign(f), null, 2),
    );
    const gateResult = run([
      "gate",
      "--workspace-root",
      f.root,
      "--results",
      f.results,
      "--report",
      resolve(outside, "gate.json"),
    ]);
    assert.equal(gateResult.status, 2);
    assert.match(gateResult.stderr, /outside the workspace/);
  } finally {
    f.cleanup();
    rmSync(outside, { recursive: true, force: true });
  }
});

test("randomized outside-output rejections never clean up foreign paths", () => {
  const f = fixture();
  const outside = mkdtempSync(resolve(tmpdir(), "skill-lab-random-outside-"));
  try {
    writeFileSync(
      f.edits,
      JSON.stringify({
        schema_version: 2,
        source_sha256: sha256(SOURCE),
        max_edits: 1,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [{ op: "replace", target: "old text", content: "new text" }],
      }),
    );
    for (let index = 0; index < 12; index += 1) {
      const token = `${index}-${Math.random().toString(16).slice(2)}`;
      const foreign = resolve(outside, `.skill-lab-output-${token}`);
      const sentinel = `foreign-${token}`;
      writeFileSync(foreign, sentinel);
      const result = run([
        "apply",
        "--workspace-root",
        f.root,
        "--source",
        f.source,
        "--edits",
        f.edits,
        "--candidate",
        foreign,
        "--report",
        resolve(f.root, `report-${token}.json`),
      ]);
      assert.equal(result.status, 2, result.stderr);
      assert.equal(readFileSync(foreign, "utf8"), sentinel);
    }
  } finally {
    f.cleanup();
    rmSync(outside, { recursive: true, force: true });
  }
});

test("stage refuses rejected or forged gates, drift, and paths outside the workspace", () => {
  const modes = ["rejected", "forged", "drift", "escape"];
  for (const mode of modes) {
    const f = fixture();
    try {
      const candidate = applySuccessfulCandidate(f);
      if (mode === "rejected" || mode === "forged") {
        writeFileSync(
          f.results,
          JSON.stringify(
            campaign(f, { importantCurrent: "pass" }),
          ),
        );
        assert.equal(run(gateArgs(f)).status, 3);
        if (mode === "forged") {
          const forged = JSON.parse(readFileSync(f.gateReport, "utf8"));
          forged.decision = "accept";
          forged.reasons = [];
          writeFileSync(f.gateReport, `${JSON.stringify(forged, null, 2)}\n`);
        }
      } else {
        acceptCandidate(f, candidate);
      }
      if (mode === "drift") writeFileSync(f.candidate, `${candidate}\ndrift\n`);

      const outside = resolve(f.root, "..", `escaped-${Date.now()}`);
      const out = mode === "escape" ? outside : resolve(f.root, `staged-${mode}`);
      const result = run([
        "stage",
        "--workspace-root",
        f.root,
        "--source",
        f.source,
        "--candidate",
        f.candidate,
        "--edits",
        f.edits,
        "--apply-report",
        f.applyReport,
        "--results",
        f.results,
        "--gate-report",
        f.gateReport,
        "--output-dir",
        out,
      ]);
      if (mode === "rejected" || mode === "forged") {
        assert.equal(result.status, 4, `${mode}: ${result.stderr}`);
        assert.match(result.stderr, /recomputed gate rejected/);
      } else {
        assert.equal(result.status, 2, `${mode}: ${result.stderr}`);
      }
      assert.throws(() => readFileSync(resolve(out, "proposed_SKILL.md")));
      rmSync(outside, { recursive: true, force: true });
    } finally {
      f.cleanup();
    }
  }
});

test("CLI contains no adoption, transcript harvesting, provider, or network path", () => {
  const source = readFileSync(cli, "utf8");
  assert.match(source, /!isAbsolute\(path\)/, "containment must reject cross-drive relative results");
  for (const forbidden of [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    ".codex/sessions",
    "harvest",
    "node:http",
    "node:https",
    "node:net",
    "node:tls",
    "node:child_process",
    "process.env",
    ".claude",
    "fetch(",
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const result = run(["adopt"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown command/);
});

test("CLI runs from a cache-like installed plugin path", () => {
  const f = fixture();
  const cache = mkdtempSync(resolve(tmpdir(), "superzhao-plugin-cache-"));
  try {
    const cachedCli = resolve(cache, "superzhao-skill-lab", "scripts", "skill-lab.mjs");
    mkdirSync(dirname(cachedCli), { recursive: true });
    copyFileSync(cli, cachedCli);
    writeFileSync(
      f.edits,
      JSON.stringify({
          schema_version: 2,
        source_sha256: sha256(SOURCE),
        max_edits: 1,
        max_added_bytes: 1024,
        max_removed_bytes: 1024,
        edits: [{ op: "replace", target: "old text", content: "new text" }],
      }),
    );
    const result = runWithCli(cachedCli, applyArgs(f));
    assert.equal(result.status, 0, result.stderr);
  } finally {
    f.cleanup();
    rmSync(cache, { recursive: true, force: true });
  }
});
