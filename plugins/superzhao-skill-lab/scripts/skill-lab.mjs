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
  readdirSync,
  readSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HARD_MAX_EDITS = 4;
const HARD_MAX_EDIT_BYTES = 4096;
const HARD_MAX_PATCH_BYTES = 8192;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_CAMPAIGN_BYTES = 64 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 96 * 1024 * 1024;
const MAX_SAMPLE_ROWS = 1000;
const MIN_REQUIRED_VALID = 5;
const MAX_REQUIRED_VALID = 20;
const CAMPAIGN_ARTIFACT_KINDS = new Set([
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
const PATCH_SCHEMA_V3 = "superzhao.skill-lab.patch/v3";
const CASES_SCHEMA_V3 = "superzhao.skill-lab.cases/v3";
const SAMPLES_SCHEMA_V3 = "superzhao.skill-lab.samples/v3";
const ACTOR_RUN_SCHEMA_V3 = "superzhao.skill-lab.actor-run/v3";
const SCORER_RECORD_SCHEMA_V3 = "superzhao.skill-lab.scorer-record/v3";
const GATE_REPORT_SCHEMA_V3 = "superzhao.skill-lab.gate-report/v3";
const BUNDLE_MANIFEST_SCHEMA_V3 = "superzhao.skill-lab.bundle-manifest/v3";
const ANCHORED_PUBLISHER_PROTOCOL = "superzhao.skill-lab.anchored-publisher/v1";
const ANCHORED_PUBLISHER_SOURCE = String.raw`
"use strict";
const {
  closeSync,
  constants,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmdirSync,
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

function requireOwnedDirectory(name, expected, label) {
  const stat = lstatRelative(name);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory() || !sameIdentity(stat, expected)) {
    fail("unsafe_path_or_integrity", label + " physical identity changed");
  }
  return stat;
}

function removeOwnedDirectory(name, expected) {
  const stat = lstatRelative(name);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory() || !sameIdentity(stat, expected)) {
    return "foreign";
  }
  rmdirSync(name);
  return "removed";
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
    if ((after.mode & 0o777n) !== 0o600n) {
      fail("publication_failure", "created file mode is not 0600");
    }
    if (typeof process.geteuid === "function" && after.uid !== BigInt(process.geteuid())) {
      fail("unsafe_path_or_integrity", "created file is not owned by the effective uid");
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

function createDirectory(request) {
  const name = requireBasename(request.name, "directory");
  anchorWorkingDirectory(request);
  if (lstatRelative(name)) fail("publication_failure", "output already exists");
  let identity;
  try {
    mkdirSync(name, { mode: 0o700 });
    const stat = lstatRelative(name);
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory() || stat.ino === 0n) {
      fail("unsafe_path_or_integrity", "created directory is not a physical directory");
    }
    identity = { dev: stat.dev, ino: stat.ino };
    requireOwnedDirectory(name, identity, "created directory");
    if ((stat.mode & 0o777n) !== 0o700n) {
      fail("publication_failure", "created directory mode is not 0700");
    }
    if (typeof process.geteuid === "function" && stat.uid !== BigInt(process.geteuid())) {
      fail("unsafe_path_or_integrity", "created directory is not owned by the effective uid");
    }
  } catch (error) {
    if (identity) {
      try { removeOwnedDirectory(name, identity); } catch {}
    }
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

function requireSourceParent(request) {
  const expected = parseIdentity(request.expected_source_parent, "temporary source parent");
  let descriptor;
  try {
    descriptor = openSync(
      "..",
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const actual = fstatSync(descriptor, { bigint: true });
    if (!actual.isDirectory() || !sameIdentity(actual, expected)) {
      fail(
        "unsafe_path_or_integrity",
        "temporary source parent identity does not match the verified output parent",
      );
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function publishLinkFromParent(request) {
  const source = requireBasename(request.source, "temporary source");
  const destination = requireBasename(request.destination, "output");
  const expected = parseIdentity(request.expected_file, "temporary source");
  const sourcePath = "../" + source;
  anchorWorkingDirectory(request);
  requireSourceParent(request);
  requireOwned(sourcePath, expected, "temporary source");
  if (lstatRelative(destination)) {
    fail("publication_failure", "output already exists");
  }
  let linked = false;
  try {
    linkSync(sourcePath, destination);
    linked = true;
    requireOwned(destination, expected, "published output");
    requireOwned(sourcePath, expected, "temporary source");
    requireSourceParent(request);
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
    else if (request.action === "mkdir") result = createDirectory(request);
    else if (request.action === "link") result = publishLink(request);
    else if (request.action === "link-from-parent") result = publishLinkFromParent(request);
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

class PublisherAcknowledgementError extends CliError {
  constructor(message) {
    super(message, EXIT_CODES.publication_failure, "publication_failure");
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

function parseCommandOptions(command, tokens) {
  if (command !== "verify-bundle") {
    if (tokens.some((token) => token === "--legacy-v2" || token.startsWith("--legacy-v2="))) {
      throw new CliError("--legacy-v2 is a bare flag available only for verify-bundle");
    }
    return { options: parseOptions(tokens), legacyV2: false };
  }

  const options = new Map();
  let legacyV2 = false;
  for (let index = 0; index < tokens.length;) {
    const flag = tokens[index];
    if (flag === "--legacy-v2") {
      if (legacyV2) throw new CliError("duplicate option --legacy-v2");
      legacyV2 = true;
      index += 1;
      continue;
    }
    if (flag?.startsWith("--legacy-v2=")) {
      throw new CliError("--legacy-v2 is a bare boolean and does not accept a value");
    }
    const value = tokens[index + 1];
    if (!flag?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new CliError(`expected --name value or bare --legacy-v2; got ${flag ?? "end of input"}`);
    }
    const name = flag.slice(2);
    if (options.has(name)) throw new CliError(`duplicate option --${name}`);
    options.set(name, value);
    index += 2;
  }
  return { options, legacyV2 };
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

function anchoredV3AcknowledgementHasKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort(asciiCompare);
  const wanted = [...expected].sort(asciiCompare);
  return JSON.stringify(actual) === JSON.stringify(wanted);
}

function anchoredV3SuccessResultIsValid(action, result) {
  if (action === "create" || action === "mkdir") {
    return anchoredV3AcknowledgementHasKeys(result, ["dev", "ino"])
      && /^(0|[1-9][0-9]*)$/.test(result.dev)
      && /^[1-9][0-9]*$/.test(result.ino);
  }
  if (action === "link" || action === "link-from-parent") return result === "linked";
  if (action === "inspect") return new Set(["absent", "foreign", "owned"]).has(result);
  if (action === "unlink") return new Set(["foreign", "removed"]).has(result);
  return false;
}

function invokeAnchoredV3Publisher(anchor, action) {
  anchor.verify();
  const request = {
    protocol: ANCHORED_PUBLISHER_PROTOCOL,
    action: action.action,
    expected_parent: {
      dev: anchor.identity.dev.toString(),
      ino: anchor.identity.ino.toString(),
    },
    ...action,
  };
  const child = spawnSync(
    process.execPath,
    ["--eval", ANCHORED_PUBLISHER_SOURCE],
    {
      cwd: anchor.absolute,
      encoding: "utf8",
      env: {},
      input: JSON.stringify(request),
      maxBuffer: 64 * 1024,
      windowsHide: true,
    },
  );
  anchor.verify();
  if (child.error && new Set(["ENOENT", "ENOTDIR", "ELOOP"]).has(child.error.code)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${anchor.label} anchored publisher cwd identity became unavailable: ${child.error.message}`,
    );
  }
  if (child.error) {
    throw new PublisherAcknowledgementError(
      `${anchor.label} anchored publisher acknowledgement was unavailable: ${child.error.message}`,
    );
  }
  if (child.status !== 0) {
    const detail = child.signal
      ? `signal ${child.signal}`
      : child.stderr?.trim() || `exit ${child.status}`;
    throw new PublisherAcknowledgementError(
      `${anchor.label} anchored publisher acknowledgement was lost: ${detail}`,
    );
  }
  let response;
  try {
    response = JSON.parse(child.stdout);
  } catch {
    throw new PublisherAcknowledgementError(
      `${anchor.label} anchored publisher returned malformed output`,
    );
  }

  if (response?.ok === false
      && anchoredV3AcknowledgementHasKeys(response, ["ok", "status", "message"])
      && new Set(["publication_failure", "unsafe_path_or_integrity"]).has(response.status)
      && typeof response.message === "string") {
    throw classifiedError(
      response.status,
      `${anchor.label} anchored publisher: ${response.message}`,
    );
  }

  if (!anchoredV3AcknowledgementHasKeys(response, ["ok", "result"])
      || response.ok !== true
      || !anchoredV3SuccessResultIsValid(action.action, response.result)) {
    throw new PublisherAcknowledgementError(
      `${anchor.label} anchored publisher returned an invalid acknowledgement`,
    );
  }
  return response.result;
}

function runAnchoredV3Publisher(binding, action) {
  const parentIdentity = binding.parentChain.at(-1);
  return invokeAnchoredV3Publisher({
    absolute: binding.parentAbsolute,
    identity: parentIdentity,
    label: binding.label,
    verify: () => verifyV3OutputParent(binding),
  }, action);
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

function writeOneOutputV3(binding, value) {
  let temporary;
  const state = { attempted: false };
  try {
    assertV3OutputAbsent(binding);
    temporary = createV3TemporarySource(binding, value);
    publishV3Output(binding, temporary, state);
    assertV3OutputOwned(binding, temporary);
  } catch (error) {
    if (state.attempted && temporary) {
      removeV3RelativeIfOwned(binding, basename(binding.absolute), temporary.stat);
    }
    if (temporary) {
      removeV3RelativeIfOwned(binding, temporary.name, temporary.stat);
    }
    if (error instanceof CliError) throw error;
    throw classifiedError(
      "publication_failure",
      `could not publish ${binding.label}: ${error.message}`,
    );
  }
  removeV3RelativeIfOwned(binding, temporary.name, temporary.stat);
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

function planEdits(content, edits, skillValidator = validateSkillV3) {
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

function applyPlannedEdits(source, planned, skillValidator = validateSkillV3) {
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
    if (typeof artifactStore.assertKind === "function") {
      artifactStore.assertKind(
        rejection.report.path,
        rejection.report.sha256,
        "prior-rejection",
        `prior rejection ${rejection.rejection_id} report`,
      );
    }
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

  if (initialPatchValue.schema !== PATCH_SCHEMA_V3) {
    const detail = initialPatchValue.schema_version === 2
      ? "production apply does not accept v2 patches"
      : `production apply requires ${PATCH_SCHEMA_V3}`;
    throw new CliError(detail);
  }
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
}

function validateDigest(value, label) {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new CliError(`${label} must be a lowercase SHA-256 digest`);
  }
}

function validateStableId(value, label, pattern = STABLE_ID_PATTERN) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new CliError(`${label} must be a stable ASCII identifier`);
  }
}

