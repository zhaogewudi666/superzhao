#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import {
  lstat,
  open,
  readdir,
  realpath,
  rename,
  rm,
} from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  posix,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const managedListPath = join(
  repositoryRoot,
  'config',
  'codex-profile-skills.txt',
);
const MANIFEST_SCHEMA = 'superzhao-profile-manifest-v1';
const TREE_SCHEMA = 'superzhao-profile-tree-v1';
const COMPARISON_SCHEMA = 'superzhao-profile-comparison-v1';
const VERIFICATION_SCHEMA = 'superzhao-profile-verification-v1';
const MAX_JSON_BYTES = 64 * 1024 * 1024;
const fatalUtf8Decoder = new TextDecoder('utf-8', { fatal: true });

class UsageError extends Error {}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function decodeUtf8(bytes, label) {
  try {
    return fatalUtf8Decoder.decode(bytes);
  } catch {
    throw new Error(label + ' is not valid UTF-8');
  }
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('canonical JSON only accepts plain objects');
    }
    const keys = Object.keys(value).sort(compareUtf8);
    return (
      '{' +
      keys
        .map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key]))
        .join(',') +
      '}'
    );
  }
  throw new Error('canonical JSON contains an unsupported value');
}

function parseStrictJson(text, label) {
  let index = 0;

  const fail = (message) => {
    throw new Error(label + ' is not strict JSON: ' + message + ' at byte ' + index);
  };
  const skipWhitespace = () => {
    while (
      index < text.length &&
      (text[index] === ' ' ||
        text[index] === '\t' ||
        text[index] === '\n' ||
        text[index] === '\r')
    ) {
      index += 1;
    }
  };
  const parseString = () => {
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === '"') {
        index += 1;
        try {
          return JSON.parse(text.slice(start, index));
        } catch (error) {
          fail(error.message);
        }
      }
      if (character === '\\') {
        index += 1;
        if (index >= text.length) {
          fail('unterminated escape');
        }
        if (text[index] === 'u') {
          const digits = text.slice(index + 1, index + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(digits)) {
            fail('invalid Unicode escape');
          }
          index += 5;
          continue;
        }
        if (!'"\\/bfnrt'.includes(text[index])) {
          fail('invalid escape');
        }
        index += 1;
        continue;
      }
      if (character.charCodeAt(0) <= 0x1f) {
        fail('unescaped control character');
      }
      index += 1;
    }
    fail('unterminated string');
  };
  const parseNumber = () => {
    const match = text
      .slice(index)
      .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if (!match) {
      fail('invalid number');
    }
    index += match[0].length;
    return JSON.parse(match[0]);
  };
  const parseArray = () => {
    const result = [];
    index += 1;
    skipWhitespace();
    if (text[index] === ']') {
      index += 1;
      return result;
    }
    while (index < text.length) {
      result.push(parseValue());
      skipWhitespace();
      if (text[index] === ']') {
        index += 1;
        return result;
      }
      if (text[index] !== ',') {
        fail('expected comma or closing bracket');
      }
      index += 1;
      skipWhitespace();
    }
    fail('unterminated array');
  };
  const parseObject = () => {
    // A null prototype keeps JSON keys such as "__proto__" as ordinary own
    // data properties. Assigning those keys to {} would invoke inherited
    // setters and could hide them from the exact-key schema checks below.
    const result = Object.create(null);
    const keys = new Set();
    index += 1;
    skipWhitespace();
    if (text[index] === '}') {
      index += 1;
      return result;
    }
    while (index < text.length) {
      if (text[index] !== '"') {
        fail('object key must be a string');
      }
      const key = parseString();
      if (keys.has(key)) {
        fail('duplicate object key ' + JSON.stringify(key));
      }
      keys.add(key);
      skipWhitespace();
      if (text[index] !== ':') {
        fail('expected colon after object key');
      }
      index += 1;
      result[key] = parseValue();
      skipWhitespace();
      if (text[index] === '}') {
        index += 1;
        return result;
      }
      if (text[index] !== ',') {
        fail('expected comma or closing brace');
      }
      index += 1;
      skipWhitespace();
    }
    fail('unterminated object');
  };
  const parseValue = () => {
    skipWhitespace();
    const character = text[index];
    if (character === '"') {
      return parseString();
    }
    if (character === '{') {
      return parseObject();
    }
    if (character === '[') {
      return parseArray();
    }
    if (text.startsWith('true', index)) {
      index += 4;
      return true;
    }
    if (text.startsWith('false', index)) {
      index += 5;
      return false;
    }
    if (text.startsWith('null', index)) {
      index += 4;
      return null;
    }
    if (character === '-' || (character >= '0' && character <= '9')) {
      return parseNumber();
    }
    fail('unexpected token');
  };

  const value = parseValue();
  skipWhitespace();
  if (index !== text.length) {
    fail('trailing data');
  }
  return value;
}

