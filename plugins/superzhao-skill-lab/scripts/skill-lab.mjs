#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

const HARD_MAX_EDITS = 4;
const HARD_MAX_EDIT_BYTES = 4096;
const HARD_MAX_PATCH_BYTES = 8192;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_CAMPAIGN_BYTES = 64 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 96 * 1024 * 1024;
const MAX_SAMPLE_ROWS = 1000;
const MIN_REQUIRED_VALID = 5;
const MAX_REQUIRED_VALID = 20;
const PATCH_SCHEMA_V3 = "superzhao.skill-lab.patch/v3";
const ANCHORED_PUBLISHER_PROTOCOL = "superzhao.skill-lab.anchored-publisher/v1";
const ANCHORED_PUBLISHER_SOURCE = String.raw`
"use strict";
const {
  closeSync,
  constants,
  fstatSync,
  linkSync,
  lstatSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} = require("node:fs");

const PROTOCOL = "superzhao.skill-lab.anchored-publisher/v1";

class PublisherError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function fail(status, message) {
  throw new PublisherError(status, message);
}

function requireBasename(value, label) {
  if (typeof value !== "string" || value.length === 0 || value === "." || value === ".."
      || value.includes("/") || value.includes("\0")) {
    fail("unsafe_path_or_integrity", label + " must be a relative basename");
  }
  return value;
}

function parseIdentity(value, label) {
  if (!value || typeof value !== "object"
      || !/^(0|[1-9][0-9]*)$/.test(value.dev)
      || !/^(0|[1-9][0-9]*)$/.test(value.ino)) {
    fail("unsafe_path_or_integrity", label + " identity is malformed");
  }
  const identity = { dev: BigInt(value.dev), ino: BigInt(value.ino) };
  if (identity.ino === 0n) fail("unsafe_path_or_integrity", label + " inode is unavailable");
  return identity;
}

function sameIdentity(stat, expected) {
  return stat.dev === expected.dev && stat.ino === expected.ino && stat.ino !== 0n;
}

function lstatRelative(name) {
  try {
    return lstatSync(name, { bigint: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function anchorWorkingDirectory(request) {
  const expected = parseIdentity(request.expected_parent, "output parent");
  let descriptor;
  try {
    descriptor = openSync(
      ".",
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const actual = fstatSync(descriptor, { bigint: true });
    if (!actual.isDirectory() || !sameIdentity(actual, expected)) {
      fail(
        "unsafe_path_or_integrity",
        "output parent working-directory identity does not match the verified parent",
      );
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function requireOwned(name, expected, label) {
  const stat = lstatRelative(name);
  if (!stat || stat.isSymbolicLink() || !stat.isFile() || !sameIdentity(stat, expected)) {
    fail("unsafe_path_or_integrity", label + " physical identity changed");
  }
  return stat;
}

function unlinkOwned(name, expected) {
  const stat = lstatRelative(name);
  if (!stat || stat.isSymbolicLink() || !stat.isFile() || !sameIdentity(stat, expected)) {
    return "foreign";
  }
  unlinkSync(name);
  return "removed";
}

function createTemporary(request) {
  const name = requireBasename(request.name, "temporary source");
  if (typeof request.content !== "string") {
    fail("publication_failure", "temporary source content is malformed");
  }
  const bytes = Buffer.from(request.content, "base64");
  if (bytes.toString("base64") !== request.content) {
    fail("publication_failure", "temporary source content is not canonical base64");
  }
  anchorWorkingDirectory(request);
  let descriptor;
  let identity;
  let failure;
  try {
    descriptor = openSync(
      name,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.ino === 0n) {
      fail("unsafe_path_or_integrity", "temporary source is not a regular file");
    }
    identity = { dev: before.dev, ino: before.ino };
    writeFileSync(descriptor, bytes);
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameIdentity(after, identity)) {
      fail("unsafe_path_or_integrity", "temporary source identity changed during write");
    }
  } catch (error) {
    failure = error;
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch (error) {
        failure ??= error;
      }
    }
  }
  if (failure) {
    if (identity) {
      try { unlinkOwned(name, identity); } catch {}
    }
    throw failure;
  }
  try {
    requireOwned(name, identity, "temporary source");
  } catch (error) {
    try { unlinkOwned(name, identity); } catch {}
    throw error;
  }
  return { dev: identity.dev.toString(), ino: identity.ino.toString() };
}

function publishLink(request) {
  const source = requireBasename(request.source, "temporary source");
  const destination = requireBasename(request.destination, "output");
  const expected = parseIdentity(request.expected_file, "temporary source");
  anchorWorkingDirectory(request);
  requireOwned(source, expected, "temporary source");
  if (lstatRelative(destination)) {
    fail("publication_failure", "output already exists");
  }
  let linked = false;
  try {
    linkSync(source, destination);
    linked = true;
    requireOwned(destination, expected, "published output");
  } catch (error) {
    if (linked) {
      try { unlinkOwned(destination, expected); } catch {}
    }
    throw error;
  }
  return "linked";
}

function inspectOwned(request) {
  const name = requireBasename(request.name, "owned file");
  const expected = parseIdentity(request.expected_file, "owned file");
  anchorWorkingDirectory(request);
  const stat = lstatRelative(name);
  if (!stat) return "absent";
  if (stat.isSymbolicLink() || !stat.isFile() || !sameIdentity(stat, expected)) return "foreign";
  return "owned";
}

function removeOwned(request) {
  const name = requireBasename(request.name, "owned file");
  const expected = parseIdentity(request.expected_file, "owned file");
  anchorWorkingDirectory(request);
  return unlinkOwned(name, expected);
}

function main() {
  try {
    const request = JSON.parse(readFileSync(0, "utf8"));
    if (!request || request.protocol !== PROTOCOL) {
      fail("unsafe_path_or_integrity", "anchored publisher protocol is invalid");
    }
    let result;
    if (request.action === "create") result = createTemporary(request);
    else if (request.action === "link") result = publishLink(request);
    else if (request.action === "inspect") result = inspectOwned(request);
    else if (request.action === "unlink") result = removeOwned(request);
    else fail("unsafe_path_or_integrity", "anchored publisher action is invalid");
    process.stdout.write(JSON.stringify({ ok: true, result }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      status: error instanceof PublisherError ? error.status : "publication_failure",
      message: error instanceof Error ? error.message : String(error),
    }));
  }
}

main();
`;
const APPLY_REPORT_SCHEMA_V3 = "superzhao.skill-lab.apply-report/v3";
const DOCTOR_REPORT_SCHEMA_V3 = "superzhao.skill-lab.doctor-report/v3";
const EXIT_CODES = Object.freeze({
  success: 0,
  usage_or_schema: 2,
  unsafe_path_or_integrity: 3,
  selection_rejection: 4,
  final_rejection: 5,
  publication_failure: 6,
  unsupported_preflight: 7,
});
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const FAILURE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const EDIT_OPS = new Set(["append", "insert_after", "replace", "delete"]);
const OUTCOMES = new Set(["pass", "fail", "invalid", "indeterminate"]);
const SPLITS = new Set(["train", "selection", "test"]);
const CASE_TYPES = new Set(["important", "control"]);
const ARMS = new Set(["current", "candidate"]);
const PROTECTED_MARKERS = [
  ["<!-- SLOW_UPDATE_START -->", "<!-- SLOW_UPDATE_END -->"],
  ["<!-- APPENDIX_START -->", "<!-- APPENDIX_END -->"],
  ["<!-- SKILL_LAB_PROTECTED_START -->", "<!-- SKILL_LAB_PROTECTED_END -->"],
];
const ALL_MARKERS = PROTECTED_MARKERS.flat();

class CliError extends Error {
  constructor(
    message,
    exitCode = EXIT_CODES.usage_or_schema,
    status = exitCode === EXIT_CODES.usage_or_schema ? "usage_or_schema" : null,
  ) {
    super(message);
    this.exitCode = exitCode;
    this.status = status;
  }
}

function classifiedError(status, message) {
  return new CliError(message, EXIT_CODES[status], status);
}

function reclassify(error, status) {
  const message = error instanceof Error ? error.message : String(error);
  return classifiedError(status, message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validateRuntime() {
  const match = /^v(\d+)\./.exec(process.version);
  const nodeMajor = match ? Number(match[1]) : NaN;
  if (!new Set([20, 22]).has(nodeMajor)) {
    throw classifiedError(
      "unsupported_preflight",
      `unsupported Node.js runtime ${process.version}; expected major 20 or 22`,
    );
  }
  if (!new Set(["darwin", "linux"]).has(process.platform)) {
    throw classifiedError(
      "unsupported_preflight",
      `unsupported platform ${process.platform}; expected darwin or linux`,
    );
  }
  return {
    node_major: nodeMajor,
    node_version: process.version,
    platform: process.platform,
    architecture: process.arch,
  };
}

function asciiCompare(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(value).sort(asciiCompare);
  const wanted = [...expected].sort(asciiCompare);
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new CliError(`${label} must contain exactly: ${wanted.join(", ")}`);
  }
}

function decodeUtf8(buffer, label) {
  if (buffer.length >= 3
      && buffer[0] === 0xef
      && buffer[1] === 0xbb
      && buffer[2] === 0xbf) {
    throw new CliError(`${label} must not begin with a UTF-8 BOM`);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new CliError(`${label} is not valid UTF-8`);
  }
}

function hasUnsupportedFrontmatterCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f
        || (codePoint >= 0x7f && codePoint <= 0x9f)
        || codePoint === 0x2028
        || codePoint === 0x2029
        || (codePoint >= 0xd800 && codePoint <= 0xdfff)
        || (codePoint >= 0xfdd0 && codePoint <= 0xfdef)
        || (codePoint & 0xffff) === 0xfffe
        || (codePoint & 0xffff) === 0xffff) {
      return true;
    }
  }
  return false;
}

function rejectDuplicateJsonKeys(text, label) {
  let cursor = 0;

  function fail(message) {
    throw new CliError(`${label} ${message} at byte ${Buffer.byteLength(text.slice(0, cursor))}`);
  }

  function skipWhitespace() {
    while (/\s/.test(text[cursor] ?? "")) cursor += 1;
  }

  function parseString() {
    if (text[cursor] !== '"') fail("contains malformed JSON");
    const start = cursor;
    cursor += 1;
    while (cursor < text.length) {
      if (text[cursor] === '"') {
        cursor += 1;
        try {
          return JSON.parse(text.slice(start, cursor));
        } catch {
          fail("contains a malformed JSON string");
        }
      }
      if (text[cursor] === "\\") {
        cursor += 2;
      } else {
        cursor += 1;
      }
    }
    fail("contains an unterminated JSON string");
  }

  function parseObject() {
    cursor += 1;
    skipWhitespace();
    const keys = new Set();
    if (text[cursor] === "}") {
      cursor += 1;
      return;
    }
    while (cursor < text.length) {
      const key = parseString();
      if (keys.has(key)) throw new CliError(`${label} contains duplicate JSON key: ${key}`);
      keys.add(key);
      skipWhitespace();
      if (text[cursor] !== ":") fail("contains malformed JSON");
      cursor += 1;
      parseValue();
      skipWhitespace();
      if (text[cursor] === "}") {
        cursor += 1;
        return;
      }
      if (text[cursor] !== ",") fail("contains malformed JSON");
      cursor += 1;
      skipWhitespace();
    }
    fail("contains an unterminated JSON object");
  }

  function parseArray() {
    cursor += 1;
    skipWhitespace();
    if (text[cursor] === "]") {
      cursor += 1;
      return;
    }
    while (cursor < text.length) {
      parseValue();
      skipWhitespace();
      if (text[cursor] === "]") {
        cursor += 1;
        return;
      }
      if (text[cursor] !== ",") fail("contains malformed JSON");
      cursor += 1;
      skipWhitespace();
    }
    fail("contains an unterminated JSON array");
  }

  function parseValue() {
    skipWhitespace();
    if (text[cursor] === "{") return parseObject();
    if (text[cursor] === "[") return parseArray();
    if (text[cursor] === '"') {
      parseString();
      return;
    }
    const start = cursor;
    while (cursor < text.length && !/[\s,}\]]/.test(text[cursor])) cursor += 1;
    if (cursor === start) fail("contains malformed JSON");
  }

  parseValue();
  skipWhitespace();
  if (cursor !== text.length) fail("contains trailing JSON content");
}

