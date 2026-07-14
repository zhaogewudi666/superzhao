import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../..', import.meta.url));
const helper = join(root, 'scripts', 'run-with-timeout.mjs');

function runWithTimeout(seconds, command, args = []) {
  const child = spawn(
    process.execPath,
    [helper, String(seconds), '--', command, ...args],
    {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return captureChild(child);
}

function captureChild(child) {
  return new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      resolve({
        code,
        signal,
        stdout: Buffer.concat(stdout).toString(),
        stderr: Buffer.concat(stderr).toString(),
      });
    });
  });
}

function waitForChildExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

function killProcessGroup(processGroupId) {
  if (!processGroupId) {
    return;
  }
  try {
    process.kill(-processGroupId, 'SIGKILL');
  } catch (error) {
    if (error.code !== 'ESRCH') {
      throw error;
    }
  }
}

async function recordedProcessId(path) {
  try {
    const processId = Number.parseInt(await readFile(path, 'utf8'), 10);
    return Number.isInteger(processId) ? processId : undefined;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

async function waitForProcessExit(pid, timeoutMilliseconds = 3_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === 'ESRCH') {
        return;
      }
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`process ${pid} still exists after ${timeoutMilliseconds}ms`);
}

async function fileSize(path) {
  try {
    return (await stat(path)).size;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return 0;
    }
    throw error;
  }
}