function assertSafeComponent(component, label) {
  if (
    typeof component !== 'string' ||
    component.length === 0 ||
    component === '.' ||
    component === '..' ||
    component.includes('/') ||
    component.includes('\\') ||
    /[\u0000-\u001f\u007f]/u.test(component)
  ) {
    throw new Error(label + ' contains an unsafe path component');
  }
}

async function lstatIfPresent(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

function sameIdentity(left, right) {
  return (
    left &&
    right &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode
  );
}

function sameSnapshot(left, right) {
  return (
    sameIdentity(left, right) &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

async function canonicalizePossiblyMissingPath(path, label) {
  const absolutePath = resolve(path);
  const missingComponents = [];
  let existingPath = absolutePath;
  let metadata;

  while (!(metadata = await lstatIfPresent(existingPath))) {
    const parent = dirname(existingPath);
    if (parent === existingPath) {
      throw new Error(label + ' has no existing physical ancestor: ' + absolutePath);
    }
    missingComponents.unshift(basename(existingPath));
    existingPath = parent;
  }

  if (metadata.isSymbolicLink()) {
    throw new Error(label + ' must not be a symlink: ' + absolutePath);
  }
  const physicalExistingPath = await realpath(existingPath);

  return {
    absolutePath: join(physicalExistingPath, ...missingComponents),
    exists: missingComponents.length === 0,
    metadata: missingComponents.length === 0 ? metadata : undefined,
  };
}

async function canonicalExistingPath(path, label) {
  const state = await canonicalizePossiblyMissingPath(path, label);
  if (!state.exists) {
    throw new Error(label + ' is missing: ' + state.absolutePath);
  }
  return state;
}

async function readRegularFileNoFollow(path, label, maximumBytes) {
  const state = await canonicalExistingPath(path, label);
  if (!state.metadata.isFile()) {
    throw new Error(label + ' is not a regular file: ' + state.absolutePath);
  }
  if (state.metadata.size > maximumBytes) {
    throw new Error(label + ' is too large');
  }

  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW || 0);
  const handle = await open(state.absolutePath, flags);
  try {
    const before = await handle.stat();
    if (!before.isFile()) {
      throw new Error(label + ' changed type while being opened');
    }
    if (before.size > maximumBytes) {
      throw new Error(label + ' is too large');
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const pathAfter = await lstatIfPresent(state.absolutePath);
    if (
      !sameSnapshot(before, after) ||
      !sameIdentity(before, pathAfter) ||
      pathAfter.isSymbolicLink()
    ) {
      throw new Error(label + ' changed while being read');
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

async function loadManagedSkills(path = managedListPath) {
  const text = decodeUtf8(
    await readRegularFileNoFollow(
      path,
      'managed Skill list',
      1024 * 1024,
    ),
    'managed Skill list',
  );
  if (text.length === 0) {
    throw new Error('managed Skill list is empty: ' + path);
  }
  if (text.includes('\r') || text.includes('\0')) {
    throw new Error('managed Skill list contains unsafe control characters');
  }

  const normalized = text.endsWith('\n') ? text.slice(0, -1) : text;
  const lines = normalized.split('\n');
  const seen = new Set();
  for (const line of lines) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(line)) {
      throw new Error('managed Skill list contains a malformed entry: ' + JSON.stringify(line));
    }
    if (seen.has(line)) {
      throw new Error('managed Skill list contains a duplicate entry: ' + line);
    }
    seen.add(line);
  }
  return lines;
}

function modeString(metadata) {
  return (metadata.mode & 0o7777).toString(8).padStart(4, '0');
}

async function collectTreeEntries(absolutePath, relativePath, entries) {
  const before = await lstat(absolutePath);
  if (before.isSymbolicLink()) {
    throw new Error('managed profile contains a symlink: ' + relativePath);
  }

  if (before.isDirectory()) {
    entries.push({
      path: relativePath,
      type: 'directory',
      mode: modeString(before),
    });
    const encodedNames = await readdir(absolutePath, { encoding: 'buffer' });
    encodedNames.sort(Buffer.compare);
    for (const encodedName of encodedNames) {
      const name = decodeUtf8(
        encodedName,
        'managed profile filename under ' + relativePath,
      );
      assertSafeComponent(name, 'managed profile path ' + relativePath);
      await collectTreeEntries(
        join(absolutePath, name),
        relativePath + '/' + name,
        entries,
      );
    }
    const after = await lstatIfPresent(absolutePath);
    if (!sameSnapshot(before, after) || after.isSymbolicLink()) {
      throw new Error('managed directory changed while being read: ' + relativePath);
    }
    return;
  }

  if (before.isFile()) {
    const flags = constants.O_RDONLY | (constants.O_NOFOLLOW || 0);
    const handle = await open(absolutePath, flags);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || !sameIdentity(before, opened)) {
        throw new Error('managed file changed while being opened: ' + relativePath);
      }
      const bytes = await handle.readFile();
      const after = await handle.stat();
      const pathAfter = await lstatIfPresent(absolutePath);
      if (
        !sameSnapshot(opened, after) ||
        !sameIdentity(opened, pathAfter) ||
        pathAfter.isSymbolicLink()
      ) {
        throw new Error('managed file changed while being read: ' + relativePath);
      }
      entries.push({
        path: relativePath,
        type: 'file',
        mode: modeString(opened),
        sha256: sha256(bytes),
      });
      return;
    } finally {
      await handle.close();
    }
  }

  throw new Error('managed profile contains an unsupported entry: ' + relativePath);
}

function treeBody(skill, entries) {
  return {
    schema: TREE_SCHEMA,
    skill,
    entries,
  };
}

function profileBody(managedSkills, skills) {
  return {
    schema: MANIFEST_SCHEMA,
    managedSkills,
    skills,
  };
}

async function validateSkillsRoot(root) {
  const state = await canonicalizePossiblyMissingPath(root, 'Skills root');
  if (state.exists && !state.metadata.isDirectory()) {
    throw new Error('Skills root is not a directory: ' + state.absolutePath);
  }
  return { absoluteRoot: state.absolutePath };
}

async function buildManifestPass(rootState, managedSkills) {
  const rootBefore = await lstatIfPresent(rootState.absoluteRoot);
  if (rootBefore && rootBefore.isSymbolicLink()) {
    throw new Error('Skills root changed into a symlink: ' + rootState.absoluteRoot);
  }
  if (rootBefore && !rootBefore.isDirectory()) {
    throw new Error('Skills root is not a directory: ' + rootState.absoluteRoot);
  }
  const skills = [];

  for (const skill of managedSkills) {
    const skillPath = join(rootState.absoluteRoot, skill);
    const metadata = rootBefore ? await lstatIfPresent(skillPath) : undefined;
    if (!metadata) {
      skills.push({
        name: skill,
        state: 'absent',
        treeSha256: null,
        entries: [],
      });
      continue;
    }
    if (metadata.isSymbolicLink()) {
      throw new Error('managed Skill root must not be a symlink: ' + skill);
    }
    if (!metadata.isDirectory()) {
      throw new Error('managed Skill root is not a directory: ' + skill);
    }

    const entries = [];
    await collectTreeEntries(skillPath, skill, entries);
    entries.sort((left, right) => compareUtf8(left.path, right.path));
    skills.push({
      name: skill,
      state: 'present',
      treeSha256: sha256(canonicalJson(treeBody(skill, entries))),
      entries,
    });
  }

  const rootAfter = await lstatIfPresent(rootState.absoluteRoot);
  if (
    Boolean(rootBefore) !== Boolean(rootAfter) ||
    (rootAfter &&
      (rootAfter.isSymbolicLink() ||
        !rootAfter.isDirectory() ||
        !sameIdentity(rootBefore, rootAfter)))
  ) {
    throw new Error('Skills root changed while being read: ' + rootState.absoluteRoot);
  }

  const body = profileBody(managedSkills, skills);
  return {
    ...body,
    profileSha256: sha256(canonicalJson(body)),
  };
}

function assertStableManifest(first, second, label) {
  if (canonicalJson(first) !== canonicalJson(second)) {
    throw new Error(
      label +
        ' changed between consecutive full-profile observations: ' +
        first.profileSha256 +
        ' then ' +
        second.profileSha256,
    );
  }
  return second;
}

async function buildManifest(root, managedSkills) {
  const rootState = await validateSkillsRoot(root);
  const first = await buildManifestPass(rootState, managedSkills);
  const second = await buildManifestPass(rootState, managedSkills);
  return assertStableManifest(first, second, 'managed profile');
}

function assertPlainObject(value, label) {
  const prototype = value && typeof value === 'object'
    ? Object.getPrototypeOf(value)
    : undefined;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (prototype !== Object.prototype && prototype !== null)
  ) {
    throw new Error(label + ' must be a JSON object');
  }
}

function assertExactKeys(value, expectedKeys, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value).sort(compareUtf8);
  const expected = [...expectedKeys].sort(compareUtf8);
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(
      label +
        ' has unexpected or missing fields; expected ' +
        expected.join(', '),
    );
  }
}

