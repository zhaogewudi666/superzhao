import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";

import {
  PORTABLE_SOURCE,
  applyArgs,
  artifact,
  assertNoApplyOutput,
  canonicalJson,
  makeFixture,
  portableHeaderBytes,
  runCli,
  runWithHook,
  sha256,
  writeJson,
} from "./helpers.mjs";

const MiB = 1024 * 1024;
const MAX_INPUT_BYTES = 8 * MiB;
const MAX_CAMPAIGN_BYTES = 64 * MiB;

function basePatch(fixture, overrides = {}) {
  return {
    schema: "superzhao.skill-lab.patch/v3",
    proposal_id: "proposal-v3-1",
    source_sha256: sha256(readFileSync(fixture.source)),
    max_edits: 2,
    max_added_bytes: 1024,
    max_removed_bytes: 1024,
    assumptions: [
      {
        assumption_id: "assumption-1",
        status: "known",
        summary: "The observed gap is confined to the body guidance.",
      },
    ],
    prior_rejections: [],
    edits: [
      {
        edit_id: "edit-replace-workflow",
        op: "replace",
        target: "old text",
        content: "new text",
        rationale: "Close the repeated workflow gap.",
        supporting_case_ids: ["selection-important-1"],
        support_count: 1,
        source_types: ["failure", "human-constraint"],
      },
      {
        edit_id: "edit-remove-obsolete",
        op: "delete",
        target: "remove me\n",
        content: "",
        rationale: "Remove guidance contradicted by the human constraint.",
        supporting_case_ids: ["selection-important-1", "selection-control-1"],
        support_count: 2,
        source_types: ["success", "rejection"],
      },
    ],
    ...overrides,
  };
}

function supportedEdit(editId, op, target, content) {
  return {
    edit_id: editId,
    op,
    target,
    content,
    rationale: `Exercise the bounded ${op} behavior.`,
    supporting_case_ids: ["selection-important-1"],
    support_count: 1,
    source_types: ["failure"],
  };
}

function patchWithEdits(fixture, edits, overrides = {}) {
  return basePatch(fixture, {
    max_edits: edits.length,
    edits,
    ...overrides,
  });
}

function materializePriorRejection(fixture, name = "prior-1", bytes = "rejected report\n") {
  const relative = `rejections/${name}.json`;
  const absolute = resolve(fixture.root, relative);
  mkdirSync(dirname(absolute), { recursive: true, mode: 0o700 });
  writeFileSync(absolute, bytes);
  return {
    rejection_id: name,
    report: artifact(relative, bytes),
    relationship: "narrows",
    note: "The new proposal narrows the rejected edit surface.",
  };
}

test("v3 apply preserves portable frontmatter bytes and emits canonical provenance", () => {
  const f = makeFixture();
  try {
    const prior = materializePriorRejection(f);
    const patch = basePatch(f, { prior_rejections: [prior] });
    writeJson(f.edits, patch);

    const result = runCli(applyArgs(f));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(readFileSync(f.source, "utf8"), PORTABLE_SOURCE);

    const candidate = readFileSync(f.candidate, "utf8");
    assert.equal(portableHeaderBytes(candidate), portableHeaderBytes(PORTABLE_SOURCE));
    assert.match(candidate, /new text/);
    assert.doesNotMatch(candidate, /old text|remove me/);

    const reportText = readFileSync(f.applyReport, "utf8");
    const report = JSON.parse(reportText);
    assert.equal(reportText, `${canonicalJson(report)}\n`);
    assert.equal(report.schema, "superzhao.skill-lab.apply-report/v3");
    assert.equal(report.status, "applied");
    assert.equal(report.proposal_id, patch.proposal_id);
    assert.equal(report.source_sha256, patch.source_sha256);
    assert.equal(report.candidate_sha256, sha256(candidate));
    assert.equal(report.patch_sha256, sha256(readFileSync(f.edits)));
    assert.deepEqual(report.assumptions, patch.assumptions);
    assert.deepEqual(report.prior_rejections, patch.prior_rejections);
    assert.deepEqual(
      report.applied_edits.map((edit) => ({
        edit_id: edit.edit_id,
        rationale: edit.rationale,
        supporting_case_ids: edit.supporting_case_ids,
        support_count: edit.support_count,
        source_types: edit.source_types,
      })),
      patch.edits.map((edit) => ({
        edit_id: edit.edit_id,
        rationale: edit.rationale,
        supporting_case_ids: edit.supporting_case_ids,
        support_count: edit.support_count,
        source_types: edit.source_types,
      })),
    );
  } finally {
    f.cleanup();
  }
});

test("v3 apply executes all four bounded operations against the immutable source", () => {
  const f = makeFixture();
  try {
    const edits = [
      supportedEdit("replace-workflow", "replace", "old text", "new text"),
      supportedEdit("delete-obsolete", "delete", "remove me\n", ""),
      supportedEdit("insert-guidance", "insert_after", "## Workflow\n", "\ninserted guidance\n"),
      supportedEdit("append-section", "append", "", "\n## Added\n\nappended guidance\n\n"),
    ];
    writeJson(f.edits, patchWithEdits(f, edits, {
      max_added_bytes: 4096,
      max_removed_bytes: 4096,
    }));

    const result = runCli(applyArgs(f));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(f.source, "utf8"), PORTABLE_SOURCE);
    const candidate = readFileSync(f.candidate, "utf8");
    assert.match(candidate, /inserted guidance/);
    assert.match(candidate, /new text/);
    assert.doesNotMatch(candidate, /old text|remove me/);
    assert.ok(
      candidate.indexOf("## Added") < candidate.indexOf("<!-- SLOW_UPDATE_START -->"),
      "append must remain outside the protected tail",
    );

    const report = JSON.parse(readFileSync(f.applyReport, "utf8"));
    assert.deepEqual(report.applied_edits.map((edit) => edit.op), [
      "replace",
      "delete",
      "insert_after",
      "append",
    ]);
    assert.equal(
      report.actual_added_bytes,
      Buffer.byteLength("new text\ninserted guidance\n\n## Added\n\nappended guidance\n\n"),
    );
    assert.equal(report.actual_removed_bytes, Buffer.byteLength("old textremove me\n"));
    assert.equal(report.source_sha256, sha256(PORTABLE_SOURCE));
    assert.equal(report.candidate_sha256, sha256(candidate));
  } finally {
    f.cleanup();
  }
});