function gateCommand(options) {
  validateRuntime();
  const paths = requireOptions(options, ["workspace-root", "results", "report"]);
  let workspace;
  try {
    workspace = prepareWorkspace(paths["workspace-root"]);
  } catch (error) {
    throw reclassify(error, "unsafe_path_or_integrity");
  }
  const store = new ArtifactStore(workspace);
  const resultsArtifact = store.readAbsolute(paths.results, null, "results document");
  const value = parseJson(resultsArtifact.bytes, "results document");

  if (value.schema === SAMPLES_SCHEMA_V3) {
    const reportBinding = bindV3Output(
      workspace,
      paths.report,
      [paths.results],
      "gate report",
    );
    const campaign = validateCampaignV3(value, resultsArtifact, workspace, store);
    const report = evaluateCampaignV3(campaign);
    writeOneOutputV3(reportBinding, canonicalJsonLine(report));
    if (report.selection.status === "selection_reject") {
      throw new CliError(
        `candidate rejected during selection: ${report.selection.reasons.join("; ")}`,
        EXIT_CODES.selection_rejection,
        "selection_rejection",
      );
    }
    if (report.final.status === "final_reject") {
      throw new CliError(
        `candidate rejected by held-out evidence: ${report.final.reasons.join("; ")}`,
        EXIT_CODES.final_rejection,
        "final_rejection",
      );
    }
    return;
  }

  const detail = value.schema_version === 2
    ? "production gate does not accept v2 sample ledgers"
    : `production gate requires ${SAMPLES_SCHEMA_V3}`;
  throw new CliError(detail);
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

// V3 reads use one bounded store; Task 2 reuses it for campaign and bundle inputs.
class ArtifactStore {
  constructor(workspace) {
    this.workspace = workspace;
    this.byPhysicalKey = new Map();
    this.byLogicalPath = new Map();
    this.byLogicalArtifact = new Map();
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
    const logicalPath = parts.join("/");
    const priorLogicalDigest = this.byLogicalPath.get(logicalPath);
    if (priorLogicalDigest !== undefined
        && expectedSha
        && priorLogicalDigest !== expectedSha) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} reuses logical path ${logicalPath} with a different sha256`,
      );
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
        this.byLogicalPath.set(logicalPath, cached.sha256);
        const logicalArtifact = {
          ...cached,
          path: logicalPath,
          absolute: beforeOpen.absolute,
          real: beforeOpen.real,
        };
        this.byLogicalArtifact.set(logicalPath, logicalArtifact);
        this.count(logicalArtifact, skill, label);
        return logicalArtifact;
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
      const boundLogicalDigest = this.byLogicalPath.get(logicalPath);
      if (boundLogicalDigest !== undefined && boundLogicalDigest !== digest) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} reuses logical path ${logicalPath} with different bytes`,
        );
      }
      this.byLogicalPath.set(logicalPath, digest);
      const physicalKey = `${afterReadStat.dev}:${afterReadStat.ino}:${digest}`;
      const artifact = {
        path: logicalPath,
        absolute: afterRead.absolute,
        real: afterRead.real,
        bytes,
        sha256: digest,
        physicalKey,
      };
      this.byPhysicalKey.set(physicalKey, artifact);
      this.byLogicalArtifact.set(logicalPath, artifact);
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

  retained(path, expectedSha, label) {
    let logicalPath;
    try {
      logicalPath = workspaceRelativeParts(path, label).join("/");
    } catch (error) {
      throw reclassify(error, "unsafe_path_or_integrity");
    }
    const artifact = this.byLogicalArtifact.get(logicalPath);
    if (!artifact || artifact.sha256 !== expectedSha) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} was not retained with its declared logical path and digest`,
      );
    }
    return artifact;
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

function closedObjectV3(value, required, optional, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CliError(`${label} must be an object`);
  }
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new CliError(`${label} has unknown ${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) throw new CliError(`${label} is missing ${key}`);
  }
  return value;
}

function requireNonBlankV3(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new CliError(`${label} must be a non-empty string`);
  }
  return value;
}

function readArtifactDescriptorV3(store, value, label, options = {}) {
  closedObjectV3(value, ["path", "sha256"], [], label);
  validateDigest(value.sha256, `${label} sha256`);
  const artifact = store.readRelative(value.path, value.sha256, label, options);
  if (options.kind && typeof store.assertKind === "function") {
    store.assertKind(value.path, value.sha256, options.kind, label);
  }
  return artifact;
}

function sameArtifactDescriptorV3(left, right) {
  return left.path === right.path && left.sha256 === right.sha256;
}

function requireUniqueV3(set, value, label) {
  if (set.has(value)) throw new CliError(`duplicate ${label}: ${value}`);
  set.add(value);
}

function bindProfileIdentityV3(assignments, id, digest, label) {
  const prior = assignments.get(id);
  if (prior !== undefined && prior !== digest) {
    throw new CliError(`${label} ${id} is bound to multiple profile digests`);
  }
  assignments.set(id, digest);
}

function validateCaseInventoryV3(value, artifact, store) {
  closedObjectV3(
    value,
    ["schema", "campaign_id", "required_valid", "cases"],
    [],
    "case inventory",
  );
  if (value.schema !== CASES_SCHEMA_V3) {
    throw new CliError(`case inventory schema must be ${CASES_SCHEMA_V3}`);
  }
  validateStableId(value.campaign_id, "case inventory campaign_id");
  if (!Number.isInteger(value.required_valid)
      || value.required_valid < MIN_REQUIRED_VALID
      || value.required_valid > MAX_REQUIRED_VALID) {
    throw new CliError(
      `case inventory required_valid must be an integer between ${MIN_REQUIRED_VALID} and ${MAX_REQUIRED_VALID}`,
    );
  }
  if (!Array.isArray(value.cases) || value.cases.length < 4 || value.cases.length > MAX_SAMPLE_ROWS) {
    throw new CliError("case inventory cases must contain between 4 and 1000 rows");
  }

  const ids = new Set();
  const normalized = value.cases.map((row, index) => {
    const label = `case inventory row ${index + 1}`;
    closedObjectV3(
      row,
      ["case_id", "split", "case_type", "prompt", "rubric"],
      [],
      label,
    );
    validateStableId(row.case_id, `${label} case_id`);
    requireUniqueV3(ids, row.case_id, "case_id");
    if (!SPLITS.has(row.split)) throw new CliError(`${label} has unknown split`);
    if (!CASE_TYPES.has(row.case_type)) throw new CliError(`${label} has unknown case_type`);
    const prompt = readArtifactDescriptorV3(
      store,
      row.prompt,
      `${label} prompt`,
      { kind: "prompt" },
    );
    const rubric = readArtifactDescriptorV3(
      store,
      row.rubric,
      `${label} rubric`,
      { kind: "rubric" },
    );
    return {
      case_id: row.case_id,
      split: row.split,
      case_type: row.case_type,
      prompt: { path: row.prompt.path, sha256: prompt.sha256 },
      rubric: { path: row.rubric.path, sha256: rubric.sha256 },
    };
  });

  for (const split of ["selection", "test"]) {
    for (const caseType of ["important", "control"]) {
      if (!normalized.some((row) => row.split === split && row.case_type === caseType)) {
        throw new CliError(`case inventory requires a ${split} ${caseType} case`);
      }
    }
  }
  const selectionPrompts = new Set(
    normalized.filter((row) => row.split === "selection").map((row) => row.prompt.sha256),
  );
  if (normalized.some((row) => row.split === "test" && selectionPrompts.has(row.prompt.sha256))) {
    throw new CliError("selection and test prompt digests must be disjoint");
  }
  return {
    artifact,
    campaignId: value.campaign_id,
    requiredValid: value.required_valid,
    cases: normalized,
    byId: new Map(normalized.map((row) => [row.case_id, row])),
  };
}

function assertSampleFieldV3(record, sample, field, recordLabel) {
  if (record[field] !== sample[field]) {
    throw new CliError(`${recordLabel} ${field} does not match sample ${sample.sample_id}`);
  }
}

function validateActorRunV3(sample, descriptor, campaignCase, store, state) {
  const artifact = readArtifactDescriptorV3(
    store,
    descriptor,
    `sample ${sample.sample_id} actor_run`,
    { kind: "actor-run" },
  );
  const value = parseJson(artifact.bytes, `sample ${sample.sample_id} actor run`);
  const required = [
    "schema",
    "sample_id",
    "run_id",
    "actor_instance_id",
    "actor_profile_id",
    "case_id",
    "split",
    "case_type",
    "arm",
    "skill_sha256",
    "actor_profile",
    "prompt",
    "environment",
    "harness_model_profile",
    "transcript",
  ];
  closedObjectV3(value, required, [], `sample ${sample.sample_id} actor run`);
  if (value.schema !== ACTOR_RUN_SCHEMA_V3) {
    throw new CliError(`sample ${sample.sample_id} actor run schema must be ${ACTOR_RUN_SCHEMA_V3}`);
  }
  for (const field of [
    "sample_id",
    "run_id",
    "actor_instance_id",
    "actor_profile_id",
    "case_id",
    "split",
    "case_type",
    "arm",
    "skill_sha256",
  ]) {
    assertSampleFieldV3(value, sample, field, "actor run");
  }
  const actorProfile = readArtifactDescriptorV3(
    store,
    value.actor_profile,
    `sample ${sample.sample_id} actor profile`,
    { kind: "actor-profile" },
  );
  const prompt = readArtifactDescriptorV3(
    store,
    value.prompt,
    `sample ${sample.sample_id} prompt`,
    { kind: "prompt" },
  );
  if (!sameArtifactDescriptorV3(prompt, campaignCase.prompt)) {
    throw new CliError(`sample ${sample.sample_id} actor prompt does not match case inventory`);
  }
  const environment = readArtifactDescriptorV3(
    store,
    value.environment,
    `sample ${sample.sample_id} environment`,
    { kind: "environment" },
  );
  const harnessModelProfile = readArtifactDescriptorV3(
    store,
    value.harness_model_profile,
    `sample ${sample.sample_id} harness/model profile`,
    { kind: "harness-model-profile" },
  );
  const transcript = readArtifactDescriptorV3(
    store,
    value.transcript,
    `sample ${sample.sample_id} transcript`,
    { kind: "transcript" },
  );
  requireUniqueV3(state.transcriptDigests, transcript.sha256, "transcript sha256");
  bindProfileIdentityV3(
    state.actorProfiles,
    sample.actor_profile_id,
    actorProfile.sha256,
    "actor_profile_id",
  );
  return {
    artifact,
    actorProfile,
    prompt,
    environment,
    harnessModelProfile,
    transcript,
  };
}

function validateScorerRecordV3(sample, descriptor, campaignCase, actorRun, store, state) {
  const artifact = readArtifactDescriptorV3(
    store,
    descriptor,
    `sample ${sample.sample_id} scorer_record`,
    { kind: "scorer-record" },
  );
  const value = parseJson(artifact.bytes, `sample ${sample.sample_id} scorer record`);
  const required = [
    "schema",
    "sample_id",
    "run_id",
    "scorer_run_id",
    "scorer_profile_id",
    "scorer_version",
    "scorer_profile",
    "rubric",
    "transcript",
    "scorer_output",
    "status",
  ];
  closedObjectV3(
    value,
    required,
    ["outcome", "failure_code", "reason"],
    `sample ${sample.sample_id} scorer record`,
  );
  if (value.schema !== SCORER_RECORD_SCHEMA_V3) {
    throw new CliError(
      `sample ${sample.sample_id} scorer record schema must be ${SCORER_RECORD_SCHEMA_V3}`,
    );
  }
  for (const field of ["sample_id", "run_id", "scorer_run_id"]) {
    assertSampleFieldV3(value, sample, field, "scorer record");
  }
  validateStableId(value.scorer_profile_id, `sample ${sample.sample_id} scorer_profile_id`);
  requireNonBlankV3(value.scorer_version, `sample ${sample.sample_id} scorer_version`);
  const scorerProfile = readArtifactDescriptorV3(
    store,
    value.scorer_profile,
    `sample ${sample.sample_id} scorer profile`,
    { kind: "scorer-profile" },
  );
  const rubric = readArtifactDescriptorV3(
    store,
    value.rubric,
    `sample ${sample.sample_id} rubric`,
    { kind: "rubric" },
  );
  if (!sameArtifactDescriptorV3(rubric, campaignCase.rubric)) {
    throw new CliError(`sample ${sample.sample_id} scorer rubric does not match case inventory`);
  }
  const transcript = readArtifactDescriptorV3(
    store,
    value.transcript,
    `sample ${sample.sample_id} scorer transcript`,
    { kind: "transcript" },
  );
  if (!sameArtifactDescriptorV3(transcript, actorRun.transcript)) {
    throw new CliError(
      `sample ${sample.sample_id} scorer transcript does not match actor transcript`,
    );
  }
  const scorerOutput = readArtifactDescriptorV3(
    store,
    value.scorer_output,
    `sample ${sample.sample_id} scorer output`,
    { kind: "scorer-output" },
  );
  requireUniqueV3(state.scorerOutputDigests, scorerOutput.sha256, "scorer_output sha256");
  bindProfileIdentityV3(
    state.scorerProfiles,
    value.scorer_profile_id,
    scorerProfile.sha256,
    "scorer_profile_id",
  );
  for (const field of ["status", "outcome", "failure_code", "reason"]) {
    if (value[field] !== sample[field]) {
      throw new CliError(
        `scorer record ${field} does not match sample ${sample.sample_id}`,
      );
    }
  }
  return {
    artifact,
    scorerProfile,
    rubric,
    transcript,
    scorerOutput,
    scorerProfileId: value.scorer_profile_id,
  };
}