function assertDigest(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(label + ' is not a lowercase SHA-256 digest');
  }
}

function validateEntry(entry, skill, index, seenDirectories, previousPath) {
  assertPlainObject(entry, 'manifest entry');
  if (entry.type === 'directory') {
    assertExactKeys(entry, ['path', 'type', 'mode'], 'directory entry');
  } else if (entry.type === 'file') {
    assertExactKeys(entry, ['path', 'type', 'mode', 'sha256'], 'file entry');
    assertDigest(entry.sha256, 'file entry sha256');
  } else {
    throw new Error('manifest entry has an unsupported type');
  }
  if (typeof entry.path !== 'string') {
    throw new Error('manifest entry path must be a string');
  }
  const components = entry.path.split('/');
  if (components[0] !== skill) {
    throw new Error('manifest entry escapes its managed Skill: ' + entry.path);
  }
  for (const component of components) {
    assertSafeComponent(component, 'manifest entry ' + entry.path);
  }
  if (!/^[0-7]{4}$/.test(entry.mode)) {
    throw new Error('manifest entry has an invalid mode: ' + entry.path);
  }
  if (previousPath !== undefined && compareUtf8(previousPath, entry.path) >= 0) {
    throw new Error('manifest entries are not strictly path-sorted');
  }
  if (index === 0) {
    if (entry.path !== skill || entry.type !== 'directory') {
      throw new Error('manifest Skill tree is missing its root directory: ' + skill);
    }
  } else {
    const parent = posix.dirname(entry.path);
    if (!seenDirectories.has(parent)) {
      throw new Error('manifest entry parent is missing or not a directory: ' + entry.path);
    }
  }
  if (entry.type === 'directory') {
    seenDirectories.add(entry.path);
  }
}

