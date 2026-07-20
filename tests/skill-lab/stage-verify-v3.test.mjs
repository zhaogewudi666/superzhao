import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import test from "node:test";

import {
  canonicalJson,
  applyArgs,
  cli,
  readSchemaPair,
  repoRoot,
  runCli,
  runWithHook,
  schemaErrors,
  sha256,
  writeJson,
} from "./helpers.mjs";
import {
  gateArgs,
  makeV3CampaignFixture,
  stageArgs,
} from "./v3-campaign-fixture.mjs";

const REQUIRED_ENTRYPOINTS = [
  "apply_report",
  "candidate",
  "cases",
  "gate_report",
  "patch",
  "producer_cli",
  "samples",
  "source",
];

const REQUIRED_ARTIFACT_KINDS = [
  "actor-profile",
  "actor-run",
  "apply-report",
  "candidate-skill",
  "cases",
  "environment",
  "gate-report",
  "harness-model-profile",
  "patch",
  "prior-rejection",
  "producer-cli",
  "prompt",
  "rubric",
  "samples",
  "scorer-output",
  "scorer-profile",
  "scorer-record",
  "source-skill",
  "transcript",
];

const ENTRYPOINT_KINDS = {
  source: "source-skill",
  candidate: "candidate-skill",
  patch: "patch",
  cases: "cases",
  samples: "samples",
  apply_report: "apply-report",
  gate_report: "gate-report",
  producer_cli: "producer-cli",
};

const CAMPAIGN_INCLUDED_KINDS = new Set([
  "patch",
  "cases",
  "samples",
  "actor-run",
  "scorer-record",
  "prior-rejection",
  "prompt",
  "rubric",
  "environment",
  "actor-profile",
  "scorer-profile",
  "harness-model-profile",
  "transcript",
  "scorer-output",
]);

const TEST_MAX_INPUT_BYTES = 8 * 1024 * 1024;
const TEST_MAX_CAMPAIGN_BYTES = 64 * 1024 * 1024;
const TEST_MAX_BUNDLE_BYTES = 96 * 1024 * 1024;

function canonicalLine(value) {
  return `${canonicalJson(value)}\n`;
}

function verifyBundleArgs(bundle, ...extra) {
  return ["verify-bundle", "--bundle", bundle, ...extra];
}

function stageAndMoveAcceptedBundle() {
  const fixture = makeV3CampaignFixture();
  const retainedRoot = mkdtempSync(resolve(tmpdir(), "superzhao-verify-v3-"));
  const bundle = resolve(retainedRoot, "moved-bundle");
  try {
    const stageResult = runCli(stageArgs(fixture));
    assert.equal(stageResult.status, 0, stageResult.stderr);
    renameSync(fixture.outputDir, bundle);
    fixture.cleanup();
    assert.equal(existsSync(fixture.root), false, "the producer workspace must be deleted");
    return {
      bundle,
      retainedRoot,
      cleanup: () => rmSync(retainedRoot, { recursive: true, force: true }),
    };
  } catch (error) {
    fixture.cleanup();
    rmSync(retainedRoot, { recursive: true, force: true });
    throw error;
  }
}

let sharedMovedVerifierBundle = null;

function acceptedVerifierBundle() {
  sharedMovedVerifierBundle ??= stageAndMoveAcceptedBundle();
  return sharedMovedVerifierBundle;
}

test.after(() => {
  sharedMovedVerifierBundle?.cleanup();
  sharedMovedVerifierBundle = null;
});

function cloneBundle(bundle, label) {
  const root = mkdtempSync(resolve(tmpdir(), `superzhao-verify-${label}-`));
  const copy = resolve(root, "bundle");
  cpSync(bundle, copy, { recursive: true });
  return { root, bundle: copy };
}

function readBundleManifest(bundle) {
  const path = resolve(bundle, "manifest.json");
  return { path, value: JSON.parse(readFileSync(path, "utf8")) };
}

function rewriteBundleManifest(bundle, mutate) {
  const manifest = readBundleManifest(bundle);
  mutate(manifest.value);
  writeFileSync(manifest.path, canonicalLine(manifest.value));
  return manifest.value;
}

function mappingOfKind(manifest, kind) {
  const mapping = manifest.artifacts.find((entry) => entry.kind === kind);
  assert.ok(mapping, `missing ${kind} mapping`);
  return mapping;
}

function coherentlyRehashPayload(bundle, kind, replacement) {
  return rewriteBundleManifest(bundle, (manifest) => {
    const mapping = mappingOfKind(manifest, kind);
    const path = resolve(bundle, mapping.packaged_path);
    const prior = readFileSync(path);
    const bytes = typeof replacement === "function" ? replacement(prior) : replacement;
    writeFileSync(path, bytes);
    const digest = sha256(bytes);
    for (const artifact of manifest.artifacts) {
      if (artifact.packaged_path === mapping.packaged_path) artifact.sha256 = digest;
    }
    const file = manifest.files.find((entry) => entry.path === mapping.packaged_path);
    assert.ok(file, mapping.packaged_path);
    file.sha256 = digest;
    file.bytes = Buffer.byteLength(bytes);
    if (kind === "producer-cli") manifest.producer.cli_sha256 = digest;
  });
}

const SIZE_PADDING_PREFIX = "proposal/rejections/size-padding-";