test("v3 apply accepts exact 4096-byte fields and enforces edit and byte budgets", async (t) => {
  await t.test("target at exactly 4096 UTF-8 bytes", () => {
    const target = "é".repeat(2048);
    assert.equal(Buffer.byteLength(target), 4096);
    const source = PORTABLE_SOURCE.replace("old text", target);
    const f = makeFixture(source);
    try {
      writeJson(f.edits, patchWithEdits(f, [
        supportedEdit("replace-boundary-target", "replace", target, "bounded replacement"),
      ], { max_added_bytes: 4096, max_removed_bytes: 8192 }));
      const result = runCli(applyArgs(f));
      assert.equal(result.status, 0, result.stderr);
      assert.match(readFileSync(f.candidate, "utf8"), /bounded replacement/);
    } finally {
      f.cleanup();
    }
  });

  await t.test("content at exactly 4096 UTF-8 bytes", () => {
    const content = "é".repeat(2048);
    assert.equal(Buffer.byteLength(content), 4096);
    const f = makeFixture();
    try {
      writeJson(f.edits, patchWithEdits(f, [
        supportedEdit("replace-boundary-content", "replace", "old text", content),
      ], { max_added_bytes: 4096 }));
      const result = runCli(applyArgs(f));
      assert.equal(result.status, 0, result.stderr);
      assert.match(readFileSync(f.candidate, "utf8"), new RegExp(content.slice(0, 32)));
    } finally {
      f.cleanup();
    }
  });

  for (const [label, mutate, expected] of [
    ["4097-byte content", (patch) => {
      patch.edits = [supportedEdit(
        "overflow-content",
        "replace",
        "old text",
        `${"é".repeat(2048)}x`,
      )];
      patch.max_edits = 1;
      patch.max_added_bytes = 8192;
    }, /4096 UTF-8 bytes/],
    ["actual added-byte budget", (patch) => {
      patch.edits = [supportedEdit("added-budget", "append", "", "é")];
      patch.max_edits = 1;
      patch.max_added_bytes = 1;
    }, /added bytes 2.*max_added_bytes 1/],
    ["actual removed-byte budget", (patch) => {
      patch.edits = [supportedEdit("removed-budget", "delete", "old text", "")];
      patch.max_edits = 1;
      patch.max_removed_bytes = 1;
    }, /removed bytes 8.*max_removed_bytes 1/],
    ["declared campaign budget", (patch) => {
      patch.max_added_bytes = 8193;
    }, /max_added_bytes.*between 1 and 8192/],
    ["max edits", (patch) => {
      patch.max_edits = 1;
    }, /max_edits/],
  ]) {
    await t.test(label, () => {
      const f = makeFixture();
      try {
        const patch = basePatch(f);
        mutate(patch);
        writeJson(f.edits, patch);
        const result = runCli(applyArgs(f));
        assert.equal(result.status, 2, `${label}: ${result.stderr}`);
        assert.match(result.stderr, expected, label);
        assertNoApplyOutput(f);
        assert.equal(readFileSync(f.source, "utf8"), PORTABLE_SOURCE);
      } finally {
        f.cleanup();
      }
    });
  }
});

test("v3 apply rejects missing, duplicate, introduced, and overlapping anchors", async (t) => {
  const cases = [
    ["missing target", PORTABLE_SOURCE, [
      supportedEdit("missing-anchor", "insert_after", "missing target", "unsafe fallback"),
    ], /exactly once.*found 0/],
    ["duplicate target", PORTABLE_SOURCE, [
      supportedEdit("duplicate-anchor", "replace", "text", "ambiguous"),
    ], /exactly once/],
    ["introduced anchor", PORTABLE_SOURCE, [
      supportedEdit("introduce-anchor", "replace", "old text", "new anchor"),
      supportedEdit("consume-anchor", "replace", "new anchor", "late binding"),
    ], /original source|exactly once/],
    ["overlapping targets", PORTABLE_SOURCE.replace("old text", "abcdef"), [
      supportedEdit("overlap-left", "replace", "abcd", "left"),
      supportedEdit("overlap-right", "delete", "cdef", ""),
    ], /overlap/],
  ];

  for (const [label, source, edits, expected] of cases) {
    await t.test(label, () => {
      const f = makeFixture(source);
      try {
        writeJson(f.edits, patchWithEdits(f, edits));
        const result = runCli(applyArgs(f));
        assert.equal(result.status, 2, `${label}: ${result.stderr}`);
        assert.match(result.stderr, expected, label);
        assertNoApplyOutput(f);
      } finally {
        f.cleanup();
      }
    });
  }

  await t.test("adjacent insert and replacement retain original coordinates", () => {
    const source = `---\nname: adjacent-edits\ndescription: Exercise adjacent edit ordering.\n---\n\n# Fixture\n\nAABB\n`;
    const f = makeFixture(source);
    try {
      writeJson(f.edits, patchWithEdits(f, [
        supportedEdit("replace-right", "replace", "BB", "XX"),
        supportedEdit("insert-left", "insert_after", "AA", "I"),
      ]));
      const result = runCli(applyArgs(f));
      assert.equal(result.status, 0, result.stderr);
      assert.match(readFileSync(f.candidate, "utf8"), /\nAAIXX\n$/);
    } finally {
      f.cleanup();
    }
  });
});