function validateManifest(manifest, managedSkills) {
  assertExactKeys(
    manifest,
    ['schema', 'managedSkills', 'skills', 'profileSha256'],
    'profile manifest',
  );
  if (manifest.schema !== MANIFEST_SCHEMA) {
    throw new Error('profile manifest schema is not supported');
  }
  if (
    !Array.isArray(manifest.managedSkills) ||
    canonicalJson(manifest.managedSkills) !== canonicalJson(managedSkills)
  ) {
    throw new Error('profile manifest managed Skill list does not match the canonical list');
  }
  if (!Array.isArray(manifest.skills) || manifest.skills.length !== managedSkills.length) {
    throw new Error('profile manifest Skill records are incomplete');
  }

  for (let index = 0; index < managedSkills.length; index += 1) {
    const skill = manifest.skills[index];
    const expectedName = managedSkills[index];
    assertExactKeys(
      skill,
      ['name', 'state', 'treeSha256', 'entries'],
      'profile Skill record',
    );
    if (skill.name !== expectedName) {
      throw new Error('profile Skill records do not match canonical order');
    }
    if (!Array.isArray(skill.entries)) {
      throw new Error('profile Skill entries must be an array: ' + expectedName);
    }
    if (skill.state === 'absent') {
      if (skill.treeSha256 !== null || skill.entries.length !== 0) {
        throw new Error('absent Skill has tree data: ' + expectedName);
      }
      continue;
    }
    if (skill.state !== 'present') {
      throw new Error('profile Skill has an invalid state: ' + expectedName);
    }
    assertDigest(skill.treeSha256, 'Skill treeSha256');
    if (skill.entries.length === 0) {
      throw new Error('present Skill has an empty tree: ' + expectedName);
    }
    const seenDirectories = new Set();
    let previousPath;
    for (let entryIndex = 0; entryIndex < skill.entries.length; entryIndex += 1) {
      const entry = skill.entries[entryIndex];
      validateEntry(
        entry,
        expectedName,
        entryIndex,
        seenDirectories,
        previousPath,
      );
      previousPath = entry.path;
    }
    const actualTreeDigest = sha256(
      canonicalJson(treeBody(expectedName, skill.entries)),
    );
    if (actualTreeDigest !== skill.treeSha256) {
      throw new Error('Skill treeSha256 does not match tree data: ' + expectedName);
    }
  }

  assertDigest(manifest.profileSha256, 'profileSha256');
  const body = profileBody(manifest.managedSkills, manifest.skills);
  const actualProfileDigest = sha256(canonicalJson(body));
  if (actualProfileDigest !== manifest.profileSha256) {
    throw new Error('profileSha256 does not match the canonical manifest body');
  }
  return manifest;
}