function validateSampleShapeV3(sample, index) {
  const label = `sample row ${index + 1}`;
  const required = [
    "sample_id",
    "run_id",
    "actor_instance_id",
    "actor_profile_id",
    "case_id",
    "split",
    "case_type",
    "arm",
    "skill_sha256",
    "status",
  ];
  closedObjectV3(
    sample,
    required,
    ["actor_run", "scorer_run_id", "scorer_record", "outcome", "failure_code", "reason"],
    label,
  );
  for (const field of [
    "sample_id",
    "run_id",
    "actor_instance_id",
    "actor_profile_id",
    "case_id",
  ]) {
    validateStableId(sample[field], `${label} ${field}`);
  }
  if (!SPLITS.has(sample.split)) throw new CliError(`${label} has unknown split`);
  if (!CASE_TYPES.has(sample.case_type)) throw new CliError(`${label} has unknown case_type`);
  if (!ARMS.has(sample.arm)) throw new CliError(`${label} has unknown arm`);
  validateDigest(sample.skill_sha256, `${label} skill_sha256`);
  if (!new Set(["valid", "invalid", "indeterminate"]).has(sample.status)) {
    throw new CliError(`${label} has unknown status`);
  }

  if (sample.status === "valid") {
    for (const field of ["actor_run", "scorer_run_id", "scorer_record", "outcome"]) {
      if (!Object.hasOwn(sample, field)) throw new CliError(`${label} valid row is missing ${field}`);
    }
    if (Object.hasOwn(sample, "reason")) throw new CliError(`${label} valid row must not have reason`);
    if (!new Set(["pass", "fail"]).has(sample.outcome)) {
      throw new CliError(`${label} valid row has unknown outcome`);
    }
    if (sample.outcome === "fail") {
      validateStableId(sample.failure_code, `${label} failure_code`, FAILURE_CODE_PATTERN);
    } else if (Object.hasOwn(sample, "failure_code")) {
      throw new CliError(`${label} passing row must not have failure_code`);
    }
  } else {
    requireNonBlankV3(sample.reason, `${label} reason`);
    if (Object.hasOwn(sample, "outcome") || Object.hasOwn(sample, "failure_code")) {
      throw new CliError(`${label} non-valid row must not have outcome or failure_code`);
    }
  }
  const scorerIdPresent = Object.hasOwn(sample, "scorer_run_id");
  const scorerRecordPresent = Object.hasOwn(sample, "scorer_record");
  if (scorerIdPresent !== scorerRecordPresent) {
    throw new CliError(`${label} scorer_run_id and scorer_record must appear together`);
  }
  if (scorerRecordPresent && !Object.hasOwn(sample, "actor_run")) {
    throw new CliError(`${label} scorer_record requires actor_run transcript evidence`);
  }
  if (scorerIdPresent) validateStableId(sample.scorer_run_id, `${label} scorer_run_id`);
}

function assertProfileParityV3(samples, inventory) {
  for (const campaignCase of inventory.cases) {
    const valid = samples.filter(
      (sample) => sample.case_id === campaignCase.case_id && sample.status === "valid",
    );
    for (const [name, field] of [
      ["actor", "actorProfileSha"],
      ["scorer", "scorerProfileSha"],
    ]) {
      const current = valid
        .filter((sample) => sample.arm === "current")
        .map((sample) => sample[field])
        .sort(asciiCompare);
      const candidate = valid
        .filter((sample) => sample.arm === "candidate")
        .map((sample) => sample[field])
        .sort(asciiCompare);
      if (current.length !== inventory.requiredValid
          || candidate.length !== inventory.requiredValid) {
        continue;
      }
      if (JSON.stringify(current) !== JSON.stringify(candidate)) {
        throw new CliError(
          `${campaignCase.case_id} ${name} profile digest multiset must match across arms`,
        );
      }
    }
  }
}

function validateCampaignV3(value, resultsArtifact, workspace, store) {
  closedObjectV3(
    value,
    ["schema", "campaign_id", "source", "candidate", "cases", "samples"],
    [],
    "sample ledger",
  );
  if (value.schema !== SAMPLES_SCHEMA_V3) {
    throw new CliError(`sample ledger schema must be ${SAMPLES_SCHEMA_V3}`);
  }
  validateStableId(value.campaign_id, "sample ledger campaign_id");

  const source = readArtifactDescriptorV3(
    store,
    value.source,
    "source Skill",
    { skill: true, kind: "source-skill" },
  );
  const candidate = readArtifactDescriptorV3(
    store,
    value.candidate,
    "candidate Skill",
    { skill: true, kind: "candidate-skill" },
  );
  validateSkillV3(decodeUtf8(source.bytes, "source Skill"));
  validateSkillV3(decodeUtf8(candidate.bytes, "candidate Skill"));
  if (source.sha256 === candidate.sha256) {
    throw new CliError("source and candidate Skill digests must differ");
  }

  const casesArtifact = readArtifactDescriptorV3(
    store,
    value.cases,
    "case inventory",
    { kind: "cases" },
  );
  const inventory = validateCaseInventoryV3(
    parseJson(casesArtifact.bytes, "case inventory"),
    casesArtifact,
    store,
  );
  if (value.campaign_id !== inventory.campaignId) {
    throw new CliError("sample ledger campaign_id does not match case inventory");
  }
  if (!Array.isArray(value.samples)
      || value.samples.length < 1
      || value.samples.length > MAX_SAMPLE_ROWS) {
    throw new CliError("sample ledger samples must contain between 1 and 1000 rows");
  }

  const state = {
    sampleIds: new Set(),
    runIds: new Set(),
    actorInstanceIds: new Set(),
    scorerRunIds: new Set(),
    transcriptDigests: new Set(),
    scorerOutputDigests: new Set(),
    actorProfiles: new Map(),
    scorerProfiles: new Map(),
  };
  const normalized = [];
  for (const [index, sample] of value.samples.entries()) {
    validateSampleShapeV3(sample, index);
    requireUniqueV3(state.sampleIds, sample.sample_id, "sample_id");
    requireUniqueV3(state.runIds, sample.run_id, "run_id");
    requireUniqueV3(state.actorInstanceIds, sample.actor_instance_id, "actor_instance_id");
    if (Object.hasOwn(sample, "scorer_run_id")) {
      requireUniqueV3(state.scorerRunIds, sample.scorer_run_id, "scorer_run_id");
    }
    const campaignCase = inventory.byId.get(sample.case_id);
    if (!campaignCase) throw new CliError(`sample ${sample.sample_id} references an unknown case_id`);
    if (sample.split !== campaignCase.split || sample.case_type !== campaignCase.case_type) {
      throw new CliError(`sample ${sample.sample_id} split or case_type does not match inventory`);
    }
    const expectedSkill = sample.arm === "current" ? source.sha256 : candidate.sha256;
    if (sample.skill_sha256 !== expectedSkill) {
      throw new CliError(
        `sample ${sample.sample_id} ${sample.arm} arm must bind the ${sample.arm} Skill digest`,
      );
    }

    let actorRun = null;
    if (Object.hasOwn(sample, "actor_run")) {
      actorRun = validateActorRunV3(sample, sample.actor_run, campaignCase, store, state);
    }
    let scorerRecord = null;
    if (Object.hasOwn(sample, "scorer_record")) {
      scorerRecord = validateScorerRecordV3(
        sample,
        sample.scorer_record,
        campaignCase,
        actorRun,
        store,
        state,
      );
    }
    normalized.push({
      sample_id: sample.sample_id,
      run_id: sample.run_id,
      actor_instance_id: sample.actor_instance_id,
      actor_profile_id: sample.actor_profile_id,
      case_id: sample.case_id,
      split: sample.split,
      case_type: sample.case_type,
      arm: sample.arm,
      skill_sha256: sample.skill_sha256,
      status: sample.status,
      ...(sample.outcome === undefined ? {} : { outcome: sample.outcome }),
      ...(sample.failure_code === undefined ? {} : { failure_code: sample.failure_code }),
      ...(sample.reason === undefined ? {} : { reason: sample.reason }),
      actorProfileSha: actorRun?.actorProfile.sha256 ?? null,
      scorerProfileSha: scorerRecord?.scorerProfile.sha256 ?? null,
    });
  }
  assertProfileParityV3(normalized, inventory);
  return {
    workspace,
    store,
    campaignId: value.campaign_id,
    requiredValid: inventory.requiredValid,
    sourceSha: source.sha256,
    candidateSha: candidate.sha256,
    casesSha: casesArtifact.sha256,
    samplesSha: resultsArtifact.sha256,
    inventory,
    samples: normalized,
    sourceArtifact: source,
    candidateArtifact: candidate,
    casesArtifact,
  };
}

function sampleStatsV3(samples) {
  const stats = { pass: 0, fail: 0, invalid: 0, indeterminate: 0, valid: 0 };
  for (const sample of samples) {
    if (sample.status === "valid") {
      stats.valid += 1;
      stats[sample.outcome] += 1;
    } else {
      stats[sample.status] += 1;
    }
  }
  return stats;
}