function parseOptions(tokens) {
  const options = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (!flag?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new CliError(`expected --name value pairs; got ${flag ?? "end of input"}`);
    }
    const name = flag.slice(2);
    if (options.has(name)) throw new CliError(`duplicate option --${name}`);
    options.set(name, value);
  }
  return options;
}

function requireOptions(options, required) {
  const allowed = new Set(required);
  for (const name of options.keys()) {
    if (!allowed.has(name)) throw new CliError(`unknown option --${name}`);
  }
  for (const name of required) {
    if (!options.has(name)) throw new CliError(`missing required option --${name}`);
  }
  return Object.fromEntries(options);
}

function readRegularFile(path, label) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    throw new CliError(`${label} does not exist: ${path}`);
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new CliError(`${label} must be a physical regular file: ${path}`);
  }
  return readFileSync(path);
}

function parseJson(buffer, label) {
  try {
    const text = decodeUtf8(buffer, label);
    rejectDuplicateJsonKeys(text, label);
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("top-level value must be an object");
    }
    return value;
  } catch (error) {
    throw new CliError(`${label} is not valid JSON: ${error.message}`);
  }
}

function assertNewPhysicalOutput(path, inputs, label) {
  const absolute = resolve(path);
  if (inputs.some((input) => resolve(input) === absolute)) {
    throw new CliError(`${label} cannot overwrite an input file`);
  }
  if (existsSync(absolute)) throw new CliError(`${label} already exists: ${path}`);
  const parent = dirname(absolute);
  let stat;
  try {
    stat = lstatSync(parent);
  } catch {
    throw new CliError(`${label} parent directory does not exist: ${parent}`);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new CliError(`${label} parent must be a physical directory: ${parent}`);
  }
}

function writeNewFile(path, value) {
  assertNewPhysicalOutput(path, [], "output file");
  let tempDir;
  let temp;
  let published = false;
  try {
    tempDir = mkdtempSync(resolve(dirname(path), ".skill-lab-output-"));
    temp = resolve(tempDir, "output");
    writeFileSync(temp, value, { mode: 0o600, flag: "wx" });
    linkSync(temp, path);
    published = true;
  } catch (error) {
    if (published) removePublishedIfOwned(path, temp);
    bestEffortRemoveTree(tempDir);
    throw new CliError(`could not publish output file: ${error.message}`);
  }
  bestEffortRemoveTree(tempDir);
}

function samePhysicalFile(left, right) {
  if (!left || !right) return false;
  try {
    const leftStat = lstatSync(left);
    const rightStat = lstatSync(right);
    return leftStat.isFile()
      && !leftStat.isSymbolicLink()
      && rightStat.isFile()
      && !rightStat.isSymbolicLink()
      && Number.isSafeInteger(leftStat.dev)
      && Number.isSafeInteger(leftStat.ino)
      && Number.isSafeInteger(rightStat.dev)
      && Number.isSafeInteger(rightStat.ino)
      && leftStat.ino !== 0
      && rightStat.ino !== 0
      && leftStat.nlink >= 2
      && rightStat.nlink >= 2
      && leftStat.dev === rightStat.dev
      && leftStat.ino === rightStat.ino;
  } catch {
    return false;
  }
}

function removePublishedIfOwned(path, retainedLink) {
  if (!samePhysicalFile(path, retainedLink)) return;
  try {
    rmSync(path);
  } catch {
    // A handled failure must never turn into a blind deletion retry.
  }
}

function bestEffortRemoveTree(path) {
  if (!path) return;
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    // Publication success is defined by the final artifact, not temp cleanup.
  }
}

function writeTwoOutputs(
  candidatePath,
  candidate,
  reportPath,
  report,
  inputs,
) {
  assertNewPhysicalOutput(candidatePath, inputs, "candidate output");
  assertNewPhysicalOutput(reportPath, [...inputs, candidatePath], "report output");
  let candidateTempDir;
  let reportTempDir;
  let candidateTemp;
  let reportTemp;
  let candidatePublished = false;
  let reportPublished = false;
  try {
    candidateTempDir = mkdtempSync(resolve(dirname(candidatePath), ".skill-lab-apply-candidate-"));
    reportTempDir = mkdtempSync(resolve(dirname(reportPath), ".skill-lab-apply-report-"));
    candidateTemp = resolve(candidateTempDir, "candidate");
    reportTemp = resolve(reportTempDir, "report");
    writeFileSync(candidateTemp, candidate, { mode: 0o600, flag: "wx" });
    writeFileSync(reportTemp, report, { mode: 0o600, flag: "wx" });
    linkSync(candidateTemp, candidatePath);
    candidatePublished = true;
    linkSync(reportTemp, reportPath);
    reportPublished = true;
  } catch (error) {
    if (reportPublished) removePublishedIfOwned(reportPath, reportTemp);
    if (candidatePublished) removePublishedIfOwned(candidatePath, candidateTemp);
    bestEffortRemoveTree(candidateTempDir);
    bestEffortRemoveTree(reportTempDir);
    const message = `could not publish apply artifacts: ${error.message}`;
    throw new CliError(message);
  }
  bestEffortRemoveTree(candidateTempDir);
  bestEffortRemoveTree(reportTempDir);
}

function sameBigIntIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.ino !== 0n;
}

function inspectV3OutputParent(workspace, parentAbsolute, label) {
  if (!isWithin(workspace.rootAbsolute, parentAbsolute)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${label} parent is outside the workspace root`,
    );
  }
  const relativeParent = relative(workspace.rootAbsolute, parentAbsolute);
  const parts = relativeParent ? relativeParent.split(sep) : [];
  let current = workspace.rootAbsolute;
  const chain = [];
  for (let index = -1; index < parts.length; index += 1) {
    if (index >= 0) current = resolve(current, parts[index]);
    let stat;
    try {
      stat = lstatSync(current, { bigint: true });
    } catch (error) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} parent component is unavailable: ${error.message}`,
      );
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} parent components must be physical directories`,
      );
    }
    chain.push({ dev: stat.dev, ino: stat.ino });
  }
  let real;
  try {
    real = realpathSync(current);
  } catch (error) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${label} parent could not be resolved physically: ${error.message}`,
    );
  }
  if (!isWithin(workspace.rootReal, real)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${label} parent resolves outside the workspace root`,
    );
  }
  return { absolute: current, real, chain };
}

function lstatV3Output(path, label) {
  try {
    return lstatSync(path, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${label} could not be inspected without following links: ${error.message}`,
    );
  }
}

function bindV3Output(workspace, outputInput, inputs, label) {
  const absolute = resolve(outputInput);
  if (!isWithin(workspace.rootAbsolute, absolute)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${label} is outside the workspace root`,
    );
  }
  if (inputs.some((input) => resolve(input) === absolute)) {
    throw classifiedError("publication_failure", `${label} cannot overwrite an input file`);
  }
  const parent = inspectV3OutputParent(workspace, dirname(absolute), label);
  if (lstatV3Output(absolute, label)) {
    throw classifiedError("publication_failure", `${label} already exists: ${outputInput}`);
  }
  return {
    workspace,
    absolute,
    label,
    parentAbsolute: parent.absolute,
    parentReal: parent.real,
    parentChain: parent.chain,
  };
}

function verifyV3OutputParent(binding) {
  const current = inspectV3OutputParent(
    binding.workspace,
    binding.parentAbsolute,
    binding.label,
  );
  if (current.real !== binding.parentReal
      || current.chain.length !== binding.parentChain.length
      || current.chain.some((entry, index) => (
        entry.dev !== binding.parentChain[index].dev
        || entry.ino !== binding.parentChain[index].ino
      ))) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${binding.label} parent physical identity changed during publication`,
    );
  }
  return current;
}

function assertV3OutputAbsent(binding) {
  verifyV3OutputParent(binding);
  if (lstatV3Output(binding.absolute, binding.label)) {
    throw classifiedError(
      "publication_failure",
      `${binding.label} already exists: ${binding.absolute}`,
    );
  }
}

function v3ChildIdentity(value, label) {
  if (!value || typeof value !== "object"
      || !/^(0|[1-9][0-9]*)$/.test(value.dev)
      || !/^(0|[1-9][0-9]*)$/.test(value.ino)) {
    throw classifiedError(
      "publication_failure",
      `${label} returned a malformed physical identity`,
    );
  }
  const identity = { dev: BigInt(value.dev), ino: BigInt(value.ino) };
  if (identity.ino === 0n) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${label} returned an unavailable inode identity`,
    );
  }
  return identity;
}

function runAnchoredV3Publisher(binding, action) {
  verifyV3OutputParent(binding);
  const parentIdentity = binding.parentChain.at(-1);
  const request = {
    protocol: ANCHORED_PUBLISHER_PROTOCOL,
    action: action.action,
    expected_parent: {
      dev: parentIdentity.dev.toString(),
      ino: parentIdentity.ino.toString(),
    },
    ...action,
  };
  const child = spawnSync(
    process.execPath,
    ["--eval", ANCHORED_PUBLISHER_SOURCE],
    {
      cwd: binding.parentAbsolute,
      encoding: "utf8",
      env: {},
      input: JSON.stringify(request),
      maxBuffer: 64 * 1024,
      windowsHide: true,
    },
  );
  verifyV3OutputParent(binding);
  if (child.error || child.status !== 0) {
    const detail = child.error?.message || child.stderr?.trim() || `exit ${child.status}`;
    throw classifiedError(
      "publication_failure",
      `${binding.label} anchored publisher failed: ${detail}`,
    );
  }
  let response;
  try {
    response = JSON.parse(child.stdout);
  } catch {
    throw classifiedError(
      "publication_failure",
      `${binding.label} anchored publisher returned malformed output`,
    );
  }
  if (!response || response.ok !== true) {
    const status = response?.status === "unsafe_path_or_integrity"
      ? "unsafe_path_or_integrity"
      : "publication_failure";
    throw classifiedError(
      status,
      `${binding.label} anchored publisher: ${response?.message ?? "operation failed"}`,
    );
  }
  return response.result;
}

function v3ExpectedFile(identity) {
  return { dev: identity.dev.toString(), ino: identity.ino.toString() };
}

function assertV3RelativeOwned(binding, name, identity, label) {
  const result = runAnchoredV3Publisher(binding, {
    action: "inspect",
    name,
    expected_file: v3ExpectedFile(identity),
  });
  if (result !== "owned") {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${label} physical identity does not match its bound temporary source`,
    );
  }
}

function removeV3RelativeIfOwned(binding, name, identity) {
  try {
    runAnchoredV3Publisher(binding, {
      action: "unlink",
      name,
      expected_file: v3ExpectedFile(identity),
    });
  } catch {
    // Cleanup never retries with an unverified pathname or removes a foreign inode.
  }
}

function createV3TemporarySource(binding, value) {
  const name = `.skill-lab-apply-${randomBytes(16).toString("hex")}`;
  const result = runAnchoredV3Publisher(binding, {
    action: "create",
    name,
    content: Buffer.from(value, "utf8").toString("base64"),
  });
  const temporary = { name, stat: v3ChildIdentity(result, `${binding.label} temporary source`) };
  try {
    assertV3RelativeOwned(
      binding,
      temporary.name,
      temporary.stat,
      `${binding.label} temporary source`,
    );
  } catch (error) {
    removeV3RelativeIfOwned(binding, temporary.name, temporary.stat);
    throw error;
  }
  return temporary;
}

