import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../..', import.meta.url));
const helper = join(root, 'scripts', 'profile-integrity.mjs');
const managedList = join(root, 'config', 'codex-profile-skills.txt');
const expectedSkills = [
  'brainstorming',
  'dispatching-parallel-agents',
  'executing-plans',
  'finishing-a-development-branch',
  'receiving-code-review',
  'requesting-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-git-worktrees',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
  'writing-skills',
];

function runCli(args, options = {}) {
  const script = options.script || helper;
  const child = spawn(process.execPath, [...(options.nodeArgs || []), script, ...args], {
    cwd: options.cwd || root,
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (code, signal) => {
      resolve({
        code,
        signal,
        stdout: Buffer.concat(stdout).toString(),
        stderr: Buffer.concat(stderr).toString(),
      });
    });
  });
}

async function runOk(args, options) {
  const result = await runCli(args, options);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.equal(result.signal, null);
  return result;
}

async function makeTemporaryDirectory(t, prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  const canonicalDirectory = await realpath(directory);
  t.after(async () => {
    await rm(canonicalDirectory, { force: true, recursive: true });
  });
  return canonicalDirectory;
}

async function makeSkillsRoot(directory, name) {
  const skillsRoot = join(directory, name);
  await mkdir(skillsRoot, { recursive: true, mode: 0o755 });
  await chmod(skillsRoot, 0o755);
  return skillsRoot;
}

async function writeSkill(skillsRoot, name, content, options = {}) {
  const skillRoot = join(skillsRoot, name);
  await mkdir(skillRoot, { recursive: true, mode: options.directoryMode || 0o755 });
  await chmod(skillRoot, options.directoryMode || 0o755);
  const entrypoint = join(skillRoot, 'SKILL.md');
  await writeFile(entrypoint, content, { mode: options.fileMode || 0o644 });
  await chmod(entrypoint, options.fileMode || 0o644);
  return skillRoot;
}

async function readManifest(skillsRoot, options = {}) {
  const result = await runOk(
    ['manifest', '--root', skillsRoot],
    options,
  );
  return JSON.parse(result.stdout);
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return (
      '{' +
      keys
        .map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function manifestBody(manifest) {
  const body = structuredClone(manifest);
  delete body.profileSha256;
  return body;
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await chmod(path, 0o600);
}

test('repository managed Skill list is the exact unique 14-entry profile', async () => {
  const text = await readFile(managedList, 'utf8');
  assert.ok(text.endsWith('\n'));
  assert.deepEqual(text.trimEnd().split('\n'), expectedSkills);
  assert.equal(new Set(expectedSkills).size, expectedSkills.length);
});

test('manifest identity is root-independent and includes bytes, modes, and empty directories', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-root-');
  const left = await makeSkillsRoot(directory, 'left');
  const right = await makeSkillsRoot(directory, 'right');

  for (const skillsRoot of [left, right]) {
    const skillRoot = await writeSkill(
      skillsRoot,
      expectedSkills[0],
      '# same bytes\n',
      { directoryMode: 0o750, fileMode: 0o640 },
    );
    const empty = join(skillRoot, 'empty');
    await mkdir(empty, { mode: 0o711 });
    await chmod(empty, 0o711);
  }

  const leftManifest = await readManifest(left);
  const rightManifest = await readManifest(right);
  assert.deepEqual(leftManifest, rightManifest);
  assert.match(leftManifest.profileSha256, /^[0-9a-f]{64}$/);
  const present = leftManifest.skills[0];
  assert.equal(present.state, 'present');
  assert.ok(
    present.entries.some(
      (entry) =>
        entry.path === expectedSkills[0] + '/empty' &&
        entry.type === 'directory' &&
        entry.mode === '0711',
    ),
  );
  assert.ok(
    present.entries.some(
      (entry) =>
        entry.path === expectedSkills[0] + '/SKILL.md' &&
        entry.type === 'file' &&
        entry.mode === '0640' &&
        /^[0-9a-f]{64}$/.test(entry.sha256),
    ),
  );
});

test('content, mode, empty-directory, extra-file, and missing-Skill drift change identity', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-drift-');
  const baselineRoot = await makeSkillsRoot(directory, 'baseline');
  await writeSkill(baselineRoot, expectedSkills[0], 'baseline\n');
  const baseline = await readManifest(baselineRoot);

  const variants = [
    {
      name: 'content',
      mutate: async (skillsRoot) => {
        await writeFile(join(skillsRoot, expectedSkills[0], 'SKILL.md'), 'changed\n');
      },
    },
    {
      name: 'mode',
      mutate: async (skillsRoot) => {
        await chmod(join(skillsRoot, expectedSkills[0], 'SKILL.md'), 0o600);
      },
    },
    {
      name: 'empty directory',
      mutate: async (skillsRoot) => {
        const path = join(skillsRoot, expectedSkills[0], 'new-empty');
        await mkdir(path, { mode: 0o755 });
        await chmod(path, 0o755);
      },
    },
    {
      name: 'extra file',
      mutate: async (skillsRoot) => {
        await writeFile(join(skillsRoot, expectedSkills[0], 'extra.txt'), 'extra\n');
      },
    },
    {
      name: 'missing Skill',
      mutate: async (skillsRoot) => {
        await rm(join(skillsRoot, expectedSkills[0]), { recursive: true });
      },
    },
  ];

  for (const variant of variants) {
    await t.test(variant.name, async () => {
      const skillsRoot = await makeSkillsRoot(directory, 'variant-' + variant.name.replaceAll(' ', '-'));
      await writeSkill(skillsRoot, expectedSkills[0], 'baseline\n');
      await variant.mutate(skillsRoot);
      const changed = await readManifest(skillsRoot);
      assert.notEqual(changed.profileSha256, baseline.profileSha256);
    });
  }
});