test("v3 apply protects Skill syntax, frontmatter, marker regions, and input encoding", async (t) => {
  const invalidSources = [
    ["missing description", `---\nname: missing-description\n---\n\n# Bad\n`, /description|frontmatter/i],
    ["invalid YAML scalar", `---\nname: [\ndescription: Valid description\n---\n\n# Bad\n`, /YAML|frontmatter|name/i],
    ["null description", `---\nname: fixture-skill\ndescription: null\n---\n\n# Bad\n`, /description|frontmatter/i],
    ["nonportable name", `---\nname: invalid--name\ndescription: Valid description\n---\n\n# Bad\n`, /name|hyphen-case/i],
    ["invalid trailing colon", `---\nname: fixture-skill\ndescription: invalid trailing colon:\n---\n\n# Bad\n`, /YAML|description|frontmatter/i],
    ["tab in scalar", `---\nname: fixture-skill\ndescription: invalid\ttab\n---\n\n# Bad\n`, /YAML|description|frontmatter|tab/i],
    ["C0 control in scalar", `---\nname: fixture-skill\ndescription: invalid\u0000control\n---\n\n# Bad\n`, /YAML|description|frontmatter|control/i],
    ["NEL in scalar", `---\nname: fixture-skill\ndescription: invalid\u0085separator\n---\n\n# Bad\n`, /YAML|description|frontmatter|control|separator/i],
    ["Unicode line separator in scalar", `---\nname: fixture-skill\ndescription: invalid\u2028separator\n---\n\n# Bad\n`, /YAML|description|frontmatter|control|separator/i],
    ["protected marker in frontmatter", `---\nname: fixture-skill\ndescription: x <!-- SLOW_UPDATE_START --> guarded <!-- SLOW_UPDATE_END -->\n---\n\n# Bad\n`, /frontmatter.*protected|protected.*frontmatter/i],
  ];
  for (const [label, source, expected] of invalidSources) {
    await t.test(label, () => {
      const f = makeFixture(source);
      try {
        writeJson(f.edits, patchWithEdits(f, [
          supportedEdit("append-invalid-source", "append", "", "more"),
        ]));
        const result = runCli(applyArgs(f));
        assert.equal(result.status, 2, `${label}: ${result.stderr}`);
        assert.match(result.stderr, expected, label);
        assertNoApplyOutput(f);
      } finally {
        f.cleanup();
      }
    });
  }

  for (const [label, edit, expected] of [
    ["frontmatter target", supportedEdit(
      "frontmatter-target",
      "replace",
      "name: fixture-skill",
      "name: hijacked",
    ), /protected region/],
    ["protected body target", supportedEdit(
      "protected-body-target",
      "delete",
      "protected text",
      "",
    ), /protected region/],
    ["introduced marker", supportedEdit(
      "introduced-marker",
      "append",
      "",
      "<!-- APPENDIX_START -->injected<!-- APPENDIX_END -->",
    ), /protected marker/],
  ]) {
    await t.test(label, () => {
      const f = makeFixture();
      try {
        writeJson(f.edits, patchWithEdits(f, [edit]));
        const result = runCli(applyArgs(f));
        assert.equal(result.status, 2, `${label}: ${result.stderr}`);
        assert.match(result.stderr, expected, label);
        assertNoApplyOutput(f);
      } finally {
        f.cleanup();
      }
    });
  }

  for (const [label, bytes, expected] of [
    ["UTF-8 BOM", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(PORTABLE_SOURCE)]), /BOM/],
    ["CRLF", Buffer.from(PORTABLE_SOURCE.replaceAll("\n", "\r\n")), /LF line endings|carriage/],
    ["non-UTF-8", Buffer.concat([Buffer.from(PORTABLE_SOURCE), Buffer.from([0xc3])]), /valid UTF-8/],
  ]) {
    await t.test(label, () => {
      const f = makeFixture();
      try {
        writeFileSync(f.source, bytes);
        writeJson(f.edits, patchWithEdits(f, [
          supportedEdit("append-encoding", "append", "", "new guidance"),
        ]));
        const result = runCli(applyArgs(f));
        assert.equal(result.status, 2, `${label}: ${result.stderr}`);
        assert.match(result.stderr, expected, label);
        assertNoApplyOutput(f);
      } finally {
        f.cleanup();
      }
    });
  }

  await t.test("duplicate JSON key", () => {
    const f = makeFixture();
    try {
      const patch = patchWithEdits(f, [
        supportedEdit("duplicate-json-key", "append", "", "new guidance"),
      ]);
      const serialized = JSON.stringify(patch).replace(
        `\"source_sha256\":\"${patch.source_sha256}\"`,
        `\"source_sha256\":\"${"0".repeat(64)}\",\"source_sha256\":\"${patch.source_sha256}\"`,
      );
      writeFileSync(f.edits, serialized);
      const result = runCli(applyArgs(f));
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /duplicate JSON key.*source_sha256/i);
      assertNoApplyOutput(f);
    } finally {
      f.cleanup();
    }
  });
});