function assertV3OutputOwned(binding, temporary) {
  assertV3RelativeOwned(binding, basename(binding.absolute), temporary.stat, binding.label);
}

function publishV3Output(binding, temporary, state) {
  assertV3OutputAbsent(binding);
  assertV3RelativeOwned(
    binding,
    temporary.name,
    temporary.stat,
    `${binding.label} temporary source`,
  );
  state.attempted = true;
  runAnchoredV3Publisher(binding, {
    action: "link",
    source: temporary.name,
    destination: basename(binding.absolute),
    expected_file: v3ExpectedFile(temporary.stat),
  });
  assertV3OutputOwned(binding, temporary);
}

function writeTwoOutputsV3(candidateBinding, candidate, reportBinding, report) {
  let candidateTemporary;
  let reportTemporary;
  const candidateState = { attempted: false };
  const reportState = { attempted: false };
  try {
    assertV3OutputAbsent(candidateBinding);
    assertV3OutputAbsent(reportBinding);
    candidateTemporary = createV3TemporarySource(candidateBinding, candidate);
    reportTemporary = createV3TemporarySource(reportBinding, report);

    publishV3Output(candidateBinding, candidateTemporary, candidateState);
    assertV3OutputOwned(candidateBinding, candidateTemporary);
    assertV3OutputAbsent(reportBinding);
    publishV3Output(reportBinding, reportTemporary, reportState);
    assertV3OutputOwned(candidateBinding, candidateTemporary);
    assertV3OutputOwned(reportBinding, reportTemporary);
  } catch (error) {
    if (reportState.attempted && reportTemporary) {
      removeV3RelativeIfOwned(
        reportBinding,
        basename(reportBinding.absolute),
        reportTemporary.stat,
      );
    }
    if (candidateState.attempted && candidateTemporary) {
      removeV3RelativeIfOwned(
        candidateBinding,
        basename(candidateBinding.absolute),
        candidateTemporary.stat,
      );
    }
    if (reportTemporary) {
      removeV3RelativeIfOwned(reportBinding, reportTemporary.name, reportTemporary.stat);
    }
    if (candidateTemporary) {
      removeV3RelativeIfOwned(candidateBinding, candidateTemporary.name, candidateTemporary.stat);
    }
    if (error instanceof CliError) throw error;
    throw classifiedError(
      "publication_failure",
      `could not publish apply artifacts: ${error.message}`,
    );
  }
  removeV3RelativeIfOwned(reportBinding, reportTemporary.name, reportTemporary.stat);
  removeV3RelativeIfOwned(candidateBinding, candidateTemporary.name, candidateTemporary.stat);
}

function countExact(content, needle) {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (offset <= content.length - needle.length) {
    const found = content.indexOf(needle, offset);
    if (found === -1) break;
    count += 1;
    offset = found + 1;
  }
  return count;
}