test('manifest fails closed when consecutive full-profile observations differ', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-concurrent-drift-');
  const skillsRoot = await makeSkillsRoot(directory, 'skills');
  const skillRoot = await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');
  const earlyFile = join(skillRoot, 'a-early.txt');
  const triggerFile = join(skillRoot, 'z-trigger.txt');
  const marker = join(directory, 'drift-marker.txt');
  const preload = join(directory, 'mutate-after-early-read.cjs');
  await writeFile(earlyFile, 'old\n');
  await writeFile(triggerFile, 'trigger\n');
  await writeFile(
    preload,
    [
      "const fs = require('node:fs');",
      "const promises = require('node:fs/promises');",
      'const originalOpen = promises.open;',
      'promises.open = async function injectedOpen(path, ...args) {',
      '  if (path === process.env.SUPERZHAO_TEST_DRIFT_TRIGGER &&',
      '      !fs.existsSync(process.env.SUPERZHAO_TEST_DRIFT_MARKER)) {',
      "    fs.writeFileSync(process.env.SUPERZHAO_TEST_DRIFT_EARLY, 'new\\n');",
      "    fs.writeFileSync(process.env.SUPERZHAO_TEST_DRIFT_MARKER, 'mutated\\n');",
      '  }',
      '  return originalOpen.call(this, path, ...args);',
      '};',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );

  const result = await runCli(['manifest', '--root', skillsRoot], {
    nodeArgs: ['--require', preload],
    env: {
      SUPERZHAO_TEST_DRIFT_EARLY: earlyFile,
      SUPERZHAO_TEST_DRIFT_TRIGGER: triggerFile,
      SUPERZHAO_TEST_DRIFT_MARKER: marker,
    },
  });

  assert.equal(await readFile(marker, 'utf8'), 'mutated\n');
  assert.equal(await readFile(earlyFile, 'utf8'), 'new\n');
  assert.notEqual(result.code, 0, 'publisher accepted a stale mixed-time profile');
  assert.match(result.stderr, /stable|changed|drift|observation/i);
});

test('unrelated personal Skills, including a personal symlink, do not affect the managed digest', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-personal-');
  const skillsRoot = await makeSkillsRoot(directory, 'skills');
  await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');
  const before = await readManifest(skillsRoot);

  await writeSkill(skillsRoot, 'personal-sentinel', 'personal\n');
  const outside = join(directory, 'outside');
  await mkdir(outside);
  await symlink(outside, join(skillsRoot, 'personal-link'));

  const after = await readManifest(skillsRoot);
  assert.equal(after.profileSha256, before.profileSha256);
  assert.deepEqual(after, before);
});