function writeSizedPriorRejections(bundle, sizes) {
  const manifestArtifact = readBundleManifest(bundle);
  const manifest = manifestArtifact.value;
  const priorMappings = manifest.artifacts.filter(
    (mapping) => mapping.kind === "prior-rejection"
      && mapping.source_path?.startsWith(SIZE_PADDING_PREFIX),
  );
  const removedPaths = new Set(priorMappings.map((mapping) => mapping.packaged_path));
  for (const path of removedPaths) rmSync(resolve(bundle, path));
  manifest.artifacts = manifest.artifacts.filter((mapping) => !priorMappings.includes(mapping));
  manifest.files = manifest.files.filter((file) => !removedPaths.has(file.path));

  const patchMapping = mappingOfKind(manifest, "patch");
  const applyMapping = mappingOfKind(manifest, "apply-report");
  const patchPath = resolve(bundle, patchMapping.packaged_path);
  const applyPath = resolve(bundle, applyMapping.packaged_path);
  const patch = JSON.parse(readFileSync(patchPath, "utf8"));
  const applyReport = JSON.parse(readFileSync(applyPath, "utf8"));
  patch.prior_rejections = patch.prior_rejections.filter(
    (rejection) => !rejection.report.path.startsWith(SIZE_PADDING_PREFIX),
  );

  const aliasPath = "proposal/rejections/shared-environment.json";
  if (!patch.prior_rejections.some((rejection) => rejection.report.path === aliasPath)) {
    const environment = mappingOfKind(manifest, "environment");
    patch.prior_rejections.push({
      rejection_id: "shared-environment-physical-dedup",
      report: { path: aliasPath, sha256: environment.sha256 },
      relationship: "not-applicable",
      note: "Exercises physical campaign-byte deduplication across included mappings.",
    });
    manifest.artifacts.push({
      kind: "prior-rejection",
      source_path: aliasPath,
      packaged_path: environment.packaged_path,
      sha256: environment.sha256,
    });
  }

  for (const [index, size] of sizes.entries()) {
    assert.ok(Number.isInteger(size) && size >= 0 && size <= 8 * 1024 * 1024);
    const bytes = Buffer.alloc(size, 0x41 + index);
    const digest = sha256(bytes);
    const sourcePath = `${SIZE_PADDING_PREFIX}${index + 1}.bin`;
    const packagedPath = `artifacts/${digest}.bin`;
    writeFileSync(resolve(bundle, packagedPath), bytes);
    patch.prior_rejections.push({
      rejection_id: `size-padding-${index + 1}`,
      report: { path: sourcePath, sha256: digest },
      relationship: "not-applicable",
      note: "Retained inert evidence for the exact bundle-size verifier boundary.",
    });
    manifest.artifacts.push({
      kind: "prior-rejection",
      source_path: sourcePath,
      packaged_path: packagedPath,
      sha256: digest,
    });
    manifest.files.push({ path: packagedPath, sha256: digest, bytes: size });
  }

  const patchBytes = Buffer.from(canonicalLine(patch));
  writeFileSync(patchPath, patchBytes);
  const patchDigest = sha256(patchBytes);
  patchMapping.sha256 = patchDigest;
  const patchFile = manifest.files.find((file) => file.path === patchMapping.packaged_path);
  patchFile.sha256 = patchDigest;
  patchFile.bytes = patchBytes.length;

  applyReport.patch_sha256 = patchDigest;
  applyReport.prior_rejections = patch.prior_rejections;
  const applyBytes = Buffer.from(canonicalLine(applyReport));
  writeFileSync(applyPath, applyBytes);
  const applyDigest = sha256(applyBytes);
  applyMapping.sha256 = applyDigest;
  const applyFile = manifest.files.find((file) => file.path === applyMapping.packaged_path);
  applyFile.sha256 = applyDigest;
  applyFile.bytes = applyBytes.length;

  manifest.artifacts.sort((left, right) => {
    const leftKey = `${left.kind}\0${left.source_path ?? ""}\0`
      + `${left.packaged_path}\0${left.sha256}`;
    const rightKey = `${right.kind}\0${right.source_path ?? ""}\0`
      + `${right.packaged_path}\0${right.sha256}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  manifest.files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const manifestBytes = Buffer.from(canonicalLine(manifest));
  writeFileSync(manifestArtifact.path, manifestBytes);
  return manifest.files.reduce((total, file) => total + file.bytes, 0)
    + manifestBytes.length;
}

function trustedCampaignOracle(bundle) {
  const manifest = readBundleManifest(bundle).value;
  const files = new Map(manifest.files.map((file) => [file.path, file]));
  const physical = new Map();
  let includedMappings = 0;
  for (const mapping of manifest.artifacts) {
    if (!CAMPAIGN_INCLUDED_KINDS.has(mapping.kind)) continue;
    includedMappings += 1;
    const file = files.get(mapping.packaged_path);
    assert.ok(file, mapping.packaged_path);
    const absolute = resolve(bundle, mapping.packaged_path);
    const stat = lstatSync(absolute, { bigint: true });
    assert.equal(stat.isFile(), true, mapping.packaged_path);
    assert.equal(stat.isSymbolicLink(), false, mapping.packaged_path);
    assert.equal(stat.size, BigInt(file.bytes), mapping.packaged_path);
    const digest = sha256(readFileSync(absolute));
    assert.equal(digest, file.sha256, mapping.packaged_path);
    assert.equal(digest, mapping.sha256, mapping.packaged_path);
    const key = `${stat.dev}:${stat.ino}:${digest}`;
    physical.set(key, stat.size);
  }
  return {
    bytes: [...physical.values()].reduce((total, size) => total + size, 0n),
    includedMappings,
    uniquePhysical: physical.size,
  };
}

function actualBundleOracle(bundle) {
  const tree = collectPublishedTree(bundle);
  const files = tree.files.map((file) => ({
    path: file.path,
    bytes: Number(file.stat.size),
  }));
  for (const file of files) {
    assert.ok(file.bytes <= TEST_MAX_INPUT_BYTES, `${file.path} exceeds 8 MiB`);
  }
  return {
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    files,
  };
}

function expectedStagePlanOracle(fixture, producerBytes, pluginVersion = "9.8.7") {
  const graph = expectedStageGraph(fixture, producerBytes);
  const ledger = JSON.parse(readFileSync(fixture.results, "utf8"));
  const patch = JSON.parse(readFileSync(fixture.edits, "utf8"));
  const manifest = {
    schema: "superzhao.skill-lab.bundle-manifest/v3",
    campaign_id: ledger.campaign_id,
    proposal_id: patch.proposal_id,
    producer: {
      plugin_id: "superzhao-skill-lab",
      plugin_version: pluginVersion,
      cli_sha256: sha256(producerBytes),
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    entrypoints: graph.entrypoints,
    artifacts: graph.artifacts,
    files: graph.files,
  };
  const manifestBytes = Buffer.from(canonicalLine(manifest));
  const fileBytes = graph.files.reduce((total, file) => total + file.bytes, 0);
  const includedPaths = new Set(
    graph.artifacts
      .filter((mapping) => CAMPAIGN_INCLUDED_KINDS.has(mapping.kind))
      .map((mapping) => mapping.packaged_path),
  );
  const filesByPath = new Map(graph.files.map((file) => [file.path, file]));
  const campaignBytes = [...includedPaths].reduce(
    (total, path) => total + filesByPath.get(path).bytes,
    0,
  );
  return {
    graph,
    manifest,
    manifestBytes,
    bundleBytes: fileBytes + manifestBytes.length,
    campaignBytes,
    maxFileBytes: Math.max(manifestBytes.length, ...graph.files.map((file) => file.bytes)),
  };
}

function padCopiedCliTo(bytes, target) {
  const prefix = Buffer.concat([bytes, Buffer.from("\n/* exact bundle-size padding\n")]);
  const suffix = Buffer.from("\n*/\n");
  assert.ok(prefix.length + suffix.length <= target);
  return Buffer.concat([
    prefix,
    Buffer.alloc(target - prefix.length - suffix.length, 0x78),
    suffix,
  ]);
}

function writePrettyJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function prepareExact96Workspace() {
  const fixture = makeV3CampaignFixture();
  try {
    const patch = JSON.parse(readFileSync(fixture.edits, "utf8"));
    const source = readFileSync(fixture.source, "utf8");
    const edit = patch.edits[0];
    const growth = Buffer.byteLength(edit.content) - Buffer.byteLength(edit.target);
    const sourceTarget = TEST_MAX_INPUT_BYTES - growth;
    assert.ok(sourceTarget > Buffer.byteLength(source));
    const largeSource = `${source}${"x".repeat(sourceTarget - Buffer.byteLength(source))}`;
    assert.equal(Buffer.byteLength(largeSource), sourceTarget);
    writeFileSync(fixture.source, largeSource);
    patch.source_sha256 = sha256(largeSource);

    const padding = [];
    for (let index = 0; index < 7; index += 1) {
      const path = `proposal/rejections/exact-bundle-${index + 1}.bin`;
      const absolute = resolve(fixture.root, path);
      const size = index < 6 ? TEST_MAX_INPUT_BYTES : 0;
      const bytes = Buffer.alloc(size, 0x51 + index);
      writeFileSync(absolute, bytes);
      const descriptor = { path, sha256: sha256(bytes) };
      patch.prior_rejections.push({
        rejection_id: `exact-bundle-${index + 1}`,
        report: descriptor,
        relationship: "not-applicable",
        note: "Retained to exercise the exact staged-bundle byte boundary.",
      });
      padding.push({ absolute, descriptor, rejection: patch.prior_rejections.at(-1), size });
    }

    patch.prior_rejections[0].note = "x";
    let patchBytes = writePrettyJsonBytes(patch);
    const noteGrowth = TEST_MAX_INPUT_BYTES - patchBytes.length;
    assert.ok(noteGrowth > 0);
    patch.prior_rejections[0].note += "x".repeat(noteGrowth);
    patchBytes = writePrettyJsonBytes(patch);
    assert.equal(patchBytes.length, TEST_MAX_INPUT_BYTES);

    const applyCurrentPatch = (lastSize) => {
      const last = padding.at(-1);
      const bytes = Buffer.alloc(lastSize, 0x5a);
      writeFileSync(last.absolute, bytes);
      last.size = lastSize;
      last.descriptor.sha256 = sha256(bytes);
      last.rejection.report.sha256 = last.descriptor.sha256;
      const serialized = writePrettyJsonBytes(patch);
      assert.equal(serialized.length, TEST_MAX_INPUT_BYTES);
      writeFileSync(fixture.edits, serialized);
      rmSync(fixture.candidate, { force: true });
      rmSync(fixture.applyReport, { force: true });
      const result = runCli(applyArgs(fixture));
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readFileSync(fixture.candidate).length, TEST_MAX_INPUT_BYTES);
    };
    applyCurrentPatch(0);

    const ledger = JSON.parse(readFileSync(fixture.results, "utf8"));
    ledger.source.sha256 = sha256(readFileSync(fixture.source));
    ledger.candidate.sha256 = sha256(readFileSync(fixture.candidate));
    for (const sample of ledger.samples) {
      sample.skill_sha256 = sample.arm === "current"
        ? ledger.source.sha256
        : ledger.candidate.sha256;
      const actorPath = resolve(fixture.root, sample.actor_run.path);
      const actorRun = JSON.parse(readFileSync(actorPath, "utf8"));
      actorRun.skill_sha256 = sample.skill_sha256;
      writeJson(actorPath, actorRun);
      sample.actor_run.sha256 = sha256(readFileSync(actorPath));
    }
    writeJson(fixture.results, ledger);
    rmSync(fixture.gateReport, { force: true });
    const gateResult = runCli(gateArgs(fixture));
    assert.equal(gateResult.status, 0, gateResult.stderr);

    const installed = materializeCopiedPlugin(fixture, {
      name: "superzhao-skill-lab",
      version: "9.8.7",
    });
    installed.copiedBytes = padCopiedCliTo(
      readFileSync(installed.copiedCli),
      TEST_MAX_INPUT_BYTES - 1,
    );
    writeFileSync(installed.copiedCli, installed.copiedBytes);

    let lastSize = 0;
    let plan;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      applyCurrentPatch(lastSize);
      plan = expectedStagePlanOracle(fixture, installed.copiedBytes);
      if (plan.bundleBytes === TEST_MAX_BUNDLE_BYTES) break;
      lastSize += TEST_MAX_BUNDLE_BYTES - plan.bundleBytes;
      assert.ok(lastSize >= 0 && lastSize <= TEST_MAX_INPUT_BYTES, `last size ${lastSize}`);
    }
    assert.equal(plan.bundleBytes, TEST_MAX_BUNDLE_BYTES);
    assert.ok(plan.campaignBytes <= TEST_MAX_CAMPAIGN_BYTES);
    assert.ok(plan.maxFileBytes <= TEST_MAX_INPUT_BYTES);
    return { fixture, installed, applyCurrentPatch, lastSize, plan };
  } catch (error) {
    fixture.cleanup();
    throw error;
  }
}

let sharedExact96 = null;

function exact96Fixture() {
  if (sharedExact96) return sharedExact96;
  const prepared = prepareExact96Workspace();
  const retainedRoot = mkdtempSync(resolve(tmpdir(), "superzhao-exact96-"));
  try {
    const stageResult = runCliAt(
      prepared.installed.copiedCli,
      stageArgs(prepared.fixture),
    );
    assert.equal(stageResult.status, 0, stageResult.stderr);
    const actual = actualBundleOracle(prepared.fixture.outputDir);
    const campaign = trustedCampaignOracle(prepared.fixture.outputDir);
    assert.equal(actual.bytes, TEST_MAX_BUNDLE_BYTES);
    assert.ok(campaign.bytes <= BigInt(TEST_MAX_CAMPAIGN_BYTES));
    const retainedBundle = resolve(retainedRoot, "bundle");
    cpSync(prepared.fixture.outputDir, retainedBundle, { recursive: true });
    sharedExact96 = {
      ...prepared,
      stageResult,
      actual,
      campaign,
      retainedRoot,
      retainedBundle,
      cleanup() {
        prepared.fixture.cleanup();
        rmSync(retainedRoot, { recursive: true, force: true });
      },
    };
    return sharedExact96;
  } catch (error) {
    prepared.fixture.cleanup();
    rmSync(retainedRoot, { recursive: true, force: true });
    throw error;
  }
}

test.after(() => {
  sharedExact96?.cleanup();
  sharedExact96 = null;
});

function resizeCampaignToExactLimit(bundle, limit) {
  const fixed = Array.from({ length: 7 }, () => 8 * 1024 * 1024);
  let last = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    writeSizedPriorRejections(bundle, [...fixed, last]);
    const oracle = trustedCampaignOracle(bundle);
    if (oracle.bytes === BigInt(limit)) {
      return { sizes: [...fixed, last], oracle };
    }
    last += Number(BigInt(limit) - oracle.bytes);
    assert.ok(last >= 0 && last <= 8 * 1024 * 1024, `last padding size ${last}`);
  }
  assert.fail("could not converge on the exact campaign-size boundary");
}

function assertVerifierIntegrityFailure(result) {
  assert.equal(result.status, 3, result.stderr);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /unsafe_path_or_integrity|integrity|bundle|mapping|tree/i);
}

function runCliAt(cliPath, args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });
}

function runWithHookAt(root, cliPath, args, hookSource) {
  const hook = resolve(root, `hook-${Math.random().toString(16).slice(2)}.cjs`);
  writeFileSync(hook, hookSource);
  return runCliAt(cliPath, args, {
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=${hook}`.trim(),
    },
  });
}

function runCliAsync(args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (status, signal) => resolveResult({
      status,
      signal,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    }));
  });
}

function anchoredChildPreludeHook(predicate, childPrelude) {
  return `const childProcess = require("node:child_process");\n`
    + `const { syncBuiltinESMExports } = require("node:module");\n`
    + `const original = childProcess.spawnSync;\n`
    + `const protocol = "superzhao.skill-lab.anchored-publisher/v1";\n`
    + `const childPrelude = ${JSON.stringify(childPrelude)};\n`
    + `let injected = false;\n`
    + `childProcess.spawnSync = function(command, args, options) {\n`
    + `  let request;\n`
    + `  try { request = JSON.parse(String(options?.input ?? "")); } catch {}\n`
    + `  if (!injected && command === process.execPath && request?.protocol === protocol\n`
    + `      && (${predicate})) {\n`
    + `    injected = true;\n`
    + `    const evalIndex = args.indexOf("--eval");\n`
    + `    const altered = [...args];\n`
    + `    altered[evalIndex + 1] = childPrelude + args[evalIndex + 1];\n`
    + `    return original.call(this, command, altered, options);\n`
    + `  }\n`
    + `  return original.call(this, command, args, options);\n`
    + `};\n`
    + `syncBuiltinESMExports();\n`;
}

function anchoredChildResultHook(predicate, resultBody, { executeChild = true } = {}) {
  return `const childProcess = require("node:child_process");\n`
    + `const { syncBuiltinESMExports } = require("node:module");\n`
    + `const original = childProcess.spawnSync;\n`
    + `const protocol = "superzhao.skill-lab.anchored-publisher/v1";\n`
    + `let injected = false;\n`
    + `childProcess.spawnSync = function(command, args, options) {\n`
    + `  let request;\n`
    + `  try { request = JSON.parse(String(options?.input ?? "")); } catch {}\n`
    + `  if (!injected && command === process.execPath && request?.protocol === protocol\n`
    + `      && (${predicate})) {\n`
    + `    injected = true;\n`
    + (executeChild
      ? `    const actual = original.call(this, command, args, options);\n`
      : `    const actual = undefined;\n`)
    + `    ${resultBody}\n`
    + `  }\n`
    + `  return original.call(this, command, args, options);\n`
    + `};\n`
    + `syncBuiltinESMExports();\n`;
}

function anchoredPostLinkInPlaceRewriteHook(relativePath) {
  return anchoredChildResultHook(
    `request.action === "link-from-parent"`,
    `const fs = require("node:fs");
    const path = require("node:path");
    const target = path.resolve(options.cwd, ${JSON.stringify(relativePath)});
    const before = fs.lstatSync(target, { bigint: true });
    const bytes = fs.readFileSync(target);
    fs.writeFileSync(target, Buffer.alloc(bytes.length, 0x78));
    const after = fs.lstatSync(target, { bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino) {
      throw new Error("test hook did not preserve the published inode");
    }
    return actual;`,
  );
}

function manifestLinkAndRecoveryAcknowledgementLossHook() {
  return `const childProcess = require("node:child_process");\n`
    + `const { syncBuiltinESMExports } = require("node:module");\n`
    + `const original = childProcess.spawnSync;\n`
    + `const protocol = "superzhao.skill-lab.anchored-publisher/v1";\n`
    + `let linkAcknowledgementLost = false;\n`
    + `childProcess.spawnSync = function(command, args, options) {\n`
    + `  let request;\n`
    + `  try { request = JSON.parse(String(options?.input ?? "")); } catch {}\n`
    + `  if (command === process.execPath && request?.protocol === protocol\n`
    + `      && request.action === "link-from-parent" && !linkAcknowledgementLost) {\n`
    + `    linkAcknowledgementLost = true;\n`
    + `    const actual = original.call(this, command, args, options);\n`
    + `    const error = new Error("synthetic link acknowledgement loss");\n`
    + `    error.code = "ENOBUFS";\n`
    + `    return { ...actual, error };\n`
    + `  }\n`
    + `  if (command === process.execPath && request?.protocol === protocol\n`
    + `      && request.action === "inspect" && request.name === "manifest.json"\n`
    + `      && linkAcknowledgementLost) {\n`
    + `    const actual = original.call(this, command, args, options);\n`
    + `    const error = new Error("synthetic recovery acknowledgement loss");\n`
    + `    error.code = "ENOBUFS";\n`
    + `    return { ...actual, error };\n`
    + `  }\n`
    + `  return original.call(this, command, args, options);\n`
    + `};\n`
    + `syncBuiltinESMExports();\n`;
}

function reserveCallerOutput(fixture, content = "caller-owned output\n") {
  mkdirSync(fixture.outputDir, { mode: 0o700 });
  const sentinel = resolve(fixture.outputDir, "owned-by-caller.txt");
  writeFileSync(sentinel, content);
  return { sentinel, content };
}