function parseFrontmatterString(raw, label) {
  const value = raw.trim();
  if (!value) throw new CliError(`Skill frontmatter ${label} must not be empty`);
  if (hasUnsupportedFrontmatterCharacter(value)) {
    throw new CliError(`Skill frontmatter ${label} contains a control character`);
  }

  if (value.startsWith('"')) {
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new CliError(`Skill frontmatter ${label} must be a valid quoted YAML string`);
    }
    if (typeof parsed !== "string") {
      throw new CliError(`Skill frontmatter ${label} must be a string`);
    }
    if (hasUnsupportedFrontmatterCharacter(parsed)) {
      throw new CliError(`Skill frontmatter ${label} contains a control character`);
    }
    return parsed;
  }

  if (value.startsWith("'")) {
    if (value.length < 2 || !value.endsWith("'")) {
      throw new CliError(`Skill frontmatter ${label} must be a valid quoted YAML string`);
    }
    const inner = value.slice(1, -1);
    let parsed = "";
    for (let index = 0; index < inner.length; index += 1) {
      if (inner[index] !== "'") {
        parsed += inner[index];
        continue;
      }
      if (inner[index + 1] !== "'") {
        throw new CliError(`Skill frontmatter ${label} has an invalid single-quoted scalar`);
      }
      parsed += "'";
      index += 1;
    }
    if (hasUnsupportedFrontmatterCharacter(parsed)) {
      throw new CliError(`Skill frontmatter ${label} contains a control character`);
    }
    return parsed;
  }

  if (!/^[A-Za-z]/.test(value)
      || /:$|:\s|\s#/.test(value)
      || /^(?:null|true|false|yes|no|on|off)$/i.test(value)
      || /[\[\]{}&*!|>@`]/.test(value)) {
    throw new CliError(
      `Skill frontmatter ${label} must be a portable plain or quoted YAML string`,
    );
  }
  return value;
}

// Retained verbatim in behavior for the temporary v2 apply/gate/stage bridge.
function validateFrontmatter(content) {
  if (content.includes("\r")) {
    throw new CliError("Skill files must use LF line endings without carriage returns");
  }
  if (!content.startsWith("---\n")) {
    throw new CliError("Skill frontmatter must begin with an exact --- delimiter");
  }
  const closingStart = content.indexOf("\n---\n", 4);
  if (closingStart === -1) {
    throw new CliError("Skill frontmatter is missing its closing --- delimiter");
  }
  const header = content.slice(4, closingStart);
  if (ALL_MARKERS.some((marker) => header.includes(marker))) {
    throw new CliError("Skill frontmatter contains a protected marker");
  }
  const values = new Map();
  for (const line of header.split("\n")) {
    if (!line.trim()) continue;
    const match = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(line);
    if (!match) throw new CliError(`invalid Skill frontmatter line: ${line}`);
    const [, key, value] = match;
    if (!new Set(["name", "description"]).has(key)) {
      throw new CliError(
        `Skill frontmatter key ${key} is unsupported; only name and description are allowed`,
      );
    }
    if (values.has(key)) throw new CliError(`duplicate Skill frontmatter key: ${key}`);
    values.set(key, parseFrontmatterString(value, key));
  }
  for (const key of ["name", "description"]) {
    if (!values.has(key)) throw new CliError(`Skill frontmatter is missing ${key}`);
  }
  const name = values.get("name").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    throw new CliError(
      "Skill frontmatter name must be 1-64 characters of lowercase hyphen-case",
    );
  }
  const description = values.get("description").trim();
  if (!description || description.length > 1024 || /[<>]/.test(description)) {
    throw new CliError(
      "Skill frontmatter description must be a non-empty string of at most 1024 characters without angle brackets",
    );
  }
  return { start: 0, end: closingStart + 5 };
}

function parsePortableBlockScalar(indicator, lines, label) {
  if (!/^[|>](?:(?:[1-9][+-]?)|(?:[+-][1-9]?))?(?:[ \t]+#.*)?$/.test(indicator)) {
    throw new CliError(`Skill frontmatter ${label} has an invalid block scalar indicator`);
  }
  const nonBlank = lines.filter((line) => line.trim());
  if (nonBlank.length === 0 || nonBlank.some((line) => !/^[ \t]+/.test(line))) {
    throw new CliError(`Skill frontmatter ${label} block scalar must contain indented text`);
  }
  const indentation = Math.min(
    ...nonBlank.map((line) => /^[ \t]*/.exec(line)[0].length),
  );
  const values = lines.map((line) => line.slice(Math.min(indentation, line.length)));
  const value = indicator.startsWith(">")
    ? values.map((line) => line.trim()).filter(Boolean).join(" ")
    : values.join("\n").trim();
  if (!value || hasUnsupportedFrontmatterCharacter(value)) {
    throw new CliError(`Skill frontmatter ${label} block scalar must contain portable text`);
  }
  return value;
}

function validateFrontmatterV3(content) {
  if (content.includes("\r")) {
    throw new CliError("Skill files must use LF line endings without carriage returns");
  }
  if (!content.startsWith("---\n")) {
    throw new CliError("Skill frontmatter must begin with an exact --- delimiter");
  }
  const closingStart = content.indexOf("\n---\n", 4);
  if (closingStart === -1) {
    throw new CliError("Skill frontmatter is missing its closing --- delimiter");
  }
  const end = closingStart + 5;
  if (!content.slice(end).trim()) {
    throw new CliError("Skill must contain a non-empty body after frontmatter");
  }
  const header = content.slice(4, closingStart);
  if (ALL_MARKERS.some((marker) => header.includes(marker))) {
    throw new CliError("Skill frontmatter contains a protected marker");
  }

  const lines = header.split("\n");
  const topLevelKeys = new Set();
  const requiredValues = new Map();
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (/^[ \t]/.test(line)) {
      throw new CliError(`invalid orphaned Skill frontmatter continuation: ${line}`);
    }
    const match = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(line);
    if (!match) throw new CliError(`invalid Skill frontmatter line: ${line}`);
    const [, key, rawValue] = match;
    if (topLevelKeys.has(key)) throw new CliError(`duplicate Skill frontmatter key: ${key}`);
    topLevelKeys.add(key);

    let next = index + 1;
    while (next < lines.length && (!lines[next].trim() || /^[ \t]/.test(lines[next]))) {
      next += 1;
    }
    const continuation = lines.slice(index + 1, next);
    if (key === "name" || key === "description") {
      let value;
      if (/^[|>]/.test(rawValue.trim())) {
        value = parsePortableBlockScalar(rawValue.trim(), continuation, key);
      } else {
        if (continuation.some((entry) => entry.trim())) {
          throw new CliError(`Skill frontmatter ${key} must be one top-level scalar`);
        }
        value = parseFrontmatterString(rawValue, key);
      }
      requiredValues.set(key, value);
    }
    index = next;
  }

  for (const key of ["name", "description"]) {
    if (!requiredValues.has(key)) throw new CliError(`Skill frontmatter is missing ${key}`);
  }
  const name = requiredValues.get("name").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    throw new CliError(
      "Skill frontmatter name must be 1-64 characters of lowercase hyphen-case",
    );
  }
  const description = requiredValues.get("description").trim();
  if (!description || description.length > 1024 || /[<>]/.test(description)) {
    throw new CliError(
      "Skill frontmatter description must be a non-empty string of at most 1024 characters without angle brackets",
    );
  }
  return { start: 0, end };
}

function locateProtectedRanges(content) {
  const ranges = [];
  for (const [startMarker, endMarker] of PROTECTED_MARKERS) {
    const startCount = countExact(content, startMarker);
    const endCount = countExact(content, endMarker);
    if (startCount !== endCount || startCount > 1) {
      throw new CliError(`protected marker pair is malformed: ${startMarker}`);
    }
    if (startCount === 0) continue;
    const start = content.indexOf(startMarker);
    const endMarkerStart = content.indexOf(endMarker);
    if (endMarkerStart < start) {
      throw new CliError(`protected marker order is invalid: ${startMarker}`);
    }
    ranges.push({
      start,
      end: endMarkerStart + endMarker.length,
      label: startMarker,
    });
  }
  const sorted = ranges.sort((left, right) => left.start - right.start);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].start < sorted[index - 1].end) {
      throw new CliError("protected regions must not overlap or nest");
    }
  }
  return sorted;
}

function validateSkill(content) {
  const frontmatter = validateFrontmatter(content);
  const protectedRanges = locateProtectedRanges(content);
  if (protectedRanges.some((range) => overlaps(frontmatter.start, frontmatter.end, range))) {
    throw new CliError("Skill frontmatter must not contain a protected marker region");
  }
  return { frontmatter, protectedRanges };
}

function validateSkillV3(content) {
  const frontmatter = validateFrontmatterV3(content);
  const protectedRanges = locateProtectedRanges(content);
  if (protectedRanges.some((range) => overlaps(frontmatter.start, frontmatter.end, range))) {
    throw new CliError("Skill frontmatter must not contain a protected marker region");
  }
  return { frontmatter, protectedRanges };
}

function overlaps(spanStart, spanEnd, range) {
  return spanStart < range.end && spanEnd > range.start;
}

// Retained separately so v2 report bytes and validation semantics remain reviewable.
function validatePatch(value) {
  if (value.schema_version !== 2) throw new CliError("edits schema_version must be 2");
  exactKeys(
    value,
    [
      "schema_version",
      "source_sha256",
      "max_edits",
      "max_added_bytes",
      "max_removed_bytes",
      "edits",
    ],
    "edits document",
  );
  validateDigest(value.source_sha256, "edits source_sha256");
  if (!Number.isInteger(value.max_edits) || value.max_edits < 1) {
    throw new CliError("max_edits must be a positive integer");
  }
  if (value.max_edits > HARD_MAX_EDITS) {
    throw new CliError(`max_edits cannot exceed ${HARD_MAX_EDITS}`);
  }
  for (const field of ["max_added_bytes", "max_removed_bytes"]) {
    if (!Number.isInteger(value[field])
        || value[field] < 1
        || value[field] > HARD_MAX_PATCH_BYTES) {
      throw new CliError(
        `${field} must be an integer between 1 and ${HARD_MAX_PATCH_BYTES}`,
      );
    }
  }
  if (!Array.isArray(value.edits) || value.edits.length === 0) {
    throw new CliError("edits must be a non-empty array");
  }
  if (value.edits.length > value.max_edits) {
    throw new CliError(`edits length exceeds max_edits (${value.max_edits})`);
  }
  const edits = value.edits.map((edit, index) => {
    if (!edit || typeof edit !== "object" || Array.isArray(edit)) {
      throw new CliError(`edit ${index + 1} must be an object`);
    }
    const keys = Object.keys(edit).sort();
    if (JSON.stringify(keys) !== JSON.stringify(["content", "op", "target"])) {
      throw new CliError(`edit ${index + 1} must contain only op, target, and content`);
    }
    if (!EDIT_OPS.has(edit.op)) throw new CliError(`edit ${index + 1} has unknown op`);
    if (typeof edit.target !== "string" || typeof edit.content !== "string") {
      throw new CliError(`edit ${index + 1} target and content must be strings`);
    }
    for (const field of ["target", "content"]) {
      const bytes = Buffer.byteLength(edit[field], "utf8");
      if (bytes > HARD_MAX_EDIT_BYTES) {
        throw new CliError(
          `edit ${index + 1} ${field} exceeds ${HARD_MAX_EDIT_BYTES} UTF-8 bytes`,
        );
      }
    }
    if (edit.op === "append") {
      if (edit.target !== "") throw new CliError(`edit ${index + 1} append target must be empty`);
      if (!edit.content) throw new CliError(`edit ${index + 1} append content must not be empty`);
    } else {
      if (!edit.target) throw new CliError(`edit ${index + 1} target must not be empty`);
      if (edit.op === "delete" && edit.content !== "") {
        throw new CliError(`edit ${index + 1} delete content must be empty`);
      }
      if (edit.op !== "delete" && !edit.content) {
        throw new CliError(`edit ${index + 1} content must not be empty`);
      }
    }
    for (const marker of ALL_MARKERS) {
      if (edit.content.includes(marker)) {
        throw new CliError(`edit ${index + 1} content cannot introduce a protected marker`);
      }
    }
    return { op: edit.op, target: edit.target, content: edit.content };
  });
  return {
    sourceSha: value.source_sha256,
    maxEdits: value.max_edits,
    maxAddedBytes: value.max_added_bytes,
    maxRemovedBytes: value.max_removed_bytes,
    edits,
  };
}

function requireNonBlank(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new CliError(`${label} must be a non-empty string`);
  }
  return value;
}

function validatePatchV3(value) {
  if (value.schema !== PATCH_SCHEMA_V3) {
    throw new CliError(`edits schema must be ${PATCH_SCHEMA_V3}`);
  }
  exactKeys(
    value,
    [
      "schema",
      "proposal_id",
      "source_sha256",
      "max_edits",
      "max_added_bytes",
      "max_removed_bytes",
      "assumptions",
      "prior_rejections",
      "edits",
    ],
    "v3 patch document",
  );
  validateStableId(value.proposal_id, "proposal_id");
  validateDigest(value.source_sha256, "patch source_sha256");
  if (!Number.isInteger(value.max_edits)
      || value.max_edits < 1
      || value.max_edits > HARD_MAX_EDITS) {
    throw new CliError(`max_edits must be an integer between 1 and ${HARD_MAX_EDITS}`);
  }
  for (const field of ["max_added_bytes", "max_removed_bytes"]) {
    if (!Number.isInteger(value[field])
        || value[field] < 1
        || value[field] > HARD_MAX_PATCH_BYTES) {
      throw new CliError(
        `${field} must be an integer between 1 and ${HARD_MAX_PATCH_BYTES}`,
      );
    }
  }

  if (!Array.isArray(value.assumptions)
      || value.assumptions.length < 1
      || value.assumptions.length > MAX_SAMPLE_ROWS) {
    throw new CliError("assumptions must contain between 1 and 1000 entries");
  }
  const assumptionIds = new Set();
  const assumptions = value.assumptions.map((assumption, index) => {
    const label = `assumption ${index + 1}`;
    if (!assumption || typeof assumption !== "object" || Array.isArray(assumption)) {
      throw new CliError(`${label} must be an object`);
    }
    exactKeys(assumption, ["assumption_id", "status", "summary"], label);
    validateStableId(assumption.assumption_id, `${label} assumption_id`);
    if (assumptionIds.has(assumption.assumption_id)) {
      throw new CliError(`duplicate assumption_id: ${assumption.assumption_id}`);
    }
    assumptionIds.add(assumption.assumption_id);
    if (!new Set(["known", "inferred", "open"]).has(assumption.status)) {
      throw new CliError(`${label} status must be known, inferred, or open`);
    }
    requireNonBlank(assumption.summary, `${label} summary`);
    return {
      assumption_id: assumption.assumption_id,
      status: assumption.status,
      summary: assumption.summary,
    };
  });

  if (!Array.isArray(value.prior_rejections)
      || value.prior_rejections.length > MAX_SAMPLE_ROWS) {
    throw new CliError("prior_rejections must be an array of at most 1000 entries");
  }
  const rejectionIds = new Set();
  const logicalReportPaths = new Set();
  const priorRejections = value.prior_rejections.map((rejection, index) => {
    const label = `prior rejection ${index + 1}`;
    if (!rejection || typeof rejection !== "object" || Array.isArray(rejection)) {
      throw new CliError(`${label} must be an object`);
    }
    exactKeys(rejection, ["rejection_id", "report", "relationship", "note"], label);
    validateStableId(rejection.rejection_id, `${label} rejection_id`);
    if (rejectionIds.has(rejection.rejection_id)) {
      throw new CliError(`duplicate rejection_id: ${rejection.rejection_id}`);
    }
    rejectionIds.add(rejection.rejection_id);
    if (!rejection.report || typeof rejection.report !== "object"
        || Array.isArray(rejection.report)) {
      throw new CliError(`${label} report must be an artifact object`);
    }
    exactKeys(rejection.report, ["path", "sha256"], `${label} report`);
    if (typeof rejection.report.path !== "string" || !rejection.report.path) {
      throw new CliError(`${label} report path must be a non-empty string`);
    }
    validateDigest(rejection.report.sha256, `${label} report sha256`);
    if (logicalReportPaths.has(rejection.report.path)) {
      throw new CliError(`duplicate prior rejection report path: ${rejection.report.path}`);
    }
    logicalReportPaths.add(rejection.report.path);
    if (!new Set([
      "supersedes",
      "narrows",
      "unchanged-risk",
      "not-applicable",
    ]).has(rejection.relationship)) {
      throw new CliError(`${label} relationship is not recognized`);
    }
    requireNonBlank(rejection.note, `${label} note`);
    return {
      rejection_id: rejection.rejection_id,
      report: { path: rejection.report.path, sha256: rejection.report.sha256 },
      relationship: rejection.relationship,
      note: rejection.note,
    };
  });

  if (!Array.isArray(value.edits) || value.edits.length < 1) {
    throw new CliError("edits must be a non-empty array");
  }
  if (value.edits.length > value.max_edits) {
    throw new CliError(`edits length exceeds max_edits (${value.max_edits})`);
  }
  const editIds = new Set();
  const edits = value.edits.map((edit, index) => {
    const label = `edit ${index + 1}`;
    if (!edit || typeof edit !== "object" || Array.isArray(edit)) {
      throw new CliError(`${label} must be an object`);
    }
    exactKeys(
      edit,
      [
        "edit_id",
        "op",
        "target",
        "content",
        "rationale",
        "supporting_case_ids",
        "support_count",
        "source_types",
      ],
      label,
    );
    validateStableId(edit.edit_id, `${label} edit_id`);
    if (editIds.has(edit.edit_id)) throw new CliError(`duplicate edit_id: ${edit.edit_id}`);
    editIds.add(edit.edit_id);
    if (!EDIT_OPS.has(edit.op)) throw new CliError(`${label} has unknown op`);
    if (typeof edit.target !== "string" || typeof edit.content !== "string") {
      throw new CliError(`${label} target and content must be strings`);
    }
    for (const field of ["target", "content"]) {
      if (Buffer.byteLength(edit[field], "utf8") > HARD_MAX_EDIT_BYTES) {
        throw new CliError(`${label} ${field} exceeds ${HARD_MAX_EDIT_BYTES} UTF-8 bytes`);
      }
    }
    if (edit.op === "append") {
      if (edit.target !== "") throw new CliError(`${label} append target must be empty`);
      if (!edit.content) throw new CliError(`${label} append content must not be empty`);
    } else {
      if (!edit.target) throw new CliError(`${label} target must not be empty`);
      if (edit.op === "delete" && edit.content !== "") {
        throw new CliError(`${label} delete content must be empty`);
      }
      if (edit.op !== "delete" && !edit.content) {
        throw new CliError(`${label} content must not be empty`);
      }
    }
    requireNonBlank(edit.rationale, `${label} rationale`);
    if (!Array.isArray(edit.supporting_case_ids)
        || edit.supporting_case_ids.length < 1
        || edit.supporting_case_ids.length > MAX_SAMPLE_ROWS) {
      throw new CliError(`${label} supporting_case_ids must be a non-empty array`);
    }
    const supportingCaseIds = new Set();
    for (const caseId of edit.supporting_case_ids) {
      validateStableId(caseId, `${label} supporting_case_ids entry`);
      if (supportingCaseIds.has(caseId)) {
        throw new CliError(`${label} supporting_case_ids must be unique`);
      }
      supportingCaseIds.add(caseId);
    }
    if (!Number.isInteger(edit.support_count)
        || edit.support_count !== supportingCaseIds.size) {
      throw new CliError(
        `${label} support_count must equal the number of distinct supporting_case_ids`,
      );
    }
    if (!Array.isArray(edit.source_types)
        || edit.source_types.length < 1
        || edit.source_types.length > 4) {
      throw new CliError(`${label} source_types must be a non-empty array`);
    }
    const sourceTypes = new Set();
    for (const sourceType of edit.source_types) {
      if (!new Set(["failure", "success", "rejection", "human-constraint"])
        .has(sourceType)) {
        throw new CliError(`${label} source_types contains an unknown value`);
      }
      if (sourceTypes.has(sourceType)) {
        throw new CliError(`${label} source_types must be unique`);
      }
      sourceTypes.add(sourceType);
    }
    for (const marker of ALL_MARKERS) {
      if (edit.content.includes(marker)) {
        throw new CliError(`${label} content cannot introduce a protected marker`);
      }
    }
    return {
      edit_id: edit.edit_id,
      op: edit.op,
      target: edit.target,
      content: edit.content,
      rationale: edit.rationale,
      supporting_case_ids: [...edit.supporting_case_ids],
      support_count: edit.support_count,
      source_types: [...edit.source_types],
    };
  });

  return {
    proposalId: value.proposal_id,
    sourceSha: value.source_sha256,
    maxEdits: value.max_edits,
    maxAddedBytes: value.max_added_bytes,
    maxRemovedBytes: value.max_removed_bytes,
    assumptions,
    priorRejections,
    edits,
  };
}

function planEdits(content, edits, skillValidator = validateSkill) {
  const { frontmatter, protectedRanges } = skillValidator(content);
  const planned = edits.map((edit, offset) => {
    const index = offset + 1;
    if (edit.op === "append") {
      const insertAt = protectedRanges.length > 0 ? protectedRanges[0].start : content.length;
      return {
        index,
        ...edit,
        anchorStart: insertAt,
        anchorEnd: insertAt,
        mutationStart: insertAt,
        mutationEnd: insertAt,
      };
    }

    const matches = countExact(content, edit.target);
    if (matches !== 1) {
      throw new CliError(
        `edit ${index} target must occur exactly once in the original source; found ${matches}`,
      );
    }
    const start = content.indexOf(edit.target);
    const end = start + edit.target.length;
    for (const range of [frontmatter, ...protectedRanges]) {
      if (overlaps(start, end, range)) {
        throw new CliError(`edit ${index} target overlaps a protected region`);
      }
    }
    return {
      index,
      ...edit,
      anchorStart: start,
      anchorEnd: end,
      mutationStart: edit.op === "insert_after" ? end : start,
      mutationEnd: edit.op === "insert_after" ? end : end,
    };
  });

  const anchored = planned.filter((edit) => edit.op !== "append");
  for (let left = 0; left < anchored.length; left += 1) {
    for (let right = left + 1; right < anchored.length; right += 1) {
      if (
        anchored[left].anchorStart < anchored[right].anchorEnd
        && anchored[left].anchorEnd > anchored[right].anchorStart
      ) {
        throw new CliError(
          `edit ${anchored[left].index} and edit ${anchored[right].index} target spans overlap`,
        );
      }
    }
  }
  return planned;
}

function applyPlannedEdits(source, planned, skillValidator = validateSkill) {
  let candidate = source;
  const reports = new Map();
  const applicationOrder = [...planned].sort((left, right) => {
    const byOffset = right.mutationStart - left.mutationStart;
    if (byOffset !== 0) return byOffset;
    const leftDestructive = left.mutationEnd > left.mutationStart;
    const rightDestructive = right.mutationEnd > right.mutationStart;
    if (leftDestructive !== rightDestructive) return leftDestructive ? -1 : 1;
    return right.index - left.index;
  });
  for (let order = 0; order < applicationOrder.length; order += 1) {
    const edit = applicationOrder[order];
    const beforeHash = sha256(candidate);
    if (edit.op === "insert_after" || edit.op === "append") {
      candidate = `${candidate.slice(0, edit.mutationStart)}${edit.content}${candidate.slice(edit.mutationStart)}`;
    } else if (edit.op === "replace") {
      candidate = `${candidate.slice(0, edit.mutationStart)}${edit.content}${candidate.slice(edit.mutationEnd)}`;
    } else {
      candidate = `${candidate.slice(0, edit.mutationStart)}${candidate.slice(edit.mutationEnd)}`;
    }
    reports.set(edit.index, {
      index: edit.index,
      op: edit.op,
      target_sha256: sha256(edit.target),
      content_sha256: sha256(edit.content),
      original_anchor_start: edit.anchorStart,
      original_anchor_end: edit.anchorEnd,
      application_order: order + 1,
      before_sha256: beforeHash,
      after_sha256: sha256(candidate),
      added_bytes: edit.op === "delete" ? 0 : Buffer.byteLength(edit.content, "utf8"),
      removed_bytes: edit.op === "insert_after" || edit.op === "append"
        ? 0
        : Buffer.byteLength(edit.target, "utf8"),
    });
  }

  skillValidator(candidate);
  return {
    candidate,
    appliedEdits: [...reports.values()].sort((left, right) => left.index - right.index),
  };
}

function buildApplyResult(sourceBuffer, editsBuffer) {
  const source = decodeUtf8(sourceBuffer, "source Skill");
  validateSkill(source);
  const patchValue = parseJson(editsBuffer, "edits document");
  const patch = validatePatch(patchValue);
  const sourceSha = sha256(sourceBuffer);
  if (patch.sourceSha !== sourceSha) {
    throw new CliError("edits source_sha256 does not match the source Skill");
  }
  const planned = planEdits(source, patch.edits);
  const result = applyPlannedEdits(source, planned);
  if (result.candidate === source) throw new CliError("patch produced no candidate change");
  const addedBytes = result.appliedEdits.reduce((total, edit) => total + edit.added_bytes, 0);
  const removedBytes = result.appliedEdits.reduce(
    (total, edit) => total + edit.removed_bytes,
    0,
  );
  if (addedBytes > patch.maxAddedBytes) {
    throw new CliError(
      `actual added bytes ${addedBytes} exceed max_added_bytes ${patch.maxAddedBytes}`,
    );
  }
  if (removedBytes > patch.maxRemovedBytes) {
    throw new CliError(
      `actual removed bytes ${removedBytes} exceed max_removed_bytes ${patch.maxRemovedBytes}`,
    );
  }
  const report = {
    schema_version: 2,
    decision: "applied",
    source_sha256: sourceSha,
    candidate_sha256: sha256(result.candidate),
    edits_sha256: sha256(editsBuffer),
    max_edits: patch.maxEdits,
    max_added_bytes: patch.maxAddedBytes,
    max_removed_bytes: patch.maxRemovedBytes,
    actual_added_bytes: addedBytes,
    actual_removed_bytes: removedBytes,
    applied_edits: result.appliedEdits,
  };
  return { candidate: result.candidate, report };
}

function buildApplyResultV3(sourceBuffer, editsBuffer, patchValue, artifactStore) {
  const source = decodeUtf8(sourceBuffer, "source Skill");
  const sourceValidation = validateSkillV3(source);
  const patch = validatePatchV3(patchValue);
  const sourceSha = sha256(sourceBuffer);
  if (patch.sourceSha !== sourceSha) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "patch source_sha256 does not match the source Skill",
    );
  }
  for (const rejection of patch.priorRejections) {
    artifactStore.readRelative(
      rejection.report.path,
      rejection.report.sha256,
      `prior rejection ${rejection.rejection_id} report`,
    );
  }

  const planned = planEdits(source, patch.edits, validateSkillV3);
  const result = applyPlannedEdits(source, planned, validateSkillV3);
  if (result.candidate === source) throw new CliError("patch produced no candidate change");
  const candidateValidation = validateSkillV3(result.candidate);
  if (source.slice(sourceValidation.frontmatter.start, sourceValidation.frontmatter.end)
      !== result.candidate.slice(
        candidateValidation.frontmatter.start,
        candidateValidation.frontmatter.end,
      )) {
    throw new CliError("patch changed immutable source frontmatter bytes");
  }

  const addedBytes = result.appliedEdits.reduce((total, edit) => total + edit.added_bytes, 0);
  const removedBytes = result.appliedEdits.reduce(
    (total, edit) => total + edit.removed_bytes,
    0,
  );
  if (addedBytes > patch.maxAddedBytes) {
    throw new CliError(
      `actual added bytes ${addedBytes} exceed max_added_bytes ${patch.maxAddedBytes}`,
    );
  }
  if (removedBytes > patch.maxRemovedBytes) {
    throw new CliError(
      `actual removed bytes ${removedBytes} exceed max_removed_bytes ${patch.maxRemovedBytes}`,
    );
  }

  const report = {
    schema: APPLY_REPORT_SCHEMA_V3,
    status: "applied",
    proposal_id: patch.proposalId,
    source_sha256: sourceSha,
    candidate_sha256: sha256(result.candidate),
    patch_sha256: sha256(editsBuffer),
    max_edits: patch.maxEdits,
    max_added_bytes: patch.maxAddedBytes,
    max_removed_bytes: patch.maxRemovedBytes,
    actual_added_bytes: addedBytes,
    actual_removed_bytes: removedBytes,
    assumptions: patch.assumptions,
    prior_rejections: patch.priorRejections,
    applied_edits: result.appliedEdits.map((applied) => {
      const edit = patch.edits[applied.index - 1];
      return {
        edit_id: edit.edit_id,
        ...applied,
        rationale: edit.rationale,
        supporting_case_ids: edit.supporting_case_ids,
        support_count: edit.support_count,
        source_types: edit.source_types,
      };
    }),
  };
  return { candidate: result.candidate, report };
}

function applyCommand(options) {
  validateRuntime();
  const paths = requireOptions(options, [
    "workspace-root",
    "source",
    "edits",
    "candidate",
    "report",
  ]);
  let workspace;
  try {
    workspace = prepareWorkspace(paths["workspace-root"]);
  } catch (error) {
    throw reclassify(error, "unsafe_path_or_integrity");
  }
  const initialStore = new ArtifactStore(workspace);
  const initialEditsBuffer = initialStore.readAbsolute(
    paths.edits,
    null,
    "edits document",
  ).bytes;
  const initialPatchValue = parseJson(initialEditsBuffer, "edits document");

  if (initialPatchValue.schema === PATCH_SCHEMA_V3) {
    validatePatchV3(initialPatchValue);
    const candidateBinding = bindV3Output(
      workspace,
      paths.candidate,
      [paths.source, paths.edits],
      "candidate output",
    );
    const reportBinding = bindV3Output(
      workspace,
      paths.report,
      [paths.source, paths.edits, paths.candidate],
      "apply report",
    );

    const store = new ArtifactStore(workspace);
    const patchArtifact = store.readAbsolute(
      paths.edits,
      sha256(initialEditsBuffer),
      "edits document",
    );
    const patchValue = parseJson(patchArtifact.bytes, "edits document");
    if (patchValue.schema !== PATCH_SCHEMA_V3) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        "edits document changed while apply preflight was running",
      );
    }
    const sourceArtifact = store.readAbsolute(
      paths.source,
      patchValue.source_sha256,
      "source Skill (patch source_sha256)",
      { skill: true },
    );
    const result = buildApplyResultV3(
      sourceArtifact.bytes,
      patchArtifact.bytes,
      patchValue,
      store,
    );
    writeTwoOutputsV3(
      candidateBinding,
      result.candidate,
      reportBinding,
      canonicalJsonLine(result.report),
    );
    return;
  }

  assertExistingWithin(workspace.rootReal, paths.source, "apply input");
  assertOutputWithin(workspace, paths.candidate, "candidate output");
  assertOutputWithin(workspace, paths.report, "apply report");
  const sourceBuffer = readRegularFile(paths.source, "source Skill");
  const result = buildApplyResult(sourceBuffer, initialEditsBuffer);
  writeTwoOutputs(
    paths.candidate,
    result.candidate,
    paths.report,
    `${JSON.stringify(result.report, null, 2)}\n`,
    [paths.source, paths.edits],
  );
}

function validateDigest(value, label) {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new CliError(`${label} must be a lowercase SHA-256 digest`);
  }
}

function sampleStats(samples) {
  const stats = { pass: 0, fail: 0, invalid: 0, indeterminate: 0 };
  for (const sample of samples) stats[sample.outcome] += 1;
  const valid = stats.pass + stats.fail;
  return {
    ...stats,
    valid,
    pass_rate: valid > 0 ? stats.pass / valid : null,
  };
}

function validateStableId(value, label, pattern = STABLE_ID_PATTERN) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new CliError(`${label} must be a stable ASCII identifier`);
  }
}

function validateArtifactRecord(record, label, workspace) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new CliError(`${label} must be an object`);
  }
  exactKeys(record, ["path", "sha256"], label);
  validateDigest(record.sha256, `${label} sha256`);
  return readWorkspaceArtifact(workspace, record.path, record.sha256, label);
}

function validateCampaign(value, rawBuffer, workspace) {
  if (value.schema_version !== 2) throw new CliError("results schema_version must be 2");
  exactKeys(
    value,
    ["schema_version", "campaign_id", "artifacts", "required_valid", "samples"],
    "results document",
  );
  validateStableId(value.campaign_id, "campaign_id");
  if (!value.artifacts || typeof value.artifacts !== "object" || Array.isArray(value.artifacts)) {
    throw new CliError("artifacts must be an object");
  }
  const artifactNames = ["source", "candidate", "scenario", "rubric", "environment"];
  exactKeys(value.artifacts, artifactNames, "artifacts");
  const artifacts = Object.fromEntries(
    artifactNames.map((name) => [
      name,
      validateArtifactRecord(value.artifacts[name], `artifacts.${name}`, workspace),
    ]),
  );
  const source = decodeUtf8(artifacts.source.bytes, "artifacts.source");
  const candidate = decodeUtf8(artifacts.candidate.bytes, "artifacts.candidate");
  validateSkill(source);
  validateSkill(candidate);
  if (artifacts.source.sha256 === artifacts.candidate.sha256) {
    throw new CliError("source and candidate digests must differ");
  }
  if (!Number.isInteger(value.required_valid)
      || value.required_valid < 5
      || value.required_valid > 100) {
    throw new CliError("required_valid must be an integer between 5 and 100");
  }
  if (!Array.isArray(value.samples) || value.samples.length === 0) {
    throw new CliError("samples must be a non-empty array");
  }

  const ids = new Set();
  const actorAssignments = new Map();
  const evidenceAssignments = new Map();
  const actorsByCaseArm = new Set();
  const evidenceByCaseArm = new Set();
  const normalized = value.samples.map((sample, index) => {
    if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
      throw new CliError(`sample ${index + 1} must be an object`);
    }
    const allowedKeys = new Set([
      "id",
      "actor_id",
      "evidence_path",
      "evidence_sha256",
      "split",
      "case_id",
      "case_type",
      "arm",
      "outcome",
      "failure_code",
      "reason",
    ]);
    for (const key of Object.keys(sample)) {
      if (!allowedKeys.has(key)) throw new CliError(`sample ${index + 1} has unknown ${key}`);
    }
    for (const key of ["id", "actor_id", "case_id"]) {
      validateStableId(sample[key], `sample ${index + 1} ${key}`);
    }
    if (ids.has(sample.id)) throw new CliError(`duplicate sample id: ${sample.id}`);
    ids.add(sample.id);
    if (!SPLITS.has(sample.split)) throw new CliError(`sample ${sample.id} has unknown split`);
    if (!CASE_TYPES.has(sample.case_type)) throw new CliError(`sample ${sample.id} has unknown case_type`);
    if (!ARMS.has(sample.arm)) throw new CliError(`sample ${sample.id} has unknown arm`);
    if (!OUTCOMES.has(sample.outcome)) throw new CliError(`sample ${sample.id} has unknown outcome`);
    const evidence = validateArtifactRecord(
      { path: sample.evidence_path, sha256: sample.evidence_sha256 },
      `sample ${sample.id} evidence`,
      workspace,
    );
    const reason = sample.reason;
    const failureCode = sample.failure_code;
    if (sample.outcome === "invalid" || sample.outcome === "indeterminate") {
      if (typeof reason !== "string" || !reason.trim()) {
        throw new CliError(`sample ${sample.id} must retain a non-empty reason`);
      }
      if (failureCode !== undefined) {
        throw new CliError(`sample ${sample.id} must not attach failure_code to a non-valid outcome`);
      }
    } else {
      if (reason !== undefined) {
        throw new CliError(`sample ${sample.id} must not attach a reason to a valid outcome`);
      }
      if (sample.outcome === "fail") {
        validateStableId(
          failureCode,
          `sample ${sample.id} failure_code`,
          FAILURE_CODE_PATTERN,
        );
      } else if (failureCode !== undefined) {
        throw new CliError(`sample ${sample.id} pass must not attach failure_code`);
      }
    }

    const assignment = JSON.stringify([sample.split, sample.arm]);
    const priorActor = actorAssignments.get(sample.actor_id);
    if (priorActor !== undefined && priorActor.assignment !== assignment) {
      throw new CliError(`sample ${sample.id} reuses an actor across arms or splits`);
    }
    if (priorActor !== undefined && priorActor.evidence !== sample.evidence_sha256) {
      throw new CliError(`sample ${sample.id} binds one actor to different evidence bundles`);
    }
    const priorEvidence = evidenceAssignments.get(sample.evidence_sha256);
    if (priorEvidence !== undefined && priorEvidence.assignment !== assignment) {
      throw new CliError(`sample ${sample.id} reuses evidence across arms or splits`);
    }
    if (priorEvidence !== undefined && priorEvidence.actor !== sample.actor_id) {
      throw new CliError(`sample ${sample.id} binds one evidence bundle to different actors`);
    }
    actorAssignments.set(sample.actor_id, {
      assignment,
      evidence: sample.evidence_sha256,
    });
    evidenceAssignments.set(sample.evidence_sha256, {
      assignment,
      actor: sample.actor_id,
    });

    const sampleCaseArm = JSON.stringify([
      sample.split,
      sample.arm,
      sample.case_type,
      sample.case_id,
    ]);
    const actorKey = JSON.stringify([sampleCaseArm, sample.actor_id]);
    const evidenceKey = JSON.stringify([sampleCaseArm, sample.evidence_sha256]);
    if (actorsByCaseArm.has(actorKey)) {
      throw new CliError(`sample ${sample.id} duplicates an actor within one case arm`);
    }
    if (evidenceByCaseArm.has(evidenceKey)) {
      throw new CliError(`sample ${sample.id} duplicates evidence within one case arm`);
    }
    actorsByCaseArm.add(actorKey);
    evidenceByCaseArm.add(evidenceKey);
    return {
      id: sample.id,
      actor_id: sample.actor_id,
      evidence_path: sample.evidence_path,
      evidence_sha256: sample.evidence_sha256,
      evidence,
      split: sample.split,
      case_id: sample.case_id,
      case_type: sample.case_type,
      arm: sample.arm,
      outcome: sample.outcome,
      ...(failureCode === undefined ? {} : { failure_code: failureCode }),
      ...(reason === undefined ? {} : { reason: reason.trim() }),
    };
  });

  return {
    artifacts,
    sourceSha: artifacts.source.sha256,
    candidateSha: artifacts.candidate.sha256,
    campaignId: value.campaign_id,
    scenarioSha: artifacts.scenario.sha256,
    rubricSha: artifacts.rubric.sha256,
    environmentSha: artifacts.environment.sha256,
    requiredValid: value.required_valid,
    samples: normalized,
    resultsSha: sha256(rawBuffer),
  };
}

function evaluateCampaign(campaign) {
  const ignoredBySplit = { train: 0, test: 0 };
  const groups = new Map();
  for (const sample of campaign.samples) {
    if (sample.split !== "selection") {
      ignoredBySplit[sample.split] += 1;
      continue;
    }
    const key = JSON.stringify([sample.case_type, sample.case_id]);
    const existing = groups.get(key) ?? {
      case_id: sample.case_id,
      case_type: sample.case_type,
      current: [],
      candidate: [],
    };
    existing[sample.arm].push(sample);
    groups.set(key, existing);
  }

  const important = [];
  const controls = [];
  const reasons = [];
  const sortedGroups = [...groups.values()].sort((left, right) => {
    const byType = asciiCompare(left.case_type, right.case_type);
    return byType === 0 ? asciiCompare(left.case_id, right.case_id) : byType;
  });
  for (const group of sortedGroups) {
    const current = sampleStats(group.current);
    const candidate = sampleStats(group.candidate);
    const failureCounts = new Map();
    for (const sample of group.current) {
      if (sample.outcome !== "fail") continue;
      failureCounts.set(sample.failure_code, (failureCounts.get(sample.failure_code) ?? 0) + 1);
    }
    const repeatedFailureCodes = [...failureCounts.entries()]
      .filter(([, count]) => count >= 2)
      .sort(([left], [right]) => asciiCompare(left, right))
      .map(([failure_code, count]) => ({ failure_code, count }));
    const row = {
      case_id: group.case_id,
      current,
      candidate,
      repeated_current_failure_codes: repeatedFailureCodes,
      delta: current.pass_rate === null || candidate.pass_rate === null
        ? null
        : candidate.pass_rate - current.pass_rate,
    };
    if (current.valid !== campaign.requiredValid) {
      reasons.push(
        `${group.case_type} ${group.case_id}: current has ${current.valid} valid samples; required valid is exactly ${campaign.requiredValid}`,
      );
    }
    if (candidate.valid !== campaign.requiredValid) {
      reasons.push(
        `${group.case_type} ${group.case_id}: candidate has ${candidate.valid} valid samples; required valid is exactly ${campaign.requiredValid}`,
      );
    }
    if (current.valid !== candidate.valid) {
      reasons.push(
        `${group.case_type} ${group.case_id}: current and candidate valid counts must be equal`,
      );
    }
    if (group.case_type === "important") important.push(row);
    else controls.push(row);
  }

  if (important.length === 0) reasons.push("selection evidence has no important case");
  if (controls.length === 0) reasons.push("selection evidence has no control case");

  let strictImprovement = false;
  for (const row of important) {
    if (row.delta === null) continue;
    if (row.delta < 0) reasons.push(`important regression on ${row.case_id}`);
    if (row.delta > 0) {
      if (row.repeated_current_failure_codes.length === 0) {
        reasons.push(
          `important ${row.case_id}: improvement is inconclusive without at least two current failures sharing one failure_code`,
        );
      } else {
        strictImprovement = true;
      }
    }
    if (row.candidate.fail > 0) {
      reasons.push(`candidate failure on important case ${row.case_id}`);
    }
  }
  if (!strictImprovement) reasons.push("candidate shows no strict improvement on any important case");

  for (const row of controls) {
    if (row.delta !== null && row.delta < 0) {
      reasons.push(`control regression on ${row.case_id}`);
    }
  }

  return {
    schema_version: 2,
    decision: reasons.length === 0 ? "accept" : "reject",
    campaign_id: campaign.campaignId,
    scenario_sha256: campaign.scenarioSha,
    rubric_sha256: campaign.rubricSha,
    environment_sha256: campaign.environmentSha,
    source_sha256: campaign.sourceSha,
    candidate_sha256: campaign.candidateSha,
    results_sha256: campaign.resultsSha,
    evaluated_split: "selection",
    required_valid: campaign.requiredValid,
    artifacts: Object.fromEntries(
      Object.entries(campaign.artifacts).map(([name, artifact]) => [
        name,
        { path: artifact.path, sha256: artifact.sha256 },
      ]),
    ),
    ignored_by_split: ignoredBySplit,
    important,
    controls,
    ledger: campaign.samples.map(({ evidence, ...sample }) => sample),
    reasons,
  };
}

function gateCommand(options) {
  validateRuntime();
  const paths = requireOptions(options, ["workspace-root", "results", "report"]);
  const workspace = prepareWorkspace(paths["workspace-root"]);
  assertExistingWithin(workspace.rootReal, paths.results, "gate input");
  assertOutputWithin(workspace, paths.report, "gate report");
  const raw = readRegularFile(paths.results, "results document");
  const campaign = validateCampaign(parseJson(raw, "results document"), raw, workspace);
  const report = evaluateCampaign(campaign);
  writeNewFile(paths.report, `${JSON.stringify(report, null, 2)}\n`);
  if (report.decision !== "accept") {
    throw new CliError(`candidate rejected: ${report.reasons.join("; ")}`, 3);
  }
}

function isWithin(root, target) {
  const path = relative(root, target);
  return path === "" || (
    !isAbsolute(path)
    && !path.startsWith(`..${sep}`)
    && path !== ".."
    && !path.startsWith(sep)
  );
}

function workspaceRelativeParts(value, label) {
  if (typeof value !== "string" || !value) {
    throw new CliError(`${label} path must be a non-empty workspace-relative path`);
  }
  if (isAbsolute(value)
      || value.startsWith("/")
      || value.startsWith("\\\\")
      || /^[A-Za-z]:[\\/]/.test(value)
      || value.includes("\\")) {
    throw new CliError(`${label} path must be workspace-relative and use forward slashes`);
  }
  const parts = value.split("/");
  if (parts.some((part) => !part
      || part === "."
      || part === ".."
      || /[\u0000-\u001f\u007f]/.test(part))) {
    throw new CliError(`${label} path contains traversal or an unstable component`);
  }
  return parts;
}

function readWorkspaceArtifact(workspace, path, expectedSha, label) {
  const parts = workspaceRelativeParts(path, label);
  let current = workspace.rootAbsolute;
  for (let index = 0; index < parts.length; index += 1) {
    current = resolve(current, parts[index]);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      throw new CliError(`${label} does not exist: ${path}`);
    }
    if (stat.isSymbolicLink()) {
      throw new CliError(`${label} must not contain a symbolic link: ${path}`);
    }
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw new CliError(`${label} parent must be a physical directory: ${path}`);
    }
    if (index === parts.length - 1 && !stat.isFile()) {
      throw new CliError(`${label} must be a physical regular file: ${path}`);
    }
  }
  const real = realpathSync(current);
  if (!isWithin(workspace.rootReal, real)) {
    throw new CliError(`${label} resolves outside the workspace root`);
  }
  const bytes = readFileSync(current);
  const actualSha = sha256(bytes);
  if (actualSha !== expectedSha) {
    throw new CliError(`${label} sha256 mismatch: expected ${expectedSha}, got ${actualSha}`);
  }
  return {
    path,
    sha256: actualSha,
    bytes,
    absolute: current,
    real,
  };
}

// V3 reads use one bounded store; Task 2 reuses it for campaign and bundle inputs.
class ArtifactStore {
  constructor(workspace) {
    this.workspace = workspace;
    this.byPhysicalKey = new Map();
    this.countedPhysicalArtifacts = new Set();
    this.campaignBytes = 0;
  }

  readAbsolute(path, expectedSha, label, { skill = false } = {}) {
    const absolute = resolve(path);
    if (!isWithin(this.workspace.rootAbsolute, absolute)) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} is outside the workspace root`,
      );
    }
    const relativePath = relative(this.workspace.rootAbsolute, absolute)
      .split(sep)
      .join("/");
    return this.readRelative(relativePath, expectedSha, label, { skill });
  }

  readRelative(path, expectedSha, label, { skill = false } = {}) {
    let parts;
    try {
      parts = workspaceRelativeParts(path, label);
    } catch (error) {
      throw reclassify(error, "unsafe_path_or_integrity");
    }
    const beforeOpen = this.inspect(parts, path, label);
    if (beforeOpen.stat.size > BigInt(MAX_INPUT_BYTES)) {
      throw classifiedError(
        "usage_or_schema",
        `${label} exceeds the ${MAX_INPUT_BYTES}-byte (8 MiB) input limit`,
      );
    }

    if (!Number.isInteger(fsConstants.O_NOFOLLOW)) {
      throw classifiedError(
        "unsupported_preflight",
        "this runtime does not expose the required O_NOFOLLOW filesystem flag",
      );
    }

    let descriptor;
    try {
      descriptor = openSync(
        beforeOpen.absolute,
        fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
      );
    } catch (error) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} could not be opened without following symbolic links: ${error.message}`,
      );
    }
    try {
      const openedStat = fstatSync(descriptor, { bigint: true });
      const afterOpen = this.inspect(parts, path, label);
      this.assertSameIdentity(openedStat, beforeOpen.stat, label, "changed before open");
      this.assertSameIdentity(openedStat, afterOpen.stat, label, "changed during open");
      if (!openedStat.isFile()) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} descriptor is not a physical regular file`,
        );
      }
      if (openedStat.size > BigInt(MAX_INPUT_BYTES)) {
        throw classifiedError(
          "usage_or_schema",
          `${label} exceeds the ${MAX_INPUT_BYTES}-byte (8 MiB) input limit`,
        );
      }

      const expectedPhysicalKey = expectedSha
        ? `${openedStat.dev}:${openedStat.ino}:${expectedSha}`
        : null;
      const cached = expectedPhysicalKey
        ? this.byPhysicalKey.get(expectedPhysicalKey)
        : null;
      if (cached) {
        this.count(cached, skill, label);
        return cached;
      }

      const bytes = this.readBounded(descriptor, openedStat.size, label);
      const afterReadStat = fstatSync(descriptor, { bigint: true });
      const afterRead = this.inspect(parts, path, label);
      this.assertSameIdentity(openedStat, afterReadStat, label, "descriptor identity changed");
      this.assertSameIdentity(openedStat, afterRead.stat, label, "path changed during read");
      if (afterReadStat.size > BigInt(MAX_INPUT_BYTES) || bytes.length > MAX_INPUT_BYTES) {
        throw classifiedError(
          "usage_or_schema",
          `${label} exceeds the ${MAX_INPUT_BYTES}-byte (8 MiB) input limit`,
        );
      }

      const digest = sha256(bytes);
      if (expectedSha && digest !== expectedSha) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} sha256 mismatch: expected ${expectedSha}, got ${digest}`,
        );
      }
      const physicalKey = `${afterReadStat.dev}:${afterReadStat.ino}:${digest}`;
      const artifact = {
        path,
        absolute: afterRead.absolute,
        real: afterRead.real,
        bytes,
        sha256: digest,
        physicalKey,
      };
      this.byPhysicalKey.set(physicalKey, artifact);
      this.count(artifact, skill, label);
      return artifact;
    } catch (error) {
      if (error instanceof CliError) throw error;
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} descriptor read failed: ${error.message}`,
      );
    } finally {
      try {
        closeSync(descriptor);
      } catch {
        // The process is terminating or continuing with already-owned bytes; never reopen by path.
      }
    }
  }

  inspect(parts, path, label) {
    let absolute = this.workspace.rootAbsolute;
    let stat;
    for (let index = 0; index < parts.length; index += 1) {
      absolute = resolve(absolute, parts[index]);
      try {
        stat = lstatSync(absolute, { bigint: true });
      } catch {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} does not exist: ${path}`,
        );
      }
      if (stat.isSymbolicLink()) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} must not contain a symbolic link: ${path}`,
        );
      }
      if (index < parts.length - 1 && !stat.isDirectory()) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} parent must be a physical directory: ${path}`,
        );
      }
      if (index === parts.length - 1 && !stat.isFile()) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} must be a physical regular file: ${path}`,
        );
      }
    }

    let real;
    try {
      real = realpathSync(absolute);
    } catch (error) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} could not be resolved physically: ${error.message}`,
      );
    }
    if (!isWithin(this.workspace.rootReal, real)) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} resolves outside the workspace root`,
      );
    }
    return { absolute, real, stat };
  }

  assertSameIdentity(actual, expected, label, reason) {
    if (!sameBigIntIdentity(actual, expected)) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} physical identity ${reason}`,
      );
    }
  }

  readBounded(descriptor, initialSize, label) {
    let capacity = Math.max(1, Number(initialSize) + 1);
    let bytes = Buffer.allocUnsafe(capacity);
    let length = 0;
    while (length <= MAX_INPUT_BYTES) {
      if (length === bytes.length) {
        if (bytes.length === MAX_INPUT_BYTES + 1) break;
        capacity = Math.min(
          MAX_INPUT_BYTES + 1,
          Math.max(bytes.length * 2, bytes.length + 64 * 1024),
        );
        const expanded = Buffer.allocUnsafe(capacity);
        bytes.copy(expanded, 0, 0, length);
        bytes = expanded;
      }
      let count;
      try {
        count = readSync(descriptor, bytes, length, bytes.length - length, length);
      } catch (error) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} could not be read through its bound descriptor: ${error.message}`,
        );
      }
      if (count === 0) break;
      length += count;
    }
    return bytes.subarray(0, length);
  }

  count(artifact, skill, label) {
    if (skill || this.countedPhysicalArtifacts.has(artifact.physicalKey)) return;
    const next = this.campaignBytes + artifact.bytes.length;
    if (next > MAX_CAMPAIGN_BYTES) {
      throw classifiedError(
        "usage_or_schema",
        `${label} exceeds the ${MAX_CAMPAIGN_BYTES}-byte (64 MiB) aggregate campaign limit`,
      );
    }
    this.countedPhysicalArtifacts.add(artifact.physicalKey);
    this.campaignBytes = next;
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalJsonLine(value) {
  return `${canonicalJson(value)}\n`;
}

function physicalDirectory(path, label) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    throw new CliError(`${label} does not exist: ${path}`);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new CliError(`${label} must be a physical directory: ${path}`);
  }
  return realpathSync(path);
}