function repeatedFailureCodesV3(samples) {
  const counts = new Map();
  for (const sample of samples) {
    if (sample.status === "valid" && sample.outcome === "fail") {
      counts.set(sample.failure_code, (counts.get(sample.failure_code) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([left], [right]) => asciiCompare(left, right))
    .map(([failure_code, count]) => ({ failure_code, count }));
}

function phaseCaseRowsV3(campaign, split) {
  return campaign.inventory.cases
    .filter((row) => row.split === split)
    .sort((left, right) => {
      const byType = asciiCompare(left.case_type, right.case_type);
      return byType === 0 ? asciiCompare(left.case_id, right.case_id) : byType;
    })
    .map((campaignCase) => {
      const rows = campaign.samples.filter((sample) => sample.case_id === campaignCase.case_id);
      const currentRows = rows.filter((sample) => sample.arm === "current");
      const candidateRows = rows.filter((sample) => sample.arm === "candidate");
      return {
        case_id: campaignCase.case_id,
        case_type: campaignCase.case_type,
        current: sampleStatsV3(currentRows),
        candidate: sampleStatsV3(candidateRows),
        repeated_current_failure_codes: repeatedFailureCodesV3(currentRows),
        reasons: [],
        currentRows,
        candidateRows,
      };
    });
}

function addPhaseReasonV3(phaseReasons, row, message) {
  row.reasons.push(message);
  phaseReasons.push(message);
}

function validatePhaseAccountingV3(campaign, rows, phaseReasons) {
  for (const row of rows) {
    for (const arm of ["current", "candidate"]) {
      const stats = row[arm];
      if (stats.valid !== campaign.requiredValid) {
        addPhaseReasonV3(
          phaseReasons,
          row,
          `${row.case_type} ${row.case_id}: ${arm} has ${stats.valid} valid samples; required valid is exactly ${campaign.requiredValid}`,
        );
      }
      const nonvalid = stats.invalid + stats.indeterminate;
      if (nonvalid > campaign.requiredValid) {
        addPhaseReasonV3(
          phaseReasons,
          row,
          `${row.case_type} ${row.case_id}: ${arm} has ${nonvalid} invalid or indeterminate attempts; maximum is ${campaign.requiredValid}`,
        );
      }
    }
  }
}

function publicCaseRowsV3(rows) {
  return rows.map(({ currentRows, candidateRows, ...row }) => row);
}

function boundedPhaseReasonsV3(reasons, phase) {
  if (reasons.length <= MAX_SAMPLE_ROWS) return reasons;
  return [
    `${phase} rejected with ${reasons.length} detailed requirements; inspect per-case reasons`,
  ];
}

function evaluateSelectionV3(campaign) {
  const rows = phaseCaseRowsV3(campaign, "selection");
  const reasons = [];
  validatePhaseAccountingV3(campaign, rows, reasons);
  let stableImprovement = false;
  for (const row of rows) {
    if (row.case_type === "important") {
      if (row.candidate.fail > 0) {
        addPhaseReasonV3(reasons, row, `candidate failure on important case ${row.case_id}`);
      }
      for (const repeated of row.repeated_current_failure_codes) {
        const candidateSameCode = row.candidateRows.filter(
          (sample) => sample.status === "valid"
            && sample.outcome === "fail"
            && sample.failure_code === repeated.failure_code,
        ).length;
        if (candidateSameCode === 0) stableImprovement = true;
      }
    } else if (row.candidate.fail > row.current.fail) {
      addPhaseReasonV3(reasons, row, `control regression on ${row.case_id}`);
    }
  }
  if (!stableImprovement) reasons.push("selection has no stable repeated-failure improvement");
  const status = reasons.length === 0 ? "selection_pass" : "selection_reject";
  return {
    status,
    cases: publicCaseRowsV3(rows),
    reasons: status === "selection_pass" ? [] : boundedPhaseReasonsV3(reasons, "selection"),
  };
}

function evaluateFinalV3(campaign, selection) {
  if (selection.status !== "selection_pass") {
    return {
      status: "not_evaluated",
      cases: [],
      reasons: ["selection did not pass"],
    };
  }
  if (!campaign.samples.some((sample) => sample.split === "test")) {
    return {
      status: "not_evaluated",
      cases: [],
      reasons: ["held-out test rows were not supplied"],
    };
  }
  const rows = phaseCaseRowsV3(campaign, "test");
  const reasons = [];
  validatePhaseAccountingV3(campaign, rows, reasons);
  for (const row of rows) {
    if (row.case_type === "important" && row.candidate.fail > 0) {
      addPhaseReasonV3(reasons, row, `candidate failure on important case ${row.case_id}`);
    } else if (row.case_type === "control" && row.candidate.fail > row.current.fail) {
      addPhaseReasonV3(reasons, row, `control regression on ${row.case_id}`);
    }
  }
  const status = reasons.length === 0 ? "final_accept" : "final_reject";
  return {
    status,
    cases: publicCaseRowsV3(rows),
    reasons: status === "final_accept" ? [] : boundedPhaseReasonsV3(reasons, "final"),
  };
}

function evaluateCampaignV3(campaign) {
  const selection = evaluateSelectionV3(campaign);
  const final = evaluateFinalV3(campaign, selection);
  return {
    schema: GATE_REPORT_SCHEMA_V3,
    campaign_id: campaign.campaignId,
    source_sha256: campaign.sourceSha,
    candidate_sha256: campaign.candidateSha,
    cases_sha256: campaign.casesSha,
    samples_sha256: campaign.samplesSha,
    required_valid: campaign.requiredValid,
    train_rows: campaign.samples.filter((sample) => sample.split === "train").length,
    selection,
    final,
  };
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

function readBoundedPhysicalFile(path, label) {
  const absolute = resolve(path);
  let before;
  try {
    before = lstatSync(absolute, { bigint: true });
  } catch (error) {
    throw classifiedError("unsafe_path_or_integrity", `${label} is unavailable: ${error.message}`);
  }
  if (before.isSymbolicLink() || !before.isFile() || before.ino === 0n) {
    throw classifiedError("unsafe_path_or_integrity", `${label} must be a physical regular file`);
  }
  if (before.size > BigInt(MAX_INPUT_BYTES)) {
    throw classifiedError(
      "usage_or_schema",
      `${label} exceeds the ${MAX_INPUT_BYTES}-byte (8 MiB) input limit`,
    );
  }
  const beforeRecord = bundleStatRecord(before, "file");
  let descriptor;
  try {
    descriptor = openSync(absolute, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const opened = fstatSync(descriptor, { bigint: true });
    const openedRecord = bundleStatRecord(opened, "file");
    if (!opened.isFile() || !sameBundleStatRecord(openedRecord, beforeRecord)) {
      throw classifiedError("unsafe_path_or_integrity", `${label} changed while it was opened`);
    }
    let capacity = Math.max(1, Number(opened.size) + 1);
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
      const count = readSync(descriptor, bytes, length, bytes.length - length, length);
      if (count === 0) break;
      length += count;
    }
    const after = fstatSync(descriptor, { bigint: true });
    const afterRecord = bundleStatRecord(after, "file");
    let finalPath;
    try {
      finalPath = lstatSync(absolute, { bigint: true });
    } catch (error) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} path is unavailable after read: ${error.message}`,
      );
    }
    if (finalPath.isSymbolicLink() || !finalPath.isFile()
        || !sameBundleStatRecord(afterRecord, openedRecord)
        || !sameBundleStatRecord(bundleStatRecord(finalPath, "file"), openedRecord)) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} physical identity or bytes changed during read`,
      );
    }
    if (length > MAX_INPUT_BYTES || after.size > BigInt(MAX_INPUT_BYTES)
        || BigInt(length) !== after.size) {
      throw classifiedError(
        "usage_or_schema",
        `${label} has an unstable size or exceeds the ${MAX_INPUT_BYTES}-byte (8 MiB) input limit`,
      );
    }
    const retained = bytes.subarray(0, length);
    return {
      path: absolute,
      bytes: retained,
      sha256: sha256(retained),
      stat: openedRecord,
    };
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw classifiedError("unsafe_path_or_integrity", `${label} could not be read: ${error.message}`);
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch {}
    }
  }
}

function verifyBoundedPhysicalFileBinding(binding, label) {
  const current = readBoundedPhysicalFile(binding.path, label);
  if (!sameBundleStatRecord(current.stat, binding.stat)
      || current.sha256 !== binding.sha256
      || !current.bytes.equals(binding.bytes)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${label} no longer matches its early command binding`,
    );
  }
}

function readInstalledStageProducer() {
  const cliPath = fileURLToPath(import.meta.url);
  const cli = readBoundedPhysicalFile(cliPath, "installed producer CLI");
  const manifestPath = resolve(dirname(cliPath), "../.codex-plugin/plugin.json");
  const pluginArtifact = readBoundedPhysicalFile(manifestPath, "installed plugin manifest");
  const plugin = parseJson(pluginArtifact.bytes, "installed plugin manifest");
  if (plugin.name !== "superzhao-skill-lab") {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "installed plugin manifest does not identify superzhao-skill-lab",
    );
  }
  if (typeof plugin.version !== "string"
      || !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(plugin.version)) {
    throw new CliError("installed plugin manifest version is not a supported semantic version");
  }
  const producer = {
    bytes: cli.bytes,
    sha256: cli.sha256,
    identity: {
      plugin_id: "superzhao-skill-lab",
      plugin_version: plugin.version,
      cli_sha256: cli.sha256,
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };
  producer.verify = () => {
    verifyBoundedPhysicalFileBinding(cli, "installed producer CLI");
    verifyBoundedPhysicalFileBinding(pluginArtifact, "installed plugin manifest");
  };
  return producer;
}

function retainedDescriptor(store, descriptor, label) {
  closedObjectV3(descriptor, ["path", "sha256"], [], label);
  validateDigest(descriptor.sha256, `${label} sha256`);
  return store.retained(descriptor.path, descriptor.sha256, label);
}

function buildStageBundlePlan({
  store,
  ledgerValue,
  patchValue,
  resultsArtifact,
  patchArtifact,
  applyArtifact,
  gateArtifact,
  producer,
}) {
  const payloads = new Map();
  const mappings = new Map();

  function addPayload(path, bytes, label) {
    const normalized = workspaceRelativeParts(path, label).join("/");
    const existing = payloads.get(normalized);
    if (existing && (!existing.equals(bytes) || sha256(existing) !== sha256(bytes))) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} conflicts with another packaged payload at ${normalized}`,
      );
    }
    payloads.set(normalized, existing ?? bytes);
    return normalized;
  }

  function addMapping(kind, artifact, sourcePath, packagedPath) {
    const path = addPayload(packagedPath, artifact.bytes, `${kind} packaged path`);
    const mapping = {
      kind,
      ...(sourcePath === null
        ? {}
        : { source_path: workspaceRelativeParts(sourcePath, `${kind} source_path`).join("/") }),
      packaged_path: path,
      sha256: artifact.sha256,
    };
    mappings.set(canonicalJson(mapping), mapping);
    return path;
  }

  function addDescriptor(kind, descriptor, packagedPath = null) {
    const artifact = retainedDescriptor(store, descriptor, `${kind} artifact`);
    return addMapping(
      kind,
      artifact,
      descriptor.path,
      packagedPath ?? `artifacts/${artifact.sha256}.bin`,
    );
  }

  const entrypoints = {
    source: addDescriptor("source-skill", ledgerValue.source, "skills/source/SKILL.md"),
    candidate: addDescriptor(
      "candidate-skill",
      ledgerValue.candidate,
      "skills/candidate/SKILL.md",
    ),
    patch: addMapping("patch", patchArtifact, patchArtifact.path, "proposal/patch.json"),
    cases: addDescriptor("cases", ledgerValue.cases, "campaign/cases.json"),
    samples: addMapping(
      "samples",
      resultsArtifact,
      resultsArtifact.path,
      "campaign/samples.json",
    ),
    apply_report: addMapping(
      "apply-report",
      applyArtifact,
      applyArtifact.path,
      "reports/apply.json",
    ),
    gate_report: addMapping(
      "gate-report",
      gateArtifact,
      gateArtifact.path,
      "reports/gate.json",
    ),
    producer_cli: addMapping(
      "producer-cli",
      producer,
      null,
      "producer/skill-lab.mjs",
    ),
  };

  for (const rejection of patchValue.prior_rejections) {
    addDescriptor("prior-rejection", rejection.report);
  }

  const casesArtifact = retainedDescriptor(store, ledgerValue.cases, "case inventory");
  const inventory = parseJson(casesArtifact.bytes, "case inventory");
  for (const campaignCase of inventory.cases) {
    addDescriptor("prompt", campaignCase.prompt);
    addDescriptor("rubric", campaignCase.rubric);
  }

  for (const sample of ledgerValue.samples) {
    if (sample.actor_run) {
      const actorRunArtifact = retainedDescriptor(
        store,
        sample.actor_run,
        `sample ${sample.sample_id} actor run`,
      );
      addMapping(
        "actor-run",
        actorRunArtifact,
        sample.actor_run.path,
        `artifacts/${actorRunArtifact.sha256}.bin`,
      );
      const actorRun = parseJson(actorRunArtifact.bytes, `sample ${sample.sample_id} actor run`);
      addDescriptor("actor-profile", actorRun.actor_profile);
      addDescriptor("prompt", actorRun.prompt);
      addDescriptor("environment", actorRun.environment);
      addDescriptor("harness-model-profile", actorRun.harness_model_profile);
      addDescriptor("transcript", actorRun.transcript);
    }
    if (sample.scorer_record) {
      const scorerArtifact = retainedDescriptor(
        store,
        sample.scorer_record,
        `sample ${sample.sample_id} scorer record`,
      );
      addMapping(
        "scorer-record",
        scorerArtifact,
        sample.scorer_record.path,
        `artifacts/${scorerArtifact.sha256}.bin`,
      );
      const scorer = parseJson(scorerArtifact.bytes, `sample ${sample.sample_id} scorer record`);
      addDescriptor("scorer-profile", scorer.scorer_profile);
      addDescriptor("rubric", scorer.rubric);
      addDescriptor("transcript", scorer.transcript);
      addDescriptor("scorer-output", scorer.scorer_output);
    }
  }

  const artifacts = [...mappings.values()].sort((left, right) => asciiCompare(
    `${left.kind}\0${left.source_path ?? ""}\0${left.packaged_path}\0${left.sha256}`,
    `${right.kind}\0${right.source_path ?? ""}\0${right.packaged_path}\0${right.sha256}`,
  ));
  const files = [...payloads.entries()]
    .sort(([left], [right]) => asciiCompare(left, right))
    .map(([path, bytes]) => ({ path, sha256: sha256(bytes), bytes: bytes.length }));
  const manifest = {
    schema: BUNDLE_MANIFEST_SCHEMA_V3,
    campaign_id: ledgerValue.campaign_id,
    proposal_id: patchValue.proposal_id,
    producer: producer.identity,
    entrypoints,
    artifacts,
    files,
  };
  const manifestBuffer = Buffer.from(canonicalJsonLine(manifest));
  if (manifestBuffer.length > MAX_INPUT_BYTES) {
    throw new CliError(
      `bundle manifest exceeds the ${MAX_INPUT_BYTES}-byte (8 MiB) input limit`,
    );
  }
  const totalBytes = files.reduce((total, file) => total + file.bytes, 0)
    + manifestBuffer.length;
  if (totalBytes > MAX_BUNDLE_BYTES) {
    throw new CliError(
      `staged bundle requires ${totalBytes} bytes; maximum is ${MAX_BUNDLE_BYTES} bytes (96 MiB)`,
    );
  }
  return { payloads, manifest, manifestBuffer };
}