test("v3 apply rejects closed-schema and provenance inconsistencies with exit 2", () => {
  const mutations = [
    ["unknown patch key", (patch) => { patch.unexpected = true; }, /exactly|unknown/i],
    ["unknown edit key", (patch) => { patch.edits[0].unexpected = true; }, /edit|unknown|exactly/i],
    ["duplicate edit id", (patch) => { patch.edits[1].edit_id = patch.edits[0].edit_id; }, /edit_id|duplicate/i],
    ["support count mismatch", (patch) => { patch.edits[0].support_count = 2; }, /support_count/i],
    ["duplicate support case", (patch) => {
      patch.edits[0].supporting_case_ids.push(patch.edits[0].supporting_case_ids[0]);
      patch.edits[0].support_count = 2;
    }, /supporting_case_ids|duplicate/i],
    ["duplicate source type", (patch) => {
      patch.edits[0].source_types.push(patch.edits[0].source_types[0]);
    }, /source_types|duplicate/i],
    ["bad source type", (patch) => { patch.edits[0].source_types = ["theory"]; }, /source_types/i],
    ["bad assumption status", (patch) => { patch.assumptions[0].status = "maybe"; }, /assumption|status/i],
    ["multibyte target overflow", (patch) => {
      patch.edits[0].target = "é".repeat(4096);
    }, /4096 UTF-8 bytes/i],
    ["multibyte content overflow", (patch) => {
      patch.edits[0].content = "é".repeat(4096);
    }, /4096 UTF-8 bytes/i],
    ["bad rejection relationship", (patch) => {
      patch.prior_rejections[0].relationship = "similar";
    }, /relationship/i],
  ];

  for (const [label, mutate, reason] of mutations) {
    const f = makeFixture();
    try {
      const patch = basePatch(f, {
        prior_rejections: [materializePriorRejection(f)],
      });
      mutate(patch);
      writeJson(f.edits, patch);
      const result = runCli(applyArgs(f));
      assert.equal(result.status, 2, `${label}: ${result.stderr}`);
      assert.match(result.stderr, reason, label);
      assertNoApplyOutput(f);
    } finally {
      f.cleanup();
    }
  }
});

test("v3 apply classifies unsafe paths and digest drift as integrity exit 3", () => {
  for (const [label, mutate, reason] of [
    ["source digest", (patch) => { patch.source_sha256 = "0".repeat(64); }, /source_sha256|digest/i],
    ["prior digest", (patch) => { patch.prior_rejections[0].report.sha256 = "0".repeat(64); }, /sha256|digest/i],
    ["prior traversal", (patch) => { patch.prior_rejections[0].report.path = "../outside"; }, /relative|traversal|path/i],
    ["prior backslash", (patch) => { patch.prior_rejections[0].report.path = "rejections\\prior.json"; }, /forward slashes|path/i],
    ["prior drive-absolute", (patch) => { patch.prior_rejections[0].report.path = "C:/prior.json"; }, /drive|relative|path/i],
  ]) {
    const f = makeFixture();
    try {
      const patch = basePatch(f, {
        prior_rejections: [materializePriorRejection(f)],
      });
      mutate(patch);
      writeJson(f.edits, patch);
      const result = runCli(applyArgs(f));
      assert.equal(result.status, 3, `${label}: ${result.stderr}`);
      assert.match(result.stderr, reason, label);
      assertNoApplyOutput(f);
    } finally {
      f.cleanup();
    }
  }
});

test("v3 apply classifies a symlinked patch input as integrity exit 3", () => {
  const f = makeFixture();
  try {
    const physicalPatch = resolve(f.root, "physical-patch.json");
    writeJson(physicalPatch, basePatch(f));
    symlinkSync(physicalPatch, f.edits);
    const result = runCli(applyArgs(f));
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /unsafe_path_or_integrity|symbolic|symlink|physical/i);
    assertNoApplyOutput(f);
  } finally {
    f.cleanup();
  }
});

test("v3 apply classifies unsafe edits and workspace paths before schema diagnostics", () => {
  const cases = [
    ["outside physical edits", (f, outside) => {
      f.edits = resolve(outside, "patch.json");
      writeJson(f.edits, basePatch(f));
    }],
    ["outside-resolving edits symlink", (f, outside) => {
      const target = resolve(outside, "patch.json");
      writeJson(target, basePatch(f));
      symlinkSync(target, f.edits);
    }],
    ["dangling edits symlink", (f) => {
      symlinkSync(resolve(f.root, "missing-patch.json"), f.edits);
    }],
    ["malformed JSON through edits symlink", (f) => {
      const target = resolve(f.root, "malformed-patch.json");
      writeFileSync(target, '{"schema":"superzhao.skill-lab.patch/v3"');
      symlinkSync(target, f.edits);
    }],
    ["schema-invalid v3 through edits symlink", (f) => {
      const target = resolve(f.root, "invalid-patch.json");
      writeJson(target, { schema: "superzhao.skill-lab.patch/v3" });
      symlinkSync(target, f.edits);
    }],
    ["symlinked workspace root", (f, outside) => {
      const workspaceLink = resolve(outside, "workspace-link");
      symlinkSync(f.root, workspaceLink, "dir");
      f.root = workspaceLink;
      writeJson(f.edits, basePatch(f));
    }],
    ["workspace root is a file", (f) => {
      writeJson(f.edits, basePatch(f));
      f.root = f.source;
    }],
  ];

  for (const [label, setup] of cases) {
    const f = makeFixture();
    const outside = mkdtempSync(resolve(tmpdir(), "superzhao-skill-lab-path-outside-"));
    try {
      setup(f, outside);
      const result = runCli(applyArgs(f));
      assert.equal(result.status, 3, `${label}: ${result.stderr}`);
      assert.match(result.stderr, /unsafe_path_or_integrity|physical|outside|symbolic|path/i);
      assertNoApplyOutput(f);
    } finally {
      f.cleanup();
      rmSync(outside, { recursive: true, force: true });
    }
  }
});

test("v3 apply keeps physical malformed JSON in the usage/schema exit class", () => {
  const f = makeFixture();
  try {
    writeFileSync(f.edits, '{"schema":"superzhao.skill-lab.patch/v3"');
    const result = runCli(applyArgs(f));
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /usage_or_schema|valid JSON|malformed|unexpected/i);
    assertNoApplyOutput(f);
  } finally {
    f.cleanup();
  }
});