function assertCallerOutputPreserved(fixture, reserved) {
  assert.equal(readFileSync(reserved.sentinel, "utf8"), reserved.content);
  assert.equal(existsSync(resolve(fixture.outputDir, "manifest.json")), false);
}

function collectPublishedTree(root) {
  const files = [];
  const directories = [];

  function visit(absolute, path) {
    const stat = lstatSync(absolute, { bigint: true });
    assert.equal(stat.isSymbolicLink(), false, `${path || "."} must not be a symlink`);
    if (stat.isDirectory()) {
      directories.push({ path, stat });
      for (const name of readdirSync(absolute).sort()) {
        visit(resolve(absolute, name), path ? `${path}/${name}` : name);
      }
      return;
    }
    assert.equal(stat.isFile(), true, `${path} must be a regular file`);
    files.push({ path, stat, bytes: readFileSync(absolute) });
  }

  visit(root, "");
  return { files, directories };
}

function impliedDirectories(paths) {
  const directories = new Set([""]);
  for (const path of paths) {
    const parts = path.split("/");
    for (let length = 1; length < parts.length; length += 1) {
      directories.add(parts.slice(0, length).join("/"));
    }
  }
  return [...directories].sort();
}

function assertNoStageTemporary(dir) {
  if (!existsSync(dir) || !lstatSync(dir).isDirectory()) return;
  assert.deepEqual(
    readdirSync(dir).filter((name) => name.startsWith(".skill-lab-manifest-")),
    [],
  );
}

function materializeCopiedPlugin(fixture, manifestValue) {
  const pluginRoot = resolve(fixture.root, "cache/superzhao-skill-lab/9.8.7");
  const copiedCli = resolve(pluginRoot, "scripts/skill-lab.mjs");
  const manifestPath = resolve(pluginRoot, ".codex-plugin/plugin.json");
  mkdirSync(dirname(copiedCli), { recursive: true });
  mkdirSync(dirname(manifestPath), { recursive: true });
  const copiedBytes = Buffer.concat([
    readFileSync(cli),
    Buffer.from("\n// cache-like producer fixture 9.8.7\n"),
  ]);
  writeFileSync(copiedCli, copiedBytes);
  if (manifestValue !== undefined) {
    if (typeof manifestValue === "string") writeFileSync(manifestPath, manifestValue);
    else writeFileSync(manifestPath, `${JSON.stringify(manifestValue, null, 2)}\n`);
  }
  return { pluginRoot, copiedCli, copiedBytes, manifestPath };
}

function workspacePath(root, absolute) {
  return relative(root, absolute).split(sep).join("/");
}