async function readJsonFile(path, label) {
  const text = decodeUtf8(
    await readRegularFileNoFollow(path, label, MAX_JSON_BYTES),
    label,
  );
  try {
    return parseStrictJson(text, label);
  } catch (error) {
    if (error.message.startsWith(label + ' is not strict JSON:')) {
      throw error;
    }
    throw new Error(label + ' is not valid JSON: ' + error.message);
  }
}

async function readAndValidateManifest(path, managedSkills) {
  return validateManifest(
    await readJsonFile(path, 'profile manifest'),
    managedSkills,
  );
}

function actionFor(sourceSkill, targetSkill) {
  if (sourceSkill.state === 'absent' && targetSkill.state === 'absent') {
    return 'missing';
  }
  if (sourceSkill.state === 'present' && targetSkill.state === 'absent') {
    return 'add';
  }
  if (sourceSkill.state === 'absent' && targetSkill.state === 'present') {
    return 'remove';
  }
  return sourceSkill.treeSha256 === targetSkill.treeSha256
    ? 'identical'
    : 'replace';
}

async function buildComparison(sourceRoot, targetRoot, managedSkills) {
  const sourceState = await validateSkillsRoot(sourceRoot);
  const targetState = await validateSkillsRoot(targetRoot);
  const sourceFirst = await buildManifestPass(sourceState, managedSkills);
  const targetFirst = await buildManifestPass(targetState, managedSkills);
  const sourceSecond = await buildManifestPass(sourceState, managedSkills);
  const targetSecond = await buildManifestPass(targetState, managedSkills);
  const source = assertStableManifest(
    sourceFirst,
    sourceSecond,
    'source managed profile',
  );
  const target = assertStableManifest(
    targetFirst,
    targetSecond,
    'target managed profile',
  );
  const actions = managedSkills.map((skill, index) => {
    const sourceSkill = source.skills[index];
    const targetSkill = target.skills[index];
    return {
      skill,
      action: actionFor(sourceSkill, targetSkill),
      sourceState: sourceSkill.state,
      targetState: targetSkill.state,
      sourceTreeSha256: sourceSkill.treeSha256,
      targetTreeSha256: targetSkill.treeSha256,
    };
  });
  const body = {
    schema: COMPARISON_SCHEMA,
    managedSkills,
    source,
    target,
    actions,
  };
  return {
    ...body,
    compareSha256: sha256(canonicalJson(body)),
  };
}