test("v3 apply rejects component and final input swaps before reading outside bytes", () => {
  for (const swapKind of ["component", "final"]) {
    const f = makeFixture();
    const outside = mkdtempSync(resolve(tmpdir(), "superzhao-skill-lab-outside-"));
    try {
      const relative = `rejections/${swapKind}/report.bin`;
      const insideDirectory = resolve(f.root, "rejections", swapKind);
      const inside = resolve(f.root, relative);
      const safeBytes = Buffer.from(`inside ${swapKind} report\n`);
      mkdirSync(insideDirectory, { recursive: true, mode: 0o700 });
      writeFileSync(inside, safeBytes);

      const outsideDirectory = resolve(outside, "redirected");
      const outsideFile = resolve(outsideDirectory, "report.bin");
      const readMarker = resolve(outside, "outside-read-attempted");
      mkdirSync(outsideDirectory, { mode: 0o700 });
      writeFileSync(outsideFile, "");
      truncateSync(outsideFile, MAX_INPUT_BYTES + 1);

      const prior = {
        rejection_id: `swap-${swapKind}`,
        report: artifact(relative, safeBytes),
        relationship: "narrows",
        note: "The path must remain physically bound through the descriptor read.",
      };
      writeJson(f.edits, basePatch(f, { prior_rejections: [prior] }));

      const hook = `const fs = require("node:fs");\n`
        + `const { syncBuiltinESMExports } = require("node:module");\n`
        + `const originalRealpath = fs.realpathSync;\n`
        + `const originalReadFile = fs.readFileSync;\n`
        + `const originalRead = fs.readSync;\n`
        + `const target = ${JSON.stringify(inside)};\n`
        + `const component = ${JSON.stringify(insideDirectory)};\n`
        + `const outsideDirectory = ${JSON.stringify(outsideDirectory)};\n`
        + `const outsideFile = ${JSON.stringify(outsideFile)};\n`
        + `const marker = ${JSON.stringify(readMarker)};\n`
        + `const kind = ${JSON.stringify(swapKind)};\n`
        + `let swapped = false;\n`
        + `fs.realpathSync = function(path, ...args) {\n`
        + `  const result = originalRealpath.call(this, path, ...args);\n`
        + `  if (!swapped && path === target) {\n`
        + `    swapped = true;\n`
        + `    if (kind === "component") {\n`
        + `      fs.renameSync(component, component + ".inside");\n`
        + `      fs.symlinkSync(outsideDirectory, component, "dir");\n`
        + `    } else {\n`
        + `      fs.renameSync(target, target + ".inside");\n`
        + `      fs.symlinkSync(outsideFile, target, "file");\n`
        + `    }\n`
        + `  }\n`
        + `  return result;\n`
        + `};\n`
        + `fs.readFileSync = function(path, ...args) {\n`
        + `  if (swapped && path === target) fs.writeFileSync(marker, "readFileSync");\n`
        + `  return originalReadFile.call(this, path, ...args);\n`
        + `};\n`
        + `fs.readSync = function(fd, ...args) {\n`
        + `  const actual = fs.fstatSync(fd);\n`
        + `  const external = fs.lstatSync(outsideFile);\n`
        + `  if (actual.dev === external.dev && actual.ino === external.ino) {\n`
        + `    fs.writeFileSync(marker, "readSync");\n`
        + `  }\n`
        + `  return originalRead.call(this, fd, ...args);\n`
        + `};\n`
        + `syncBuiltinESMExports();\n`;
      const result = runWithHook(f, applyArgs(f), hook);
      assert.equal(
        existsSync(readMarker),
        false,
        `${swapKind}: outside bytes must not be read`,
      );
      assert.equal(result.status, 3, `${swapKind}: ${result.stderr}`);
      assert.match(result.stderr, /unsafe_path_or_integrity|contain|symbolic|identity|path/i);
      assertNoApplyOutput(f);
    } finally {
      f.cleanup();
      rmSync(outside, { recursive: true, force: true });
    }
  }
});

test("v3 apply enforces the 8 MiB per-input limit before publication", () => {
  const f = makeFixture();
  try {
    const tooLarge = Buffer.alloc(MAX_INPUT_BYTES + 1, 0x61);
    const prior = materializePriorRejection(f, "oversize", tooLarge);
    writeJson(f.edits, basePatch(f, { prior_rejections: [prior] }));
    const result = runCli(applyArgs(f));
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /8 MiB|8388608|input limit/i);
    assertNoApplyOutput(f);
  } finally {
    f.cleanup();
  }
});

test("v3 apply accepts exactly 64 MiB and rejects one aggregate byte more", () => {
  for (const overflow of [false, true]) {
    const f = makeFixture();
    try {
      const placeholders = Array.from({ length: 8 }, (_, index) => ({
        rejection_id: `aggregate-${index + 1}`,
        report: { path: `rejections/aggregate-${index + 1}.bin`, sha256: "0".repeat(64) },
        relationship: "not-applicable",
        note: "Retained only to exercise deterministic aggregate accounting.",
      }));
      let patch = basePatch(f, { prior_rejections: placeholders });
      const provisional = Buffer.from(`${JSON.stringify(patch, null, 2)}\n`);
      const finalSize = MAX_INPUT_BYTES - provisional.length + (overflow ? 1 : 0);
      assert.ok(finalSize > 0 && finalSize <= MAX_INPUT_BYTES);

      for (let index = 0; index < placeholders.length; index += 1) {
        const size = index === placeholders.length - 1 ? finalSize : MAX_INPUT_BYTES;
        const bytes = Buffer.alloc(size, 0x41 + index);
        const absolute = resolve(f.root, placeholders[index].report.path);
        mkdirSync(dirname(absolute), { recursive: true, mode: 0o700 });
        writeFileSync(absolute, bytes);
        placeholders[index].report.sha256 = sha256(bytes);
      }
      patch = basePatch(f, { prior_rejections: placeholders });
      const serialized = Buffer.from(`${JSON.stringify(patch, null, 2)}\n`);
      assert.equal(serialized.length, provisional.length);
      assert.equal(
        serialized.length + placeholders.reduce((total, row, index) => (
          total + (index === placeholders.length - 1 ? finalSize : MAX_INPUT_BYTES)
        ), 0),
        MAX_CAMPAIGN_BYTES + (overflow ? 1 : 0),
      );
      writeFileSync(f.edits, serialized);

      const result = runCli(applyArgs(f));
      if (overflow) {
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr, /64 MiB|67108864|aggregate/i);
        assertNoApplyOutput(f);
      } else {
        assert.equal(result.status, 0, result.stderr);
        assert.equal(existsSync(f.candidate), true);
        assert.equal(existsSync(f.applyReport), true);
      }
    } finally {
      f.cleanup();
    }
  }
});