function expectedStageGraph(fixture, producerBytes = readFileSync(cli)) {
  const mappings = new Map();
  const files = new Map();

  function descriptorFor(absolute) {
    const bytes = readFileSync(absolute);
    return {
      path: workspacePath(fixture.root, absolute),
      sha256: sha256(bytes),
    };
  }

  function add(kind, descriptor, packagedPath = null) {
    const isProducer = descriptor.path === null;
    const bytes = isProducer
      ? producerBytes
      : readFileSync(resolve(fixture.root, descriptor.path));
    assert.equal(sha256(bytes), descriptor.sha256, `${kind} ${descriptor.path ?? "producer"}`);
    const path = packagedPath ?? `artifacts/${descriptor.sha256}.bin`;
    const mapping = {
      kind,
      ...(isProducer ? {} : { source_path: descriptor.path }),
      packaged_path: path,
      sha256: descriptor.sha256,
    };
    mappings.set(canonicalJson(mapping), mapping);
    const existing = files.get(path);
    if (existing) {
      assert.equal(existing.sha256, descriptor.sha256, path);
      assert.deepEqual(existing.payload, bytes, path);
    } else {
      files.set(path, {
        path,
        sha256: descriptor.sha256,
        bytes: bytes.length,
        payload: bytes,
      });
    }
    return path;
  }

  const patch = JSON.parse(readFileSync(fixture.edits, "utf8"));
  const ledger = JSON.parse(readFileSync(fixture.results, "utf8"));
  const inventory = JSON.parse(
    readFileSync(resolve(fixture.root, ledger.cases.path), "utf8"),
  );
  const entrypoints = {
    source: add("source-skill", ledger.source, "skills/source/SKILL.md"),
    candidate: add("candidate-skill", ledger.candidate, "skills/candidate/SKILL.md"),
    patch: add("patch", descriptorFor(fixture.edits), "proposal/patch.json"),
    cases: add("cases", ledger.cases, "campaign/cases.json"),
    samples: add("samples", descriptorFor(fixture.results), "campaign/samples.json"),
    apply_report: add(
      "apply-report",
      descriptorFor(fixture.applyReport),
      "reports/apply.json",
    ),
    gate_report: add("gate-report", descriptorFor(fixture.gateReport), "reports/gate.json"),
    producer_cli: add(
      "producer-cli",
      { path: null, sha256: sha256(producerBytes) },
      "producer/skill-lab.mjs",
    ),
  };

  for (const rejection of patch.prior_rejections) {
    add("prior-rejection", rejection.report);
  }
  for (const campaignCase of inventory.cases) {
    add("prompt", campaignCase.prompt);
    add("rubric", campaignCase.rubric);
  }
  for (const sample of ledger.samples) {
    if (sample.actor_run) {
      add("actor-run", sample.actor_run);
      const actorRun = JSON.parse(
        readFileSync(resolve(fixture.root, sample.actor_run.path), "utf8"),
      );
      add("actor-profile", actorRun.actor_profile);
      add("prompt", actorRun.prompt);
      add("environment", actorRun.environment);
      add("harness-model-profile", actorRun.harness_model_profile);
      add("transcript", actorRun.transcript);
    }
    if (sample.scorer_record) {
      add("scorer-record", sample.scorer_record);
      const scorerRecord = JSON.parse(
        readFileSync(resolve(fixture.root, sample.scorer_record.path), "utf8"),
      );
      add("scorer-profile", scorerRecord.scorer_profile);
      add("rubric", scorerRecord.rubric);
      add("transcript", scorerRecord.transcript);
      add("scorer-output", scorerRecord.scorer_output);
    }
  }

  const artifacts = [...mappings.values()].sort((left, right) => {
    const leftKey = `${left.kind}\0${left.source_path ?? ""}\0`
      + `${left.packaged_path}\0${left.sha256}`;
    const rightKey = `${right.kind}\0${right.source_path ?? ""}\0`
      + `${right.packaged_path}\0${right.sha256}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  const expectedFiles = [...files.values()]
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  return {
    artifacts,
    entrypoints,
    files: expectedFiles.map(({ payload: _payload, ...file }) => file),
    payloads: new Map(expectedFiles.map((file) => [file.path, file.payload])),
  };
}

function assertExactStageGraph(manifest, expected) {
  assert.deepEqual(manifest.entrypoints, expected.entrypoints);
  assert.deepEqual(manifest.artifacts, expected.artifacts);
  assert.deepEqual(manifest.files, expected.files);
}

function assertCommittedStageBundle(fixture, result, producerBytes = readFileSync(cli)) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^[0-9a-f]{64}\n$/);
  const manifestPath = resolve(fixture.outputDir, "manifest.json");
  const raw = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  assert.equal(result.stdout, `${sha256(raw)}\n`);
  assert.equal(raw, canonicalLine(manifest));
  assert.deepEqual(schemaErrors(manifest, readSchemaPair("bundle-manifest").schema), []);
  const expected = expectedStageGraph(fixture, producerBytes);
  assertExactStageGraph(manifest, expected);
  const expectedPaths = [...expected.files.map((file) => file.path), "manifest.json"].sort();
  const tree = collectPublishedTree(fixture.outputDir);
  assert.deepEqual(tree.files.map((file) => file.path).sort(), expectedPaths);
  assert.deepEqual(
    tree.directories.map((directory) => directory.path).sort(),
    impliedDirectories(expectedPaths),
  );
  for (const descriptor of expected.files) {
    assert.deepEqual(
      readFileSync(resolve(fixture.outputDir, descriptor.path)),
      expected.payloads.get(descriptor.path),
      descriptor.path,
    );
  }
  return { manifest, raw };
}

function spoofLstatFieldHook(target, field) {
  return `const fs = require("node:fs");\n`
    + `const path = require("node:path");\n`
    + `const { syncBuiltinESMExports } = require("node:module");\n`
    + `const original = fs.lstatSync;\n`
    + `const target = ${JSON.stringify(target)};\n`
    + `const field = ${JSON.stringify(field)};\n`
    + `fs.lstatSync = function(value, options) {\n`
    + `  const stat = original.call(this, value, options);\n`
    + `  if (path.resolve(String(value)) === target) {\n`
    + `    const current = stat[field];\n`
    + `    Object.defineProperty(stat, field, {\n`
    + `      value: typeof current === "bigint" ? current + 1n : current + 1,\n`
    + `      writable: true, enumerable: true, configurable: true,\n`
    + `    });\n`
    + `  }\n`
    + `  return stat;\n`
    + `};\n`
    + `syncBuiltinESMExports();\n`;
}

function writeFixtureArtifact(fixture, relativePath, value, { json = false } = {}) {
  const absolute = resolve(fixture.root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  const bytes = json ? `${JSON.stringify(value)}\n` : value;
  writeFileSync(absolute, bytes);
  return { path: relativePath, sha256: sha256(bytes) };
}

function inflateManifestPastInputLimit(fixture) {
  const ledger = JSON.parse(readFileSync(fixture.results, "utf8"));
  const inventoryPath = resolve(fixture.root, ledger.cases.path);
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  const longPrefix = `campaign/oversized/${[
    "a".repeat(215),
    "b".repeat(215),
    "c".repeat(215),
    "d".repeat(215),
  ].join("/")}`;
  const extraRows = 940;

  for (let index = 0; index < extraRows; index += 1) {
    const suffix = String(index).padStart(3, "0");
    const caseId = `oversized-train-${suffix}`;
    const prompt = writeFixtureArtifact(
      fixture,
      `${longPrefix}/prompt-${suffix}.txt`,
      `prompt ${suffix}\n`,
    );
    const rubric = writeFixtureArtifact(
      fixture,
      `${longPrefix}/rubric-${suffix}.txt`,
      `rubric ${suffix}\n`,
    );
    inventory.cases.push({
      case_id: caseId,
      split: "train",
      case_type: "control",
      prompt,
      rubric,
    });

    const actorProfile = writeFixtureArtifact(
      fixture,
      `${longPrefix}/actor-profile-${suffix}.json`,
      { actor: suffix },
      { json: true },
    );
    const environment = writeFixtureArtifact(
      fixture,
      `${longPrefix}/environment-${suffix}.json`,
      { environment: suffix },
      { json: true },
    );
    const harness = writeFixtureArtifact(
      fixture,
      `${longPrefix}/harness-${suffix}.json`,
      { harness: suffix },
      { json: true },
    );
    const transcript = writeFixtureArtifact(
      fixture,
      `${longPrefix}/transcript-${suffix}.jsonl`,
      `${JSON.stringify({ transcript: suffix })}\n`,
    );
    const scorerProfile = writeFixtureArtifact(
      fixture,
      `${longPrefix}/scorer-profile-${suffix}.json`,
      { scorer: suffix },
      { json: true },
    );
    const scorerOutput = writeFixtureArtifact(
      fixture,
      `${longPrefix}/scorer-output-${suffix}.json`,
      { result: suffix },
      { json: true },
    );
    const sampleId = `oversized-sample-${suffix}`;
    const runId = `oversized-run-${suffix}`;
    const scorerRunId = `oversized-scorer-run-${suffix}`;
    const reason = "retained train attempt for manifest-size coverage";
    const actorRun = writeFixtureArtifact(
      fixture,
      `${longPrefix}/actor-run-${suffix}.json`,
      {
        schema: "superzhao.skill-lab.actor-run/v3",
        sample_id: sampleId,
        run_id: runId,
        actor_instance_id: `oversized-actor-${suffix}`,
        actor_profile_id: `oversized-actor-profile-${suffix}`,
        case_id: caseId,
        split: "train",
        case_type: "control",
        arm: "current",
        skill_sha256: ledger.source.sha256,
        actor_profile: actorProfile,
        prompt,
        environment,
        harness_model_profile: harness,
        transcript,
      },
      { json: true },
    );
    const scorerRecord = writeFixtureArtifact(
      fixture,
      `${longPrefix}/scorer-record-${suffix}.json`,
      {
        schema: "superzhao.skill-lab.scorer-record/v3",
        sample_id: sampleId,
        run_id: runId,
        scorer_run_id: scorerRunId,
        scorer_profile_id: `oversized-scorer-profile-${suffix}`,
        scorer_version: "fixture-scorer-v1",
        scorer_profile: scorerProfile,
        rubric,
        transcript,
        scorer_output: scorerOutput,
        status: "indeterminate",
        reason,
      },
      { json: true },
    );
    ledger.samples.push({
      sample_id: sampleId,
      run_id: runId,
      actor_instance_id: `oversized-actor-${suffix}`,
      actor_profile_id: `oversized-actor-profile-${suffix}`,
      case_id: caseId,
      split: "train",
      case_type: "control",
      arm: "current",
      skill_sha256: ledger.source.sha256,
      actor_run: actorRun,
      scorer_run_id: scorerRunId,
      scorer_record: scorerRecord,
      status: "indeterminate",
      reason,
    });
  }

  writeJson(inventoryPath, inventory);
  ledger.cases.sha256 = sha256(readFileSync(inventoryPath));
  writeJson(fixture.results, ledger);
  rmSync(fixture.gateReport);
  const gateResult = runCli(gateArgs(fixture));
  assert.equal(gateResult.status, 0, gateResult.stderr);
}

test("v3 stage publishes a canonical complete manifest and prints its digest", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const expected = expectedStageGraph(fixture);
    assert.equal(expected.artifacts.length, 183);
    assert.equal(expected.files.length, 183);
    const result = runCli(stageArgs(fixture));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /^[0-9a-f]{64}\n$/);

    const manifestPath = resolve(fixture.outputDir, "manifest.json");
    const raw = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(raw);
    assert.equal(result.stdout, `${sha256(raw)}\n`);
    assert.equal(raw, `${canonicalJson(manifest)}\n`);
    assert.equal(manifest.schema, "superzhao.skill-lab.bundle-manifest/v3");
    assert.deepEqual(schemaErrors(manifest, readSchemaPair("bundle-manifest").schema), []);
    assert.deepEqual(Object.keys(manifest.entrypoints).sort(), REQUIRED_ENTRYPOINTS);
    assert.deepEqual(
      [...new Set(manifest.artifacts.map((artifact) => artifact.kind))].sort(),
      REQUIRED_ARTIFACT_KINDS,
    );
    assert.equal(manifest.artifacts.length, 183);
    assert.equal(manifest.files.length, 183);
    assertExactStageGraph(manifest, expected);

    const missingEvidence = structuredClone(manifest);
    const missingIndex = missingEvidence.artifacts.findIndex(
      (artifact) => artifact.kind === "scorer-output",
    );
    assert.notEqual(missingIndex, -1);
    missingEvidence.artifacts.splice(missingIndex, 1);
    assert.throws(
      () => assertExactStageGraph(missingEvidence, expected),
      (error) => error?.code === "ERR_ASSERTION",
      "the independent oracle must reject a manifest missing one evidence mapping",
    );

    const artifactOrder = manifest.artifacts.map((artifact) => (
      `${artifact.kind}\0${artifact.source_path ?? ""}\0`
      + `${artifact.packaged_path}\0${artifact.sha256}`
    ));
    assert.deepEqual(artifactOrder, [...artifactOrder].sort());
    const fileOrder = manifest.files.map((file) => file.path);
    assert.deepEqual(fileOrder, [...fileOrder].sort());

    const filesByPath = new Map(expected.files.map((file) => [file.path, file]));
    assert.equal(filesByPath.size, expected.files.length, "file paths must be unique");
    const mappingsByPath = new Map();
    for (const mapping of expected.artifacts) {
      const mappings = mappingsByPath.get(mapping.packaged_path) ?? [];
      mappings.push(mapping);
      mappingsByPath.set(mapping.packaged_path, mappings);
      const file = filesByPath.get(mapping.packaged_path);
      assert.ok(file, `${mapping.kind} mapping must reference a listed file`);
      assert.equal(mapping.sha256, file.sha256);
      const packagedBytes = readFileSync(resolve(fixture.outputDir, mapping.packaged_path));
      assert.deepEqual(packagedBytes, expected.payloads.get(mapping.packaged_path));
      if (mapping.kind === "producer-cli") {
        assert.equal(Object.hasOwn(mapping, "source_path"), false);
        assert.deepEqual(packagedBytes, readFileSync(cli));
      } else {
        assert.equal(Object.hasOwn(mapping, "source_path"), true, mapping.kind);
        const sourceBytes = readFileSync(resolve(fixture.root, mapping.source_path));
        assert.deepEqual(packagedBytes, sourceBytes, mapping.source_path);
        assert.equal(mapping.sha256, sha256(sourceBytes));
      }
    }
    for (const file of expected.files) {
      assert.match(file.path, /\S/);
      assert.match(file.sha256, /^[0-9a-f]{64}$/);
      assert.ok(Number.isInteger(file.bytes) && file.bytes >= 0);
      assert.ok(mappingsByPath.has(file.path), `${file.path} must be artifact-covered`);
    }

    for (const [entrypoint, expectedKind] of Object.entries(ENTRYPOINT_KINDS)) {
      const matches = expected.artifacts.filter(
        (artifact) => artifact.packaged_path === expected.entrypoints[entrypoint],
      );
      assert.equal(matches.length, 1, `${entrypoint} must resolve to exactly one mapping`);
      assert.equal(matches[0].kind, expectedKind);
    }

    const producerMapping = expected.artifacts.find(
      (artifact) => artifact.kind === "producer-cli",
    );
    const producerFile = filesByPath.get(expected.entrypoints.producer_cli);
    const producerBytes = readFileSync(
      resolve(fixture.outputDir, expected.entrypoints.producer_cli),
    );
    assert.equal(producerMapping.sha256, manifest.producer.cli_sha256);
    assert.equal(producerFile.sha256, manifest.producer.cli_sha256);
    assert.equal(sha256(producerBytes), manifest.producer.cli_sha256);
    assert.equal(manifest.producer.node_version, process.version);
    assert.equal(manifest.producer.platform, process.platform);
    assert.equal(manifest.producer.arch, process.arch);

    const tree = collectPublishedTree(fixture.outputDir);
    const expectedFiles = [...expected.files.map((file) => file.path), "manifest.json"].sort();
    assert.deepEqual(tree.files.map((file) => file.path).sort(), expectedFiles);
    assert.deepEqual(
      tree.directories.map((directory) => directory.path).sort(),
      impliedDirectories(expectedFiles),
    );
    assert.equal(typeof process.geteuid, "function");
    const expectedUid = BigInt(process.geteuid());
    for (const directory of tree.directories) {
      assert.equal(directory.stat.mode & 0o777n, 0o700n, directory.path || ".");
      assert.equal(directory.stat.uid, expectedUid, directory.path || ".");
    }
    for (const file of tree.files) {
      assert.equal(file.stat.mode & 0o777n, 0o600n, file.path);
      assert.equal(file.stat.uid, expectedUid, file.path);
      if (file.path === "manifest.json") {
        assert.equal(sha256(file.bytes), result.stdout.trim());
      } else {
        const descriptor = filesByPath.get(file.path);
        assert.equal(file.bytes.length, descriptor.bytes, file.path);
        assert.equal(sha256(file.bytes), descriptor.sha256, file.path);
      }
    }
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage rejects an in-place payload rewrite before completing publication", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const hook = anchoredPostLinkInPlaceRewriteHook("skills/source/SKILL.md");
    const result = runWithHook(fixture, stageArgs(fixture), hook);

    assert.equal(result.status, 3, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /unsafe_path_or_integrity|physical|bytes|digest/i);
    assert.equal(existsSync(resolve(fixture.outputDir, "manifest.json")), false);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage removes an in-place rewritten manifest instead of printing a trust anchor", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const hook = anchoredPostLinkInPlaceRewriteHook("manifest.json");
    const result = runWithHook(fixture, stageArgs(fixture), hook);

    assert.equal(result.status, 3, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /unsafe_path_or_integrity|physical|bytes|digest/i);
    assert.equal(existsSync(resolve(fixture.outputDir, "manifest.json")), false);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage recovers committed manifest after publisher acknowledgement loss", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const childPrelude = `const fs = require("node:fs");
const originalLink = fs.linkSync;
fs.linkSync = function(...args) {
  const result = originalLink.apply(this, args);
  process.kill(process.pid, "SIGKILL");
  return result;
};
`;
    const hook = anchoredChildPreludeHook(
      `request.action === "link-from-parent"`,
      childPrelude,
    );

    const result = runWithHook(fixture, stageArgs(fixture), hook);
    const committedRaw = readFileSync(resolve(fixture.outputDir, "manifest.json"), "utf8");
    const committedManifest = JSON.parse(committedRaw);
    assert.equal(committedRaw, canonicalLine(committedManifest));
    assertExactStageGraph(committedManifest, expectedStageGraph(fixture));
    assertCommittedStageBundle(fixture, result);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage recovers a committed manifest after a status-zero malformed acknowledgement", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const hook = anchoredChildResultHook(
      `request.action === "link-from-parent"`,
      `return { ...actual, status: 0, signal: null, stdout: "{malformed acknowledgement" };`,
    );

    const result = runWithHook(fixture, stageArgs(fixture), hook);
    assertCommittedStageBundle(fixture, result);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage recovers a committed manifest after an invalid success acknowledgement", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const hook = anchoredChildResultHook(
      `request.action === "link-from-parent"`,
      `return {
        ...actual,
        status: 0,
        signal: null,
        stdout: JSON.stringify({ ok: true, result: "unexpected-link-result" }),
      };`,
    );

    const result = runWithHook(fixture, stageArgs(fixture), hook);
    assertCommittedStageBundle(fixture, result);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage recovers a committed manifest after a generic publisher child error", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const hook = anchoredChildResultHook(
      `request.action === "link-from-parent"`,
      `const error = new Error("synthetic ENOBUFS after publisher completion");
      error.code = "ENOBUFS";
      return { ...actual, error };`,
    );

    const result = runWithHook(fixture, stageArgs(fixture), hook);
    assertCommittedStageBundle(fixture, result);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage removes manifest when link and recovery acknowledgements are both lost", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const result = runWithHook(
      fixture,
      stageArgs(fixture),
      manifestLinkAndRecoveryAcknowledgementLossHook(),
    );

    assert.equal(result.status, 6, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /acknowledgement|publication_failure/i);
    assert.equal(existsSync(resolve(fixture.outputDir, "manifest.json")), false);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage does not recover malformed or child-error ambiguity before manifest link", async (t) => {
  const scenarios = [
    {
      name: "status-zero malformed acknowledgement",
      resultBody: `return {
        pid: 0, output: [], stdout: "{malformed acknowledgement", stderr: "",
        status: 0, signal: null,
      };`,
    },
    {
      name: "generic child error with success-like fields",
      resultBody: `const error = new Error("synthetic ENOBUFS before publisher execution");
      error.code = "ENOBUFS";
      return {
        pid: 0, output: [],
        stdout: JSON.stringify({ ok: true, result: "linked" }), stderr: "",
        status: 0, signal: null, error,
      };`,
    },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, () => {
      const fixture = makeV3CampaignFixture();
      try {
        const hook = anchoredChildResultHook(
          `request.action === "link-from-parent"`,
          scenario.resultBody,
          { executeChild: false },
        );

        const result = runWithHook(fixture, stageArgs(fixture), hook);
        assert.equal(result.status, 6, result.stderr);
        assert.equal(result.stdout, "");
        assert.equal(existsSync(fixture.outputDir), true);
        assert.equal(existsSync(resolve(fixture.outputDir, "manifest.json")), false);
        assertNoStageTemporary(fixture.outputParent);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("v3 stage does not recover a malformed payload-create acknowledgement", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const hook = anchoredChildResultHook(
      `request.action === "create"
        && !String(request.name).startsWith(".skill-lab-manifest-")`,
      `return { ...actual, status: 0, signal: null, stdout: "{malformed acknowledgement" };`,
    );

    const result = runWithHook(fixture, stageArgs(fixture), hook);
    assert.equal(result.status, 6, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(existsSync(fixture.outputDir), true);
    assert.equal(existsSync(resolve(fixture.outputDir, "manifest.json")), false);
    assert.equal(collectPublishedTree(fixture.outputDir).files.length, 1);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage tolerates manifest-temp unlink acknowledgement loss after removal", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const childPrelude = `const fs = require("node:fs");
const originalUnlink = fs.unlinkSync;
fs.unlinkSync = function(...args) {
  const result = originalUnlink.apply(this, args);
  process.kill(process.pid, "SIGKILL");
  return result;
};
`;
    const hook = anchoredChildPreludeHook(
      `request.action === "unlink"
        && String(request.name).startsWith(".skill-lab-manifest-")`,
      childPrelude,
    );

    const result = runWithHook(fixture, stageArgs(fixture), hook);
    assertCommittedStageBundle(fixture, result);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage may retain its exact hidden manifest inode when cleanup dies before unlink", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const childPrelude = `const fs = require("node:fs");
fs.unlinkSync = function() {
  process.kill(process.pid, "SIGKILL");
};
`;
    const hook = anchoredChildPreludeHook(
      `request.action === "unlink"
        && String(request.name).startsWith(".skill-lab-manifest-")`,
      childPrelude,
    );

    const result = runWithHook(fixture, stageArgs(fixture), hook);
    assertCommittedStageBundle(fixture, result);
    const temporaryNames = readdirSync(fixture.outputParent).filter(
      (name) => name.startsWith(".skill-lab-manifest-"),
    );
    assert.equal(temporaryNames.length, 1);
    const temporaryPath = resolve(fixture.outputParent, temporaryNames[0]);
    const manifestPath = resolve(fixture.outputDir, "manifest.json");
    const temporaryStat = lstatSync(temporaryPath, { bigint: true });
    const manifestStat = lstatSync(manifestPath, { bigint: true });
    assert.equal(temporaryStat.dev, manifestStat.dev);
    assert.equal(temporaryStat.ino, manifestStat.ino);
    assert.deepEqual(readFileSync(temporaryPath), readFileSync(manifestPath));
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage does not recover payload create acknowledgement loss as a commit", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const childPrelude = `const fs = require("node:fs");
const originalWrite = fs.writeFileSync;
fs.writeFileSync = function(...args) {
  const result = originalWrite.apply(this, args);
  process.kill(process.pid, "SIGKILL");
  return result;
};
`;
    const hook = anchoredChildPreludeHook(
      `request.action === "create"
        && !String(request.name).startsWith(".skill-lab-manifest-")`,
      childPrelude,
    );

    const result = runWithHook(fixture, stageArgs(fixture), hook);
    assert.equal(result.status, 6, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(existsSync(fixture.outputDir), true);
    assert.equal(existsSync(resolve(fixture.outputDir, "manifest.json")), false);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage does not recover acknowledgement loss when the manifest link never occurred", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const childPrelude = `const fs = require("node:fs");
fs.linkSync = function() {
  process.kill(process.pid, "SIGKILL");
};
`;
    const hook = anchoredChildPreludeHook(
      `request.action === "link-from-parent"`,
      childPrelude,
    );

    const result = runWithHook(fixture, stageArgs(fixture), hook);
    assert.equal(result.status, 6, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(existsSync(fixture.outputDir), true);
    assert.equal(existsSync(resolve(fixture.outputDir, "manifest.json")), false);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage preserves a foreign manifest link conflict and exits publication failure", () => {
  const fixture = makeV3CampaignFixture();
  const foreign = "foreign manifest conflict\n";
  try {
    const hook = `const childProcess = require("node:child_process");\n`
      + `const fs = require("node:fs");\n`
      + `const path = require("node:path");\n`
      + `const { syncBuiltinESMExports } = require("node:module");\n`
      + `const original = childProcess.spawnSync;\n`
      + `const protocol = "superzhao.skill-lab.anchored-publisher/v1";\n`
      + `const foreign = ${JSON.stringify(foreign)};\n`
      + `let injected = false;\n`
      + `childProcess.spawnSync = function(command, args, options) {\n`
      + `  let request;\n`
      + `  try { request = JSON.parse(String(options?.input ?? "")); } catch {}\n`
      + `  if (!injected && command === process.execPath && request?.protocol === protocol\n`
      + `      && request.action === "link-from-parent") {\n`
      + `    injected = true;\n`
      + `    fs.writeFileSync(path.resolve(options.cwd, "manifest.json"), foreign, {\n`
      + `      flag: "wx", mode: 0o600,\n`
      + `    });\n`
      + `  }\n`
      + `  return original.call(this, command, args, options);\n`
      + `};\n`
      + `syncBuiltinESMExports();\n`;

    const result = runWithHook(fixture, stageArgs(fixture), hook);
    assert.equal(result.status, 6, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(readFileSync(resolve(fixture.outputDir, "manifest.json"), "utf8"), foreign);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage has exactly one winner under concurrent no-replace publication", async () => {
  const fixture = makeV3CampaignFixture();
  try {
    const results = await Promise.all([
      runCliAsync(stageArgs(fixture)),
      runCliAsync(stageArgs(fixture)),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [0, 6]);
    const winner = results.find((result) => result.status === 0);
    const loser = results.find((result) => result.status === 6);
    assertCommittedStageBundle(fixture, winner);
    assert.equal(loser.stdout, "");
    assert.match(loser.stderr, /publication_failure|already exists|output/i);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage rejects unknown production schemas before inspecting an existing destination", async (t) => {
  for (const scenario of [
    { name: "patch", path: "edits", schema: "superzhao.skill-lab.patch/v999" },
    { name: "samples", path: "results", schema: "superzhao.skill-lab.samples/v999" },
  ]) {
    await t.test(scenario.name, () => {
      const fixture = makeV3CampaignFixture();
      try {
        const value = JSON.parse(readFileSync(fixture[scenario.path], "utf8"));
        value.schema = scenario.schema;
        writeJson(fixture[scenario.path], value);
        const reserved = reserveCallerOutput(fixture, `keep ${scenario.name} schema output\n`);

        const result = runCli(stageArgs(fixture));
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr, /stage requires|schema/i);
        assert.doesNotMatch(result.stderr, /already exists|publication_failure/i);
        assertCallerOutputPreserved(fixture, reserved);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("v3 stage rejects same-byte and hard-link source or candidate aliases before output", async (t) => {
  for (const scenario of [
    { field: "source", method: "copy" },
    { field: "source", method: "hard-link" },
    { field: "candidate", method: "copy" },
    { field: "candidate", method: "hard-link" },
  ]) {
    await t.test(`${scenario.field} ${scenario.method}`, () => {
      const fixture = makeV3CampaignFixture();
      try {
        const alias = resolve(
          fixture.root,
          `aliases/${scenario.field}-${scenario.method}/SKILL.md`,
        );
        mkdirSync(dirname(alias), { recursive: true });
        if (scenario.method === "copy") {
          writeFileSync(alias, readFileSync(fixture[scenario.field]));
        } else {
          linkSync(fixture[scenario.field], alias);
        }
        const args = stageArgs(fixture);
        args[args.indexOf(`--${scenario.field}`) + 1] = alias;

        const result = runCli(args);
        assert.equal(result.status, 3, result.stderr);
        assert.match(result.stderr, /unsafe_path_or_integrity|match|bound|identity/i);
        assert.equal(existsSync(fixture.outputDir), false);
        assertNoStageTemporary(fixture.outputParent);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("v3 stage rejects noncanonical and forged accepting reports as integrity failures", async (t) => {
  for (const scenario of [
    { name: "noncanonical apply", path: "applyReport", mutate: null },
    { name: "noncanonical gate", path: "gateReport", mutate: null },
    {
      name: "forged apply",
      path: "applyReport",
      mutate: (value) => { value.proposal_id = "forged-proposal"; },
    },
    {
      name: "forged gate",
      path: "gateReport",
      mutate: (value) => { value.campaign_id = "forged-campaign"; },
    },
  ]) {
    await t.test(scenario.name, () => {
      const fixture = makeV3CampaignFixture();
      try {
        const path = fixture[scenario.path];
        const value = JSON.parse(readFileSync(path, "utf8"));
        if (scenario.mutate) {
          scenario.mutate(value);
          writeFileSync(path, canonicalLine(value));
        } else {
          writeJson(path, value);
        }

        const result = runCli(stageArgs(fixture));
        assert.equal(result.status, 3, result.stderr);
        assert.match(result.stderr, /unsafe_path_or_integrity|reports? do not match|trusted/i);
        assert.equal(existsSync(fixture.outputDir), false);
        assertNoStageTemporary(fixture.outputParent);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("v3 stage rejects truncated gate bytes and accepted-candidate drift before output", async (t) => {
  await t.test("truncated gate report", () => {
    const fixture = makeV3CampaignFixture();
    try {
      const complete = readFileSync(fixture.gateReport);
      writeFileSync(fixture.gateReport, complete.subarray(0, Math.floor(complete.length / 2)));
      const result = runCli(stageArgs(fixture));
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /gate report.*valid JSON|JSON|truncated|unexpected/i);
      assert.equal(existsSync(fixture.outputDir), false);
      assertNoStageTemporary(fixture.outputParent);
    } finally {
      fixture.cleanup();
    }
  });

  await t.test("accepted candidate byte drift", () => {
    const fixture = makeV3CampaignFixture();
    try {
      writeFileSync(fixture.candidate, `${readFileSync(fixture.candidate, "utf8")}drift\n`);
      const result = runCli(stageArgs(fixture));
      assert.equal(result.status, 3, result.stderr);
      assert.match(result.stderr, /unsafe_path_or_integrity|sha256|digest|candidate/i);
      assert.equal(existsSync(fixture.outputDir), false);
      assertNoStageTemporary(fixture.outputParent);
    } finally {
      fixture.cleanup();
    }
  });
});

test("v3 stage rejects a rejected campaign whose report is forged to final_accept", () => {
  const rejected = makeV3CampaignFixture({ mode: "selection_reject" });
  const accepting = makeV3CampaignFixture();
  try {
    const acceptingReport = readFileSync(accepting.gateReport);
    const parsed = JSON.parse(acceptingReport);
    assert.equal(parsed.selection.status, "selection_pass");
    assert.equal(parsed.final.status, "final_accept");
    writeFileSync(rejected.gateReport, acceptingReport);

    const result = runCli(stageArgs(rejected));
    assert.equal(result.status, 4, result.stderr);
    assert.match(result.stderr, /selection/i);
    assert.equal(existsSync(rejected.outputDir), false);
    assertNoStageTemporary(rejected.outputParent);
  } finally {
    rejected.cleanup();
    accepting.cleanup();
  }
});

test("v3 stage preserves final rejection priority over a forged final_accept report", () => {
  const rejected = makeV3CampaignFixture({ mode: "final_reject" });
  const accepting = makeV3CampaignFixture();
  try {
    const acceptingReport = readFileSync(accepting.gateReport);
    const parsed = JSON.parse(acceptingReport);
    assert.equal(parsed.selection.status, "selection_pass");
    assert.equal(parsed.final.status, "final_accept");
    writeFileSync(rejected.gateReport, acceptingReport);

    const result = runCli(stageArgs(rejected));
    assert.equal(result.status, 5, result.stderr);
    assert.match(result.stderr, /held-out|final/i);
    assert.equal(existsSync(rejected.outputDir), false);
    assertNoStageTemporary(rejected.outputParent);
  } finally {
    rejected.cleanup();
    accepting.cleanup();
  }
});

test("v3 stage decision and integrity precedence wins over an existing destination", async (t) => {
  for (const scenario of [
    { name: "selection rejection", mode: "selection_reject", expected: 4 },
    {
      name: "final rejection",
      mode: "final_reject",
      expected: 5,
      expectedFinal: "final_reject",
    },
    { name: "accepted forgery", mode: "final_accept", expected: 3, forge: true },
    { name: "valid conflict", mode: "final_accept", expected: 6 },
  ]) {
    await t.test(scenario.name, () => {
      const fixture = makeV3CampaignFixture({ mode: scenario.mode });
      try {
        if (scenario.expectedFinal) {
          assert.equal(fixture.gateResult.status, 5);
          assert.equal(fixture.gate.selection.status, "selection_pass");
          assert.equal(fixture.gate.final.status, scenario.expectedFinal);
        }
        if (scenario.forge) {
          const report = JSON.parse(readFileSync(fixture.gateReport, "utf8"));
          report.campaign_id = "forged-campaign";
          writeFileSync(fixture.gateReport, canonicalLine(report));
        }
        const reserved = reserveCallerOutput(fixture, `keep ${scenario.name}\n`);

        const result = runCli(stageArgs(fixture));
        assert.equal(result.status, scenario.expected, result.stderr);
        assertCallerOutputPreserved(fixture, reserved);
        assertNoStageTemporary(fixture.outputParent);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("v3 stage returns selection rejection without creating output", () => {
  const fixture = makeV3CampaignFixture({ mode: "selection_reject" });
  try {
    const result = runCli(stageArgs(fixture));
    assert.equal(result.status, 4, result.stderr);
    assert.equal(existsSync(fixture.outputDir), false);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage returns final not-evaluated rejection without creating output", () => {
  const fixture = makeV3CampaignFixture({ mode: "not_evaluated" });
  try {
    const result = runCli(stageArgs(fixture));
    assert.equal(result.status, 5, result.stderr);
    assert.equal(existsSync(fixture.outputDir), false);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage returns publication failure and preserves an existing output directory", () => {
  const fixture = makeV3CampaignFixture();
  try {
    mkdirSync(fixture.outputDir, { mode: 0o700 });
    const sentinel = resolve(fixture.outputDir, "owned-by-caller.txt");
    writeFileSync(sentinel, "keep me\n");

    const result = runCli(stageArgs(fixture));
    assert.equal(result.status, 6, result.stderr);
    assert.equal(readFileSync(sentinel, "utf8"), "keep me\n");
    assert.equal(existsSync(resolve(fixture.outputDir, "manifest.json")), false);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage never exposes a partial manifest when its writer is killed", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const failurePrelude = `const fs = require("node:fs");
const originalWrite = fs.writeFileSync;
fs.writeFileSync = function(target, value, ...rest) {
  if (typeof target === "number") {
    const bytes = Buffer.from(value);
    fs.writeSync(target, bytes.subarray(0, Math.min(64, bytes.length)));
    process.kill(process.pid, "SIGKILL");
  }
  return originalWrite.call(this, target, value, ...rest);
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
      + `  const manifestWrite = request?.action === "create"\n`
      + `    && (request.name === "manifest.json"\n`
      + `      || String(request.name).startsWith(".skill-lab-manifest-"));\n`
      + `  if (!injected && command === process.execPath && request?.protocol === protocol\n`
      + `      && manifestWrite) {\n`
      + `    injected = true;\n`
      + `    const evalIndex = args.indexOf("--eval");\n`
      + `    const altered = [...args];\n`
      + `    altered[evalIndex + 1] = failurePrelude + args[evalIndex + 1];\n`
      + `    return original.call(this, command, altered, options);\n`
      + `  }\n`
      + `  return original.call(this, command, args, options);\n`
      + `};\n`
      + `syncBuiltinESMExports();\n`;

    const result = runWithHook(fixture, stageArgs(fixture), hook);
    assert.equal(result.status, 6, result.stderr);
    assert.equal(existsSync(fixture.outputDir), true);
    assert.equal(
      existsSync(resolve(fixture.outputDir, "manifest.json")),
      false,
      "a killed manifest writer must not leave visible manifest bytes",
    );
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage rejects patch support that is absent from the campaign inventory", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const patch = JSON.parse(readFileSync(fixture.edits, "utf8"));
    patch.edits[0].supporting_case_ids = ["case-not-in-inventory"];
    patch.edits[0].support_count = 1;
    writeJson(fixture.edits, patch);
    rmSync(fixture.candidate);
    rmSync(fixture.applyReport);
    const applyResult = runCli(applyArgs(fixture));
    assert.equal(applyResult.status, 0, applyResult.stderr);

    const result = runCli(stageArgs(fixture));
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /supporting_case_ids|campaign inventory|unknown case/i);
    assert.equal(existsSync(fixture.outputDir), false);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage rejects a source path mapped to conflicting packaged payloads", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const patch = JSON.parse(readFileSync(fixture.edits, "utf8"));
    const ledger = JSON.parse(readFileSync(fixture.results, "utf8"));
    patch.prior_rejections.push({
      rejection_id: "source-path-mapping-conflict",
      report: ledger.source,
      relationship: "not-applicable",
      note: "A source Skill is not a separately packaged prior-rejection report.",
    });
    writeJson(fixture.edits, patch);
    rmSync(fixture.candidate);
    rmSync(fixture.applyReport);
    const applyResult = runCli(applyArgs(fixture));
    assert.equal(applyResult.status, 0, applyResult.stderr);

    const result = runCli(stageArgs(fixture));
    assert.equal(result.status, 3, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /conflicting source_path mapping|mapping/i);
    assert.equal(existsSync(fixture.outputDir), false);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage enforces the output-parent safety matrix without foreign mutation", async (t) => {
  const scenarios = [
    { name: "missing", expected: 3 },
    { name: "ordinary file", expected: 3 },
    { name: "symlink", expected: 3 },
    { name: "outside workspace", expected: 3 },
    { name: "non-private mode", expected: 7 },
    { name: "wrong uid", expected: 3, spoof: "uid" },
    { name: "cross-device", expected: 7, spoof: "dev" },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, () => {
      const fixture = makeV3CampaignFixture();
      let outputDir = fixture.outputDir;
      let outside = null;
      let preserved;
      try {
        if (scenario.name === "missing") {
          rmSync(fixture.outputParent, { recursive: true });
          preserved = () => assert.equal(existsSync(fixture.outputParent), false);
        } else if (scenario.name === "ordinary file") {
          rmSync(fixture.outputParent, { recursive: true });
          writeFileSync(fixture.outputParent, "foreign parent file\n");
          preserved = () => assert.equal(
            readFileSync(fixture.outputParent, "utf8"),
            "foreign parent file\n",
          );
        } else if (scenario.name === "symlink") {
          const target = resolve(fixture.root, "foreign-output-parent");
          mkdirSync(target, { mode: 0o700 });
          const sentinel = resolve(target, "foreign.txt");
          writeFileSync(sentinel, "foreign symlink target\n");
          rmSync(fixture.outputParent, { recursive: true });
          symlinkSync(target, fixture.outputParent);
          preserved = () => {
            assert.equal(lstatSync(fixture.outputParent).isSymbolicLink(), true);
            assert.equal(readFileSync(sentinel, "utf8"), "foreign symlink target\n");
            assertNoStageTemporary(target);
          };
        } else if (scenario.name === "outside workspace") {
          outside = mkdtempSync(resolve(tmpdir(), "superzhao-stage-outside-"));
          chmodSync(outside, 0o700);
          const sentinel = resolve(outside, "foreign.txt");
          writeFileSync(sentinel, "foreign outside parent\n");
          outputDir = resolve(outside, "bundle");
          preserved = () => {
            assert.equal(readFileSync(sentinel, "utf8"), "foreign outside parent\n");
            assertNoStageTemporary(outside);
          };
        } else {
          const sentinel = resolve(fixture.outputParent, "foreign.txt");
          writeFileSync(sentinel, `foreign ${scenario.name}\n`);
          if (scenario.name === "non-private mode") chmodSync(fixture.outputParent, 0o755);
          preserved = () => {
            assert.equal(readFileSync(sentinel, "utf8"), `foreign ${scenario.name}\n`);
            assertNoStageTemporary(fixture.outputParent);
          };
        }

        const args = stageArgs(fixture, outputDir);
        const result = scenario.spoof
          ? runWithHook(
            fixture,
            args,
            spoofLstatFieldHook(fixture.outputParent, scenario.spoof),
          )
          : runCli(args);
        assert.equal(result.status, scenario.expected, result.stderr);
        assert.match(
          result.stderr,
          scenario.expected === 7
            ? /unsupported_preflight|private|device|writable|searchable/i
            : /unsafe_path_or_integrity|outside|physical|owned|unavailable/i,
        );
        assert.equal(existsSync(outputDir), false);
        preserved();
      } finally {
        if (outside) rmSync(outside, { recursive: true, force: true });
        fixture.cleanup();
      }
    });
  }
});