function pathIsInside(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === '' ||
    (!isAbsolute(pathFromRoot) &&
      pathFromRoot !== '..' &&
      !pathFromRoot.startsWith('..' + sep))
  );
}

async function canonicalOutputPath(outputPath) {
  const requestedOutput = resolve(outputPath);
  const parentState = await canonicalExistingPath(
    dirname(requestedOutput),
    'output parent',
  );
  if (!parentState.metadata.isDirectory()) {
    throw new Error('output parent is not a directory: ' + dirname(requestedOutput));
  }
  const absoluteOutput = join(parentState.absolutePath, basename(requestedOutput));

  const existing = await lstatIfPresent(absoluteOutput);
  if (existing) {
    if (existing.isSymbolicLink()) {
      throw new Error('output path must not be a symlink: ' + absoluteOutput);
    }
    if (!existing.isFile()) {
      throw new Error('output path is not a regular file: ' + absoluteOutput);
    }
  }
  return absoluteOutput;
}

async function validateOutputLocation(outputPath, boundRoots) {
  const absoluteOutput = await canonicalOutputPath(outputPath);
  for (const boundRoot of boundRoots) {
    const rootState = await canonicalizePossiblyMissingPath(
      boundRoot,
      'bound Skills root',
    );
    if (pathIsInside(rootState.absolutePath, absoluteOutput)) {
      throw new Error(
        'output path must be outside every bound managed Skills root: ' +
          absoluteOutput,
      );
    }
  }
  return absoluteOutput;
}

async function assertOpenFileContent(handle, expectedBytes, label) {
  const before = await handle.stat();
  if (!before.isFile() || before.size !== expectedBytes.length) {
    throw new Error(label + ' size or type changed');
  }
  const actualBytes = Buffer.alloc(expectedBytes.length);
  let offset = 0;
  while (offset < actualBytes.length) {
    const { bytesRead } = await handle.read(
      actualBytes,
      offset,
      actualBytes.length - offset,
      offset,
    );
    if (bytesRead === 0) {
      throw new Error(label + ' ended while being verified');
    }
    offset += bytesRead;
  }
  const after = await handle.stat();
  if (!sameSnapshot(before, after) || !actualBytes.equals(expectedBytes)) {
    throw new Error(label + ' content changed');
  }
  return after;
}

async function writeJsonAtomic(outputPath, value) {
  const absoluteOutput = await canonicalOutputPath(outputPath);
  const serialized = Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
  const parent = dirname(absoluteOutput);
  const temporaryPath = join(
    parent,
    '.' +
      basename(absoluteOutput) +
      '.tmp-' +
      process.pid +
      '-' +
      randomBytes(8).toString('hex'),
  );
  let handle;
  let published = false;
  try {
    handle = await open(
      temporaryPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_RDWR,
      0o600,
    );
    await handle.writeFile(serialized);
    await handle.chmod(0o600);
    await handle.sync();
    const openedMetadata = await assertOpenFileContent(
      handle,
      serialized,
      'atomic output temporary file',
    );
    const temporaryMetadata = await lstatIfPresent(temporaryPath);
    if (
      !sameSnapshot(openedMetadata, temporaryMetadata) ||
      temporaryMetadata.isSymbolicLink()
    ) {
      throw new Error('atomic output temporary path was replaced before publication');
    }
    await rename(temporaryPath, absoluteOutput);
    published = true;
    const publishedHandleMetadata = await assertOpenFileContent(
      handle,
      serialized,
      'atomic output published file',
    );
    const publishedMetadata = await lstatIfPresent(absoluteOutput);
    if (
      !publishedMetadata ||
      publishedMetadata.isSymbolicLink() ||
      !publishedMetadata.isFile() ||
      !sameSnapshot(publishedHandleMetadata, publishedMetadata) ||
      (publishedMetadata.mode & 0o777) !== 0o600
    ) {
      throw new Error('atomic output publication was replaced or changed');
    }
  } finally {
    if (handle) {
      await handle.close().catch(() => {});
    }
    if (!published) {
      await rm(temporaryPath, { force: true }).catch(() => {});
    }
  }
}