test('managed symlinks, unsafe names, and unsupported entries fail closed', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-unsafe-');

  await t.test('managed root symlink', async () => {
    const skillsRoot = await makeSkillsRoot(directory, 'root-link');
    const outside = join(directory, 'root-link-target');
    await mkdir(outside);
    await symlink(outside, join(skillsRoot, expectedSkills[0]));
    const result = await runCli(['manifest', '--root', skillsRoot]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /symlink/i);
  });

  await t.test('internal symlink', async () => {
    const skillsRoot = await makeSkillsRoot(directory, 'internal-link');
    const skillRoot = await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');
    await symlink('SKILL.md', join(skillRoot, 'alias.md'));
    const result = await runCli(['manifest', '--root', skillsRoot]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /symlink/i);
  });

  await t.test('control character in a name', async () => {
    const skillsRoot = await makeSkillsRoot(directory, 'unsafe-name');
    const skillRoot = await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');
    await mkdir(join(skillRoot, 'line\nbreak'));
    const result = await runCli(['manifest', '--root', skillsRoot]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /unsafe|control/i);
  });

  await t.test('FIFO', async (subtest) => {
    const probe = spawnSync('mkfifo', ['--help'], { stdio: 'ignore' });
    if (probe.error && probe.error.code === 'ENOENT') {
      subtest.skip('mkfifo is unavailable');
      return;
    }
    const skillsRoot = await makeSkillsRoot(directory, 'fifo');
    const skillRoot = await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');
    const fifo = join(skillRoot, 'pipe');
    const created = spawnSync('mkfifo', [fifo], { encoding: 'utf8' });
    assert.equal(created.status, 0, created.stderr);
    const result = await runCli(['manifest', '--root', skillsRoot]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /unsupported/i);
  });

  await t.test('invalid UTF-8 filename bytes', async (subtest) => {
    const skillsRoot = await makeSkillsRoot(directory, 'invalid-utf8-name');
    const skillRoot = await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');
    const encodedPath = Buffer.concat([
      Buffer.from(skillRoot + '/'),
      Buffer.from([0x80]),
    ]);
    try {
      await writeFile(encodedPath, 'invalid name\n');
    } catch (error) {
      if (error.code === 'EILSEQ' || error.code === 'EINVAL') {
        subtest.skip('filesystem rejects invalid UTF-8 filenames');
        return;
      }
      throw error;
    }
    const result = await runCli(['manifest', '--root', skillsRoot]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /UTF-8|filename|unsafe/i);
  });
});

test('managed list parser rejects missing, empty, blank, malformed, duplicate, and symlinked config', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-config-');
  const skillsRoot = await makeSkillsRoot(directory, 'skills');
  const variants = [
    ['missing', null],
    ['empty', ''],
    ['blank', 'brainstorming\n\nwriting-skills\n'],
    ['malformed', 'brainstorming\n../escape\n'],
    ['duplicate', 'brainstorming\nbrainstorming\n'],
  ];

  for (const [name, config] of variants) {
    await t.test(name, async () => {
      const copiedRoot = join(directory, name);
      const copiedScript = join(copiedRoot, 'scripts', 'profile-integrity.mjs');
      await mkdir(dirname(copiedScript), { recursive: true });
      await copyFile(helper, copiedScript);
      if (config !== null) {
        const configPath = join(copiedRoot, 'config', 'codex-profile-skills.txt');
        await mkdir(dirname(configPath), { recursive: true });
        await writeFile(configPath, config);
      }
      const result = await runCli(
        ['manifest', '--root', skillsRoot],
        { script: copiedScript },
      );
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /managed|config|Skill list/i);
    });
  }

  await t.test('symlinked config', async () => {
    const copiedRoot = join(directory, 'symlinked');
    const copiedScript = join(copiedRoot, 'scripts', 'profile-integrity.mjs');
    const configPath = join(copiedRoot, 'config', 'codex-profile-skills.txt');
    await mkdir(dirname(copiedScript), { recursive: true });
    await mkdir(dirname(configPath), { recursive: true });
    await copyFile(helper, copiedScript);
    await symlink(managedList, configPath);
    const result = await runCli(
      ['manifest', '--root', skillsRoot],
      { script: copiedScript },
    );
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /symlink/i);
  });
});