test("v3 stage classifies a restored output-parent cwd identity loss as integrity", () => {
  const fixture = makeV3CampaignFixture();
  const retainedParent = `${fixture.outputParent}.retained`;
  const foreignParent = `${fixture.outputParent}.foreign`;
  const sentinel = "foreign output-parent sentinel\n";
  try {
    const hook = `const childProcess = require("node:child_process");\n`
      + `const fs = require("node:fs");\n`
      + `const { syncBuiltinESMExports } = require("node:module");\n`
      + `const original = childProcess.spawnSync;\n`
      + `const protocol = "superzhao.skill-lab.anchored-publisher/v1";\n`
      + `const parent = ${JSON.stringify(fixture.outputParent)};\n`
      + `const retained = ${JSON.stringify(retainedParent)};\n`
      + `const foreign = ${JSON.stringify(foreignParent)};\n`
      + `const sentinel = ${JSON.stringify(sentinel)};\n`
      + `let injected = false;\n`
      + `childProcess.spawnSync = function(command, args, options) {\n`
      + `  let request;\n`
      + `  try { request = JSON.parse(String(options?.input ?? "")); } catch {}\n`
      + `  if (!injected && command === process.execPath && request?.protocol === protocol\n`
      + `      && request.action === "mkdir" && options?.cwd === parent) {\n`
      + `    injected = true;\n`
      + `    fs.renameSync(parent, retained);\n`
      + `    fs.writeFileSync(parent, sentinel);\n`
      + `    try {\n`
      + `      return original.call(this, command, args, options);\n`
      + `    } finally {\n`
      + `      fs.renameSync(parent, foreign);\n`
      + `      fs.renameSync(retained, parent);\n`
      + `    }\n`
      + `  }\n`
      + `  return original.call(this, command, args, options);\n`
      + `};\n`
      + `syncBuiltinESMExports();\n`;

    const result = runWithHook(fixture, stageArgs(fixture), hook);
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /unsafe_path_or_integrity|cwd|identity|retarget|ENOTDIR/i);
    assert.equal(readFileSync(foreignParent, "utf8"), sentinel);
    assert.equal(existsSync(fixture.outputDir), false);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage derives producer identity and bytes from a cache-like copied plugin", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const copied = materializeCopiedPlugin(fixture, {
      name: "superzhao-skill-lab",
      version: "9.8.7",
    });
    assert.notEqual(sha256(copied.copiedBytes), sha256(readFileSync(cli)));

    const result = runCliAt(copied.copiedCli, stageArgs(fixture));
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(
      readFileSync(resolve(fixture.outputDir, "manifest.json"), "utf8"),
    );
    const producerMapping = manifest.artifacts.find(
      (artifact) => artifact.kind === "producer-cli",
    );
    const producerFile = manifest.files.find(
      (file) => file.path === manifest.entrypoints.producer_cli,
    );
    const bundledBytes = readFileSync(
      resolve(fixture.outputDir, manifest.entrypoints.producer_cli),
    );
    const copiedDigest = sha256(copied.copiedBytes);
    assert.equal(manifest.producer.plugin_id, "superzhao-skill-lab");
    assert.equal(manifest.producer.plugin_version, "9.8.7");
    assert.equal(manifest.producer.cli_sha256, copiedDigest);
    assert.equal(manifest.producer.node_version, process.version);
    assert.equal(manifest.producer.platform, process.platform);
    assert.equal(manifest.producer.arch, process.arch);
    assert.equal(producerMapping.sha256, copiedDigest);
    assert.equal(producerFile.sha256, copiedDigest);
    assert.deepEqual(bundledBytes, copied.copiedBytes);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage keeps its early installed CLI binding through campaign reads", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const installed = materializeCopiedPlugin(fixture, {
      name: "superzhao-skill-lab",
      version: "9.8.7",
    });
    const original = readFileSync(installed.copiedCli, "utf8");
    const replacement = original.replace(
      "cache-like producer fixture 9.8.7",
      "cache-like producer fixture 9.8.8",
    );
    assert.notEqual(replacement, original);
    assert.equal(Buffer.byteLength(replacement), Buffer.byteLength(original));
    const hook = `const fs = require("node:fs");\n`
      + `const path = require("node:path");\n`
      + `const { syncBuiltinESMExports } = require("node:module");\n`
      + `const originalOpen = fs.openSync;\n`
      + `const trigger = ${JSON.stringify(fixture.gateReport)};\n`
      + `const target = ${JSON.stringify(installed.copiedCli)};\n`
      + `const replacement = Buffer.from(${JSON.stringify(Buffer.from(replacement).toString("base64"))}, "base64");\n`
      + `let changed = false;\n`
      + `fs.openSync = function(value, ...args) {\n`
      + `  const descriptor = originalOpen.call(this, value, ...args);\n`
      + `  if (!changed && path.resolve(String(value)) === trigger) {\n`
      + `    changed = true;\n`
      + `    fs.writeFileSync(target, replacement);\n`
      + `  }\n`
      + `  return descriptor;\n`
      + `};\n`
      + `syncBuiltinESMExports();\n`;

    const result = runWithHookAt(
      fixture.root,
      installed.copiedCli,
      stageArgs(fixture),
      hook,
    );
    assertVerifierIntegrityFailure(result);
    assert.match(result.stderr, /installed producer CLI|installed plugin|changed|binding/i);
    assert.equal(existsSync(fixture.outputDir), false);
    assertNoStageTemporary(fixture.outputParent);
  } finally {
    fixture.cleanup();
  }
});