async function emitJson(value, outputPath) {
  if (outputPath) {
    await writeJsonAtomic(outputPath, value);
    return;
  }
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function parseOptions(args, allowed, required) {
  if (args.length % 2 !== 0) {
    throw new UsageError('every option requires a value');
  }
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!allowed.includes(option)) {
      throw new UsageError('unknown option: ' + option);
    }
    if (Object.prototype.hasOwnProperty.call(result, option)) {
      throw new UsageError('duplicate option: ' + option);
    }
    if (typeof value !== 'string' || value.length === 0) {
      throw new UsageError('option requires a nonempty value: ' + option);
    }
    result[option] = value;
  }
  for (const option of required) {
    if (!Object.prototype.hasOwnProperty.call(result, option)) {
      throw new UsageError('required option is missing: ' + option);
    }
  }
  return result;
}

function usage() {
  return [
    'usage:',
    '  node scripts/profile-integrity.mjs manifest --root DIR [--output FILE]',
    '  node scripts/profile-integrity.mjs compare --source DIR --target DIR [--output FILE]',
    '  node scripts/profile-integrity.mjs verify --root DIR --manifest FILE',
  ].join('\n');
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    throw new UsageError('command is required');
  }

  if (command === 'manifest') {
    const options = parseOptions(args, ['--root', '--output'], ['--root']);
    const managedSkills = await loadManagedSkills();
    const output = options['--output']
      ? await validateOutputLocation(options['--output'], [options['--root']])
      : undefined;
    const manifest = await buildManifest(options['--root'], managedSkills);
    await emitJson(manifest, output);
    return;
  }

  if (command === 'compare') {
    const options = parseOptions(
      args,
      ['--source', '--target', '--output'],
      ['--source', '--target'],
    );
    const managedSkills = await loadManagedSkills();
    const output = options['--output']
      ? await validateOutputLocation(
          options['--output'],
          [options['--source'], options['--target']],
        )
      : undefined;
    const comparison = await buildComparison(
      options['--source'],
      options['--target'],
      managedSkills,
    );
    await emitJson(comparison, output);
    return;
  }

  if (command === 'verify') {
    const options = parseOptions(
      args,
      ['--root', '--manifest'],
      ['--root', '--manifest'],
    );
    const managedSkills = await loadManagedSkills();
    const expected = await readAndValidateManifest(
      options['--manifest'],
      managedSkills,
    );
    const actual = await buildManifest(options['--root'], managedSkills);
    if (canonicalJson(expected) !== canonicalJson(actual)) {
      throw new Error(
        'profile mismatch or drift: expected ' +
          expected.profileSha256 +
          ', actual ' +
          actual.profileSha256,
      );
    }
    await emitJson({
      schema: VERIFICATION_SCHEMA,
      verified: true,
      profileSha256: actual.profileSha256,
    });
    return;
  }

  throw new UsageError('unknown command: ' + command);
}

try {
  await main();
} catch (error) {
  if (error instanceof UsageError) {
    process.stderr.write('error: ' + error.message + '\n' + usage() + '\n');
    process.exitCode = 2;
  } else {
    process.stderr.write('error: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