test('manifest output is private, atomic, and preserves an existing output on build failure', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-output-');
  const skillsRoot = await makeSkillsRoot(directory, 'skills');
  await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');
  const outputDirectory = join(directory, 'output');
  const output = join(outputDirectory, 'profile.json');
  await mkdir(outputDirectory);

  await runOk(['manifest', '--root', skillsRoot, '--output', output]);
  const outputStat = await lstat(output);
  assert.equal(outputStat.mode & 0o777, 0o600);
  assert.equal(outputStat.isFile(), true);
  const outputText = await readFile(output, 'utf8');
  assert.doesNotThrow(() => JSON.parse(outputText));
  assert.deepEqual(await readdir(outputDirectory), ['profile.json']);

  const sentinel = 'do not replace\n';
  await writeFile(output, sentinel);
  await symlink('SKILL.md', join(skillsRoot, expectedSkills[0], 'unsafe-link'));
  const failed = await runCli([
    'manifest',
    '--root',
    skillsRoot,
    '--output',
    output,
  ]);
  assert.notEqual(failed.code, 0);
  assert.equal(await readFile(output, 'utf8'), sentinel);
  assert.deepEqual(await readdir(outputDirectory), ['profile.json']);
});

test('atomic output detects a deterministically swapped temporary path without touching the symlink target', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-output-race-');
  const skillsRoot = await makeSkillsRoot(directory, 'skills');
  await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');

  const outputDirectory = join(directory, 'output-race');
  const output = join(outputDirectory, 'profile.json');
  const victim = join(directory, 'victim.txt');
  const swapMarker = join(directory, 'swap-marker.txt');
  const preload = join(directory, 'swap-opened-temp.cjs');
  await mkdir(outputDirectory, { mode: 0o700 });
  await chmod(outputDirectory, 0o700);
  await writeFile(victim, 'victim must stay unchanged\n', { mode: 0o644 });
  await chmod(victim, 0o644);
  await writeFile(
    preload,
    [
      "const fs = require('node:fs');",
      "const promises = require('node:fs/promises');",
      'const originalOpen = promises.open;',
      'promises.open = async function injectedOpen(path, ...args) {',
      '  const handle = await originalOpen.call(this, path, ...args);',
      '  if (typeof path === \'string\' && path.startsWith(process.env.SUPERZHAO_TEST_TEMP_PREFIX)) {',
      '    fs.unlinkSync(path);',
      '    fs.symlinkSync(process.env.SUPERZHAO_TEST_VICTIM, path);',
      "    fs.writeFileSync(process.env.SUPERZHAO_TEST_SWAP_MARKER, 'swapped\\n');",
      '  }',
      '  return handle;',
      '};',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );

  const result = await runCli([
    'manifest',
    '--root',
    skillsRoot,
    '--output',
    output,
  ], {
    nodeArgs: ['--require', preload],
    env: {
      SUPERZHAO_TEST_TEMP_PREFIX: join(outputDirectory, '.profile.json.tmp-'),
      SUPERZHAO_TEST_VICTIM: victim,
      SUPERZHAO_TEST_SWAP_MARKER: swapMarker,
    },
  });

  assert.equal(await readFile(swapMarker, 'utf8'), 'swapped\n');
  assert.notEqual(result.code, 0, 'publisher accepted a replaced temporary path');
  assert.equal(await readFile(victim, 'utf8'), 'victim must stay unchanged\n');
  assert.equal((await lstat(victim)).mode & 0o777, 0o644);
  const published = await lstat(output).catch((error) => {
    if (error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  });
  assert.equal(
    Boolean(published && published.isSymbolicLink()),
    false,
    'publisher left an attacker-controlled symlink at the output path',
  );
});

test('atomic output detects same-inode content tampering immediately before rename', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-output-content-race-');
  const skillsRoot = await makeSkillsRoot(directory, 'skills');
  await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');
  const outputDirectory = join(directory, 'output-race');
  const output = join(outputDirectory, 'profile.json');
  const marker = join(directory, 'rename-marker.txt');
  const preload = join(directory, 'tamper-before-rename.cjs');
  await mkdir(outputDirectory, { mode: 0o700 });
  await writeFile(
    preload,
    [
      "const fs = require('node:fs');",
      "const promises = require('node:fs/promises');",
      'const originalRename = promises.rename;',
      'promises.rename = async function injectedRename(from, to) {',
      '  if (typeof from === \'string\' && from.startsWith(process.env.SUPERZHAO_TEST_TEMP_PREFIX)) {',
      "    fs.writeFileSync(from, '{\"attacker\":true}\\n');",
      "    fs.writeFileSync(process.env.SUPERZHAO_TEST_RENAME_MARKER, 'tampered\\n');",
      '  }',
      '  return originalRename.call(this, from, to);',
      '};',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );

  const result = await runCli([
    'manifest',
    '--root',
    skillsRoot,
    '--output',
    output,
  ], {
    nodeArgs: ['--require', preload],
    env: {
      SUPERZHAO_TEST_TEMP_PREFIX: join(outputDirectory, '.profile.json.tmp-'),
      SUPERZHAO_TEST_RENAME_MARKER: marker,
    },
  });

  assert.equal(await readFile(marker, 'utf8'), 'tampered\n');
  assert.notEqual(result.code, 0, 'publisher accepted tampered same-inode bytes');
  assert.match(result.stderr, /content|changed|publication|atomic/i);
  // Once rename has published, deleting by pathname can race with and remove a
  // later valid concurrent writer. The failed writer therefore reports the
  // verification failure but does not clean a path it can no longer own
  // conditionally with portable Node APIs.
  assert.equal(await readFile(output, 'utf8'), '{"attacker":true}\n');
  assert.deepEqual(await readdir(outputDirectory), ['profile.json']);
});

test('concurrent atomic writers preserve the last complete winner', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-output-concurrent-');
  const skillsRoot = await makeSkillsRoot(directory, 'skills');
  await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');
  const outputDirectory = join(directory, 'output');
  const output = join(outputDirectory, 'profile.json');
  const firstRenamed = join(directory, 'first-renamed');
  const secondRenamed = join(directory, 'second-renamed');
  const preload = join(directory, 'ordered-concurrent-rename.cjs');
  await mkdir(outputDirectory, { mode: 0o700 });
  await writeFile(
    preload,
    [
      "const fs = require('node:fs');",
      "const promises = require('node:fs/promises');",
      'const originalRename = promises.rename;',
      'const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));',
      'async function waitFor(path) {',
      '  for (let attempt = 0; attempt < 2_000; attempt += 1) {',
      '    if (fs.existsSync(path)) return;',
      '    await sleep(2);',
      '  }',
      "  throw new Error('timed out waiting for concurrent writer barrier');",
      '}',
      'promises.rename = async function injectedRename(from, to) {',
      '  if (typeof from !== \'string\' || !from.startsWith(process.env.SUPERZHAO_TEST_TEMP_PREFIX)) {',
      '    return originalRename.call(this, from, to);',
      '  }',
      "  if (process.env.SUPERZHAO_TEST_WRITER === 'first') {",
      '    await originalRename.call(this, from, to);',
      "    fs.writeFileSync(process.env.SUPERZHAO_TEST_FIRST_RENAMED, 'renamed\\n');",
      '    await waitFor(process.env.SUPERZHAO_TEST_SECOND_RENAMED);',
      '    return;',
      '  }',
      '  await waitFor(process.env.SUPERZHAO_TEST_FIRST_RENAMED);',
      '  await originalRename.call(this, from, to);',
      "  fs.writeFileSync(process.env.SUPERZHAO_TEST_SECOND_RENAMED, 'renamed\\n');",
      '  await sleep(250);',
      '};',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );

  const common = {
    nodeArgs: ['--require', preload],
    env: {
      SUPERZHAO_TEST_TEMP_PREFIX: join(outputDirectory, '.profile.json.tmp-'),
      SUPERZHAO_TEST_FIRST_RENAMED: firstRenamed,
      SUPERZHAO_TEST_SECOND_RENAMED: secondRenamed,
    },
  };
  const first = runCli([
    'manifest',
    '--root',
    skillsRoot,
    '--output',
    output,
  ], {
    ...common,
    env: { ...common.env, SUPERZHAO_TEST_WRITER: 'first' },
  });
  const second = runCli([
    'manifest',
    '--root',
    skillsRoot,
    '--output',
    output,
  ], {
    ...common,
    env: { ...common.env, SUPERZHAO_TEST_WRITER: 'second' },
  });
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.notEqual(firstResult.code, 0, 'superseded writer claimed publication');
  assert.equal(secondResult.code, 0, secondResult.stderr || secondResult.stdout);
  const published = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(published.schema, 'superzhao-profile-manifest-v1');
  assert.match(published.profileSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(await readdir(outputDirectory), ['profile.json']);
});

test('output inside a bound managed tree is rejected before it can invalidate the result', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-self-output-');
  const skillsRoot = await makeSkillsRoot(directory, 'skills');
  const skillRoot = await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');
  const output = join(skillRoot, 'generated-profile.json');

  const result = await runCli([
    'manifest',
    '--root',
    skillsRoot,
    '--output',
    output,
  ]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /output|managed|inside|root/i);
  await assert.rejects(lstat(output), { code: 'ENOENT' });
});

test('output symlinks and manifest-input symlinks are rejected', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-io-link-');
  const skillsRoot = await makeSkillsRoot(directory, 'skills');
  await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');
  const target = join(directory, 'target.json');
  const linkedOutput = join(directory, 'linked-output.json');
  await writeFile(target, 'sentinel\n');
  await symlink(target, linkedOutput);

  const outputResult = await runCli([
    'manifest',
    '--root',
    skillsRoot,
    '--output',
    linkedOutput,
  ]);
  assert.notEqual(outputResult.code, 0);
  assert.match(outputResult.stderr, /symlink/i);
  assert.equal(await readFile(target, 'utf8'), 'sentinel\n');

  const manifest = join(directory, 'manifest.json');
  await runOk(['manifest', '--root', skillsRoot, '--output', manifest]);
  const linkedManifest = join(directory, 'linked-manifest.json');
  await symlink(manifest, linkedManifest);
  const verifyResult = await runCli([
    'verify',
    '--root',
    skillsRoot,
    '--manifest',
    linkedManifest,
  ]);
  assert.notEqual(verifyResult.code, 0);
  assert.match(verifyResult.stderr, /symlink/i);
});