test("v3 apply treats an existing output and a publication race as exit 6", () => {
  const conflict = makeFixture();
  try {
    writeJson(conflict.edits, basePatch(conflict));
    writeFileSync(conflict.candidate, "foreign candidate");
    const result = runCli(applyArgs(conflict));
    assert.equal(result.status, 6, result.stderr);
    assert.match(result.stderr, /exists|output|publication/i);
    assert.equal(readFileSync(conflict.candidate, "utf8"), "foreign candidate");
    assert.equal(existsSync(conflict.applyReport), false);
  } finally {
    conflict.cleanup();
  }

  const race = makeFixture();
  try {
    writeJson(race.edits, basePatch(race));
    const hook = `const childProcess = require("node:child_process");\n`
      + `const fs = require("node:fs");\n`
      + `const { syncBuiltinESMExports } = require("node:module");\n`
      + `const original = childProcess.spawnSync;\n`
      + `const protocol = "superzhao.skill-lab.anchored-publisher/v1";\n`
      + `const candidate = "${race.candidate.split("/").at(-1)}";\n`
      + `const report = ${JSON.stringify(race.applyReport)};\n`
      + `let injected = false;\n`
      + `childProcess.spawnSync = function(command, args, options) {\n`
      + `  let request;\n`
      + `  try { request = JSON.parse(String(options?.input ?? "")); } catch {}\n`
      + `  const result = original.call(this, command, args, options);\n`
      + `  if (!injected && command === process.execPath && request?.protocol === protocol\n`
      + `      && request.action === "link" && request.destination === candidate\n`
      + `      && result.status === 0) {\n`
      + `    injected = true;\n`
      + `    fs.writeFileSync(report, "foreign owner", { flag: "wx" });\n`
      + `  }\n`
      + `  return result;\n`
      + `};\n`
      + `syncBuiltinESMExports();\n`;
    const result = runWithHook(race, applyArgs(race), hook);
    assert.equal(result.status, 6, result.stderr);
    assert.equal(readFileSync(race.applyReport, "utf8"), "foreign owner");
    assert.equal(existsSync(race.candidate), false, "owned candidate rolls back");
  } finally {
    race.cleanup();
  }
});

test("v3 apply anchors temp creation and link publication against restored-parent races", () => {
  for (const phase of ["create", "link"]) {
    const f = makeFixture();
    const outside = mkdtempSync(resolve(tmpdir(), "superzhao-skill-lab-publish-outside-"));
    try {
      const outputParent = resolve(f.root, "publish");
      const retainedParent = `${outputParent}.inside`;
      const marker = resolve(f.root, `anchored-${phase}.txt`);
      mkdirSync(outputParent, { mode: 0o700 });
      f.candidate = resolve(outputParent, "candidate.md");
      f.applyReport = resolve(outputParent, "apply-report.json");
      writeJson(f.edits, basePatch(f));

      const hook = `const childProcess = require("node:child_process");\n`
        + `const fs = require("node:fs");\n`
        + `const { syncBuiltinESMExports } = require("node:module");\n`
        + `const original = childProcess.spawnSync;\n`
        + `const protocol = "superzhao.skill-lab.anchored-publisher/v1";\n`
        + `const phase = ${JSON.stringify(phase)};\n`
        + `const parent = ${JSON.stringify(outputParent)};\n`
        + `const retained = ${JSON.stringify(retainedParent)};\n`
        + `const outside = ${JSON.stringify(outside)};\n`
        + `const marker = ${JSON.stringify(marker)};\n`
        + `let attacked = false;\n`
        + `process.once("exit", () => {\n`
        + `  if (!attacked) fs.writeFileSync(marker, "not-observed");\n`
        + `});\n`
        + `childProcess.spawnSync = function(command, args, options) {\n`
        + `  let request;\n`
        + `  try { request = JSON.parse(String(options?.input ?? "")); } catch {}\n`
        + `  if (!attacked && command === process.execPath && request?.protocol === protocol\n`
        + `      && request.action === phase) {\n`
        + `    attacked = true;\n`
        + `    const sanitized = options?.env\n`
        + `      && !Object.prototype.hasOwnProperty.call(options.env, "NODE_OPTIONS");\n`
        + `    fs.renameSync(parent, retained);\n`
        + `    fs.symlinkSync(outside, parent, "dir");\n`
        + `    try {\n`
        + `      return original.call(this, command, args, options);\n`
        + `    } finally {\n`
        + `      fs.rmSync(parent);\n`
        + `      fs.renameSync(retained, parent);\n`
        + `      fs.writeFileSync(marker, sanitized ? phase : "inherited-NODE_OPTIONS");\n`
        + `    }\n`
        + `  }\n`
        + `  return original.call(this, command, args, options);\n`
        + `};\n`
        + `syncBuiltinESMExports();\n`;
      const result = runWithHook(f, applyArgs(f), hook);
      assert.equal(readFileSync(marker, "utf8"), phase, `${phase}: anchored child spawn`);
      assert.deepEqual(readdirSync(outside), [], `${phase}: outside remains untouched`);
      assert.deepEqual(readdirSync(outputParent), [], `${phase}: no output or temp remains`);
      assert.equal(result.status, 3, `${phase}: ${result.stderr}`);
      assert.match(result.stderr, /unsafe_path_or_integrity|identity|parent|path/i);
    } finally {
      f.cleanup();
      rmSync(outside, { recursive: true, force: true });
    }
  }
});

