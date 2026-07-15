import assert from "node:assert/strict";
import {
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  canonicalJson,
  doctorArgs,
  makeFixture,
  runCli,
  runWithHook,
} from "./helpers.mjs";

const EXIT_CODES = {
  success: 0,
  usage_or_schema: 2,
  unsafe_path_or_integrity: 3,
  selection_rejection: 4,
  final_rejection: 5,
  publication_failure: 6,
  unsupported_preflight: 7,
};

test("doctor reports the exact runtime/limit/exit contract and leaves no probe", () => {
  const f = makeFixture();
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = runCli(doctorArgs(f));
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      const report = JSON.parse(result.stdout);
      assert.equal(result.stdout, `${canonicalJson(report)}\n`);
      assert.equal(report.schema, "superzhao.skill-lab.doctor-report/v3");
      assert.equal(report.status, "ready");
      assert.ok([20, 22].includes(report.runtime.node_major));
      assert.ok(["darwin", "linux"].includes(report.runtime.platform));
      assert.deepEqual(report.exit_codes, EXIT_CODES);
      assert.deepEqual(report.limits, {
        max_bundle_bytes: 96 * 1024 * 1024,
        max_campaign_bytes: 64 * 1024 * 1024,
        max_input_bytes: 8 * 1024 * 1024,
        max_sample_rows: 1000,
        required_valid_max: 20,
        required_valid_min: 5,
      });
      assert.deepEqual(report.checks, {
        hard_link: true,
        output_parent_contained: true,
        output_parent_private: true,
        probe_cleaned: true,
        same_device: true,
        workspace_physical: true,
      });
      assert.deepEqual(readdirSync(f.outputParent), [], "probe directory must be cleaned");
    }
  } finally {
    f.cleanup();
  }
});

test("doctor supports Node 20 on Linux and rejects unsupported runtime/platform with exit 7", () => {
  for (const [label, version, platform, expected] of [
    ["supported Node 20 Linux", "v20.19.5", "linux", 0],
    ["unsupported Node 19", "v19.9.0", "darwin", 7],
    ["unsupported Node 23", "v23.1.0", "linux", 7],
    ["unsupported Windows", "v22.22.2", "win32", 7],
  ]) {
    const f = makeFixture();
    try {
      const hook = `Object.defineProperty(process, "version", { value: ${JSON.stringify(version)} });\n`
        + `Object.defineProperty(process, "platform", { value: ${JSON.stringify(platform)} });\n`;
      const result = runWithHook(f, doctorArgs(f), hook);
      assert.equal(result.status, expected, `${label}: ${result.stderr}`);
      if (expected === 0) {
        const report = JSON.parse(result.stdout);
        assert.equal(report.runtime.node_major, 20);
        assert.equal(report.runtime.platform, "linux");
      } else {
        assert.equal(result.stdout, "", `${label} must not emit a success report`);
        assert.match(result.stderr, /unsupported_preflight|runtime|platform|Node/i);
      }
      assert.deepEqual(readdirSync(f.outputParent), [], `${label} probe cleanup`);
    } finally {
      f.cleanup();
    }
  }
});

test("doctor rejects outside and symlinked output parents as unsafe paths", () => {
  const outside = mkdtempSync(resolve(tmpdir(), "superzhao-skill-lab-doctor-outside-"));
  const f = makeFixture();
  try {
    const link = resolve(f.root, "linked-output");
    symlinkSync(outside, link);
    for (const [label, output] of [["outside", outside], ["symlink", link]]) {
      const result = runCli(doctorArgs(f, output));
      assert.equal(result.status, 3, `${label}: ${result.stderr}`);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /unsafe_path|outside|symbolic|physical|contain/i);
      assert.deepEqual(readdirSync(f.outputParent), []);
    }
  } finally {
    f.cleanup();
    rmSync(outside, { recursive: true, force: true });
  }
});

test("doctor reports same-device and hard-link capability failures as exit 7 and cleans probes", () => {
  for (const [label, hook] of [
    [
      "hard-link unavailable",
      `const fs = require("node:fs");\n`
        + `const { syncBuiltinESMExports } = require("node:module");\n`
        + `fs.linkSync = function() { const error = new Error("hard links disabled"); error.code = "EPERM"; throw error; };\n`
        + `syncBuiltinESMExports();\n`,
    ],
    [
      "same-device mismatch",
      `const fs = require("node:fs");\n`
        + `const { syncBuiltinESMExports } = require("node:module");\n`
        + `const original = fs.lstatSync;\n`
        + `const output = OUTPUT_PARENT;\n`
        + `fs.lstatSync = function(path, ...args) {\n`
        + `  const stat = original.call(this, path, ...args);\n`
        + `  if (String(path) === output) Object.defineProperty(stat, "dev", { value: stat.dev + 1 });\n`
        + `  return stat;\n`
        + `};\n`
        + `syncBuiltinESMExports();\n`,
    ],
  ]) {
    const f = makeFixture();
    try {
      const source = hook.replace("OUTPUT_PARENT", JSON.stringify(f.outputParent));
      const result = runWithHook(f, doctorArgs(f), source);
      assert.equal(result.status, 7, `${label}: ${result.stderr}`);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /unsupported_preflight|hard.?link|device|filesystem/i);
      assert.deepEqual(readdirSync(f.outputParent), [], `${label} must clean its probe`);
    } finally {
      f.cleanup();
    }
  }
});

test("doctor rejects missing, duplicate, and unknown options with usage exit 2", () => {
  const f = makeFixture();
  try {
    for (const args of [
      ["doctor", "--workspace-root", f.root],
      [...doctorArgs(f), "--workspace-root", f.root],
      [...doctorArgs(f), "--unexpected", "value"],
    ]) {
      const result = runCli(args);
      assert.equal(result.status, 2, result.stderr);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /usage_or_schema|missing|duplicate|unknown|option/i);
      assert.deepEqual(readdirSync(f.outputParent), []);
    }
  } finally {
    f.cleanup();
  }
});
