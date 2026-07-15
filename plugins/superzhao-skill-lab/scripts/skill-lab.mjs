#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const HARD_MAX_EDITS = 4;
const HARD_MAX_EDIT_BYTES = 4096;
const HARD_MAX_PATCH_BYTES = 8192;
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
  constructor(message, exitCode = 2) {
    super(message);
    this.exitCode = exitCode;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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

function writeTwoOutputs(candidatePath, candidate, reportPath, report, inputs) {
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
    throw new CliError(`could not publish apply artifacts: ${error.message}`);
  }
  bestEffortRemoveTree(candidateTempDir);
  bestEffortRemoveTree(reportTempDir);
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

function overlaps(spanStart, spanEnd, range) {
  return spanStart < range.end && spanEnd > range.start;
}

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

function planEdits(content, edits) {
  const { frontmatter, protectedRanges } = validateSkill(content);
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

function applyPlannedEdits(source, planned) {
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

  validateSkill(candidate);
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

function applyCommand(options) {
  const paths = requireOptions(options, [
    "workspace-root",
    "source",
    "edits",
    "candidate",
    "report",
  ]);
  const workspace = prepareWorkspace(paths["workspace-root"]);
  for (const input of [paths.source, paths.edits]) {
    assertExistingWithin(workspace.rootReal, input, "apply input");
  }
  assertOutputWithin(workspace, paths.candidate, "candidate output");
  assertOutputWithin(workspace, paths.report, "apply report");
  const sourceBuffer = readRegularFile(paths.source, "source Skill");
  const editsBuffer = readRegularFile(paths.edits, "edits document");
  const result = buildApplyResult(sourceBuffer, editsBuffer);
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
  if (!command) throw new CliError("missing command; expected apply, gate, or stage");
  const options = parseOptions(tokens);
  if (command === "apply") applyCommand(options);
  else if (command === "gate") gateCommand(options);
  else if (command === "stage") stageCommand(options);
  else throw new CliError(`unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`skill-lab: ${message}\n`);
  process.exitCode = error instanceof CliError ? error.exitCode : 2;
}
