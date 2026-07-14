#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { constants } from 'node:os';

const FORCE_KILL_GRACE_MILLISECONDS = 250;
const FORWARDED_SIGNAL_GRACE_MILLISECONDS = 100;
const MAX_TIMEOUT_MILLISECONDS = 2_147_483_647;
const FORWARDED_SIGNALS = ['SIGHUP', 'SIGINT', 'SIGTERM'];

function usage() {
  console.error(
    'usage: node scripts/run-with-timeout.mjs SECONDS -- COMMAND [ARG...]',
  );
}

function exitCodeForSignal(signal) {
  const signalNumber = constants.signals[signal];
  return Number.isInteger(signalNumber) ? 128 + signalNumber : 1;
}

function signalProcessGroup(child, signal) {
  if (!Number.isInteger(child.pid)) {
    return;
  }
  try {
    process.kill(-child.pid, signal);
    return;
  } catch (error) {
    if (error.code === 'ESRCH') {
      return;
    }
  }

  try {
    child.kill(signal);
  } catch (error) {
    if (error.code !== 'ESRCH') {
      throw error;
    }
  }
}

function runCommand(timeoutMilliseconds, command, args) {
  return new Promise((resolve) => {
    let child;
    let finished = false;
    let terminationExitCode;
    let timeoutTimer;
    let forceKillTimer;
    const signalHandlers = new Map();

    const finish = (exitCode) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timeoutTimer);
      clearTimeout(forceKillTimer);
      for (const [signal, handler] of signalHandlers) {
        process.removeListener(signal, handler);
      }
      resolve(exitCode);
    };

    const terminate = (signal, exitCode, graceMilliseconds) => {
      if (finished) {
        return;
      }
      if (terminationExitCode !== undefined) {
        signalProcessGroup(child, 'SIGKILL');
        finish(terminationExitCode);
        return;
      }

      terminationExitCode = exitCode;
      signalProcessGroup(child, signal);
      forceKillTimer = setTimeout(() => {
        signalProcessGroup(child, 'SIGKILL');
        finish(terminationExitCode);
      }, graceMilliseconds);
    };

    try {
      child = spawn(command, args, {
        detached: true,
        stdio: 'inherit',
      });
    } catch (error) {
      console.error(`run-with-timeout: could not start ${command}: ${error.message}`);
      resolve(error.code === 'ENOENT' ? 127 : 126);
      return;
    }

    child.once('error', (error) => {
      console.error(`run-with-timeout: could not start ${command}: ${error.message}`);
      finish(error.code === 'ENOENT' ? 127 : 126);
    });

    child.once('close', (code, signal) => {
      if (terminationExitCode !== undefined) {
        // The group leader can exit on SIGTERM while descendants keep running.
        // Keep the escalation timer armed until it signals the whole group.
        return;
      }
      finish(code ?? exitCodeForSignal(signal));
    });

    for (const signal of FORWARDED_SIGNALS) {
      const handler = () => {
        terminate(
          signal,
          exitCodeForSignal(signal),
          FORWARDED_SIGNAL_GRACE_MILLISECONDS,
        );
      };
      signalHandlers.set(signal, handler);
      process.on(signal, handler);
    }

    timeoutTimer = setTimeout(() => {
      terminate('SIGTERM', 124, FORCE_KILL_GRACE_MILLISECONDS);
    }, timeoutMilliseconds);
  });
}

async function main() {
  const [secondsText, separator, command, ...args] = process.argv.slice(2);
  const seconds = Number(secondsText);
  const timeoutMilliseconds = seconds * 1_000;

  if (
    separator !== '--' ||
    !command ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    timeoutMilliseconds > MAX_TIMEOUT_MILLISECONDS
  ) {
    usage();
    return 2;
  }

  return runCommand(timeoutMilliseconds, command, args);
}

process.exitCode = await main();