test("v3 apply conditionally rolls back after child post-link verification failures", () => {
  for (const failureBudget of [1, 2]) {
    const f = makeFixture();
    try {
      writeJson(f.edits, basePatch(f));
      const failurePrelude = `const fs = require("node:fs");
const originalLink = fs.linkSync;
const originalLstat = fs.lstatSync;
let linkedDestination;
let remainingFailures = ${failureBudget};
fs.linkSync = function(source, destination) {
  const result = originalLink.call(this, source, destination);
  linkedDestination = destination;
  return result;
};
fs.lstatSync = function(path, ...rest) {
  if (path === linkedDestination && remainingFailures > 0) {
    remainingFailures -= 1;
    const error = new Error("simulated post-link verification failure");
    error.code = "EIO";
    throw error;
  }
  return originalLstat.call(this, path, ...rest);
};
`;
      const hook = `const childProcess = require("node:child_process");\n`
        + `const { syncBuiltinESMExports } = require("node:module");\n`
        + `const original = childProcess.spawnSync;\n`
        + `const protocol = "superzhao.skill-lab.anchored-publisher/v1";\n`
        + `const failurePrelude = ${JSON.stringify(failurePrelude)};\n`
        + `let injected = false;\n`
        + `childProcess.spawnSync = function(command, args, options) {\n`
        + `  let request;\n`
        + `  try { request = JSON.parse(String(options?.input ?? "")); } catch {}\n`
        + `  if (!injected && command === process.execPath && request?.protocol === protocol\n`
        + `      && request.action === "link") {\n`
        + `    injected = true;\n`
        + `    const evalIndex = args.indexOf("--eval");\n`
        + `    const altered = [...args];\n`
        + `    altered[evalIndex + 1] = failurePrelude + args[evalIndex + 1];\n`
        + `    return original.call(this, command, altered, options);\n`
        + `  }\n`
        + `  return original.call(this, command, args, options);\n`
        + `};\n`
        + `syncBuiltinESMExports();\n`;
      const result = runWithHook(f, applyArgs(f), hook);
      assert.equal(result.status, 6, `${failureBudget}: ${result.stderr}`);
      assert.match(result.stderr, /publication_failure|post-link|verification/i);
      assertNoApplyOutput(f);
      assert.equal(
        readdirSync(f.root).some((name) => name.startsWith(".skill-lab-apply-")),
        false,
        `${failureBudget}: temporary sources must also be removed`,
      );
    } finally {
      f.cleanup();
    }
  }
});

test("v3 apply rolls back an owned link after a malformed child response", () => {
  const f = makeFixture();
  try {
    writeJson(f.edits, basePatch(f));
    const hook = `const childProcess = require("node:child_process");\n`
      + `const { syncBuiltinESMExports } = require("node:module");\n`
      + `const original = childProcess.spawnSync;\n`
      + `const protocol = "superzhao.skill-lab.anchored-publisher/v1";\n`
      + `let injected = false;\n`
      + `childProcess.spawnSync = function(command, args, options) {\n`
      + `  let request;\n`
      + `  try { request = JSON.parse(String(options?.input ?? "")); } catch {}\n`
      + `  const result = original.call(this, command, args, options);\n`
      + `  if (!injected && command === process.execPath && request?.protocol === protocol\n`
      + `      && request.action === "link" && result.status === 0) {\n`
      + `    injected = true;\n`
      + `    return { ...result, stdout: "not-json" };\n`
      + `  }\n`
      + `  return result;\n`
      + `};\n`
      + `syncBuiltinESMExports();\n`;
    const result = runWithHook(f, applyArgs(f), hook);
    assert.equal(result.status, 6, result.stderr);
    assert.match(result.stderr, /publication_failure|malformed|publisher/i);
    assertNoApplyOutput(f);
    assert.equal(
      readdirSync(f.root).some((name) => name.startsWith(".skill-lab-apply-")),
      false,
      "temporary sources must also be removed",
    );
  } finally {
    f.cleanup();
  }
});

