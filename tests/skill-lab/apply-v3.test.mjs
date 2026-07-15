import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
    const hook = `const fs = require("node:fs");\n`
      + `const { syncBuiltinESMExports } = require("node:module");\n`
      + `const original = fs.linkSync;\n`
      + `const candidate = ${JSON.stringify(race.candidate)};\n`
      + `const report = ${JSON.stringify(race.applyReport)};\n`
      + `fs.linkSync = function(source, destination) {\n`
      + `  const result = original.call(this, source, destination);\n`
      + `  if (destination === candidate) fs.writeFileSync(report, "foreign owner", { flag: "wx" });\n`
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