test('ancestor symlink aliases resolve once to the same physical roots, outputs, and inputs', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-ancestor-link-');
  const physicalContainer = join(directory, 'physical');
  const skillsRoot = await makeSkillsRoot(physicalContainer, 'skills');
  await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');
  const alias = join(directory, 'alias');
  await symlink(physicalContainer, alias);

  const physicalManifest = await readManifest(skillsRoot);
  const aliasManifest = await readManifest(join(alias, 'skills'));
  assert.deepEqual(aliasManifest, physicalManifest);

  const outputDirectory = join(physicalContainer, 'output');
  await mkdir(outputDirectory);
  await runOk([
    'manifest',
    '--root',
    skillsRoot,
    '--output',
    join(alias, 'output', 'profile.json'),
  ]);
  assert.deepEqual(
    JSON.parse(await readFile(join(outputDirectory, 'profile.json'), 'utf8')),
    physicalManifest,
  );

  const manifest = join(outputDirectory, 'manifest.json');
  await runOk(['manifest', '--root', skillsRoot, '--output', manifest]);
  const verifyResult = await runOk([
    'verify',
    '--root',
    skillsRoot,
    '--manifest',
    join(alias, 'output', 'manifest.json'),
  ]);
  assert.equal(JSON.parse(verifyResult.stdout).verified, true);
});