test("v3 stage preserves selection rejection when the installed binding later differs", () => {
  const fixture = makeV3CampaignFixture({ mode: "selection_reject" });
  try {
    const installed = materializeCopiedPlugin(fixture, {
      name: "superzhao-skill-lab",
      version: "9.8.7",
    });
    const original = readFileSync(installed.copiedCli, "utf8");
    const replacement = original.replace(
      "cache-like producer fixture 9.8.7",
      "cache-like producer fixture 9.8.8",
    );
    assert.notEqual(replacement, original);
    const hook = `const fs = require("node:fs");\n`
      + `const path = require("node:path");\n`
      + `const { syncBuiltinESMExports } = require("node:module");\n`
      + `const originalOpen = fs.openSync;\n`
      + `const trigger = ${JSON.stringify(fixture.gateReport)};\n`
      + `const target = ${JSON.stringify(installed.copiedCli)};\n`
      + `const replacement = Buffer.from(${JSON.stringify(Buffer.from(replacement).toString("base64"))}, "base64");\n`
      + `let changed = false;\n`
      + `fs.openSync = function(value, ...args) {\n`
      + `  const descriptor = originalOpen.call(this, value, ...args);\n`
      + `  if (!changed && path.resolve(String(value)) === trigger) {\n`
      + `    changed = true;\n`
      + `    fs.writeFileSync(target, replacement);\n`
      + `  }\n`
      + `  return descriptor;\n`
      + `};\n`
      + `syncBuiltinESMExports();\n`;

    const result = runWithHookAt(
      fixture.root,
      installed.copiedCli,
      stageArgs(fixture),
      hook,
    );
    assert.equal(result.status, 4, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /selection/i);
    assert.equal(existsSync(fixture.outputDir), false);
  } finally {
    fixture.cleanup();
  }
});