function stageOutputParentAnchor(workspace, outputInput) {
  const outputAbsolute = resolve(outputInput);
  if (!isWithin(workspace.rootAbsolute, outputAbsolute)
      || outputAbsolute === workspace.rootAbsolute) {
    throw classifiedError("unsafe_path_or_integrity", "stage output directory is outside the workspace root");
  }
  const binding = {
    workspace,
    absolute: outputAbsolute,
    label: "stage output directory",
    parentAbsolute: dirname(outputAbsolute),
  };
  const inspected = inspectV3OutputParent(workspace, binding.parentAbsolute, binding.label);
  binding.parentReal = inspected.real;
  binding.parentChain = inspected.chain;
  let workspaceStat;
  try {
    workspaceStat = lstatSync(workspace.rootAbsolute, { bigint: true });
  } catch (error) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `workspace root became unavailable during stage preflight: ${error.message}`,
    );
  }

  function verify() {
    const current = verifyV3OutputParent(binding);
    let stat;
    try {
      stat = lstatSync(binding.parentAbsolute, { bigint: true });
    } catch (error) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `stage output parent became unavailable during publication: ${error.message}`,
      );
    }
    if (typeof process.geteuid !== "function" || stat.uid !== BigInt(process.geteuid())) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        "stage output parent must be owned by the effective uid",
      );
    }
    if ((stat.mode & 0o77n) !== 0n || (stat.mode & 0o300n) !== 0o300n) {
      throw classifiedError(
        "unsupported_preflight",
        "stage output parent must be writable, searchable, and private",
      );
    }
    if (stat.dev !== workspaceStat.dev) {
      throw classifiedError(
        "unsupported_preflight",
        "stage output parent must be on the workspace device",
      );
    }
    return current;
  }

  verify();
  if (lstatV3Output(outputAbsolute, binding.label)) {
    throw classifiedError("publication_failure", "stage output directory already exists");
  }
  return {
    outputAbsolute,
    outputName: basename(outputAbsolute),
    anchor: {
      absolute: binding.parentAbsolute,
      identity: binding.parentChain.at(-1),
      label: binding.label,
      verify,
    },
  };
}

function verifyPublishedStageDirectory(binding) {
  binding.parent.verify();
  let stat;
  try {
    stat = lstatSync(binding.absolute, { bigint: true });
  } catch (error) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${binding.label} is unavailable after reservation: ${error.message}`,
    );
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()
      || !sameBigIntIdentity(stat, binding.identity)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${binding.label} physical identity changed during publication`,
    );
  }
  if ((stat.mode & 0o777n) !== 0o700n
      || (typeof process.geteuid === "function" && stat.uid !== BigInt(process.geteuid()))) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${binding.label} mode or ownership changed during publication`,
    );
  }
  return stat;
}

function createPublishedStageDirectory(parent, name, label) {
  const identity = v3ChildIdentity(
    invokeAnchoredV3Publisher(parent, { action: "mkdir", name }),
    label,
  );
  const binding = {
    absolute: resolve(parent.absolute, name),
    identity,
    label,
    parent,
  };
  binding.verify = () => verifyPublishedStageDirectory(binding);
  binding.verify();
  return binding;
}

function createPublishedStageFile(parent, name, bytes, label) {
  const identity = v3ChildIdentity(
    invokeAnchoredV3Publisher(parent, {
      action: "create",
      name,
      content: bytes.toString("base64"),
    }),
    label,
  );
  const file = { parent, name, identity, label };
  verifyPublishedStageFile(file);
  return file;
}

function verifyPublishedStageFile(file) {
  const result = invokeAnchoredV3Publisher(file.parent, {
    action: "inspect",
    name: file.name,
    expected_file: v3ExpectedFile(file.identity),
  });
  if (result !== "owned") {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `${file.label} physical identity changed during publication`,
    );
  }
}

function linkPublishedStageFileFromParent(parent, sourceParent, sourceFile, name, label) {
  let result;
  try {
    result = invokeAnchoredV3Publisher(parent, {
      action: "link-from-parent",
      source: sourceFile.name,
      destination: name,
      expected_file: v3ExpectedFile(sourceFile.identity),
      expected_source_parent: v3ExpectedFile(sourceParent.identity),
    });
  } catch (error) {
    if (!(error instanceof PublisherAcknowledgementError)) throw error;
    const committed = invokeAnchoredV3Publisher(parent, {
      action: "inspect",
      name,
      expected_file: v3ExpectedFile(sourceFile.identity),
    });
    if (committed !== "owned") throw error;
    result = "linked";
  }
  if (result !== "linked") {
    throw classifiedError("publication_failure", `${label} was not linked`);
  }
  const file = { parent, name, identity: sourceFile.identity, label };
  verifyPublishedStageFile(file);
  return file;
}

function removePublishedStageFileIfOwned(file) {
  try {
    invokeAnchoredV3Publisher(file.parent, {
      action: "unlink",
      name: file.name,
      expected_file: v3ExpectedFile(file.identity),
    });
  } catch {
    // Cleanup never removes a pathname unless the anchored child confirms the exact inode.
  }
}

function publishStageBundle(workspace, outputInput, plan, verifyInstalledProducer) {
  const destination = stageOutputParentAnchor(workspace, outputInput);
  const root = createPublishedStageDirectory(
    destination.anchor,
    destination.outputName,
    "staged bundle root",
  );
  const directories = new Map([["", root]]);
  const directoryPaths = new Set();
  for (const path of plan.payloads.keys()) {
    const parts = workspaceRelativeParts(path, "bundle payload path");
    for (let length = 1; length < parts.length; length += 1) {
      directoryPaths.add(parts.slice(0, length).join("/"));
    }
  }
  for (const path of [...directoryPaths].sort((left, right) => {
    const depth = left.split("/").length - right.split("/").length;
    return depth === 0 ? asciiCompare(left, right) : depth;
  })) {
    const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const name = path.slice(path.lastIndexOf("/") + 1);
    directories.set(
      path,
      createPublishedStageDirectory(directories.get(parentPath), name, `bundle directory ${path}`),
    );
  }

  const publishedFiles = [];
  for (const [path, bytes] of [...plan.payloads.entries()]
    .sort(([left], [right]) => asciiCompare(left, right))) {
    const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const name = path.slice(path.lastIndexOf("/") + 1);
    publishedFiles.push(
      createPublishedStageFile(directories.get(parentPath), name, bytes, `bundle payload ${path}`),
    );
  }
  for (const file of publishedFiles) verifyPublishedStageFile(file);
  for (const directory of directories.values()) directory.verify();

  // Write the manifest outside the bundle first. The final trust anchor appears
  // atomically as a no-replace hard link only after every byte and inode check succeeds.
  const manifestSource = createPublishedStageFile(
    destination.anchor,
    `.skill-lab-manifest-${randomBytes(16).toString("hex")}`,
    plan.manifestBuffer,
    "bundle manifest temporary source",
  );
  let manifestFile;
  try {
    verifyInstalledProducer();
    manifestFile = linkPublishedStageFileFromParent(
      root,
      destination.anchor,
      manifestSource,
      "manifest.json",
      "bundle manifest",
    );
    verifyInstalledProducer();
  } catch (error) {
    if (manifestFile) removePublishedStageFileIfOwned(manifestFile);
    throw error;
  } finally {
    removePublishedStageFileIfOwned(manifestSource);
  }
  verifyPublishedStageFile(manifestFile);
  root.verify();
  process.stdout.write(`${sha256(plan.manifestBuffer)}\n`);
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
  let producer;
  let producerError;
  try {
    producer = readInstalledStageProducer();
  } catch (error) {
    producerError = error;
  }
  let workspace;
  try {
    workspace = prepareWorkspace(paths["workspace-root"]);
  } catch (error) {
    throw reclassify(error, "unsafe_path_or_integrity");
  }
  const store = new ArtifactStore(workspace);
  const patchArtifact = store.readAbsolute(paths.edits, null, "patch document");
  const patchValue = parseJson(patchArtifact.bytes, "patch document");
  if (patchValue.schema !== PATCH_SCHEMA_V3) {
    const detail = patchValue.schema_version === 2
      ? "production stage does not accept v2 patches"
      : `production stage requires ${PATCH_SCHEMA_V3}`;
    throw new CliError(detail);
  }
  validatePatchV3(patchValue);
  const resultsArtifact = store.readAbsolute(paths.results, null, "sample ledger");
  const ledgerValue = parseJson(resultsArtifact.bytes, "sample ledger");
  if (ledgerValue.schema !== SAMPLES_SCHEMA_V3) {
    throw new CliError(`stage requires ${SAMPLES_SCHEMA_V3}`);
  }
  const applyArtifact = store.readAbsolute(
    paths["apply-report"],
    null,
    "apply report",
    { skill: true },
  );
  const gateArtifact = store.readAbsolute(
    paths["gate-report"],
    null,
    "gate report",
    { skill: true },
  );
  const sourceArtifact = store.readAbsolute(
    paths.source,
    ledgerValue.source?.sha256,
    "stage source Skill",
    { skill: true },
  );
  const candidateArtifact = store.readAbsolute(
    paths.candidate,
    ledgerValue.candidate?.sha256,
    "stage candidate Skill",
    { skill: true },
  );
  const campaign = validateCampaignV3(ledgerValue, resultsArtifact, workspace, store);
  for (const edit of patchValue.edits) {
    for (const caseId of edit.supporting_case_ids) {
      if (!campaign.inventory.byId.has(caseId)) {
        throw new CliError(
          `patch edit ${edit.edit_id} supporting_case_ids references unknown campaign case ${caseId}`,
        );
      }
    }
  }
  const recomputedApply = buildApplyResultV3(
    sourceArtifact.bytes,
    patchArtifact.bytes,
    patchValue,
    store,
  );
  const recomputedGate = evaluateCampaignV3(campaign);
  const suppliedApply = parseJson(applyArtifact.bytes, "apply report");
  const suppliedGate = parseJson(gateArtifact.bytes, "gate report");

  const bindingsMatch = sourceArtifact.path === ledgerValue.source.path
    && candidateArtifact.path === ledgerValue.candidate.path
    && sourceArtifact.physicalKey === campaign.sourceArtifact.physicalKey
    && candidateArtifact.physicalKey === campaign.candidateArtifact.physicalKey;
  const candidateMatches = candidateArtifact.bytes.equals(
    Buffer.from(recomputedApply.candidate, "utf8"),
  );
  const applyMatches = applyArtifact.bytes.equals(
    Buffer.from(canonicalJsonLine(recomputedApply.report)),
  ) && canonicalJson(suppliedApply) === canonicalJson(recomputedApply.report);
  const gateMatches = gateArtifact.bytes.equals(
    Buffer.from(canonicalJsonLine(recomputedGate)),
  ) && canonicalJson(suppliedGate) === canonicalJson(recomputedGate);

  if (recomputedGate.selection.status === "selection_reject") {
    throw classifiedError("selection_rejection", "candidate rejected during selection");
  }
  if (recomputedGate.final.status !== "final_accept") {
    throw classifiedError(
      "final_rejection",
      `candidate did not pass held-out evaluation (${recomputedGate.final.status})`,
    );
  }
  if (!bindingsMatch || !candidateMatches || !applyMatches || !gateMatches) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "stage inputs or reports do not match trusted apply and gate recomputation",
    );
  }
  if (producerError) throw producerError;
  producer.verify();
  const plan = buildStageBundlePlan({
    store,
    ledgerValue,
    patchValue,
    resultsArtifact,
    patchArtifact,
    applyArtifact,
    gateArtifact,
    producer,
  });
  publishStageBundle(
    workspace,
    paths["output-dir"],
    plan,
    () => producer.verify(),
  );
}

function bundlePath(value, label) {
  try {
    return workspaceRelativeParts(value, label).join("/");
  } catch (error) {
    throw reclassify(error, "unsafe_path_or_integrity");
  }
}

function bundleStatRecord(stat, type) {
  return {
    type,
    dev: stat.dev,
    ino: stat.ino,
    size: stat.size,
    mtimeNs: stat.mtimeNs,
    ctimeNs: stat.ctimeNs,
  };
}

function sameBundleStatRecord(left, right) {
  return left.type === right.type
    && left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs
    && left.ino !== 0n;
}

class BundleReader {
  constructor(rootInput) {
    this.rootAbsolute = resolve(rootInput);
    let rootStat;
    try {
      rootStat = lstatSync(this.rootAbsolute, { bigint: true });
    } catch (error) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `bundle root is unavailable: ${error.message}`,
      );
    }
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory() || rootStat.ino === 0n) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        "bundle root must be a physical directory",
      );
    }
    this.rootIdentity = bundleStatRecord(rootStat, "directory");
    this.cache = new Map();
  }

  assertRoot() {
    let stat;
    try {
      stat = lstatSync(this.rootAbsolute, { bigint: true });
    } catch (error) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `bundle root changed during verification: ${error.message}`,
      );
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()
        || !sameBundleStatRecord(bundleStatRecord(stat, "directory"), this.rootIdentity)) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        "bundle root physical identity changed during verification",
      );
    }
  }

  inspect(path, label) {
    const normalized = bundlePath(path, label);
    const parts = normalized.split("/");
    let absolute = this.rootAbsolute;
    for (const [index, part] of parts.entries()) {
      absolute = resolve(absolute, part);
      let stat;
      try {
        stat = lstatSync(absolute, { bigint: true });
      } catch (error) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} is unavailable: ${error.message}`,
        );
      }
      if (stat.isSymbolicLink()) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} must not contain a symbolic link`,
        );
      }
      if (index < parts.length - 1 && !stat.isDirectory()) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} parent must be a physical directory`,
        );
      }
      if (index === parts.length - 1 && !stat.isFile()) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} must be a physical regular file`,
        );
      }
      if (stat.ino === 0n) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} has no stable physical identity`,
        );
      }
      if (index === parts.length - 1) return { normalized, absolute, stat };
    }
    throw classifiedError("unsafe_path_or_integrity", `${label} path is invalid`);
  }

  read(path, label) {
    const normalized = bundlePath(path, label);
    const cached = this.cache.get(normalized);
    if (cached) return cached;
    this.assertRoot();
    const before = this.inspect(normalized, label);
    if (before.stat.size > BigInt(MAX_INPUT_BYTES)) {
      throw classifiedError(
        "unsafe_path_or_integrity",
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
      descriptor = openSync(before.absolute, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
      const opened = fstatSync(descriptor, { bigint: true });
      if (!opened.isFile()
          || !sameBundleStatRecord(
            bundleStatRecord(opened, "file"),
            bundleStatRecord(before.stat, "file"),
          )) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} changed while it was opened`,
        );
      }
      let capacity = Math.max(1, Number(opened.size) + 1);
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
        const count = readSync(descriptor, bytes, length, bytes.length - length, length);
        if (count === 0) break;
        length += count;
      }
      const afterDescriptor = fstatSync(descriptor, { bigint: true });
      const afterPath = this.inspect(normalized, label);
      const openedRecord = bundleStatRecord(opened, "file");
      if (!sameBundleStatRecord(bundleStatRecord(afterDescriptor, "file"), openedRecord)
          || !sameBundleStatRecord(bundleStatRecord(afterPath.stat, "file"), openedRecord)) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} physical identity or bytes changed during read`,
        );
      }
      if (length > MAX_INPUT_BYTES || afterDescriptor.size > BigInt(MAX_INPUT_BYTES)) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} exceeds the ${MAX_INPUT_BYTES}-byte (8 MiB) input limit`,
        );
      }
      const retained = bytes.subarray(0, length);
      const artifact = {
        path: normalized,
        bytes: retained,
        sha256: sha256(retained),
        stat: openedRecord,
      };
      this.cache.set(normalized, artifact);
      return artifact;
    } catch (error) {
      if (error instanceof CliError) throw error;
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} could not be read through its bound descriptor: ${error.message}`,
      );
    } finally {
      if (descriptor !== undefined) {
        try { closeSync(descriptor); } catch {}
      }
    }
  }

  scan() {
    this.assertRoot();
    const files = new Map();
    const directories = new Map([["", this.rootIdentity]]);
    const visit = (absolute, relativePath) => {
      let names;
      try {
        names = readdirSync(absolute, { encoding: "buffer" });
      } catch (error) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `bundle tree could not be enumerated: ${error.message}`,
        );
      }
      const decoded = names.map((raw) => {
        let name;
        try {
          name = new TextDecoder("utf-8", { fatal: true }).decode(raw);
        } catch {
          throw classifiedError(
            "unsafe_path_or_integrity",
            "bundle tree contains a non-UTF-8 path component",
          );
        }
        return name;
      }).sort(asciiCompare);
      for (const name of decoded) {
        const path = relativePath ? `${relativePath}/${name}` : name;
        bundlePath(path, "bundle tree entry");
        const child = resolve(absolute, name);
        let stat;
        try {
          stat = lstatSync(child, { bigint: true });
        } catch (error) {
          throw classifiedError(
            "unsafe_path_or_integrity",
            `bundle tree entry changed during enumeration: ${error.message}`,
          );
        }
        if (stat.isSymbolicLink()) {
          throw classifiedError(
            "unsafe_path_or_integrity",
            `bundle tree entry is a symbolic link: ${path}`,
          );
        }
        if (stat.isDirectory()) {
          const record = bundleStatRecord(stat, "directory");
          if (record.ino === 0n) {
            throw classifiedError(
              "unsafe_path_or_integrity",
              `bundle directory has no stable physical identity: ${path}`,
            );
          }
          directories.set(path, record);
          visit(child, path);
        } else if (stat.isFile()) {
          const record = bundleStatRecord(stat, "file");
          if (record.ino === 0n) {
            throw classifiedError(
              "unsafe_path_or_integrity",
              `bundle file has no stable physical identity: ${path}`,
            );
          }
          files.set(path, record);
        } else {
          throw classifiedError(
            "unsafe_path_or_integrity",
            `bundle tree entry is not a regular file or directory: ${path}`,
          );
        }
      }
    };
    visit(this.rootAbsolute, "");
    this.assertRoot();
    return { files, directories };
  }
}