test('verify validates schema and hashes before comparing current state', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-verify-');
  const skillsRoot = await makeSkillsRoot(directory, 'skills');
  const skillRoot = await writeSkill(skillsRoot, expectedSkills[0], 'managed\n');
  await writeFile(join(skillRoot, '�.txt'), 'valid replacement character\n');
  const manifestPath = join(directory, 'manifest.json');
  await runOk(['manifest', '--root', skillsRoot, '--output', manifestPath]);

  const verified = await runOk([
    'verify',
    '--root',
    skillsRoot,
    '--manifest',
    manifestPath,
  ]);
  const verification = JSON.parse(verified.stdout);
  assert.equal(verification.verified, true);

  const original = JSON.parse(await readFile(manifestPath, 'utf8'));
  const originalText = await readFile(manifestPath, 'utf8');
  const duplicateKeysPath = join(directory, 'duplicate-keys.json');
  await writeFile(
    duplicateKeysPath,
    '{"\\u0073chema":"smuggled-first-value",' + originalText.slice(1),
  );
  const duplicateResult = await runCli([
    'verify',
    '--root',
    skillsRoot,
    '--manifest',
    duplicateKeysPath,
  ]);
  assert.notEqual(duplicateResult.code, 0);
  assert.match(duplicateResult.stderr, /duplicate/i);

  const prototypeKeyPath = join(directory, 'prototype-key.json');
  await writeFile(
    prototypeKeyPath,
    '{"__proto__":true,' + originalText.slice(1),
  );
  const prototypeKeyResult = await runCli([
    'verify',
    '--root',
    skillsRoot,
    '--manifest',
    prototypeKeyPath,
  ]);
  assert.notEqual(prototypeKeyResult.code, 0);
  assert.match(prototypeKeyResult.stderr, /unexpected|key|schema/i);

  const validBytes = await readFile(manifestPath);
  const replacementBytes = Buffer.from('�');
  const replacementIndex = validBytes.indexOf(replacementBytes);
  assert.notEqual(replacementIndex, -1);
  const invalidUtf8Path = join(directory, 'invalid-utf8.json');
  await writeFile(
    invalidUtf8Path,
    Buffer.concat([
      validBytes.subarray(0, replacementIndex),
      Buffer.from([0x80]),
      validBytes.subarray(replacementIndex + replacementBytes.length),
    ]),
  );
  const invalidUtf8Result = await runCli([
    'verify',
    '--root',
    skillsRoot,
    '--manifest',
    invalidUtf8Path,
  ]);
  assert.notEqual(invalidUtf8Result.code, 0);
  assert.match(invalidUtf8Result.stderr, /UTF-8/i);

  const badHash = structuredClone(original);
  badHash.profileSha256 = '0'.repeat(64);
  await writeJson(manifestPath, badHash);
  const hashResult = await runCli([
    'verify',
    '--root',
    skillsRoot,
    '--manifest',
    manifestPath,
  ]);
  assert.notEqual(hashResult.code, 0);
  assert.match(hashResult.stderr, /profileSha256|digest|hash/i);

  const extraField = structuredClone(original);
  extraField.unexpected = true;
  await writeJson(manifestPath, extraField);
  const schemaResult = await runCli([
    'verify',
    '--root',
    skillsRoot,
    '--manifest',
    manifestPath,
  ]);
  assert.notEqual(schemaResult.code, 0);
  assert.match(schemaResult.stderr, /field|schema|unexpected/i);

  const inconsistentTree = structuredClone(original);
  const fileEntry = inconsistentTree.skills[0].entries.find(
    (entry) => entry.type === 'file',
  );
  fileEntry.sha256 = 'f'.repeat(64);
  inconsistentTree.profileSha256 = sha256(
    canonicalJson(manifestBody(inconsistentTree)),
  );
  await writeJson(manifestPath, inconsistentTree);
  const treeResult = await runCli([
    'verify',
    '--root',
    skillsRoot,
    '--manifest',
    manifestPath,
  ]);
  assert.notEqual(treeResult.code, 0);
  assert.match(treeResult.stderr, /treeSha256|tree digest|Skill digest/i);

  await writeJson(manifestPath, original);
  await writeFile(
    join(skillsRoot, expectedSkills[0], 'SKILL.md'),
    'drifted\n',
  );
  const driftResult = await runCli([
    'verify',
    '--root',
    skillsRoot,
    '--manifest',
    manifestPath,
  ]);
  assert.notEqual(driftResult.code, 0);
  assert.match(driftResult.stderr, /mismatch|drift/i);
});