function prepareWorkspace(rootInput) {
  const rootAbsolute = resolve(rootInput);
  return {
    rootAbsolute,
    rootReal: physicalDirectory(rootAbsolute, "workspace root"),
  };
}

function assertOutputWithin(workspace, outputInput, label) {
  const outputAbsolute = resolve(outputInput);
  if (!isWithin(workspace.rootAbsolute, outputAbsolute)) {
    throw new CliError(`${label} is outside the workspace root`);
  }
  if (existsSync(outputAbsolute)) throw new CliError(`${label} already exists`);
  let ancestor = dirname(outputAbsolute);
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) throw new CliError(`could not resolve ${label} ancestor`);
    ancestor = parent;
  }
  const ancestorReal = physicalDirectory(ancestor, `${label} ancestor`);
  if (!isWithin(workspace.rootReal, ancestorReal)) {
    throw new CliError(`${label} ancestor resolves outside the workspace root`);
  }
}

function assertExistingWithin(rootReal, path, label) {
  const real = realpathSync(path);
  if (!isWithin(rootReal, real)) throw new CliError(`${label} is outside the workspace root`);
}

function doctorCommand(options) {
  const runtime = validateRuntime();
  const paths = requireOptions(options, ["workspace-root", "output-parent"]);
  let workspace;
  try {
    workspace = prepareWorkspace(paths["workspace-root"]);
  } catch (error) {
    throw reclassify(error, "unsafe_path_or_integrity");
  }

  const outputAbsolute = resolve(paths["output-parent"]);
  if (!isWithin(workspace.rootAbsolute, outputAbsolute)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "doctor output parent is outside the workspace root",
    );
  }
  let outputReal;
  try {
    outputReal = physicalDirectory(outputAbsolute, "doctor output parent");
  } catch (error) {
    throw reclassify(error, "unsafe_path_or_integrity");
  }
  if (!isWithin(workspace.rootReal, outputReal)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "doctor output parent resolves outside the workspace root",
    );
  }

  let workspaceStat;
  let outputStat;
  try {
    workspaceStat = lstatSync(workspace.rootReal);
    outputStat = lstatSync(outputAbsolute);
  } catch (error) {
    throw classifiedError(
      "unsupported_preflight",
      `could not inspect doctor filesystem: ${error.message}`,
    );
  }
  if (workspaceStat.dev !== outputStat.dev) {
    throw classifiedError(
      "unsupported_preflight",
      "workspace and output parent are not on the same device",
    );
  }
  if ((outputStat.mode & 0o077) !== 0) {
    throw classifiedError(
      "unsupported_preflight",
      "doctor output parent must be private (no group or other permissions)",
    );
  }

  let probeDirectory;
  let probeFailure = null;
  let cleanupFailure = null;
  try {
    probeDirectory = mkdtempSync(resolve(outputReal, ".skill-lab-doctor-"));
    const probeDirectoryStat = lstatSync(probeDirectory);
    if (!probeDirectoryStat.isDirectory() || (probeDirectoryStat.mode & 0o077) !== 0) {
      throw new Error("private probe directory permissions are unsupported");
    }
    const source = resolve(probeDirectory, "source");
    const linked = resolve(probeDirectory, "linked");
    writeFileSync(source, "skill-lab-doctor\n", { mode: 0o600, flag: "wx" });
    const sourceStat = lstatSync(source);
    if (!sourceStat.isFile()
        || sourceStat.isSymbolicLink()
        || (sourceStat.mode & 0o077) !== 0
        || sourceStat.dev !== workspaceStat.dev) {
      throw new Error("private same-device probe file semantics are unsupported");
    }
    linkSync(source, linked);
    if (!samePhysicalFile(source, linked)) {
      throw new Error("hard-link identity could not be verified");
    }
  } catch (error) {
    probeFailure = error;
  } finally {
    if (probeDirectory) {
      try {
        rmSync(probeDirectory, { recursive: true });
        if (existsSync(probeDirectory)) throw new Error("probe directory still exists");
      } catch (error) {
        cleanupFailure = error;
      }
    }
  }
  if (probeFailure || cleanupFailure) {
    const reasons = [probeFailure, cleanupFailure]
      .filter(Boolean)
      .map((error) => error.message)
      .join("; ");
    throw classifiedError(
      "unsupported_preflight",
      `doctor filesystem probe failed: ${reasons}`,
    );
  }

  const report = {
    schema: DOCTOR_REPORT_SCHEMA_V3,
    status: "ready",
    runtime,
    exit_codes: EXIT_CODES,
    limits: {
      max_input_bytes: MAX_INPUT_BYTES,
      max_campaign_bytes: MAX_CAMPAIGN_BYTES,
      max_bundle_bytes: MAX_BUNDLE_BYTES,
      max_sample_rows: MAX_SAMPLE_ROWS,
      required_valid_min: MIN_REQUIRED_VALID,
      required_valid_max: MAX_REQUIRED_VALID,
    },
    checks: {
      workspace_physical: true,
      output_parent_contained: true,
      output_parent_private: true,
      same_device: true,
      hard_link: true,
      probe_cleaned: true,
    },
  };
  process.stdout.write(canonicalJsonLine(report));
}