function assertBundleSnapshotsEqual(left, right) {
  for (const field of ["files", "directories"]) {
    const leftPaths = [...left[field].keys()].sort(asciiCompare);
    const rightPaths = [...right[field].keys()].sort(asciiCompare);
    if (JSON.stringify(leftPaths) !== JSON.stringify(rightPaths)) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `bundle ${field} changed during verification`,
      );
    }
    for (const path of leftPaths) {
      if (!sameBundleStatRecord(left[field].get(path), right[field].get(path))) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `bundle tree identity changed during verification: ${path || "."}`,
        );
      }
    }
  }
}

function expectedBundleDirectories(paths) {
  const directories = new Set([""]);
  for (const path of paths) {
    const parts = path.split("/");
    for (let length = 1; length < parts.length; length += 1) {
      directories.add(parts.slice(0, length).join("/"));
    }
  }
  return [...directories].sort(asciiCompare);
}

function validateProducerIdentity(value, label) {
  closedObjectV3(
    value,
    ["plugin_id", "plugin_version", "cli_sha256", "node_version", "platform", "arch"],
    [],
    label,
  );
  if (value.plugin_id !== "superzhao-skill-lab") {
    throw new CliError(`${label} plugin_id must be superzhao-skill-lab`);
  }
  if (typeof value.plugin_version !== "string"
      || !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(value.plugin_version)) {
    throw new CliError(`${label} plugin_version is not a supported semantic version`);
  }
  validateDigest(value.cli_sha256, `${label} cli_sha256`);
  if (typeof value.node_version !== "string"
      || !/^v?(?:20|22)\.[0-9]+\.[0-9]+$/.test(value.node_version)) {
    throw new CliError(`${label} node_version is unsupported`);
  }
  if (!new Set(["darwin", "linux"]).has(value.platform)) {
    throw new CliError(`${label} platform is unsupported`);
  }
  validateStableId(value.arch, `${label} arch`);
}