test('compare reports identical, replace, add, remove, and missing actions', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-compare-');
  const source = await makeSkillsRoot(directory, 'source');
  const target = await makeSkillsRoot(directory, 'target');

  await writeSkill(source, expectedSkills[0], 'same\n');
  await writeSkill(target, expectedSkills[0], 'same\n');
  await writeSkill(source, expectedSkills[1], 'source\n');
  await writeSkill(target, expectedSkills[1], 'target\n');
  await writeSkill(source, expectedSkills[2], 'add\n');
  await writeSkill(target, expectedSkills[3], 'remove\n');

  const result = await runOk([
    'compare',
    '--source',
    source,
    '--target',
    target,
  ]);
  const comparison = JSON.parse(result.stdout);
  assert.match(comparison.compareSha256, /^[0-9a-f]{64}$/);
  assert.equal(
    comparison.compareSha256,
    sha256(
      canonicalJson(
        Object.fromEntries(
          Object.entries(comparison).filter(([key]) => key !== 'compareSha256'),
        ),
      ),
    ),
  );
  const actions = new Map(
    comparison.actions.map((entry) => [entry.skill, entry.action]),
  );
  assert.equal(actions.get(expectedSkills[0]), 'identical');
  assert.equal(actions.get(expectedSkills[1]), 'replace');
  assert.equal(actions.get(expectedSkills[2]), 'add');
  assert.equal(actions.get(expectedSkills[3]), 'remove');
  assert.equal(actions.get(expectedSkills[4]), 'missing');
  assert.equal(comparison.source.profileSha256, (await readManifest(source)).profileSha256);
  assert.equal(comparison.target.profileSha256, (await readManifest(target)).profileSha256);
});