test("v3 apply keeps relative publication in a cwd inode retargeted after spawn", () => {
  for (const phase of ["create", "link"]) {
    const f = makeFixture();
    const outside = mkdtempSync(resolve(tmpdir(), "superzhao-skill-lab-bound-cwd-outside-"));
    try {
      const outputParent = resolve(f.root, "publish");
      const retainedParent = `${outputParent}.inside`;
      const marker = resolve(f.root, `bound-cwd-${phase}.txt`);
      mkdirSync(outputParent, { mode: 0o700 });
      f.candidate = resolve(outputParent, "candidate.md");
      f.applyReport = resolve(outputParent, "apply-report.json");
      writeJson(f.edits, basePatch(f));
      const retargetPrelude = `const fs = require("node:fs");
fs.renameSync(${JSON.stringify(outputParent)}, ${JSON.stringify(retainedParent)});
fs.symlinkSync(${JSON.stringify(outside)}, ${JSON.stringify(outputParent)}, "dir");
`;
      const hook = `const childProcess = require("node:child_process");\n`
        + `const fs = require("node:fs");\n`
        + `const { syncBuiltinESMExports } = require("node:module");\n`
        + `const original = childProcess.spawnSync;\n`
        + `const protocol = "superzhao.skill-lab.anchored-publisher/v1";\n`
        + `const phase = ${JSON.stringify(phase)};\n`
        + `const parent = ${JSON.stringify(outputParent)};\n`
        + `const retained = ${JSON.stringify(retainedParent)};\n`
        + `const outside = ${JSON.stringify(outside)};\n`
        + `const marker = ${JSON.stringify(marker)};\n`
        + `const retargetPrelude = ${JSON.stringify(retargetPrelude)};\n`
        + `let injected = false;\n`
        + `childProcess.spawnSync = function(command, args, options) {\n`
        + `  let request;\n`
        + `  try { request = JSON.parse(String(options?.input ?? "")); } catch {}\n`
        + `  if (!injected && command === process.execPath && request?.protocol === protocol\n`
        + `      && request.action === phase) {\n`
        + `    injected = true;\n`
        + `    const evalIndex = args.indexOf("--eval");\n`
        + `    const altered = [...args];\n`
        + `    altered[evalIndex + 1] = retargetPrelude + args[evalIndex + 1];\n`
        + `    try {\n`
        + `      const result = original.call(this, command, altered, options);\n`
        + `      const retainedNames = fs.readdirSync(retained);\n`
        + `      const stayedAnchored = phase === "create"\n`
        + `        ? retainedNames.some((name) => name.startsWith(".skill-lab-apply-"))\n`
        + `        : retainedNames.includes("candidate.md");\n`
        + `      const outsideUntouched = fs.readdirSync(outside).length === 0;\n`
        + `      fs.writeFileSync(marker, stayedAnchored && outsideUntouched ? phase : "escaped");\n`
        + `      return result;\n`
        + `    } finally {\n`
        + `      if (fs.existsSync(parent)) fs.rmSync(parent);\n`
        + `      if (fs.existsSync(retained)) fs.renameSync(retained, parent);\n`
        + `    }\n`
        + `  }\n`
        + `  return original.call(this, command, args, options);\n`
        + `};\n`
        + `syncBuiltinESMExports();\n`;
      const result = runWithHook(f, applyArgs(f), hook);
      assert.equal(readFileSync(marker, "utf8"), phase, `${phase}: cwd inode remains anchored`);
      assert.equal(result.status, 0, `${phase}: ${result.stderr}`);
      assert.deepEqual(readdirSync(outside), [], `${phase}: outside remains untouched`);
      assert.deepEqual(
        readdirSync(outputParent).sort(),
        ["apply-report.json", "candidate.md"],
        `${phase}: final outputs stay in the original directory inode`,
      );
    } finally {
      f.cleanup();
      rmSync(outside, { recursive: true, force: true });
    }
  }
});

test("v3 apply removes only its pinned temp after a temp write failure", () => {
  const f = makeFixture();
  try {
    writeJson(f.edits, basePatch(f));
    const foreignTemp = resolve(f.root, ".skill-lab-apply-foreign-owner");
    writeFileSync(foreignTemp, "must survive\n");
    const failurePrelude = `const fs = require("node:fs");
const originalWrite = fs.writeFileSync;
fs.writeFileSync = function(path, ...rest) {
  if (typeof path === "number") {
    const error = new Error("simulated temporary write failure");
    error.code = "ENOSPC";
    throw error;
  }
  return originalWrite.call(this, path, ...rest);
};
`;
    const hook = `const childProcess = require("node:child_process");\n`
      + `const fs = require("node:fs");\n`
      + `const { syncBuiltinESMExports } = require("node:module");\n`
      + `const original = childProcess.spawnSync;\n`
      + `const protocol = "superzhao.skill-lab.anchored-publisher/v1";\n`
      + `const failurePrelude = ${JSON.stringify(failurePrelude)};\n`
      + `let injected = false;\n`
      + `childProcess.spawnSync = function(command, args, options) {\n`
      + `  let request;\n`
      + `  try { request = JSON.parse(String(options?.input ?? "")); } catch {}\n`
      + `  if (!injected && command === process.execPath && request?.protocol === protocol\n`
      + `      && request.action === "create") {\n`
      + `    injected = true;\n`
      + `    const evalIndex = args.indexOf("--eval");\n`
      + `    const altered = [...args];\n`
      + `    altered[evalIndex + 1] = failurePrelude + args[evalIndex + 1];\n`
      + `    return original.call(this, command, altered, options);\n`
      + `  }\n`
      + `  return original.call(this, command, args, options);\n`
      + `};\n`
      + `syncBuiltinESMExports();\n`;
    const result = runWithHook(f, applyArgs(f), hook);
    assert.deepEqual(
      readdirSync(f.root).filter((name) => name.startsWith(".skill-lab-apply-")),
      [".skill-lab-apply-foreign-owner"],
      "only the pinned temporary source may be removed",
    );
    assert.equal(readFileSync(foreignTemp, "utf8"), "must survive\n");
    assert.equal(result.status, 6, result.stderr);
    assert.match(result.stderr, /publication_failure|temporary|ENOSPC|write/i);
    assertNoApplyOutput(f);
  } finally {
    f.cleanup();
  }
});

test("v3 apply checks a symlinked output parent before an outside destination", () => {
  const f = makeFixture();
  const outside = mkdtempSync(resolve(tmpdir(), "superzhao-skill-lab-output-outside-"));
  try {
    const linkedParent = resolve(f.root, "linked-output");
    const outsideCandidate = resolve(outside, "candidate.md");
    writeFileSync(outsideCandidate, "foreign outside candidate");
    symlinkSync(outside, linkedParent, "dir");
    f.candidate = resolve(linkedParent, "candidate.md");
    writeJson(f.edits, basePatch(f));

    const result = runCli(applyArgs(f));
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /unsafe_path_or_integrity|physical|symbolic|parent|outside/i);
    assert.equal(readFileSync(outsideCandidate, "utf8"), "foreign outside candidate");
    assert.equal(existsSync(f.applyReport), false);
  } finally {
    f.cleanup();
    rmSync(outside, { recursive: true, force: true });
  }
});

test("v3 apply rejects an output escape before publishing either artifact", () => {
  const f = makeFixture();
  try {
    writeJson(f.edits, basePatch(f));
    f.candidate = resolve(f.root, "..", `outside-${Date.now()}.md`);
    const result = runCli(applyArgs(f));
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /outside|workspace|path/i);
    assertNoApplyOutput(f);
  } finally {
    f.cleanup();
  }
});
