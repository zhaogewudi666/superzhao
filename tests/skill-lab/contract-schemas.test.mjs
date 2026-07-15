import assert from "node:assert/strict";
import test from "node:test";

import {
  readSchemaPair,
  schemaErrors,
} from "./helpers.mjs";

const CONTRACTS = [
  ["patch", "superzhao.skill-lab.patch/v3"],
  ["cases", "superzhao.skill-lab.cases/v3"],
  ["samples", "superzhao.skill-lab.samples/v3"],
  ["actor-run", "superzhao.skill-lab.actor-run/v3"],
  ["scorer-record", "superzhao.skill-lab.scorer-record/v3"],
  ["apply-report", "superzhao.skill-lab.apply-report/v3"],
  ["gate-report", "superzhao.skill-lab.gate-report/v3"],
  ["bundle-manifest", "superzhao.skill-lab.bundle-manifest/v3"],
];

function clone(value) {
  return structuredClone(value);
}

function assertValid(value, schema, label) {
  assert.deepEqual(schemaErrors(value, schema), [], label);
}

function assertInvalid(value, schema, label) {
  assert.notDeepEqual(schemaErrors(value, schema), [], label);
}

function collectSchemaNodes(value, predicate, nodes = []) {
  if (!value || typeof value !== "object") return nodes;
  if (predicate(value)) nodes.push(value);
  for (const child of Object.values(value)) collectSchemaNodes(child, predicate, nodes);
  return nodes;
}

test("all eight v3 golden examples validate against exact closed schemas", () => {
  for (const [name, schemaName] of CONTRACTS) {
    const { schema, example } = readSchemaPair(name);
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.$id, `https://superzhao.dev/schemas/skill-lab/v3/${name}.schema.json`);
    assert.equal(schema.properties.schema.const, schemaName);
    assert.equal(example.schema, schemaName);
    assertValid(example, schema, `${name} example`);

    const unknownRoot = { ...example, unexpected: true };
    assertInvalid(unknownRoot, schema, `${name} must reject an unknown root key`);
  }
});

test("patch schema and example pin provenance, operations, and rejection enums", () => {
  const { schema, example } = readSchemaPair("patch");
  const edit = example.edits[0];
  assert.deepEqual(
    new Set(edit.source_types),
    new Set(["failure", "success", "rejection", "human-constraint"]),
  );
  assert.equal(edit.support_count, new Set(edit.supporting_case_ids).size);
  assert.equal(new Set(example.edits.map((row) => row.edit_id)).size, example.edits.length);
  assert.equal(
    new Set(example.prior_rejections.map((row) => row.rejection_id)).size,
    example.prior_rejections.length,
  );

  for (const [label, mutate] of [
    ["unknown edit key", (value) => { value.edits[0].unexpected = true; }],
    ["bad operation", (value) => { value.edits[0].op = "prepend"; }],
    ["bad source type", (value) => { value.edits[0].source_types = ["guess"]; }],
    ["duplicate source type", (value) => { value.edits[0].source_types = ["failure", "failure"]; }],
    ["bad assumption status", (value) => { value.assumptions[0].status = "maybe"; }],
    ["bad rejection relationship", (value) => {
      value.prior_rejections[0].relationship = "similar";
    }],
  ]) {
    const value = clone(example);
    mutate(value);
    assertInvalid(value, schema, label);
  }
});

test("all v3 artifact paths reject Windows drive-absolute prefixes", () => {
  const pathContracts = CONTRACTS.filter(([name]) => name !== "gate-report");
  assert.equal(pathContracts.length, 7);
  for (const [name] of pathContracts) {
    const { schema } = readSchemaPair(name);
    assert.ok(schema.$defs?.path, `${name} must define its artifact path contract`);
    for (const path of ["C:/artifact.bin", "z:/nested/artifact.bin"]) {
      assertInvalid(path, schema.$defs.path, `${name} must reject ${path}`);
    }
  }
});

test("patch string schemas enforce the 4096 UTF-8 byte contract", () => {
  const { schema, example } = readSchemaPair("patch");
  const byteBoundedNodes = collectSchemaNodes(
    schema,
    (node) => node.maxLength === 4096,
  );
  assert.equal(byteBoundedNodes.length, 6);
  for (const node of byteBoundedNodes) {
    assert.equal(node["x-maxUtf8Bytes"], 4096);
  }

  const exact = "é".repeat(2048);
  for (const field of ["target", "content"]) {
    const value = clone(example);
    value.edits[0][field] = exact;
    assertValid(value, schema, `${field} accepts exactly 4096 UTF-8 bytes`);
  }

  const oversized = "é".repeat(4096);
  for (const field of ["target", "content"]) {
    const value = clone(example);
    value.edits[0][field] = oversized;
    assertInvalid(value, schema, `${field} rejects 8192 UTF-8 bytes`);
  }
});