test("installed producer reads revalidate the final manifest path", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const installed = materializeCopiedPlugin(fixture, {
      name: "superzhao-skill-lab",
      version: "9.8.7",
    });
    const replacementPath = resolve(fixture.root, "replacement-plugin-manifest.json");
    writeFileSync(
      replacementPath,
      `${JSON.stringify({ name: "superzhao-skill-lab", version: "9.8.8" }, null, 2)}\n`,
    );
    const hook = `const fs = require("node:fs");\n`
      + `const { syncBuiltinESMExports } = require("node:module");\n`
      + `const originalRead = fs.readSync;\n`
      + `const target = ${JSON.stringify(installed.manifestPath)};\n`
      + `const replacement = ${JSON.stringify(replacementPath)};\n`
      + `const identity = fs.lstatSync(target, { bigint: true });\n`
      + `let changed = false;\n`
      + `fs.readSync = function(fd, ...args) {\n`
      + `  const count = originalRead.call(this, fd, ...args);\n`
      + `  const opened = fs.fstatSync(fd, { bigint: true });\n`
      + `  if (!changed && opened.dev === identity.dev && opened.ino === identity.ino) {\n`
      + `    changed = true;\n`
      + `    fs.renameSync(replacement, target);\n`
      + `  }\n`
      + `  return count;\n`
      + `};\n`
      + `syncBuiltinESMExports();\n`;

    const result = runWithHookAt(
      fixture.root,
      installed.copiedCli,
      stageArgs(fixture),
      hook,
    );
    assertVerifierIntegrityFailure(result);
    assert.match(result.stderr, /installed plugin manifest|changed|binding/i);
    assert.equal(existsSync(fixture.outputDir), false);
  } finally {
    fixture.cleanup();
  }
});

test("v3 apply and gate run from a cache-like copied plugin path", () => {
  const fixture = makeV3CampaignFixture();
  try {
    const copied = materializeCopiedPlugin(fixture, {
      name: "superzhao-skill-lab",
      version: "9.8.7",
    });
    rmSync(fixture.candidate);
    rmSync(fixture.applyReport);
    rmSync(fixture.gateReport);

    const applyResult = runCliAt(copied.copiedCli, applyArgs(fixture));
    assert.equal(applyResult.status, 0, applyResult.stderr);
    assert.equal(existsSync(fixture.candidate), true);
    assert.equal(existsSync(fixture.applyReport), true);

    const gateResult = runCliAt(copied.copiedCli, gateArgs(fixture));
    assert.equal(gateResult.status, 0, gateResult.stderr);
    const report = JSON.parse(readFileSync(fixture.gateReport, "utf8"));
    assert.equal(report.selection.status, "selection_pass");
    assert.equal(report.final.status, "final_accept");
  } finally {
    fixture.cleanup();
  }
});