function validateV3BundleManifest(manifest) {
  const entrypointKinds = {
    source: "source-skill",
    candidate: "candidate-skill",
    patch: "patch",
    cases: "cases",
    samples: "samples",
    apply_report: "apply-report",
    gate_report: "gate-report",
    producer_cli: "producer-cli",
  };
  const artifactKinds = new Set([
    "source-skill",
    "candidate-skill",
    "patch",
    "cases",
    "samples",
    "actor-run",
    "scorer-record",
    "apply-report",
    "gate-report",
    "prior-rejection",
    "prompt",
    "rubric",
    "environment",
    "actor-profile",
    "scorer-profile",
    "harness-model-profile",
    "transcript",
    "scorer-output",
    "producer-cli",
  ]);
  closedObjectV3(
    manifest,
    ["schema", "campaign_id", "proposal_id", "producer", "entrypoints", "artifacts", "files"],
    [],
    "bundle manifest",
  );
  if (manifest.schema !== BUNDLE_MANIFEST_SCHEMA_V3) {
    throw new CliError(`bundle manifest schema must be ${BUNDLE_MANIFEST_SCHEMA_V3}`);
  }
  validateStableId(manifest.campaign_id, "bundle manifest campaign_id");
  validateStableId(manifest.proposal_id, "bundle manifest proposal_id");
  validateProducerIdentity(manifest.producer, "bundle manifest producer");
  closedObjectV3(
    manifest.entrypoints,
    Object.keys(entrypointKinds),
    [],
    "bundle manifest entrypoints",
  );
  for (const name of Object.keys(entrypointKinds)) {
    manifest.entrypoints[name] = bundlePath(
      manifest.entrypoints[name],
      `bundle entrypoint ${name}`,
    );
  }

  if (!Array.isArray(manifest.files) || manifest.files.length < 1) {
    throw new CliError("bundle manifest files must be a non-empty array");
  }
  const filesByPath = new Map();
  for (const [index, file] of manifest.files.entries()) {
    const label = `bundle file ${index + 1}`;
    closedObjectV3(file, ["path", "sha256", "bytes"], [], label);
    file.path = bundlePath(file.path, `${label} path`);
    if (file.path === "manifest.json") {
      throw classifiedError(
        "unsafe_path_or_integrity",
        "manifest.json must not be listed as a payload file",
      );
    }
    validateDigest(file.sha256, `${label} sha256`);
    if (!Number.isInteger(file.bytes) || file.bytes < 0 || file.bytes > MAX_BUNDLE_BYTES) {
      throw new CliError(`${label} bytes is outside the supported range`);
    }
    if (filesByPath.has(file.path)) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `duplicate bundle file path: ${file.path}`,
      );
    }
    filesByPath.set(file.path, file);
  }

  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length < 1) {
    throw new CliError("bundle manifest artifacts must be a non-empty array");
  }
  const mappingKeys = new Set();
  const logicalMappings = new Map();
  const mappingsByPackagedPath = new Map();
  for (const [index, mapping] of manifest.artifacts.entries()) {
    const label = `bundle artifact mapping ${index + 1}`;
    const required = ["kind", "packaged_path", "sha256"];
    const optional = mapping.kind === "producer-cli" ? [] : ["source_path"];
    closedObjectV3(mapping, required, optional, label);
    if (!artifactKinds.has(mapping.kind)) throw new CliError(`${label} kind is unsupported`);
    mapping.packaged_path = bundlePath(mapping.packaged_path, `${label} packaged_path`);
    validateDigest(mapping.sha256, `${label} sha256`);
    if (mapping.kind === "producer-cli") {
      if (Object.hasOwn(mapping, "source_path")) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          "producer-cli mapping must not have source_path",
        );
      }
    } else {
      if (!Object.hasOwn(mapping, "source_path")) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `${label} is missing source_path`,
        );
      }
      mapping.source_path = bundlePath(mapping.source_path, `${label} source_path`);
      const logical = logicalMappings.get(mapping.source_path);
      const identity = `${mapping.packaged_path}\0${mapping.sha256}`;
      if (logical !== undefined && logical !== identity) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `conflicting source_path mapping: ${mapping.source_path}`,
        );
      }
      logicalMappings.set(mapping.source_path, identity);
    }
    const key = canonicalJson(mapping);
    if (mappingKeys.has(key)) {
      throw classifiedError("unsafe_path_or_integrity", `duplicate ${label}`);
    }
    mappingKeys.add(key);
    const packaged = mappingsByPackagedPath.get(mapping.packaged_path) ?? [];
    packaged.push(mapping);
    mappingsByPackagedPath.set(mapping.packaged_path, packaged);
  }

  for (const [path, file] of filesByPath) {
    const mappings = mappingsByPackagedPath.get(path);
    if (!mappings || mappings.length === 0) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `bundle payload has no artifact mapping: ${path}`,
      );
    }
    if (mappings.some((mapping) => mapping.sha256 !== file.sha256)) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `bundle mapping digest conflicts with file ${path}`,
      );
    }
  }
  for (const [path, mappings] of mappingsByPackagedPath) {
    const file = filesByPath.get(path);
    if (!file) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `bundle artifact mapping references an unlisted payload: ${path}`,
      );
    }
    if (mappings.some((mapping) => mapping.sha256 !== file.sha256)) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `bundle artifact mapping conflicts with payload digest: ${path}`,
      );
    }
  }

  const entrypointMappings = new Map();
  for (const [name, kind] of Object.entries(entrypointKinds)) {
    const path = manifest.entrypoints[name];
    const matches = manifest.artifacts.filter(
      (mapping) => mapping.packaged_path === path && mapping.kind === kind,
    );
    if (matches.length !== 1) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `bundle entrypoint ${name} must resolve to exactly one ${kind} mapping`,
      );
    }
    entrypointMappings.set(name, matches[0]);
  }
  const producerMapping = entrypointMappings.get("producer_cli");
  if (producerMapping.sha256 !== manifest.producer.cli_sha256) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "bundle producer identity does not match producer-cli mapping",
    );
  }
  return {
    filesByPath,
    entrypointMappings,
    mappings: manifest.artifacts,
  };
}

class BundleArtifactStore {
  constructor(manifestIndex, payloads) {
    this.manifestIndex = manifestIndex;
    this.payloads = payloads;
    this.byLogicalPath = new Map();
    this.mappingsByIdentity = new Map();
    this.usedMappings = new Set();
    this.countedPhysicalArtifacts = new Set();
    this.campaignBytes = 0n;
    for (const mapping of manifestIndex.mappings) {
      if (Object.hasOwn(mapping, "source_path")) {
        const key = this.mappingIdentityKey(
          mapping.kind,
          mapping.source_path,
          mapping.sha256,
        );
        const indexed = this.mappingsByIdentity.get(key) ?? [];
        indexed.push(mapping);
        this.mappingsByIdentity.set(key, indexed);
      }
      if (!Object.hasOwn(mapping, "source_path")) continue;
      const file = payloads.get(mapping.packaged_path);
      this.byLogicalPath.set(mapping.source_path, {
        path: mapping.source_path,
        bytes: file.bytes,
        sha256: file.sha256,
        physicalKey: `${file.stat.dev}:${file.stat.ino}:${file.sha256}`,
        packagedPath: mapping.packaged_path,
        stat: file.stat,
      });
    }
  }

  mappingKey(mapping) {
    return canonicalJson(mapping);
  }

  mappingIdentityKey(kind, sourcePath, digest) {
    return canonicalJson([kind, sourcePath, digest]);
  }