async function waitForFile(path, timeoutMilliseconds = 2_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${path}`);
}

async function runExplicitSkillRequestWithFakeClaude(t, exitCode) {
  const directory = await mkdtemp(join(tmpdir(), 'explicit-skill-runner-'));
  const promptFile = join(directory, 'prompt.txt');
  const fakeClaude = join(directory, 'claude');
  const skillName = `fake-skill-${exitCode}`;

  t.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  await writeFile(promptFile, 'Invoke the named skill.\n');
  await writeFile(
    fakeClaude,
    [
      '#!/usr/bin/env bash',
      `printf '%s\\n' '{"type":"tool_use","name":"Skill","skill":"${skillName}"}'`,
      `exit ${exitCode}`,
      '',
    ].join('\n'),
    { mode: 0o755 },
  );

  const runner = join(root, 'tests', 'explicit-skill-requests', 'run-test.sh');
  const child = spawn('bash', [runner, skillName, promptFile, '1'], {
    cwd: root,
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return captureChild(child);
}

test('preserves the child exit code', async () => {
  const result = await runWithTimeout(2, process.execPath, [
    '-e',
    'process.exit(37)',
  ]);

  assert.equal(result.code, 37, result.stderr);
  assert.equal(result.signal, null);
});

test('returns status 124 when the command times out', async () => {
  const result = await runWithTimeout(0.1, process.execPath, [
    '-e',
    'setInterval(() => {}, 1_000)',
  ]);

  assert.equal(result.code, 124, result.stderr);
  assert.equal(result.signal, null);
});

test('passes child stdout and stderr through unchanged', async () => {
  const result = await runWithTimeout(2, process.execPath, [
    '-e',
    "process.stdout.write('stdout marker\\n'); process.stderr.write('stderr marker\\n')",
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, 'stdout marker\n');
  assert.equal(result.stderr, 'stderr marker\n');
});

test('preserves argument boundaries', async () => {
  const expected = ['space value', '*', 'semi;colon', 'quote"value', ''];
  const result = await runWithTimeout(2, process.execPath, [
    '-e',
    'process.stdout.write(JSON.stringify(process.argv.slice(1)))',
    '--',
    ...expected,
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), expected);
});

test('exports the timeout runner used by inherited Claude helper functions', async () => {
  const shellHelpers = join(root, 'tests', 'claude-code', 'test-helpers.sh');
  const result = await runWithTimeout(2, 'bash', [
    '-c',
    'source "$1"; bash -c \'test -n "$TIMEOUT_RUNNER" && test -f "$TIMEOUT_RUNNER"\'',
    'bash',
    shellHelpers,
  ]);

  assert.equal(result.code, 0, result.stderr);
});

test('terminates descendants in the child process group', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'run-with-timeout-'));
  const childPidFile = join(directory, 'child.pid');
  const pidFile = join(directory, 'grandchild.pid');
  const heartbeatFile = join(directory, 'grandchild.heartbeat');
  let childPid;
  let grandchildPid;

  t.after(async () => {
    killProcessGroup(childPid ?? (await recordedProcessId(childPidFile)));
    await rm(directory, { force: true, recursive: true });
  });

  const grandchildScript = [
    "const fs = require('node:fs')",
    'const [pidFile, heartbeatFile] = process.argv.slice(1)',
    "process.on('SIGTERM', () => {})",
    'fs.writeFileSync(pidFile, String(process.pid))',
    "setInterval(() => fs.appendFileSync(heartbeatFile, 'x'), 20)",
  ].join(';');
  const childScript = [
    "const fs = require('node:fs')",
    "const { spawn } = require('node:child_process')",
    'const [grandchildScript, childPidFile, pidFile, heartbeatFile] = process.argv.slice(1)',
    "process.on('SIGTERM', () => {})",
    'fs.writeFileSync(childPidFile, String(process.pid))',
    'spawn(process.execPath, [\'-e\', grandchildScript, \'--\', pidFile, heartbeatFile], { stdio: \'ignore\' })',
    'setInterval(() => {}, 1_000)',
  ].join(';');

  const result = await runWithTimeout(0.5, process.execPath, [
    '-e',
    childScript,
    '--',
    grandchildScript,
    childPidFile,
    pidFile,
    heartbeatFile,
  ]);

  assert.equal(result.code, 124, result.stderr);
  childPid = Number.parseInt(await waitForFile(childPidFile), 10);
  grandchildPid = Number.parseInt(await waitForFile(pidFile), 10);
  assert.ok(Number.isInteger(childPid));
  assert.ok(Number.isInteger(grandchildPid));

  await Promise.all([
    waitForProcessExit(childPid),
    waitForProcessExit(grandchildPid),
  ]);

  assert.ok(
    (await fileSize(heartbeatFile)) > 0,
    'grandchild never started its heartbeat',
  );
});

test('kills an ignoring descendant after the process-group leader exits', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'run-with-timeout-leader-exit-'));
  const leaderPidFile = join(directory, 'leader.pid');
  const leafPidFile = join(directory, 'leaf.pid');
  const heartbeatFile = join(directory, 'leaf.heartbeat');
  let leaderPid;
  let leafPid;

  t.after(async () => {
    killProcessGroup(leaderPid ?? (await recordedProcessId(leaderPidFile)));
    await rm(directory, { force: true, recursive: true });
  });

  const leafScript = [
    "const fs = require('node:fs')",
    'const [pidFile, heartbeatFile] = process.argv.slice(1)',
    "process.on('SIGTERM', () => {})",
    'fs.writeFileSync(pidFile, String(process.pid))',
    "setInterval(() => fs.appendFileSync(heartbeatFile, 'x'), 20)",
  ].join(';');
  const leaderScript = [
    "const fs = require('node:fs')",
    "const { spawn } = require('node:child_process')",
    'const [leafScript, leaderPidFile, leafPidFile, heartbeatFile] = process.argv.slice(1)',
    'fs.writeFileSync(leaderPidFile, String(process.pid))',
    'spawn(process.execPath, [\'-e\', leafScript, \'--\', leafPidFile, heartbeatFile], { stdio: \'ignore\' })',
    'setInterval(() => {}, 1_000)',
  ].join(';');

  const result = await runWithTimeout(0.5, process.execPath, [
    '-e',
    leaderScript,
    '--',
    leafScript,
    leaderPidFile,
    leafPidFile,
    heartbeatFile,
  ]);

  assert.equal(result.code, 124, result.stderr);
  leaderPid = Number.parseInt(await waitForFile(leaderPidFile), 10);
  leafPid = Number.parseInt(await waitForFile(leafPidFile), 10);
  assert.ok(Number.isInteger(leaderPid));
  assert.ok(Number.isInteger(leafPid));
  await waitForProcessExit(leafPid);
});

test('forwards external termination and reaps an ignoring child group', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'run-with-timeout-signal-'));
  const pidFile = join(directory, 'leaf.pid');
  const heartbeatFile = join(directory, 'leaf.heartbeat');
  let leafPid;

  t.after(async () => {
    killProcessGroup(leafPid ?? (await recordedProcessId(pidFile)));
    await rm(directory, { force: true, recursive: true });
  });

  const leafScript = [
    "const fs = require('node:fs')",
    'const [pidFile, heartbeatFile] = process.argv.slice(1)',
    "process.on('SIGTERM', () => {})",
    'fs.writeFileSync(pidFile, String(process.pid))',
    "setInterval(() => fs.appendFileSync(heartbeatFile, 'x'), 20)",
  ].join(';');
  const wrapper = spawn(
    process.execPath,
    [
      helper,
      '30',
      '--',
      process.execPath,
      '-e',
      leafScript,
      '--',
      pidFile,
      heartbeatFile,
    ],
    { cwd: root, stdio: 'ignore' },
  );
  const resultPromise = waitForChildExit(wrapper);

  leafPid = Number.parseInt(await waitForFile(pidFile), 10);
  assert.ok(Number.isInteger(leafPid));
  wrapper.kill('SIGTERM');

  const result = await resultPromise;
  assert.equal(result.code, 143);
  assert.equal(result.signal, null);
  await waitForProcessExit(leafPid);
});

test('a repeated external signal immediately kills the child group', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'run-with-timeout-repeat-signal-'));
  const pidFile = join(directory, 'leaf.pid');
  const heartbeatFile = join(directory, 'leaf.heartbeat');
  let leafPid;

  t.after(async () => {
    killProcessGroup(leafPid ?? (await recordedProcessId(pidFile)));
    await rm(directory, { force: true, recursive: true });
  });

  const leafScript = [
    "const fs = require('node:fs')",
    'const [pidFile, heartbeatFile] = process.argv.slice(1)',
    "process.on('SIGTERM', () => {})",
    'fs.writeFileSync(pidFile, String(process.pid))',
    "setInterval(() => fs.appendFileSync(heartbeatFile, 'x'), 20)",
  ].join(';');
  const wrapper = spawn(
    process.execPath,
    [
      helper,
      '30',
      '--',
      process.execPath,
      '-e',
      leafScript,
      '--',
      pidFile,
      heartbeatFile,
    ],
    { cwd: root, stdio: 'ignore' },
  );
  const resultPromise = waitForChildExit(wrapper);

  leafPid = Number.parseInt(await waitForFile(pidFile), 10);
  assert.ok(Number.isInteger(leafPid));
  wrapper.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 20));
  wrapper.kill('SIGTERM');

  const result = await resultPromise;
  assert.equal(result.code, 143);
  assert.equal(result.signal, null);
  await waitForProcessExit(leafPid);
});

test('an outer timeout cancels a detached leaf created by an inner wrapper', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'run-with-timeout-nested-'));
  const pidFile = join(directory, 'leaf.pid');
  const heartbeatFile = join(directory, 'leaf.heartbeat');
  let leafPid;

  t.after(async () => {
    killProcessGroup(leafPid ?? (await recordedProcessId(pidFile)));
    await rm(directory, { force: true, recursive: true });
  });

  const leafScript = [
    "const fs = require('node:fs')",
    'const [pidFile, heartbeatFile] = process.argv.slice(1)',
    "process.on('SIGTERM', () => {})",
    'fs.writeFileSync(pidFile, String(process.pid))',
    "setInterval(() => fs.appendFileSync(heartbeatFile, 'x'), 20)",
  ].join(';');

  const outerWrapper = spawn(
    process.execPath,
    [
      helper,
      '0.5',
      '--',
      process.execPath,
      helper,
      '30',
      '--',
      process.execPath,
      '-e',
      leafScript,
      '--',
      pidFile,
      heartbeatFile,
    ],
    { cwd: root, stdio: 'ignore' },
  );
  const result = await waitForChildExit(outerWrapper);

  assert.equal(result.code, 124);
  leafPid = Number.parseInt(await waitForFile(pidFile), 10);
  assert.ok(Number.isInteger(leafPid));
  await waitForProcessExit(leafPid);
});

test('explicit skill runner rejects partial output after a command failure', async (t) => {
  const result = await runExplicitSkillRequestWithFakeClaude(t, 42);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 42, output);
  assert.match(output, /FAIL: Claude execution exited with status 42/);
  assert.doesNotMatch(output, /PASS: Skill/);
});

test('explicit skill runner reports timeout output as indeterminate', async (t) => {
  const result = await runExplicitSkillRequestWithFakeClaude(t, 124);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 124, output);
  assert.match(output, /INDETERMINATE: Claude timed out/);
  assert.doesNotMatch(output, /PASS: Skill/);
});