test("CLI has only built-in imports, no network or adoption path, and one anchored spawn", () => {
  const source = readFileSync(cli, "utf8");
  const specifiers = [
    ...source.matchAll(/\bfrom\s+["']([^"']+)["']/g),
    ...source.matchAll(/\brequire\(["']([^"']+)["']\)/g),
  ].map((match) => match[1]);
  assert.ok(specifiers.length > 0);
  assert.deepEqual(
    specifiers.filter((specifier) => !specifier.startsWith("node:")),
    [],
    "production CLI may import only Node built-ins",
  );
  for (const forbidden of [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    ".codex/sessions",
    "harvest",
    "node:http",
    "node:https",
    "node:net",
    "node:tls",
    ".claude",
    "fetch(",
  ]) {
    assert.doesNotMatch(
      source,
      new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      forbidden,
    );
  }
  assert.equal(source.match(/\bspawnSync\(/g)?.length, 1);
  assert.match(source, /spawnSync\(\s*process\.execPath,/);
  assert.match(source, /env:\s*\{\}/, "publisher child must not inherit NODE_OPTIONS");
  assert.doesNotMatch(source, /\bshell\s*:/);
  assert.doesNotMatch(
    source,
    /skillValidator\s*=\s*validateSkill\b/,
    "edit helpers must not retain the removed legacy validator as a default",
  );

  const result = runCli(["adopt"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown command/);
});

test("bundle artifact kind lookups use a prebuilt mapping index", () => {
  const source = readFileSync(cli, "utf8");
  const start = source.indexOf("  assertKind(path, digest, kind, label) {");
  const end = source.indexOf("\n  entrypoint(name)", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const assertKindBody = source.slice(start, end);
  assert.doesNotMatch(
    assertKindBody,
    /manifestIndex\.mappings\.filter|\.filter\s*\(/,
    "assertKind must not rescan the complete artifact mapping table",
  );
});

test("v3 stage rejects invalid adjacent producer manifests before output inspection", async (t) => {
  for (const scenario of [
    { name: "missing", expected: 3, manifest: undefined },
    { name: "symlinked", expected: 3, manifest: undefined, symlink: true },
    { name: "malformed", expected: 2, manifest: "{not json\n" },
    {
      name: "wrong plugin id",
      expected: 3,
      manifest: { name: "not-superzhao-skill-lab", version: "9.8.7" },
    },
    {
      name: "invalid version",
      expected: 2,
      manifest: { name: "superzhao-skill-lab", version: "9.8" },
    },
  ]) {
    await t.test(scenario.name, () => {
      const fixture = makeV3CampaignFixture();
      try {
        const copied = materializeCopiedPlugin(fixture, scenario.manifest);
        let symlinkTarget = null;
        if (scenario.symlink) {
          symlinkTarget = resolve(fixture.root, "foreign-plugin-manifest.json");
          writeFileSync(
            symlinkTarget,
            `${JSON.stringify({ name: "superzhao-skill-lab", version: "9.8.7" })}\n`,
          );
          symlinkSync(symlinkTarget, copied.manifestPath);
        }
        const reserved = reserveCallerOutput(fixture, `keep ${scenario.name} producer output\n`);

        const result = runCliAt(copied.copiedCli, stageArgs(fixture));
        assert.equal(result.status, scenario.expected, result.stderr);
        assert.match(result.stderr, /installed plugin manifest|JSON|plugin|version/i);
        assert.doesNotMatch(result.stderr, /already exists|publication_failure/i);
        assertCallerOutputPreserved(fixture, reserved);
        assertNoStageTemporary(fixture.outputParent);
        if (symlinkTarget) {
          assert.match(readFileSync(symlinkTarget, "utf8"), /superzhao-skill-lab/);
          assert.equal(lstatSync(copied.manifestPath).isSymbolicLink(), true);
        }
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("v3 stage rejects a manifest larger than 8 MiB before output inspection", () => {
  const fixture = makeV3CampaignFixture();
  try {
    inflateManifestPastInputLimit(fixture);
    mkdirSync(fixture.outputDir, { mode: 0o700 });
    const sentinel = resolve(fixture.outputDir, "owned-by-caller.txt");
    writeFileSync(sentinel, "keep oversized manifest output untouched\n");

    const result = runCli(stageArgs(fixture));
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /manifest.*8 MiB|8388608|input limit/i);
    assert.equal(readFileSync(sentinel, "utf8"), "keep oversized manifest output untouched\n");
    assert.equal(existsSync(resolve(fixture.outputDir, "manifest.json")), false);
  } finally {
    fixture.cleanup();
  }
});

test("v3 verify-bundle accepts a moved bundle after the producer workspace is deleted", () => {
  const moved = acceptedVerifierBundle();
    const manifestRaw = readFileSync(resolve(moved.bundle, "manifest.json"));
    const manifest = JSON.parse(manifestRaw);
    const plugin = JSON.parse(
      readFileSync(resolve(dirname(cli), "../.codex-plugin/plugin.json"), "utf8"),
    );
    const result = runCli(verifyBundleArgs(moved.bundle));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output, {
      manifest_sha256: sha256(manifestRaw),
      producer: manifest.producer,
      status: "final_accept",
      verifier: {
        plugin_id: "superzhao-skill-lab",
        plugin_version: plugin.version,
        cli_sha256: sha256(readFileSync(cli)),
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    });
    assert.equal(result.stdout, canonicalLine(output));
});

test("v3 verify-bundle binds the manifest read to the first full tree scan", () => {
  const moved = acceptedVerifierBundle();
  const copy = cloneBundle(moved.bundle, "manifest-read-scan-race");
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
    assertVerifierIntegrityFailure(
      runWithHook({ root: copy.root }, verifyBundleArgs(copy.bundle), hook),
    );
  } finally {
    rmSync(copy.root, { recursive: true, force: true });
  }
});

test("v3 verify-bundle rejects unsafe, special, missing, extra, and drifting trees", async (t) => {
  const moved = acceptedVerifierBundle();
    const manifest = readBundleManifest(moved.bundle).value;
    const payload = manifest.entrypoints.source;
    const cases = [
      {
        name: "missing payload",
        mutate(copy) { rmSync(resolve(copy.bundle, payload)); },
      },
      {
        name: "extra payload",
        mutate(copy) { writeFileSync(resolve(copy.bundle, "unexpected.bin"), "extra\n"); },
      },
      {
        name: "extra directory",
        mutate(copy) { mkdirSync(resolve(copy.bundle, "unexpected-directory")); },
      },
      {
        name: "unsafe tree name",
        mutate(copy) { writeFileSync(resolve(copy.bundle, "bad\nname"), "unsafe\n"); },
      },
      {
        name: "symlinked payload",
        mutate(copy) {
          const target = resolve(copy.root, "retained-source");
          cpSync(resolve(copy.bundle, payload), target);
          rmSync(resolve(copy.bundle, payload));
          symlinkSync(target, resolve(copy.bundle, payload));
        },
      },
      {
        name: "symlinked payload parent",
        mutate(copy) {
          const parent = resolve(copy.bundle, dirname(payload));
          const target = resolve(copy.root, "retained-skills");
          cpSync(parent, target, { recursive: true });
          rmSync(parent, { recursive: true });
          symlinkSync(target, parent);
        },
      },
      {
        name: "symlinked manifest",
        mutate(copy) {
          const manifestPath = resolve(copy.bundle, "manifest.json");
          const target = resolve(copy.root, "retained-manifest.json");
          cpSync(manifestPath, target);
          rmSync(manifestPath);
          symlinkSync(target, manifestPath);
        },
      },
      {
        name: "symlinked bundle root",
        mutate(copy) {
          copy.verifyPath = resolve(copy.root, "bundle-link");
          symlinkSync(copy.bundle, copy.verifyPath);
        },
      },
      {
        name: "payload byte drift",
        mutate(copy) { writeFileSync(resolve(copy.bundle, payload), "drifted bytes\n"); },
      },
      {
        name: "declared hash drift",
        mutate(copy) {
          rewriteBundleManifest(copy.bundle, (value) => {
            value.files.find((file) => file.path === payload).sha256 = "0".repeat(64);
          });
        },
      },
      {
        name: "unsafe declared path",
        mutate(copy) {
          rewriteBundleManifest(copy.bundle, (value) => {
            value.files.find((file) => file.path === payload).path = "../outside";
          });
        },
      },
    ];

    for (const scenario of cases) {
      await t.test(scenario.name, () => {
        const copy = cloneBundle(moved.bundle, scenario.name.replaceAll(" ", "-"));
        try {
          scenario.mutate(copy);
          assertVerifierIntegrityFailure(
            runCli(verifyBundleArgs(copy.verifyPath ?? copy.bundle)),
          );
        } finally {
          rmSync(copy.root, { recursive: true, force: true });
        }
      });
    }

    await t.test("FIFO payload", (subtest) => {
      const copy = cloneBundle(moved.bundle, "fifo");
      try {
        const path = resolve(copy.bundle, payload);
        rmSync(path);
        const created = spawnSync("mkfifo", [path], { encoding: "utf8" });
        if (created.status !== 0) {
          subtest.skip(`mkfifo unavailable: ${created.stderr || created.error?.message}`);
          return;
        }
        assertVerifierIntegrityFailure(runCli(verifyBundleArgs(copy.bundle)));
      } finally {
        rmSync(copy.root, { recursive: true, force: true });
      }
    });

    await t.test("tree changes after initial enumeration", () => {
      const copy = cloneBundle(moved.bundle, "tree-drift-race");
      try {
        const target = resolve(copy.bundle, payload);
        const extra = resolve(copy.bundle, "late-extra.bin");
        const hook = `const fs = require("node:fs");\n`
          + `const path = require("node:path");\n`
          + `const { syncBuiltinESMExports } = require("node:module");\n`
          + `const original = fs.openSync;\n`
          + `const target = ${JSON.stringify(target)};\n`
          + `const extra = ${JSON.stringify(extra)};\n`
          + `let changed = false;\n`
          + `fs.openSync = function(value, ...args) {\n`
          + `  const descriptor = original.call(this, value, ...args);\n`
          + `  if (!changed && path.resolve(String(value)) === target) {\n`
          + `    changed = true;\n`
          + `    fs.writeFileSync(extra, "late tree drift\\n");\n`
          + `  }\n`
          + `  return descriptor;\n`
          + `};\n`
          + `syncBuiltinESMExports();\n`;
        assertVerifierIntegrityFailure(
          runWithHook({ root: copy.root }, verifyBundleArgs(copy.bundle), hook),
        );
      } finally {
        rmSync(copy.root, { recursive: true, force: true });
      }
    });
});

test("v3 verify-bundle rejects duplicate, swapped, and wrong-kind manifest mappings", async (t) => {
  const moved = acceptedVerifierBundle();
    const scenarios = [
      {
        name: "duplicate mapping",
        mutate(manifest) { manifest.artifacts.push(structuredClone(manifest.artifacts[0])); },
      },
      {
        name: "swapped entrypoints",
        mutate(manifest) {
          [manifest.entrypoints.source, manifest.entrypoints.candidate] = [
            manifest.entrypoints.candidate,
            manifest.entrypoints.source,
          ];
        },
      },
      {
        name: "wrong-kind graph mapping",
        mutate(manifest) {
          const actor = mappingOfKind(manifest, "actor-profile");
          const environment = mappingOfKind(manifest, "environment");
          [actor.kind, environment.kind] = [environment.kind, actor.kind];
        },
      },
      {
        name: "conflicting logical source mapping",
        mutate(manifest) {
          const actor = mappingOfKind(manifest, "actor-profile");
          const other = structuredClone(actor);
          other.packaged_path = manifest.entrypoints.candidate;
          other.sha256 = manifest.files.find(
            (file) => file.path === other.packaged_path,
          ).sha256;
          manifest.artifacts.push(other);
        },
      },
    ];
    for (const scenario of scenarios) {
      await t.test(scenario.name, () => {
        const copy = cloneBundle(moved.bundle, scenario.name.replaceAll(" ", "-"));
        try {
          rewriteBundleManifest(copy.bundle, scenario.mutate);
          assertVerifierIntegrityFailure(runCli(verifyBundleArgs(copy.bundle)));
        } finally {
          rmSync(copy.root, { recursive: true, force: true });
        }
      });
    }
});

test("v3 verify-bundle rejects coherently rehashed semantic payload tampering", async (t) => {
  const moved = acceptedVerifierBundle();
    for (const kind of [
      "patch",
      "candidate-skill",
      "prior-rejection",
      "actor-run",
      "scorer-record",
      "apply-report",
      "gate-report",
    ]) {
      await t.test(kind, () => {
        const copy = cloneBundle(moved.bundle, `tamper-${kind}`);
        try {
          coherentlyRehashPayload(copy.bundle, kind, (bytes) => Buffer.concat([
            bytes,
            Buffer.from(" \n"),
          ]));
          assertVerifierIntegrityFailure(runCli(verifyBundleArgs(copy.bundle)));
        } finally {
          rmSync(copy.root, { recursive: true, force: true });
        }
      });
    }
});

test("v3 verify-bundle accepts exactly 64 MiB of trusted campaign evidence and rejects one more byte", () => {
  const moved = acceptedVerifierBundle();
  const copy = cloneBundle(moved.bundle, "campaign-size-boundary");
  try {
    const limit = 64 * 1024 * 1024;
    const exact = resizeCampaignToExactLimit(copy.bundle, limit);
    assert.equal(exact.oracle.bytes, BigInt(limit));
    assert.ok(
      exact.oracle.includedMappings > exact.oracle.uniquePhysical,
      "the oracle fixture must reuse at least one included physical payload",
    );
    const accepted = runCli(verifyBundleArgs(copy.bundle));
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(JSON.parse(accepted.stdout).status, "final_accept");

    writeSizedPriorRejections(copy.bundle, [
      ...exact.sizes.slice(0, -1),
      exact.sizes.at(-1) + 1,
    ]);
    const overflow = trustedCampaignOracle(copy.bundle);
    assert.equal(overflow.bytes, BigInt(limit + 1));
    const rejected = runCli(verifyBundleArgs(copy.bundle));
    assertVerifierIntegrityFailure(rejected);
    assert.match(rejected.stderr, /64 MiB|67108864|aggregate campaign/i);
  } finally {
    rmSync(copy.root, { recursive: true, force: true });
  }
});

test("v3 stage accepts an exact 96 MiB plan and rejects one more planned byte", () => {
  const exact = exact96Fixture();
  assert.equal(exact.plan.bundleBytes, TEST_MAX_BUNDLE_BYTES);
  assert.equal(exact.actual.bytes, TEST_MAX_BUNDLE_BYTES);
  assert.ok(exact.plan.campaignBytes <= TEST_MAX_CAMPAIGN_BYTES);
  assert.ok(exact.campaign.bytes <= BigInt(TEST_MAX_CAMPAIGN_BYTES));
  assert.ok(exact.plan.maxFileBytes <= TEST_MAX_INPUT_BYTES);
  assert.equal(exact.stageResult.stderr, "");
  assert.match(exact.stageResult.stdout, /^[0-9a-f]{64}\n$/);

  rmSync(exact.fixture.outputDir, { recursive: true, force: true });
  exact.applyCurrentPatch(exact.lastSize + 1);
  const overflowPlan = expectedStagePlanOracle(
    exact.fixture,
    exact.installed.copiedBytes,
  );
  assert.equal(overflowPlan.bundleBytes, TEST_MAX_BUNDLE_BYTES + 1);
  assert.ok(overflowPlan.campaignBytes <= TEST_MAX_CAMPAIGN_BYTES);
  assert.ok(overflowPlan.maxFileBytes <= TEST_MAX_INPUT_BYTES);

  const rejected = runCliAt(
    exact.installed.copiedCli,
    stageArgs(exact.fixture),
  );
  assert.equal(rejected.status, 2, rejected.stderr);
  assert.equal(rejected.stdout, "");
  assert.match(rejected.stderr, /96 MiB|100663296|maximum/i);
  assert.equal(existsSync(exact.fixture.outputDir), false);
  assertNoStageTemporary(exact.fixture.outputParent);
});

test("v3 verify-bundle accepts an actual 96 MiB tree and rejects a coherent excluded byte", () => {
  const exact = exact96Fixture();
  const accepted = runCli(verifyBundleArgs(exact.retainedBundle));
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(accepted.stderr, "");
  assert.equal(JSON.parse(accepted.stdout).status, "final_accept");

  const overflow = cloneBundle(exact.retainedBundle, "exact96-plus-one");
  try {
    const beforeCampaign = trustedCampaignOracle(overflow.bundle);
    coherentlyRehashPayload(
      overflow.bundle,
      "producer-cli",
      (bytes) => Buffer.concat([bytes, Buffer.from("x")]),
    );
    const actual = actualBundleOracle(overflow.bundle);
    const afterCampaign = trustedCampaignOracle(overflow.bundle);
    assert.equal(actual.bytes, TEST_MAX_BUNDLE_BYTES + 1);
    assert.equal(afterCampaign.bytes, beforeCampaign.bytes);
    assert.ok(afterCampaign.bytes <= BigInt(TEST_MAX_CAMPAIGN_BYTES));

    const rejected = runCli(verifyBundleArgs(overflow.bundle));
    assertVerifierIntegrityFailure(rejected);
    assert.match(rejected.stderr, /96 MiB|100663296|maximum/i);
  } finally {
    rmSync(overflow.root, { recursive: true, force: true });
  }
});

test("v3 verify-bundle treats coherently rehashed malicious producer bytes as inert provenance", () => {
  const moved = acceptedVerifierBundle();
  const copy = cloneBundle(moved.bundle, "malicious-producer");
  try {
    const producerSentinel = resolve(copy.root, "producer-executed");
    const spawnSentinel = resolve(copy.root, "spawn-attempted");
    const malicious = Buffer.from(
      `import { writeFileSync } from "node:fs";\n`
      + `writeFileSync(${JSON.stringify(producerSentinel)}, "executed\\n");\n`
      + `throw new Error("bundled producer must stay inert");\n`,
    );
    coherentlyRehashPayload(copy.bundle, "producer-cli", malicious);
    const hook = `const childProcess = require("node:child_process");\n`
      + `const fs = require("node:fs");\n`
      + `const { syncBuiltinESMExports } = require("node:module");\n`
      + `const sentinel = ${JSON.stringify(spawnSentinel)};\n`
      + `const blocked = function() { fs.writeFileSync(sentinel, "spawned\\n");`
      + ` throw new Error("verification must not spawn bundled code"); };\n`
      + `childProcess.spawnSync = blocked;\n`
      + `childProcess.execFileSync = blocked;\n`
      + `childProcess.execSync = blocked;\n`
      + `syncBuiltinESMExports();\n`;
    const result = runWithHook(
      { root: copy.root },
      verifyBundleArgs(copy.bundle),
      hook,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.equal(existsSync(producerSentinel), false);
    assert.equal(existsSync(spawnSentinel), false);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, "final_accept");
    assert.equal(output.producer.cli_sha256, sha256(malicious));
    assert.equal(output.verifier.cli_sha256, sha256(readFileSync(cli)));
  } finally {
    rmSync(copy.root, { recursive: true, force: true });
  }
});

test("v3 verify-bundle derives verifier identity from a cache-like installed plugin", () => {
  const moved = acceptedVerifierBundle();
  const copy = cloneBundle(moved.bundle, "cache-verifier");
  try {
    const installed = materializeCopiedPlugin(
      { root: copy.root },
      { name: "superzhao-skill-lab", version: "9.8.7" },
    );
    const result = runCliAt(installed.copiedCli, verifyBundleArgs(copy.bundle));
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(result.stdout, canonicalLine(output));
    assert.equal(output.status, "final_accept");
    assert.equal(output.verifier.plugin_id, "superzhao-skill-lab");
    assert.equal(output.verifier.plugin_version, "9.8.7");
    assert.equal(output.verifier.cli_sha256, sha256(installed.copiedBytes));
    assert.equal(output.verifier.node_version, process.version);
    assert.equal(output.verifier.platform, process.platform);
    assert.equal(output.verifier.arch, process.arch);
    assert.notDeepEqual(output.verifier, output.producer);
  } finally {
    rmSync(copy.root, { recursive: true, force: true });
  }
});

test("v3 verify-bundle keeps its early installed manifest binding through bundle scans", () => {
  const moved = acceptedVerifierBundle();
  const copy = cloneBundle(moved.bundle, "verifier-installed-binding");
  try {
    const installed = materializeCopiedPlugin(
      { root: copy.root },
      { name: "superzhao-skill-lab", version: "9.8.7" },
    );
    const replacementPath = resolve(copy.root, "replacement-plugin-manifest.json");
    writeFileSync(
      replacementPath,
      `${JSON.stringify({ name: "superzhao-skill-lab", version: "9.8.8" }, null, 2)}\n`,
    );
    assert.equal(
      readFileSync(replacementPath).length,
      readFileSync(installed.manifestPath).length,
    );
    const hook = `const fs = require("node:fs");\n`
      + `const path = require("node:path");\n`
      + `const { syncBuiltinESMExports } = require("node:module");\n`
      + `const originalReaddir = fs.readdirSync;\n`
      + `const bundle = ${JSON.stringify(copy.bundle)};\n`
      + `const target = ${JSON.stringify(installed.manifestPath)};\n`
      + `const replacement = ${JSON.stringify(replacementPath)};\n`
      + `let changed = false;\n`
      + `fs.readdirSync = function(value, ...args) {\n`
      + `  const result = originalReaddir.call(this, value, ...args);\n`
      + `  if (!changed && path.resolve(String(value)) === bundle) {\n`
      + `    changed = true;\n`
      + `    fs.renameSync(replacement, target);\n`
      + `  }\n`
      + `  return result;\n`
      + `};\n`
      + `syncBuiltinESMExports();\n`;

    const result = runWithHookAt(
      copy.root,
      installed.copiedCli,
      verifyBundleArgs(copy.bundle),
      hook,
    );
    assertVerifierIntegrityFailure(result);
    assert.match(result.stderr, /installed plugin manifest|changed|binding/i);
  } finally {
    rmSync(copy.root, { recursive: true, force: true });
  }
});