test('compare interleaves source and target observations and rejects cross-root drift', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-compare-drift-');
  const sourceRoot = await makeSkillsRoot(directory, 'source');
  const targetRoot = await makeSkillsRoot(directory, 'target');
  const sourceSkill = await writeSkill(sourceRoot, expectedSkills[0], 'source\n');
  const targetSkill = await writeSkill(targetRoot, expectedSkills[0], 'target\n');
  const sourceEarlyFile = join(sourceSkill, 'a-source.txt');
  const targetTriggerFile = join(targetSkill, 'z-target-trigger.txt');
  const marker = join(directory, 'compare-drift-marker.txt');
  const preload = join(directory, 'mutate-source-during-target-scan.cjs');
  await writeFile(sourceEarlyFile, 'old\n');
  await writeFile(targetTriggerFile, 'trigger\n');
  await writeFile(
    preload,
    [
      "const fs = require('node:fs');",
      "const promises = require('node:fs/promises');",
      'const originalOpen = promises.open;',
      'promises.open = async function injectedOpen(path, ...args) {',
      '  if (path === process.env.SUPERZHAO_TEST_TARGET_TRIGGER &&',
      '      !fs.existsSync(process.env.SUPERZHAO_TEST_COMPARE_MARKER)) {',
      "    fs.writeFileSync(process.env.SUPERZHAO_TEST_SOURCE_EARLY, 'new\\n');",
      "    fs.writeFileSync(process.env.SUPERZHAO_TEST_COMPARE_MARKER, 'mutated\\n');",
      '  }',
      '  return originalOpen.call(this, path, ...args);',
      '};',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );

  const result = await runCli([
    'compare',
    '--source',
    sourceRoot,
    '--target',
    targetRoot,
  ], {
    nodeArgs: ['--require', preload],
    env: {
      SUPERZHAO_TEST_SOURCE_EARLY: sourceEarlyFile,
      SUPERZHAO_TEST_TARGET_TRIGGER: targetTriggerFile,
      SUPERZHAO_TEST_COMPARE_MARKER: marker,
    },
  });

  assert.equal(await readFile(marker, 'utf8'), 'mutated\n');
  assert.notEqual(result.code, 0, 'compare accepted a stale source/target pair');
  assert.match(result.stderr, /source|stable|changed|observation/i);
});

test('CLI rejects missing, unknown, and duplicate arguments with usage status 2', async (t) => {
  const directory = await makeTemporaryDirectory(t, 'profile-integrity-cli-');
  const skillsRoot = await makeSkillsRoot(directory, 'skills');
  const cases = [
    [],
    ['unknown'],
    ['manifest'],
    ['manifest', '--root', skillsRoot, '--root', skillsRoot],
    ['manifest', '--root', skillsRoot, '--unknown', 'value'],
    ['verify', '--root', skillsRoot],
  ];

  for (const args of cases) {
    const result = await runCli(args);
    assert.equal(result.code, 2, result.stderr || result.stdout);
    assert.match(result.stderr, /usage|unknown|duplicate|required/i);
  }
});
