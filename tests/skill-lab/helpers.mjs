import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "../..");
export const cli = resolve(
  repoRoot,
  "plugins/superzhao-skill-lab/scripts/skill-lab.mjs",
);
export const schemaRoot = resolve(
  repoRoot,
  "plugins/superzhao-skill-lab/schemas/v3",
);

export const SOURCE = `---
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

export const PORTABLE_SOURCE = `---
name: fixture-skill
description: >-
  Use when exercising the portable
  Skill Lab fixture.
license: MIT
metadata:
  owner: test
---

# Fixture

## Workflow

old text
remove me

<!-- SLOW_UPDATE_START -->
protected text
<!-- SLOW_UPDATE_END -->
`;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function makeFixture(sourceText = PORTABLE_SOURCE) {
  const root = mkdtempSync(resolve(tmpdir(), "superzhao-skill-lab-v3-"));
  const source = resolve(root, "SKILL.md");
  const edits = resolve(root, "patch.json");
  const candidate = resolve(root, "candidate.md");
  const applyReport = resolve(root, "apply-report.json");
  const outputParent = resolve(root, "output");
  mkdirSync(outputParent, { mode: 0o700 });
  writeFileSync(source, sourceText);
  return {
    root,
    source,
    sourceText,
    edits,
    candidate,
    applyReport,
    outputParent,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

export function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });
}

export function runWithHook(fixture, args, hookSource) {
  const hook = resolve(fixture.root, `hook-${Math.random().toString(16).slice(2)}.cjs`);
  writeFileSync(hook, hookSource);
  return runCli(args, {
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=${hook}`.trim(),
    },
  });
}

export function applyArgs(fixture) {
  return [
    "apply",
    "--workspace-root", fixture.root,
    "--source", fixture.source,
    "--edits", fixture.edits,
    "--candidate", fixture.candidate,
    "--report", fixture.applyReport,
  ];
}

export function doctorArgs(fixture, outputParent = fixture.outputParent) {
  return [
    "doctor",
    "--workspace-root", fixture.root,
    "--output-parent", outputParent,
  ];
}

export function artifact(path, bytes) {
  return { path, sha256: sha256(bytes) };
}

export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function portableHeaderBytes(value) {
  const end = value.indexOf("\n---\n", 4);
  assert.notEqual(end, -1);
  return value.slice(0, end + 5);
}

export function assertNoApplyOutput(fixture) {
  assert.equal(existsSync(fixture.candidate), false, "candidate must not exist");
  assert.equal(existsSync(fixture.applyReport), false, "report must not exist");
}

function resolvePointer(root, pointer) {
  assert.match(pointer, /^#\//);
  return pointer.slice(2).split("/").reduce(
    (value, part) => value[part.replaceAll("~1", "/").replaceAll("~0", "~")],
    root,
  );
}

function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export function schemaErrors(value, schema, root = schema, path = "$") {
  if (schema.$ref) return schemaErrors(value, resolvePointer(root, schema.$ref), root, path);
  const errors = [];
  const add = (message) => errors.push(`${path}: ${message}`);

  if (schema.const !== undefined && !sameJson(value, schema.const)) add("const mismatch");
  if (schema.enum && !schema.enum.some((entry) => sameJson(value, entry))) add("enum mismatch");

  if (schema.type) {
    const validType = schema.type === "object"
      ? value !== null && typeof value === "object" && !Array.isArray(value)
      : schema.type === "array"
        ? Array.isArray(value)
        : schema.type === "integer"
          ? Number.isInteger(value)
          : schema.type === "number"
            ? typeof value === "number" && Number.isFinite(value)
            : schema.type === "null"
              ? value === null
              : typeof value === schema.type;
    if (!validType) {
      add(`expected ${schema.type}`);
      return errors;
    }
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) add("too short");
    if (schema.maxLength !== undefined && value.length > schema.maxLength) add("too long");
    if (schema["x-maxUtf8Bytes"] !== undefined
        && Buffer.byteLength(value, "utf8") > schema["x-maxUtf8Bytes"]) {
      add(`exceeds ${schema["x-maxUtf8Bytes"]} UTF-8 bytes`);
    }
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) add("pattern mismatch");
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) add("below minimum");
    if (schema.maximum !== undefined && value > schema.maximum) add("above maximum");
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) add("too few items");
    if (schema.maxItems !== undefined && value.length > schema.maxItems) add("too many items");
    if (schema.uniqueItems) {
      const keys = value.map(canonicalJson);
      if (new Set(keys).size !== keys.length) add("duplicate items");
    }
    if (schema.items) {
      value.forEach((entry, index) => {
        errors.push(...schemaErrors(entry, schema.items, root, `${path}[${index}]`));
      });
    }
    if (schema.contains) {
      const matches = value.filter(
        (entry) => schemaErrors(entry, schema.contains, root, path).length === 0,
      ).length;
      if (matches < (schema.minContains ?? 1)) add("contains minimum not met");
      if (schema.maxContains !== undefined && matches > schema.maxContains) {
        add("contains maximum exceeded");
      }
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) add(`missing ${required}`);
    }
    for (const [key, entry] of Object.entries(value)) {
      if (schema.properties?.[key]) {
        errors.push(...schemaErrors(entry, schema.properties[key], root, `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        add(`unknown ${key}`);
      }
    }
  }

  for (const branch of schema.allOf ?? []) {
    errors.push(...schemaErrors(value, branch, root, path));
  }
  if (schema.anyOf) {
    const matches = schema.anyOf.filter(
      (branch) => schemaErrors(value, branch, root, path).length === 0,
    ).length;
    if (matches === 0) add("anyOf mismatch");
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(
      (branch) => schemaErrors(value, branch, root, path).length === 0,
    ).length;
    if (matches !== 1) add("oneOf mismatch");
  }
  if (schema.not && schemaErrors(value, schema.not, root, path).length === 0) {
    add("not mismatch");
  }
  if (schema.if) {
    const matches = schemaErrors(value, schema.if, root, path).length === 0;
    if (matches && schema.then) errors.push(...schemaErrors(value, schema.then, root, path));
    if (!matches && schema.else) errors.push(...schemaErrors(value, schema.else, root, path));
  }
  return errors;
}

export function readSchemaPair(name) {
  const schema = JSON.parse(readFileSync(resolve(schemaRoot, `${name}.schema.json`), "utf8"));
  const example = JSON.parse(
    readFileSync(resolve(schemaRoot, "examples", `${name}.json`), "utf8"),
  );
  return { schema, example };
}