test("case inventory pins split/type coverage and disjoint selection/test identity", () => {
  const { schema, example } = readSchemaPair("cases");
  const categories = new Set(example.cases.map((row) => `${row.split}:${row.case_type}`));
  for (const category of [
    "selection:important",
    "selection:control",
    "test:important",
    "test:control",
  ]) {
    assert.equal(categories.has(category), true, category);
  }
  assert.equal(new Set(example.cases.map((row) => row.case_id)).size, example.cases.length);
  const selection = example.cases.filter((row) => row.split === "selection");
  const heldOut = example.cases.filter((row) => row.split === "test");
  const selectionIds = new Set(selection.map((row) => row.case_id));
  const selectionPrompts = new Set(selection.map((row) => row.prompt.sha256));
  assert.equal(heldOut.some((row) => selectionIds.has(row.case_id)), false);
  assert.equal(heldOut.some((row) => selectionPrompts.has(row.prompt.sha256)), false);

  const missingControl = clone(example);
  missingControl.cases = missingControl.cases.filter(
    (row) => !(row.split === "test" && row.case_type === "control"),
  );
  assertInvalid(missingControl, schema, "test controls are required");
});

test("sample and scorer contracts distinguish valid failures from retained non-valid attempts", () => {
  const samplesPair = readSchemaPair("samples");
  const scorerPair = readSchemaPair("scorer-record");

  const validFailure = clone(samplesPair.example);
  validFailure.samples[0].status = "valid";
  validFailure.samples[0].outcome = "fail";
  validFailure.samples[0].failure_code = "KNOWN_GAP";
  delete validFailure.samples[0].reason;
  assertValid(validFailure, samplesPair.schema, "valid failure");

  const missingFailureCode = clone(validFailure);
  delete missingFailureCode.samples[0].failure_code;
  assertInvalid(missingFailureCode, samplesPair.schema, "valid failure requires a code");

  const retainedInvalid = clone(samplesPair.example);
  retainedInvalid.samples[0].status = "invalid";
  retainedInvalid.samples[0].reason = "actor output was truncated";
  delete retainedInvalid.samples[0].outcome;
  delete retainedInvalid.samples[0].failure_code;
  assertValid(retainedInvalid, samplesPair.schema, "retained invalid attempt");

  const invalidWithOutcome = clone(retainedInvalid);
  invalidWithOutcome.samples[0].outcome = "pass";
  assertInvalid(invalidWithOutcome, samplesPair.schema, "non-valid attempt has no outcome");

  const scorerInvalid = clone(scorerPair.example);
  scorerInvalid.status = "indeterminate";
  scorerInvalid.reason = "scorer transport ended early";
  delete scorerInvalid.outcome;
  delete scorerInvalid.failure_code;
  assertValid(scorerInvalid, scorerPair.schema, "indeterminate scorer record");
});

test("gate report cannot claim final acceptance after selection rejection", () => {
  const { schema, example } = readSchemaPair("gate-report");
  const contradictory = clone(example);
  contradictory.selection.status = "selection_reject";
  contradictory.selection.reasons = ["selection evidence rejected the candidate"];
  assertInvalid(
    contradictory,
    schema,
    "selection rejection must force final not_evaluated",
  );
});

test("bundle manifest does not confuse the 1000-row sample cap with a file cap", () => {
  const { schema, example } = readSchemaPair("bundle-manifest");
  const expanded = clone(example);
  expanded.files.push(...Array.from({ length: 1001 }, (_, index) => ({
    path: `evidence/transcript-${index}.bin`,
    sha256: "a".repeat(64),
    bytes: 1,
  })));
  expanded.artifacts.push(...Array.from({ length: 1001 }, (_, index) => ({
    kind: "transcript",
    packaged_path: `evidence/transcript-${index}.bin`,
    sha256: "a".repeat(64),
  })));
  assertValid(expanded, schema, "bundle file count is bounded by 96 MiB, not sample rows");
});

test("actor, scorer, sample, report, and manifest examples share stable cross-references", () => {
  const patch = readSchemaPair("patch").example;
  const cases = readSchemaPair("cases").example;
  const samples = readSchemaPair("samples").example;
  const actor = readSchemaPair("actor-run").example;
  const scorer = readSchemaPair("scorer-record").example;
  const apply = readSchemaPair("apply-report").example;
  const gate = readSchemaPair("gate-report").example;
  const manifest = readSchemaPair("bundle-manifest").example;
  const sample = samples.samples[0];

  assert.equal(samples.campaign_id, cases.campaign_id);
  assert.equal(actor.sample_id, sample.sample_id);
  assert.equal(actor.run_id, sample.run_id);
  assert.equal(actor.actor_instance_id, sample.actor_instance_id);
  assert.equal(scorer.sample_id, sample.sample_id);
  assert.equal(scorer.run_id, sample.run_id);
  assert.equal(scorer.scorer_run_id, sample.scorer_run_id);
  assert.equal(scorer.transcript.sha256, actor.transcript.sha256);
  assert.equal(apply.proposal_id, patch.proposal_id);
  assert.equal(gate.campaign_id, cases.campaign_id);
  assert.equal(manifest.campaign_id, cases.campaign_id);
  assert.equal(manifest.proposal_id, patch.proposal_id);

  const manifestPaths = manifest.files.map((row) => row.path);
  assert.equal(new Set(manifestPaths).size, manifestPaths.length);
  assert.equal(manifestPaths.includes("manifest.json"), false, "manifest never hashes itself");
  for (const path of Object.values(manifest.entrypoints)) {
    assert.equal(manifestPaths.includes(path), true, `entrypoint ${path} must be packaged`);
  }
});