  useMapping(mapping, label) {
    this.usedMappings.add(this.mappingKey(mapping));
    if (!CAMPAIGN_ARTIFACT_KINDS.has(mapping.kind)) return;
    const payload = this.payloads.get(mapping.packaged_path);
    const physicalKey = `${payload.stat.dev}:${payload.stat.ino}:${payload.sha256}`;
    if (this.countedPhysicalArtifacts.has(physicalKey)) return;
    const next = this.campaignBytes + BigInt(payload.bytes.length);
    if (next > BigInt(MAX_CAMPAIGN_BYTES)) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} exceeds the ${MAX_CAMPAIGN_BYTES}-byte (64 MiB) aggregate campaign limit`,
      );
    }
    this.countedPhysicalArtifacts.add(physicalKey);
    this.campaignBytes = next;
  }

  readRelative(path, expectedSha, label) {
    const normalized = bundlePath(path, label);
    const artifact = this.byLogicalPath.get(normalized);
    if (!artifact) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} has no manifest source_path mapping`,
      );
    }
    if (expectedSha && artifact.sha256 !== expectedSha) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} sha256 does not match its manifest source_path mapping`,
      );
    }
    return artifact;
  }

  retained(path, expectedSha, label) {
    return this.readRelative(path, expectedSha, label);
  }

  assertKind(path, digest, kind, label) {
    const normalized = bundlePath(path, label);
    const matches = this.mappingsByIdentity.get(
      this.mappingIdentityKey(kind, normalized, digest),
    ) ?? [];
    if (matches.length !== 1) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `${label} must resolve to exactly one ${kind} mapping`,
      );
    }
    this.useMapping(matches[0], label);
  }

  entrypoint(name) {
    const mapping = this.manifestIndex.entrypointMappings.get(name);
    const payload = this.payloads.get(mapping.packaged_path);
    this.useMapping(mapping, `bundle entrypoint ${name}`);
    return {
      mapping,
      artifact: {
        path: mapping.source_path ?? mapping.packaged_path,
        bytes: payload.bytes,
        sha256: payload.sha256,
        physicalKey: `${payload.stat.dev}:${payload.stat.ino}:${payload.sha256}`,
        stat: payload.stat,
      },
    };
  }

  assertAllMappingsUsed() {
    const unused = this.manifestIndex.mappings.filter(
      (mapping) => !this.usedMappings.has(this.mappingKey(mapping)),
    );
    if (unused.length > 0) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `bundle contains ${unused.length} artifact mapping(s) outside the trusted graph`,
      );
    }
  }
}

function bindV3BundlePayloads(reader, manifestArtifact, manifestIndex) {
  const before = reader.scan();
  const expectedFiles = ["manifest.json", ...manifestIndex.filesByPath.keys()]
    .sort(asciiCompare);
  const actualFiles = [...before.files.keys()].sort(asciiCompare);
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "bundle physical file tree does not exactly match manifest files",
    );
  }
  const expectedDirectories = expectedBundleDirectories(expectedFiles);
  const actualDirectories = [...before.directories.keys()].sort(asciiCompare);
  if (JSON.stringify(actualDirectories) !== JSON.stringify(expectedDirectories)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "bundle physical directory tree does not exactly match manifest paths",
    );
  }
  const actualTotal = actualFiles.reduce(
    (total, path) => total + before.files.get(path).size,
    0n,
  );
  if (actualTotal > BigInt(MAX_BUNDLE_BYTES)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `bundle is ${actualTotal} bytes; maximum is ${MAX_BUNDLE_BYTES} bytes (96 MiB)`,
    );
  }
  if (!sameBundleStatRecord(before.files.get("manifest.json"), manifestArtifact.stat)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "bundle manifest physical identity or bytes changed before the first tree scan",
    );
  }
  const payloads = new Map();
  for (const [path, declared] of manifestIndex.filesByPath) {
    const artifact = reader.read(path, `bundle payload ${path}`);
    if (artifact.bytes.length !== declared.bytes || artifact.sha256 !== declared.sha256) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `bundle payload bytes or sha256 do not match manifest: ${path}`,
      );
    }
    payloads.set(path, artifact);
  }
  return { before, payloads };
}

function recomputeTrustedV3Bundle(manifest, manifestIndex, payloads) {
  const store = new BundleArtifactStore(manifestIndex, payloads);
  const source = store.entrypoint("source");
  const candidate = store.entrypoint("candidate");
  const patch = store.entrypoint("patch");
  const cases = store.entrypoint("cases");
  const samples = store.entrypoint("samples");
  const applyReport = store.entrypoint("apply_report");
  const gateReport = store.entrypoint("gate_report");
  store.entrypoint("producer_cli");

  const patchValue = parseJson(patch.artifact.bytes, "bundle patch document");
  const ledgerValue = parseJson(samples.artifact.bytes, "bundle sample ledger");
  if (patchValue.schema !== PATCH_SCHEMA_V3 || ledgerValue.schema !== SAMPLES_SCHEMA_V3) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "bundle patch or sample ledger is not the supported v3 schema",
    );
  }
  const campaign = validateCampaignV3(
    ledgerValue,
    samples.artifact,
    { rootAbsolute: null, rootReal: null },
    store,
  );
  if (manifest.campaign_id !== ledgerValue.campaign_id
      || manifest.proposal_id !== patchValue.proposal_id
      || source.mapping.source_path !== ledgerValue.source.path
      || candidate.mapping.source_path !== ledgerValue.candidate.path
      || cases.mapping.source_path !== ledgerValue.cases.path
      || source.artifact.sha256 !== campaign.sourceSha
      || candidate.artifact.sha256 !== campaign.candidateSha
      || cases.artifact.sha256 !== campaign.casesSha
      || samples.artifact.sha256 !== campaign.samplesSha) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "bundle manifest entrypoints do not match the campaign graph",
    );
  }
  for (const edit of patchValue.edits) {
    for (const caseId of edit.supporting_case_ids) {
      if (!campaign.inventory.byId.has(caseId)) {
        throw classifiedError(
          "unsafe_path_or_integrity",
          `bundle patch references unknown campaign case ${caseId}`,
        );
      }
    }
  }

  const recomputedApply = buildApplyResultV3(
    source.artifact.bytes,
    patch.artifact.bytes,
    patchValue,
    store,
  );
  const recomputedGate = evaluateCampaignV3(campaign);
  const suppliedApply = parseJson(applyReport.artifact.bytes, "bundle apply report");
  const suppliedGate = parseJson(gateReport.artifact.bytes, "bundle gate report");
  const candidateMatches = candidate.artifact.bytes.equals(
    Buffer.from(recomputedApply.candidate, "utf8"),
  );
  const applyMatches = applyReport.artifact.bytes.equals(
    Buffer.from(canonicalJsonLine(recomputedApply.report)),
  ) && canonicalJson(suppliedApply) === canonicalJson(recomputedApply.report);
  const gateMatches = gateReport.artifact.bytes.equals(
    Buffer.from(canonicalJsonLine(recomputedGate)),
  ) && canonicalJson(suppliedGate) === canonicalJson(recomputedGate);
  if (!candidateMatches || !applyMatches || !gateMatches) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "bundle candidate or reports do not match trusted apply and gate recomputation",
    );
  }
  if (recomputedGate.selection.status !== "selection_pass"
      || recomputedGate.final.status !== "final_accept") {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "bundle does not recompute to selection_pass and final_accept",
    );
  }
  store.assertAllMappingsUsed();
}

function validateLegacyV2ManifestSchema(manifest) {
  exactKeys(
    manifest,
    [
      "schema_version",
      "campaign_id",
      "results_sha256",
      "edits_sha256",
      "apply_report_sha256",
      "gate_report_sha256",
      "artifacts",
      "evidence",
      "files",
    ],
    "legacy v2 manifest",
  );
  if (manifest.schema_version !== 2) {
    throw new CliError("legacy v2 manifest schema_version must be 2");
  }
  validateStableId(manifest.campaign_id, "legacy v2 manifest campaign_id");
  for (const field of [
    "results_sha256",
    "edits_sha256",
    "apply_report_sha256",
    "gate_report_sha256",
  ]) {
    validateDigest(manifest[field], `legacy v2 manifest ${field}`);
  }

  if (!manifest.artifacts || typeof manifest.artifacts !== "object"
      || Array.isArray(manifest.artifacts)) {
    throw new CliError("legacy v2 manifest artifacts must be an object");
  }
  exactKeys(
    manifest.artifacts,
    ["source", "candidate", "scenario", "rubric", "environment"],
    "legacy v2 manifest artifacts",
  );
  for (const [name, mapping] of Object.entries(manifest.artifacts)) {
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
      throw new CliError(`legacy v2 artifact ${name} must be an object`);
    }
    exactKeys(
      mapping,
      ["workspace_path", "packaged_path", "sha256"],
      `legacy v2 artifact ${name}`,
    );
    requireNonBlank(mapping.workspace_path, `legacy v2 artifact ${name} workspace_path`);
    requireNonBlank(mapping.packaged_path, `legacy v2 artifact ${name} packaged_path`);
    validateDigest(mapping.sha256, `legacy v2 artifact ${name} sha256`);
  }

  if (!manifest.evidence || typeof manifest.evidence !== "object"
      || Array.isArray(manifest.evidence)
      || Object.keys(manifest.evidence).length < 1) {
    throw new CliError("legacy v2 manifest evidence must be a non-empty object");
  }
  for (const [digest, mapping] of Object.entries(manifest.evidence)) {
    validateDigest(digest, "legacy v2 evidence key");
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
      throw new CliError(`legacy v2 evidence ${digest} must be an object`);
    }
    exactKeys(
      mapping,
      ["packaged_path", "sha256", "workspace_paths", "sample_ids"],
      `legacy v2 evidence ${digest}`,
    );
    requireNonBlank(mapping.packaged_path, `legacy v2 evidence ${digest} packaged_path`);
    validateDigest(mapping.sha256, `legacy v2 evidence ${digest} sha256`);
    if (!Array.isArray(mapping.workspace_paths) || mapping.workspace_paths.length < 1) {
      throw new CliError(`legacy v2 evidence ${digest} workspace_paths must be non-empty`);
    }
    if (!Array.isArray(mapping.sample_ids) || mapping.sample_ids.length < 1) {
      throw new CliError(`legacy v2 evidence ${digest} sample_ids must be non-empty`);
    }
    if (new Set(mapping.workspace_paths).size !== mapping.workspace_paths.length
        || new Set(mapping.sample_ids).size !== mapping.sample_ids.length) {
      throw new CliError(`legacy v2 evidence ${digest} paths and sample_ids must be unique`);
    }
    for (const path of mapping.workspace_paths) {
      requireNonBlank(path, `legacy v2 evidence ${digest} workspace path`);
    }
    for (const sampleId of mapping.sample_ids) {
      validateStableId(sampleId, `legacy v2 evidence ${digest} sample_id`);
    }
  }

  if (!manifest.files || typeof manifest.files !== "object"
      || Array.isArray(manifest.files)
      || Object.keys(manifest.files).length < 1) {
    throw new CliError("legacy v2 manifest files must be a non-empty object");
  }
  for (const [path, file] of Object.entries(manifest.files)) {
    requireNonBlank(path, "legacy v2 file path");
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      throw new CliError(`legacy v2 file ${path} must be an object`);
    }
    exactKeys(file, ["sha256", "bytes"], `legacy v2 file ${path}`);
    validateDigest(file.sha256, `legacy v2 file ${path} sha256`);
    if (!Number.isInteger(file.bytes) || file.bytes < 0 || file.bytes > MAX_BUNDLE_BYTES) {
      throw new CliError(`legacy v2 file ${path} bytes is outside the supported range`);
    }
  }
}

function verifyLegacyV2Bundle(reader, manifestArtifact, manifest) {
  const filesByPath = new Map();
  for (const [declaredPath, descriptor] of Object.entries(manifest.files)) {
    const path = bundlePath(declaredPath, "legacy v2 file path");
    if (path !== declaredPath || path === "manifest.json" || filesByPath.has(path)) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `legacy v2 manifest has an unsafe or duplicate file path: ${declaredPath}`,
      );
    }
    filesByPath.set(path, descriptor);
  }

  const before = reader.scan();
  const expectedFiles = ["manifest.json", ...filesByPath.keys()].sort(asciiCompare);
  const actualFiles = [...before.files.keys()].sort(asciiCompare);
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "legacy v2 physical file tree does not exactly match manifest files",
    );
  }
  const expectedDirectories = expectedBundleDirectories(expectedFiles);
  const actualDirectories = [...before.directories.keys()].sort(asciiCompare);
  if (JSON.stringify(actualDirectories) !== JSON.stringify(expectedDirectories)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "legacy v2 physical directory tree does not exactly match manifest paths",
    );
  }
  const actualTotal = actualFiles.reduce(
    (total, path) => total + before.files.get(path).size,
    0n,
  );
  if (actualTotal > BigInt(MAX_BUNDLE_BYTES)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `legacy v2 bundle is ${actualTotal} bytes; maximum is ${MAX_BUNDLE_BYTES} bytes (96 MiB)`,
    );
  }
  if (!sameBundleStatRecord(before.files.get("manifest.json"), manifestArtifact.stat)) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      "legacy v2 manifest physical identity or bytes changed before the first tree scan",
    );
  }

  const payloads = new Map();
  for (const [path, declared] of filesByPath) {
    const artifact = reader.read(path, `legacy v2 payload ${path}`);
    if (artifact.bytes.length !== declared.bytes || artifact.sha256 !== declared.sha256) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `legacy v2 payload bytes or sha256 do not match manifest: ${path}`,
      );
    }
    payloads.set(path, artifact);
  }

  const covered = new Set();
  const conventional = new Map([
    ["results.json", manifest.results_sha256],
    ["edits.json", manifest.edits_sha256],
    ["apply/report.json", manifest.apply_report_sha256],
    ["gate/report.json", manifest.gate_report_sha256],
  ]);
  for (const [path, digest] of conventional) {
    const payload = payloads.get(path);
    if (!payload || payload.sha256 !== digest) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `legacy v2 conventional digest does not match ${path}`,
      );
    }
    covered.add(path);
  }

  for (const [name, mapping] of Object.entries(manifest.artifacts)) {
    bundlePath(mapping.workspace_path, `legacy v2 artifact ${name} workspace_path`);
    const packagedPath = bundlePath(
      mapping.packaged_path,
      `legacy v2 artifact ${name} packaged_path`,
    );
    const payload = payloads.get(packagedPath);
    if (!payload || payload.sha256 !== mapping.sha256) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `legacy v2 artifact ${name} does not match its packaged payload`,
      );
    }
    covered.add(packagedPath);
  }

  for (const [digest, mapping] of Object.entries(manifest.evidence)) {
    if (mapping.sha256 !== digest) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `legacy v2 evidence ${digest} key and sha256 disagree`,
      );
    }
    for (const path of mapping.workspace_paths) {
      bundlePath(path, `legacy v2 evidence ${digest} workspace path`);
    }
    const packagedPath = bundlePath(
      mapping.packaged_path,
      `legacy v2 evidence ${digest} packaged_path`,
    );
    const payload = payloads.get(packagedPath);
    if (!payload || payload.sha256 !== digest) {
      throw classifiedError(
        "unsafe_path_or_integrity",
        `legacy v2 evidence ${digest} does not match its packaged payload`,
      );
    }
    covered.add(packagedPath);
  }

  const uncovered = [...filesByPath.keys()].filter((path) => !covered.has(path));
  if (uncovered.length > 0) {
    throw classifiedError(
      "unsafe_path_or_integrity",
      `legacy v2 manifest has unmapped payload files: ${uncovered.join(", ")}`,
    );
  }
  const after = reader.scan();
  assertBundleSnapshotsEqual(before, after);
  process.stdout.write(canonicalJsonLine({
    status: "legacy-structural-only",
    manifest_sha256: manifestArtifact.sha256,
  }));
}

function verifyBundleCommand(options, legacyV2 = false) {
  validateRuntime();
  const paths = requireOptions(options, ["bundle"]);
  const reader = new BundleReader(paths.bundle);
  const manifestArtifact = reader.read("manifest.json", "bundle manifest");
  const manifest = parseJson(manifestArtifact.bytes, "bundle manifest");
  if (legacyV2) {
    if (manifest.schema === BUNDLE_MANIFEST_SCHEMA_V3) {
      throw new CliError("--legacy-v2 cannot verify a v3 bundle manifest");
    }
    if (manifest.schema_version !== 2) {
      throw new CliError("--legacy-v2 requires an authentic v2 bundle manifest");
    }
    validateLegacyV2ManifestSchema(manifest);
    try {
      verifyLegacyV2Bundle(reader, manifestArtifact, manifest);
      return;
    } catch (error) {
      if (error instanceof CliError && error.exitCode === EXIT_CODES.unsupported_preflight) {
        throw error;
      }
      throw reclassify(error, "unsafe_path_or_integrity");
    }
  }
  if (manifest.schema !== BUNDLE_MANIFEST_SCHEMA_V3) {
    if (manifest.schema_version === 2) {
      throw new CliError("v2 bundles require the bare --legacy-v2 verifier flag");
    }
    throw new CliError(`verify-bundle requires ${BUNDLE_MANIFEST_SCHEMA_V3}`);
  }
  try {
    const verifier = readInstalledStageProducer();
    const manifestIndex = validateV3BundleManifest(manifest);
    const bound = bindV3BundlePayloads(reader, manifestArtifact, manifestIndex);
    recomputeTrustedV3Bundle(manifest, manifestIndex, bound.payloads);
    const after = reader.scan();
    assertBundleSnapshotsEqual(bound.before, after);
    verifier.verify();
    process.stdout.write(canonicalJsonLine({
      status: "final_accept",
      manifest_sha256: manifestArtifact.sha256,
      producer: manifest.producer,
      verifier: verifier.identity,
    }));
  } catch (error) {
    if (error instanceof CliError && error.exitCode === EXIT_CODES.unsupported_preflight) {
      throw error;
    }
    throw reclassify(error, "unsafe_path_or_integrity");
  }
}

function main() {
  const [command, ...tokens] = process.argv.slice(2);
  if (!command) {
    throw new CliError("missing command; expected apply, doctor, gate, stage, or verify-bundle");
  }
  const { options, legacyV2 } = parseCommandOptions(command, tokens);
  if (command === "apply") applyCommand(options);
  else if (command === "doctor") doctorCommand(options);
  else if (command === "gate") gateCommand(options);
  else if (command === "stage") stageCommand(options);
  else if (command === "verify-bundle") verifyBundleCommand(options, legacyV2);
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