function prepareStageDestination(rootInput, outputInput) {
  const workspace = prepareWorkspace(rootInput);
  const outputAbsolute = resolve(outputInput);
  if (!isWithin(workspace.rootAbsolute, outputAbsolute)) {
    throw new CliError("output directory is outside the workspace root");
  }
  if (existsSync(outputAbsolute)) throw new CliError("output directory already exists");

  let ancestor = dirname(outputAbsolute);
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) throw new CliError("could not resolve output ancestor");
    ancestor = parent;
  }
  const ancestorReal = physicalDirectory(ancestor, "output ancestor");
  if (!isWithin(workspace.rootReal, ancestorReal)) {
    throw new CliError("output ancestor resolves outside the workspace root");
  }
  return { rootReal: workspace.rootReal, outputAbsolute };
}

function stageCommand(options) {
  validateRuntime();
  const paths = requireOptions(options, [
    "workspace-root",
    "source",
    "candidate",
    "edits",
    "apply-report",
    "results",
    "gate-report",
    "output-dir",
  ]);
  const workspace = prepareWorkspace(paths["workspace-root"]);
  const destination = prepareStageDestination(paths["workspace-root"], paths["output-dir"]);
  const inputs = [
    paths.source,
    paths.candidate,
    paths.edits,
    paths["apply-report"],
    paths.results,
    paths["gate-report"],
  ];
  for (const input of inputs) assertExistingWithin(destination.rootReal, input, "stage input");

  const sourceBuffer = readRegularFile(paths.source, "source Skill");
  const candidateBuffer = readRegularFile(paths.candidate, "candidate Skill");
  const editsBuffer = readRegularFile(paths.edits, "edits document");
  const applyBuffer = readRegularFile(paths["apply-report"], "apply report");
  const resultsBuffer = readRegularFile(paths.results, "results document");
  const gateBuffer = readRegularFile(paths["gate-report"], "gate report");
  const source = decodeUtf8(sourceBuffer, "source Skill");
  const candidate = decodeUtf8(candidateBuffer, "candidate Skill");
  validateSkill(source);
  validateSkill(candidate);
  const sourceSha = sha256(sourceBuffer);
  const candidateSha = sha256(candidateBuffer);
  if (sourceSha === candidateSha) throw new CliError("candidate must differ from source");

  const applyReport = parseJson(applyBuffer, "apply report");
  const gateReport = parseJson(gateBuffer, "gate report");
  const recomputedApply = buildApplyResult(sourceBuffer, editsBuffer);
  if (recomputedApply.candidate !== candidate) {
    throw new CliError("candidate does not match a fresh application of the bound edits");
  }
  if (canonicalJson(applyReport) !== canonicalJson(recomputedApply.report)) {
    throw new CliError("apply report does not match a fresh application of the bound edits");
  }

  const recomputedCampaign = validateCampaign(
    parseJson(resultsBuffer, "results document"),
    resultsBuffer,
    workspace,
  );
  for (const [name, input] of [["source", paths.source], ["candidate", paths.candidate]]) {
    const inputReal = realpathSync(input);
    if (inputReal !== recomputedCampaign.artifacts[name].real) {
      throw new CliError(
        `results artifacts.${name} path does not identify the staged ${name} file`,
      );
    }
  }
  const recomputedGate = evaluateCampaign(recomputedCampaign);
  if (recomputedGate.decision !== "accept") {
    throw new CliError("recomputed gate rejected the candidate", 4);
  }
  if (canonicalJson(gateReport) !== canonicalJson(recomputedGate)) {
    throw new CliError("gate report does not match the bound results", 4);
  }
  for (const report of [recomputedApply.report, recomputedGate]) {
    if (report.source_sha256 !== sourceSha || report.candidate_sha256 !== candidateSha) {
      throw new CliError("bound report does not match current source and candidate");
    }
  }

  const parent = dirname(destination.outputAbsolute);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const parentReal = physicalDirectory(parent, "stage output parent");
  if (!isWithin(destination.rootReal, parentReal)) {
    throw new CliError("stage output parent resolves outside the workspace root");
  }

  const evidenceByDigest = new Map();
  for (const sample of recomputedCampaign.samples) {
    const existing = evidenceByDigest.get(sample.evidence_sha256);
    if (existing && !existing.bytes.equals(sample.evidence.bytes)) {
      throw new CliError("evidence digest collision has inconsistent bytes");
    }
    const entry = existing ?? {
      bytes: sample.evidence.bytes,
      workspacePaths: new Set(),
      sampleIds: new Set(),
    };
    entry.workspacePaths.add(sample.evidence_path);
    entry.sampleIds.add(sample.id);
    evidenceByDigest.set(sample.evidence_sha256, entry);
  }

  const files = new Map([
    ["source_SKILL.md", sourceBuffer],
    ["proposed_SKILL.md", candidateBuffer],
    ["edits.json", editsBuffer],
    ["results.json", resultsBuffer],
    ["apply/report.json", applyBuffer],
    ["gate/report.json", gateBuffer],
    ["campaign/scenario.bin", recomputedCampaign.artifacts.scenario.bytes],
    ["campaign/rubric.bin", recomputedCampaign.artifacts.rubric.bytes],
    ["campaign/environment.bin", recomputedCampaign.artifacts.environment.bytes],
  ]);
  for (const [digest, entry] of evidenceByDigest) {
    files.set(`evidence/${digest}.bin`, entry.bytes);
  }

  const packagedArtifacts = {
    source: "source_SKILL.md",
    candidate: "proposed_SKILL.md",
    scenario: "campaign/scenario.bin",
    rubric: "campaign/rubric.bin",
    environment: "campaign/environment.bin",
  };
  const manifest = {
    schema_version: 2,
    campaign_id: recomputedCampaign.campaignId,
    results_sha256: sha256(resultsBuffer),
    edits_sha256: sha256(editsBuffer),
    apply_report_sha256: sha256(applyBuffer),
    gate_report_sha256: sha256(gateBuffer),
    artifacts: Object.fromEntries(
      Object.entries(packagedArtifacts).map(([name, packagedPath]) => [
        name,
        {
          workspace_path: recomputedCampaign.artifacts[name].path,
          packaged_path: packagedPath,
          sha256: recomputedCampaign.artifacts[name].sha256,
        },
      ]),
    ),
    evidence: Object.fromEntries(
      [...evidenceByDigest.entries()]
        .sort(([left], [right]) => asciiCompare(left, right))
        .map(([digest, entry]) => [
          digest,
          {
            packaged_path: `evidence/${digest}.bin`,
            sha256: digest,
            workspace_paths: [...entry.workspacePaths].sort(asciiCompare),
            sample_ids: [...entry.sampleIds].sort(asciiCompare),
          },
        ]),
    ),
    files: Object.fromEntries(
      [...files.entries()]
        .sort(([left], [right]) => asciiCompare(left, right))
        .map(([name, bytes]) => [
          name,
          { sha256: sha256(bytes), bytes: bytes.length },
        ]),
    ),
  };
  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);

  const temp = mkdtempSync(resolve(parent, ".skill-lab-stage-"));
  let success = false;
  try {
    for (const [name, bytes] of files) {
      const tempPath = resolve(temp, name);
      mkdirSync(dirname(tempPath), { recursive: true, mode: 0o700 });
      writeFileSync(tempPath, bytes, { mode: 0o600, flag: "wx" });
    }
    writeFileSync(resolve(temp, "manifest.json"), manifestBuffer, {
      mode: 0o600,
      flag: "wx",
    });

    // mkdir is the no-replace reservation primitive. Unlike POSIX rename, it
    // cannot replace a concurrently-created empty directory.
    mkdirSync(destination.outputAbsolute, { mode: 0o700 });
    for (const [name] of [...files.entries()].sort(([left], [right]) => asciiCompare(left, right))) {
      const outputPath = resolve(destination.outputAbsolute, name);
      mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
      linkSync(resolve(temp, name), outputPath);
    }
    // A staged directory is complete only after this final no-replace link.
    linkSync(resolve(temp, "manifest.json"), resolve(destination.outputAbsolute, "manifest.json"));
    success = true;
  } catch (error) {
    bestEffortRemoveTree(temp);
    if (error instanceof CliError) throw error;
    throw new CliError(`could not stage candidate: ${error.message}`);
  }
  bestEffortRemoveTree(temp);
  if (!success) throw new CliError("could not stage candidate");
}

function main() {
  const [command, ...tokens] = process.argv.slice(2);
  if (!command) throw new CliError("missing command; expected apply, doctor, gate, or stage");
  const options = parseOptions(tokens);
  if (command === "apply") applyCommand(options);
  else if (command === "doctor") doctorCommand(options);
  else if (command === "gate") gateCommand(options);
  else if (command === "stage") stageCommand(options);
  else throw new CliError(`unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const status = error instanceof CliError && error.status ? `${error.status}: ` : "";
  process.stderr.write(`skill-lab: ${status}${message}\n`);
  process.exitCode = error instanceof CliError ? error.exitCode : 2;
}
