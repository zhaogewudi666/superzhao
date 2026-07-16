import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import test from "node:test";

import {
  canonicalJson,
  readSchemaPair,
  repoRoot,
  runCli,
  runWithHook,
  schemaErrors,
  sha256,
} from "./helpers.mjs";

const blueprint = JSON.parse(readFileSync(
  resolve(repoRoot, "tests/skill-lab/golden/v3/gate-campaign-blueprint.json"),
  "utf8",
));

const SOURCE = `---
name: gate-fixture
description: Use the current gate fixture behavior.
---

# Gate fixture

Current behavior.
`;

const CANDIDATE = `---
name: gate-fixture
description: Use the candidate gate fixture behavior.
---

# Gate fixture

Candidate behavior fixes the known gap.
`;

function workspacePath(root, absolute) {
  return relative(root, absolute).split(sep).join("/");
}

function writeArtifact(root, path, bytes) {
  const absolute = resolve(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, bytes);
  return { path: workspacePath(root, absolute), sha256: sha256(bytes) };
}

function writeJsonArtifact(root, path, value) {
  return writeArtifact(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function materializeCampaign({
  includeTest = true,
  candidateHeldOutFailure = false,
  includeTrain = false,
  validCountOverrides = {},
  nonvalidCountOverrides = {},
} = {}) {
  const root = mkdtempSync(resolve(tmpdir(), "superzhao-gate-v3-"));
  const source = writeArtifact(root, "skills/current/SKILL.md", SOURCE);
  const candidate = writeArtifact(root, "skills/candidate/SKILL.md", CANDIDATE);
  const environment = writeJsonArtifact(root, "campaign/environment.json", {
    node: "22.22.2",
    platform: "fixture",
  });
  const harness = writeJsonArtifact(root, "campaign/profiles/harness.json", {
    harness: "codex",
    model: "fixture-model",
  });
  const actorProfiles = [
    writeJsonArtifact(root, "campaign/profiles/actor-a.json", { profile: "actor-a" }),
    writeJsonArtifact(root, "campaign/profiles/actor-b.json", { profile: "actor-b" }),
  ];
  const scorerProfiles = [
    writeJsonArtifact(root, "campaign/profiles/scorer-a.json", { profile: "scorer-a" }),
    writeJsonArtifact(root, "campaign/profiles/scorer-b.json", { profile: "scorer-b" }),
  ];

  const caseBlueprints = [
    ...blueprint.cases,
    ...(includeTrain ? [{
      case_id: "train-important",
      split: "train",
      case_type: "important",
      current: ["pass", "pass", "pass", "pass", "pass"],
      candidate: ["TRAIN_FAILURE", "TRAIN_FAILURE", "TRAIN_FAILURE", "TRAIN_FAILURE", "TRAIN_FAILURE"],
    }] : []),
  ];
  const cases = caseBlueprints.map((row) => ({
    case_id: row.case_id,
    split: row.split,
    case_type: row.case_type,
    prompt: writeArtifact(root, `campaign/prompts/${row.case_id}.md`, `Prompt ${row.case_id}\n`),
    rubric: writeArtifact(root, `campaign/rubrics/${row.case_id}.md`, `Rubric ${row.case_id}\n`),
  }));
  const inventory = {
    schema: "superzhao.skill-lab.cases/v3",
    campaign_id: blueprint.campaign_id,
    required_valid: blueprint.required_valid,
    cases,
  };
  const inventoryArtifact = writeJsonArtifact(root, "campaign/cases.json", inventory);
  const samples = [];

  for (const [caseIndex, row] of caseBlueprints.entries()) {
    if (!includeTest && row.split === "test") continue;
    for (const arm of ["current", "candidate"]) {
      const groupKey = `${row.case_id}:${arm}`;
      const validCount = validCountOverrides[groupKey] ?? blueprint.required_valid;
      for (let index = 0; index < validCount; index += 1) {
        const suffix = `${row.case_id}-${arm}-${index + 1}`;
        let result = row[arm][index] ?? "pass";
        if (candidateHeldOutFailure
            && row.case_id === "test-important"
            && arm === "candidate"
            && index === 0) {
          result = "KNOWN_HELDOUT_GAP";
        }
        const outcome = result === "pass" ? "pass" : "fail";
        const actorProfileIndex = index < 3 ? 0 : 1;
        const scorerProfileIndex = index < 2 ? 0 : 1;
        const transcript = writeArtifact(
          root,
          `campaign/transcripts/${suffix}.jsonl`,
          `${JSON.stringify({ run: suffix, answer: outcome })}\n`,
        );
        const scorerOutput = writeJsonArtifact(
          root,
          `campaign/scorer-output/${suffix}.json`,
          { scorer_run: `scorer-${suffix}`, outcome },
        );
        const skill = arm === "current" ? source : candidate;
        const actorRunValue = {
          schema: "superzhao.skill-lab.actor-run/v3",
          sample_id: `sample-${suffix}`,
          run_id: `run-${suffix}`,
          actor_instance_id: `actor-instance-${suffix}`,
          actor_profile_id: `actor-profile-${actorProfileIndex + 1}`,
          case_id: row.case_id,
          split: row.split,
          case_type: row.case_type,
          arm,
          skill_sha256: skill.sha256,
          actor_profile: actorProfiles[actorProfileIndex],
          prompt: cases[caseIndex].prompt,
          environment,
          harness_model_profile: harness,
          transcript,
        };
        const actorRun = writeJsonArtifact(
          root,
          `campaign/runs/${suffix}.json`,
          actorRunValue,
        );
        const scorerRecordValue = {
          schema: "superzhao.skill-lab.scorer-record/v3",
          sample_id: `sample-${suffix}`,
          run_id: `run-${suffix}`,
          scorer_run_id: `scorer-${suffix}`,
          scorer_profile_id: `scorer-profile-${scorerProfileIndex + 1}`,
          scorer_version: "fixture-scorer-v1",
          scorer_profile: scorerProfiles[scorerProfileIndex],
          rubric: cases[caseIndex].rubric,
          transcript,
          scorer_output: scorerOutput,
          status: "valid",
          outcome,
          ...(outcome === "fail" ? { failure_code: result } : {}),
        };
        const scorerRecord = writeJsonArtifact(
          root,
          `campaign/scores/${suffix}.json`,
          scorerRecordValue,
        );
        samples.push({
          sample_id: `sample-${suffix}`,
          run_id: `run-${suffix}`,
          actor_instance_id: `actor-instance-${suffix}`,
          actor_profile_id: `actor-profile-${actorProfileIndex + 1}`,
          case_id: row.case_id,
          split: row.split,
          case_type: row.case_type,
          arm,
          skill_sha256: skill.sha256,
          actor_run: actorRun,
          scorer_run_id: `scorer-${suffix}`,
          scorer_record: scorerRecord,
          status: "valid",
          outcome,
          ...(outcome === "fail" ? { failure_code: result } : {}),
        });
      }
      const nonvalidCount = nonvalidCountOverrides[groupKey] ?? 0;
      for (let index = 0; index < nonvalidCount; index += 1) {
        const suffix = `${row.case_id}-${arm}-nonvalid-${index + 1}`;
        const skill = arm === "current" ? source : candidate;
        samples.push({
          sample_id: `sample-${suffix}`,
          run_id: `run-${suffix}`,
          actor_instance_id: `actor-instance-${suffix}`,
          actor_profile_id: "actor-profile-1",
          case_id: row.case_id,
          split: row.split,
          case_type: row.case_type,
          arm,
          skill_sha256: skill.sha256,
          status: index % 2 === 0 ? "invalid" : "indeterminate",
          reason: `retained non-valid attempt ${index + 1}`,
        });
      }
    }
  }

  const ledger = {
    schema: "superzhao.skill-lab.samples/v3",
    campaign_id: blueprint.campaign_id,
    source,
    candidate,
    cases: inventoryArtifact,
    samples,
  };
  const results = resolve(root, "campaign/samples.json");
  writeFileSync(results, `${JSON.stringify(ledger, null, 2)}\n`);
  return {
    root,
    results,
    report: resolve(root, "campaign/gate-report.json"),
    ledger,
    inventory,
    cases,
    source,
    candidate,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function readJsonArtifact(fixture, descriptor) {
  return JSON.parse(readFileSync(resolve(fixture.root, descriptor.path), "utf8"));
}

function persistLedger(fixture) {
  writeFileSync(fixture.results, `${JSON.stringify(fixture.ledger, null, 2)}\n`);
}

function rewriteJsonArtifact(fixture, descriptor, mutate) {
  const value = readJsonArtifact(fixture, descriptor);
  mutate(value);
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(resolve(fixture.root, descriptor.path), bytes);
  descriptor.sha256 = sha256(bytes);
  return value;
}

function findSample(fixture, caseId, arm, index = 0) {
  return fixture.ledger.samples.filter(
    (sample) => sample.case_id === caseId && sample.arm === arm && sample.status === "valid",
  )[index];
}

function setOutcome(fixture, caseId, arm, index, outcome, failureCode) {
  const sample = findSample(fixture, caseId, arm, index);
  sample.outcome = outcome;
  if (failureCode === undefined) delete sample.failure_code;
  else sample.failure_code = failureCode;
  rewriteJsonArtifact(fixture, sample.scorer_record, (record) => {
    record.outcome = outcome;
    if (failureCode === undefined) delete record.failure_code;
    else record.failure_code = failureCode;
  });
  persistLedger(fixture);
}

function appendEvidencedNonvalidAttempt(fixture, caseId, arm) {
  const suffix = `${caseId}-${arm}-evidenced-invalid`;
  const campaignCase = fixture.inventory.cases.find((row) => row.case_id === caseId);
  const sourceSample = findSample(fixture, caseId, arm, 0);
  const sourceActor = readJsonArtifact(fixture, sourceSample.actor_run);
  const actorProfile = writeJsonArtifact(
    fixture.root,
    `campaign/profiles/${suffix}-actor.json`,
    { profile: `${suffix}-actor` },
  );
  const scorerProfile = writeJsonArtifact(
    fixture.root,
    `campaign/profiles/${suffix}-scorer.json`,
    { profile: `${suffix}-scorer` },
  );
  const transcript = writeArtifact(
    fixture.root,
    `campaign/transcripts/${suffix}.jsonl`,
    `${JSON.stringify({ run: suffix, invalid: true })}\n`,
  );
  const scorerOutput = writeJsonArtifact(
    fixture.root,
    `campaign/scorer-output/${suffix}.json`,
    { scorer_run: `scorer-${suffix}`, status: "invalid" },
  );
  const skill = arm === "current" ? fixture.source : fixture.candidate;
  const reason = "retained evidence-complete invalid attempt";
  const actorRun = writeJsonArtifact(
    fixture.root,
    `campaign/runs/${suffix}.json`,
    {
      schema: "superzhao.skill-lab.actor-run/v3",
      sample_id: `sample-${suffix}`,
      run_id: `run-${suffix}`,
      actor_instance_id: `actor-instance-${suffix}`,
      actor_profile_id: `actor-profile-${suffix}`,
      case_id: caseId,
      split: campaignCase.split,
      case_type: campaignCase.case_type,
      arm,
      skill_sha256: skill.sha256,
      actor_profile: actorProfile,
      prompt: campaignCase.prompt,
      environment: sourceActor.environment,
      harness_model_profile: sourceActor.harness_model_profile,
      transcript,
    },
  );
  const scorerRecord = writeJsonArtifact(
    fixture.root,
    `campaign/scores/${suffix}.json`,
    {
      schema: "superzhao.skill-lab.scorer-record/v3",
      sample_id: `sample-${suffix}`,
      run_id: `run-${suffix}`,
      scorer_run_id: `scorer-${suffix}`,
      scorer_profile_id: `scorer-profile-${suffix}`,
      scorer_version: "fixture-scorer-v1",
      scorer_profile: scorerProfile,
      rubric: campaignCase.rubric,
      transcript,
      scorer_output: scorerOutput,
      status: "invalid",
      reason,
    },
  );
  const sample = {
    sample_id: `sample-${suffix}`,
    run_id: `run-${suffix}`,
    actor_instance_id: `actor-instance-${suffix}`,
    actor_profile_id: `actor-profile-${suffix}`,
    case_id: caseId,
    split: campaignCase.split,
    case_type: campaignCase.case_type,
    arm,
    skill_sha256: skill.sha256,
    actor_run: actorRun,
    scorer_run_id: `scorer-${suffix}`,
    scorer_record: scorerRecord,
    status: "invalid",
    reason,
  };
  fixture.ledger.samples.push(sample);
  persistLedger(fixture);
  return sample;
}

function padJsonArtifact(fixture, descriptor, targetBytes) {
  const value = readJsonArtifact(fixture, descriptor);
  const core = JSON.stringify(value);
  const padding = targetBytes - Buffer.byteLength(core) - 1;
  assert.ok(padding >= 0, "target must fit the JSON value");
  const bytes = `${core}${" ".repeat(padding)}\n`;
  assert.equal(Buffer.byteLength(bytes), targetBytes);
  writeFileSync(resolve(fixture.root, descriptor.path), bytes);
  descriptor.sha256 = sha256(bytes);
}

function persistInventory(fixture) {
  const bytes = `${JSON.stringify(fixture.inventory, null, 2)}\n`;
  writeFileSync(resolve(fixture.root, fixture.ledger.cases.path), bytes);
  fixture.ledger.cases.sha256 = sha256(bytes);
  persistLedger(fixture);
}

function rewriteIdentity(fixture, sample, field, value) {
  sample[field] = value;
  if (["sample_id", "run_id", "actor_instance_id", "actor_profile_id"].includes(field)) {
    rewriteJsonArtifact(fixture, sample.actor_run, (record) => {
      record[field] = value;
    });
  }
  if (["sample_id", "run_id", "scorer_run_id"].includes(field)) {
    rewriteJsonArtifact(fixture, sample.scorer_record, (record) => {
      record[field] = value;
    });
  }
  persistLedger(fixture);
}

function assertNoReport(fixture) {
  assert.equal(existsSync(fixture.report), false, "a validation failure must not publish a report");
}

function gate(fixture) {
  return runCli(gateArgs(fixture));
}

function gateArgs(fixture, workspaceRoot = fixture.root) {
  return [
    "gate",
    "--workspace-root", workspaceRoot,
    "--results", fixture.results,
    "--report", fixture.report,
  ];
}

function readCanonicalReport(fixture) {
  const raw = readFileSync(fixture.report, "utf8");
  const report = JSON.parse(raw);
  assert.equal(raw, `${canonicalJson(report)}\n`);
  return report;
}

test("v3 gate publishes final_accept for a complete passing campaign", () => {
  const fixture = materializeCampaign();
  try {
    const result = gate(fixture);
    assert.equal(result.status, 0, result.stderr);
    const report = readCanonicalReport(fixture);
    assert.equal(report.schema, "superzhao.skill-lab.gate-report/v3");
    assert.equal(report.campaign_id, blueprint.campaign_id);
    assert.equal(report.source_sha256, fixture.ledger.source.sha256);
    assert.equal(report.candidate_sha256, fixture.ledger.candidate.sha256);
    assert.equal(report.cases_sha256, fixture.ledger.cases.sha256);
    assert.equal(report.samples_sha256, sha256(readFileSync(fixture.results)));
    assert.equal(report.required_valid, 5);
    assert.equal(report.train_rows, 0);
    assert.equal(report.selection.status, "selection_pass");
    assert.equal(report.final.status, "final_accept");
    assert.deepEqual(
      schemaErrors(report, readSchemaPair("gate-report").schema),
      [],
      "emitted report must satisfy the normative gate-report schema",
    );
  } finally {
    fixture.cleanup();
  }
});

test("a 21-valid cohort is honestly reported and rejected under the normative schema", () => {
  const fixture = materializeCampaign({
    validCountOverrides: {
      "selection-important:current": 21,
      "selection-important:candidate": 21,
    },
  });
  try {
    const result = gate(fixture);
    assert.equal(result.status, 4, result.stderr);
    const report = readCanonicalReport(fixture);
    const row = report.selection.cases.find((entry) => entry.case_id === "selection-important");
    assert.equal(row.current.valid, 21);
    assert.equal(row.candidate.valid, 21);
    assert.deepEqual(schemaErrors(report, readSchemaPair("gate-report").schema), []);
  } finally {
    fixture.cleanup();
  }
});

test("a 21-row repeated failure is represented without truncating rejection evidence", () => {
  const fixture = materializeCampaign({
    validCountOverrides: {
      "selection-important:current": 21,
      "selection-important:candidate": 21,
    },
  });
  try {
    for (let index = 2; index < 21; index += 1) {
      setOutcome(fixture, "selection-important", "current", index, "fail", "KNOWN_GAP");
    }
    const result = gate(fixture);
    assert.equal(result.status, 4, result.stderr);
    const report = readCanonicalReport(fixture);
    const row = report.selection.cases.find((entry) => entry.case_id === "selection-important");
    assert.deepEqual(row.repeated_current_failure_codes, [{
      failure_code: "KNOWN_GAP",
      count: 21,
    }]);
    assert.deepEqual(schemaErrors(report, readSchemaPair("gate-report").schema), []);
  } finally {
    fixture.cleanup();
  }
});

test("one-sided extra valid rows are phase rejections rather than profile schema failures", async (t) => {
  await t.test("selection current 6 candidate 5", () => {
    const fixture = materializeCampaign({
      validCountOverrides: { "selection-important:current": 6 },
    });
    try {
      const result = gate(fixture);
      assert.equal(result.status, 4, result.stderr);
      const report = readCanonicalReport(fixture);
      assert.equal(report.selection.status, "selection_reject");
      const row = report.selection.cases.find((entry) => entry.case_id === "selection-important");
      assert.equal(row.current.valid, 6);
      assert.equal(row.candidate.valid, 5);
      assert.match(report.selection.reasons.join("\n"), /current has 6 valid samples/);
    } finally {
      fixture.cleanup();
    }
  });

  await t.test("test current 6 candidate 5", () => {
    const fixture = materializeCampaign({
      validCountOverrides: { "test-control:current": 6 },
    });
    try {
      const result = gate(fixture);
      assert.equal(result.status, 5, result.stderr);
      const report = readCanonicalReport(fixture);
      assert.equal(report.selection.status, "selection_pass");
      assert.equal(report.final.status, "final_reject");
      const row = report.final.cases.find((entry) => entry.case_id === "test-control");
      assert.equal(row.current.valid, 6);
      assert.equal(row.candidate.valid, 5);
      assert.match(report.final.reasons.join("\n"), /current has 6 valid samples/);
    } finally {
      fixture.cleanup();
    }
  });
});

test("evidence-complete non-valid attempts are validated and counted but excluded from parity", async (t) => {
  await t.test("valid evidence does not affect acceptance", () => {
    const fixture = materializeCampaign();
    try {
      appendEvidencedNonvalidAttempt(fixture, "selection-important", "candidate");
      const result = gate(fixture);
      assert.equal(result.status, 0, result.stderr);
      const report = readCanonicalReport(fixture);
      const row = report.selection.cases.find((entry) => entry.case_id === "selection-important");
      assert.equal(row.current.invalid, 0);
      assert.equal(row.candidate.invalid, 1);
      assert.equal(row.current.valid, 5);
      assert.equal(row.candidate.valid, 5);
      assert.equal(report.final.status, "final_accept");
    } finally {
      fixture.cleanup();
    }
  });

  await t.test("bound evidence is still integrity checked", () => {
    const fixture = materializeCampaign();
    try {
      const sample = appendEvidencedNonvalidAttempt(
        fixture,
        "selection-important",
        "candidate",
      );
      sample.scorer_record.sha256 = "0".repeat(64);
      persistLedger(fixture);
      const result = gate(fixture);
      assert.equal(result.status, 3, result.stderr);
      assert.match(result.stderr, /sha256 mismatch/);
      assertNoReport(fixture);
    } finally {
      fixture.cleanup();
    }
  });
});

test("campaign IDs must agree between the sample ledger and case inventory", async (t) => {
  for (const [label, mutate] of [
    ["ledger", (fixture) => {
      fixture.ledger.campaign_id = "different-ledger-campaign";
      persistLedger(fixture);
    }],
    ["inventory", (fixture) => {
      fixture.inventory.campaign_id = "different-inventory-campaign";
      persistInventory(fixture);
    }],
  ]) {
    await t.test(label, () => {
      const fixture = materializeCampaign();
      try {
        mutate(fixture);
        const result = gate(fixture);
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr, /campaign_id does not match/);
        assertNoReport(fixture);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("case identity, type, prompt, and rubric cross-references are exact", async (t) => {
  const mutations = [
    ["unknown case", (fixture) => {
      const sample = findSample(fixture, "selection-important", "current", 0);
      sample.case_id = "unknown-case";
      persistLedger(fixture);
    }, /unknown case_id/],
    ["case type", (fixture) => {
      const sample = findSample(fixture, "selection-important", "current", 0);
      sample.case_type = "control";
      rewriteJsonArtifact(fixture, sample.actor_run, (record) => {
        record.case_type = "control";
      });
      persistLedger(fixture);
    }, /split or case_type does not match inventory/],
    ["prompt", (fixture) => {
      const sample = findSample(fixture, "selection-important", "current", 0);
      const otherPrompt = fixture.inventory.cases.find(
        (row) => row.case_id === "selection-control",
      ).prompt;
      rewriteJsonArtifact(fixture, sample.actor_run, (record) => {
        record.prompt = otherPrompt;
      });
      persistLedger(fixture);
    }, /actor prompt does not match case inventory/],
    ["rubric", (fixture) => {
      const sample = findSample(fixture, "selection-important", "current", 0);
      const otherRubric = fixture.inventory.cases.find(
        (row) => row.case_id === "selection-control",
      ).rubric;
      rewriteJsonArtifact(fixture, sample.scorer_record, (record) => {
        record.rubric = otherRubric;
      });
      persistLedger(fixture);
    }, /scorer rubric does not match case inventory/],
  ];
  for (const [label, mutate, expected] of mutations) {
    await t.test(label, () => {
      const fixture = materializeCampaign();
      try {
        mutate(fixture);
        const result = gate(fixture);
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr, expected);
        assertNoReport(fixture);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("sample and scorer status, outcome, failure code, and reason must agree", async (t) => {
  for (const [label, prepare, mutate, expected] of [
    ["status", () => {}, (record) => {
      record.status = "invalid";
      record.reason = "scorer called the run invalid";
      delete record.outcome;
    }, /scorer record status does not match sample/],
    ["outcome", () => {}, (record) => {
      record.outcome = "fail";
      record.failure_code = "SCORER_ONLY_FAILURE";
    }, /scorer record outcome does not match sample/],
    ["failure_code", (fixture) => {
      setOutcome(fixture, "selection-important", "current", 2, "fail", "SAMPLE_FAILURE");
    }, (record) => {
      record.failure_code = "SCORER_FAILURE";
    }, /scorer record failure_code does not match sample/],
    ["reason", (fixture, sample) => {
      sample.status = "invalid";
      sample.reason = "sample invalid reason";
      delete sample.outcome;
      rewriteJsonArtifact(fixture, sample.scorer_record, (record) => {
        record.status = "invalid";
        record.reason = "sample invalid reason";
        delete record.outcome;
      });
      persistLedger(fixture);
    }, (record) => {
      record.reason = "different scorer reason";
    }, /scorer record reason does not match sample/],
  ]) {
    await t.test(label, () => {
      const fixture = materializeCampaign();
      try {
        let sample = findSample(fixture, "selection-control", "candidate", 1);
        prepare(fixture, sample);
        sample = label === "failure_code"
          ? findSample(fixture, "selection-important", "current", 2)
          : sample;
        rewriteJsonArtifact(fixture, sample.scorer_record, mutate);
        persistLedger(fixture);
        const result = gate(fixture);
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr, expected);
        assertNoReport(fixture);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("the ledger accepts exactly 1000 rows and rejects row 1001", async (t) => {
  function appendTrainAttempts(fixture, count) {
    for (let index = 0; index < count; index += 1) {
      fixture.ledger.samples.push({
        sample_id: `sample-train-extra-${index}`,
        run_id: `run-train-extra-${index}`,
        actor_instance_id: `actor-instance-train-extra-${index}`,
        actor_profile_id: "actor-profile-1",
        case_id: "train-important",
        split: "train",
        case_type: "important",
        arm: index % 2 === 0 ? "current" : "candidate",
        skill_sha256: index % 2 === 0 ? fixture.source.sha256 : fixture.candidate.sha256,
        status: "invalid",
        reason: `retained train attempt ${index}`,
      });
    }
    persistLedger(fixture);
  }

  await t.test("exactly 1000", () => {
    const fixture = materializeCampaign({ includeTrain: true });
    try {
      appendTrainAttempts(fixture, 950);
      assert.equal(fixture.ledger.samples.length, 1000);
      const result = gate(fixture);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readCanonicalReport(fixture).train_rows, 960);
    } finally {
      fixture.cleanup();
    }
  });

  await t.test("row 1001", () => {
    const fixture = materializeCampaign({ includeTrain: true });
    try {
      appendTrainAttempts(fixture, 951);
      assert.equal(fixture.ledger.samples.length, 1001);
      const result = gate(fixture);
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /between 1 and 1000 rows/);
      assertNoReport(fixture);
    } finally {
      fixture.cleanup();
    }
  });
});

test("shared logical paths may repeat only with the same digest", () => {
  const fixture = materializeCampaign();
  try {
    const sample = findSample(fixture, "selection-important", "current", 1);
    rewriteJsonArtifact(fixture, sample.actor_run, (record) => {
      record.environment.sha256 = "0".repeat(64);
    });
    persistLedger(fixture);
    const result = gate(fixture);
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /reuses logical path .* with a different sha256/);
    assertNoReport(fixture);
  } finally {
    fixture.cleanup();
  }
});

test("any partial held-out ledger is evaluated and rejected instead of called not_evaluated", () => {
  const fixture = materializeCampaign();
  try {
    fixture.ledger.samples = fixture.ledger.samples.filter((sample) => (
      sample.split !== "test"
      || fixture.ledger.samples.filter((candidate) => (
        candidate.case_id === sample.case_id && candidate.arm === sample.arm
      )).indexOf(sample) === 0
    ));
    persistLedger(fixture);
    const result = gate(fixture);
    assert.equal(result.status, 5, result.stderr);
    const report = readCanonicalReport(fixture);
    assert.equal(report.selection.status, "selection_pass");
    assert.equal(report.final.status, "final_reject");
    assert.match(report.final.reasons.join("\n"), /required valid is exactly 5/);
  } finally {
    fixture.cleanup();
  }
});

test("selection rejection publishes a canonical report and exits 4", () => {
  const fixture = materializeCampaign();
  try {
    setOutcome(fixture, "selection-important", "candidate", 0, "fail", "NEW_FAILURE");
    const result = gate(fixture);
    assert.equal(result.status, 4, result.stderr);
    const report = readCanonicalReport(fixture);
    assert.equal(report.selection.status, "selection_reject");
    assert.equal(report.final.status, "not_evaluated");
    assert.match(report.selection.reasons.join("\n"), /candidate failure on important case/);
  } finally {
    fixture.cleanup();
  }
});

test("full-ledger integrity validation precedes an otherwise certain selection rejection", () => {
  const fixture = materializeCampaign();
  try {
    setOutcome(fixture, "selection-important", "candidate", 0, "fail", "NEW_FAILURE");
    const heldOut = findSample(fixture, "test-control", "candidate", 0);
    heldOut.scorer_record.sha256 = "0".repeat(64);
    persistLedger(fixture);
    const result = gate(fixture);
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /sha256 mismatch/);
    assertNoReport(fixture);
  } finally {
    fixture.cleanup();
  }
});

for (const [label, options, expected] of [
  ["too few valid samples", { validCountOverrides: {
    "selection-important:current": 4,
    "selection-important:candidate": 4,
  } }, /has 4 valid samples/],
  ["too many valid samples", { validCountOverrides: {
    "selection-important:current": 6,
    "selection-important:candidate": 6,
  } }, /has 6 valid samples/],
  ["too many retained non-valid attempts", { nonvalidCountOverrides: { "selection-important:current": 6 } }, /has 6 invalid or indeterminate attempts/],
]) {
  test(`selection rejects ${label} for one exact case and arm`, () => {
    const fixture = materializeCampaign(options);
    try {
      const result = gate(fixture);
      assert.equal(result.status, 4, result.stderr);
      const report = readCanonicalReport(fixture);
      assert.match(report.selection.reasons.join("\n"), expected);
    } finally {
      fixture.cleanup();
    }
  });
}

test("partial held-out evidence also enforces the non-valid attempt cap", () => {
  const fixture = materializeCampaign({
    nonvalidCountOverrides: { "test-control:candidate": 6 },
  });
  try {
    const result = gate(fixture);
    assert.equal(result.status, 5, result.stderr);
    const report = readCanonicalReport(fixture);
    assert.match(report.final.reasons.join("\n"), /has 6 invalid or indeterminate attempts/);
  } finally {
    fixture.cleanup();
  }
});

for (const kind of ["actor", "scorer"]) {
  test(`${kind} profile digest multisets must match across arms of a case`, () => {
    const fixture = materializeCampaign();
    try {
      const sample = findSample(fixture, "selection-control", "candidate", 0);
      const thirdProfile = writeJsonArtifact(
        fixture.root,
        `campaign/profiles/${kind}-third.json`,
        { profile: `${kind}-third` },
      );
      if (kind === "actor") {
        sample.actor_profile_id = "actor-profile-third";
        rewriteJsonArtifact(fixture, sample.actor_run, (record) => {
          record.actor_profile_id = sample.actor_profile_id;
          record.actor_profile = thirdProfile;
        });
      } else {
        rewriteJsonArtifact(fixture, sample.scorer_record, (record) => {
          record.scorer_profile_id = "scorer-profile-third";
          record.scorer_profile = thirdProfile;
        });
      }
      persistLedger(fixture);
      const result = gate(fixture);
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, new RegExp(`${kind} profile digest multiset`));
      assertNoReport(fixture);
    } finally {
      fixture.cleanup();
    }
  });
}

for (const field of ["sample_id", "run_id", "actor_instance_id", "scorer_run_id"]) {
  test(`${field} is globally unique across split and arm boundaries`, () => {
    const fixture = materializeCampaign();
    try {
      const first = findSample(fixture, "selection-important", "current", 0);
      const second = findSample(fixture, "test-control", "candidate", 0);
      rewriteIdentity(fixture, second, field, first[field]);
      const result = gate(fixture);
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, new RegExp(`duplicate ${field}`));
      assertNoReport(fixture);
    } finally {
      fixture.cleanup();
    }
  });
}

test("transcript and scorer-output digests are each globally unique", async (t) => {
  for (const artifactName of ["transcript", "scorer_output"]) {
    await t.test(artifactName, () => {
      const fixture = materializeCampaign();
      try {
        const first = findSample(fixture, "selection-important", "current", 0);
        const second = findSample(fixture, "test-control", "candidate", 0);
        const firstActor = readJsonArtifact(fixture, first.actor_run);
        const firstScorer = readJsonArtifact(fixture, first.scorer_record);
        if (artifactName === "transcript") {
          rewriteJsonArtifact(fixture, second.actor_run, (record) => {
            record.transcript = firstActor.transcript;
          });
          rewriteJsonArtifact(fixture, second.scorer_record, (record) => {
            record.transcript = firstActor.transcript;
          });
        } else {
          rewriteJsonArtifact(fixture, second.scorer_record, (record) => {
            record.scorer_output = firstScorer.scorer_output;
          });
        }
        persistLedger(fixture);
        const result = gate(fixture);
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr, new RegExp(`duplicate ${artifactName} sha256`));
        assertNoReport(fixture);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

for (const recordName of ["actor_run", "scorer_record"]) {
  test(`swapping ${recordName} artifacts between samples is rejected`, () => {
    const fixture = materializeCampaign();
    try {
      const first = findSample(fixture, "selection-important", "current", 0);
      const second = findSample(fixture, "selection-control", "current", 0);
      [first[recordName], second[recordName]] = [second[recordName], first[recordName]];
      persistLedger(fixture);
      const result = gate(fixture);
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /does not match sample/);
      assertNoReport(fixture);
    } finally {
      fixture.cleanup();
    }
  });
}

test("actor-to-scorer transcript cross-reference swaps are rejected", () => {
  const fixture = materializeCampaign();
  try {
    const first = findSample(fixture, "selection-important", "current", 0);
    const second = findSample(fixture, "selection-important", "current", 1);
    const secondScorer = readJsonArtifact(fixture, second.scorer_record);
    rewriteJsonArtifact(fixture, first.scorer_record, (record) => {
      record.transcript = secondScorer.transcript;
    });
    persistLedger(fixture);
    const result = gate(fixture);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /scorer transcript does not match actor transcript/);
    assertNoReport(fixture);
  } finally {
    fixture.cleanup();
  }
});

test("inventory rejects selection and test prompt reuse before a gate decision", () => {
  const fixture = materializeCampaign();
  try {
    fixture.inventory.cases.find((row) => row.case_id === "test-important").prompt =
      fixture.inventory.cases.find((row) => row.case_id === "selection-important").prompt;
    persistInventory(fixture);
    const result = gate(fixture);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /selection and test prompt digests must be disjoint/);
    assertNoReport(fixture);
  } finally {
    fixture.cleanup();
  }
});

test("a sample arm must bind the exact corresponding Skill digest", () => {
  const fixture = materializeCampaign();
  try {
    const sample = findSample(fixture, "selection-important", "candidate", 0);
    sample.skill_sha256 = fixture.source.sha256;
    rewriteJsonArtifact(fixture, sample.actor_run, (record) => {
      record.skill_sha256 = fixture.source.sha256;
    });
    persistLedger(fixture);
    const result = gate(fixture);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /candidate arm must bind the candidate Skill digest/);
    assertNoReport(fixture);
  } finally {
    fixture.cleanup();
  }
});

test("train rows remain fully bound but cannot influence either gate phase", () => {
  const fixture = materializeCampaign({ includeTrain: true });
  try {
    const result = gate(fixture);
    assert.equal(result.status, 0, result.stderr);
    const report = readCanonicalReport(fixture);
    assert.equal(report.train_rows, 10);
    assert.equal(report.selection.status, "selection_pass");
    assert.equal(report.final.status, "final_accept");
    assert.equal(report.selection.cases.some((row) => row.case_id === "train-important"), false);
    assert.equal(report.final.cases.some((row) => row.case_id === "train-important"), false);
  } finally {
    fixture.cleanup();
  }
});

test("selection improvement requires two current failures with one stable code", () => {
  const fixture = materializeCampaign();
  try {
    setOutcome(fixture, "selection-important", "current", 1, "fail", "OTHER_GAP");
    const result = gate(fixture);
    assert.equal(result.status, 4, result.stderr);
    const report = readCanonicalReport(fixture);
    assert.match(report.selection.reasons.join("\n"), /no stable repeated-failure improvement/);
  } finally {
    fixture.cleanup();
  }
});

test("selection rejects important candidate failure and control regression", async (t) => {
  for (const [label, caseId, index, code, expected] of [
    ["important candidate failure", "selection-important", 0, "NEW_FAILURE", /candidate failure on important case/],
    ["control regression", "selection-control", 1, "CONTROL_REGRESSION", /control regression/],
  ]) {
    await t.test(label, () => {
      const fixture = materializeCampaign();
      try {
        setOutcome(fixture, caseId, "candidate", index, "fail", code);
        const result = gate(fixture);
        assert.equal(result.status, 4, result.stderr);
        assert.match(readCanonicalReport(fixture).selection.reasons.join("\n"), expected);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("final held-out controls may not regress", () => {
  const fixture = materializeCampaign();
  try {
    setOutcome(fixture, "test-control", "candidate", 1, "fail", "CONTROL_REGRESSION");
    const result = gate(fixture);
    assert.equal(result.status, 5, result.stderr);
    const report = readCanonicalReport(fixture);
    assert.equal(report.final.status, "final_reject");
    assert.match(report.final.reasons.join("\n"), /control regression on test-control/);
  } finally {
    fixture.cleanup();
  }
});

test("unsafe artifact paths and byte drift exit 3 without a report", async (t) => {
  for (const [label, mutate, expected] of [
    ["unsafe path", (fixture) => { fixture.ledger.cases.path = "../cases.json"; }, /traversal|workspace-relative/],
    ["byte drift", (fixture) => { fixture.ledger.cases.sha256 = "0".repeat(64); }, /sha256 mismatch/],
  ]) {
    await t.test(label, () => {
      const fixture = materializeCampaign();
      try {
        mutate(fixture);
        persistLedger(fixture);
        const result = gate(fixture);
        assert.equal(result.status, 3, result.stderr);
        assert.match(result.stderr, expected);
        assertNoReport(fixture);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("v3 gate rejects symlinked artifact components and invalid Skill preimages", async (t) => {
  await t.test("symlinked artifact leaf", () => {
    const fixture = materializeCampaign();
    try {
      const casesPath = resolve(fixture.root, fixture.ledger.cases.path);
      const physical = `${casesPath}.physical`;
      writeFileSync(physical, readFileSync(casesPath));
      rmSync(casesPath);
      symlinkSync(physical, casesPath);
      const result = gate(fixture);
      assert.equal(result.status, 3, result.stderr);
      assert.match(result.stderr, /unsafe_path_or_integrity|symbolic link/i);
      assertNoReport(fixture);
    } finally {
      fixture.cleanup();
    }
  });

  await t.test("symlinked artifact parent", () => {
    const fixture = materializeCampaign();
    try {
      const physicalParent = resolve(fixture.root, "linked-campaign-physical");
      mkdirSync(physicalParent);
      writeFileSync(
        resolve(physicalParent, "cases.json"),
        readFileSync(resolve(fixture.root, fixture.ledger.cases.path)),
      );
      symlinkSync(physicalParent, resolve(fixture.root, "linked-campaign"), "dir");
      fixture.ledger.cases.path = "linked-campaign/cases.json";
      persistLedger(fixture);
      const result = gate(fixture);
      assert.equal(result.status, 3, result.stderr);
      assert.match(result.stderr, /unsafe_path_or_integrity|symbolic link/i);
      assertNoReport(fixture);
    } finally {
      fixture.cleanup();
    }
  });

  for (const artifactName of ["source", "candidate"]) {
    await t.test(`invalid ${artifactName} Skill with matching digest`, () => {
      const fixture = materializeCampaign();
      try {
        const invalid = Buffer.from(`not a ${artifactName} Skill\n`);
        const descriptor = fixture[artifactName];
        writeFileSync(resolve(fixture.root, descriptor.path), invalid);
        descriptor.sha256 = sha256(invalid);
        fixture.ledger[artifactName].sha256 = descriptor.sha256;
        persistLedger(fixture);
        const result = gate(fixture);
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr, /frontmatter|Skill/i);
        assertNoReport(fixture);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("v3 gate requires stable ASCII identifiers and failure codes", async (t) => {
  for (const [label, mutate, expected] of [
    ["missing failure code", (fixture) => {
      const sample = findSample(fixture, "selection-important", "current", 0);
      delete sample.failure_code;
      rewriteJsonArtifact(fixture, sample.scorer_record, (record) => {
        delete record.failure_code;
      });
      persistLedger(fixture);
    }, /failure_code.*stable ASCII|failure_code.*required/i],
    ["non-ASCII failure code", (fixture) => {
      const sample = findSample(fixture, "selection-important", "current", 0);
      sample.failure_code = "失败";
      rewriteJsonArtifact(fixture, sample.scorer_record, (record) => {
        record.failure_code = "失败";
      });
      persistLedger(fixture);
    }, /failure_code.*stable ASCII/i],
    ["pass carrying a failure code", (fixture) => {
      const sample = findSample(fixture, "selection-important", "candidate", 0);
      sample.failure_code = "NOT_ALLOWED";
      rewriteJsonArtifact(fixture, sample.scorer_record, (record) => {
        record.failure_code = "NOT_ALLOWED";
      });
      persistLedger(fixture);
    }, /pass.*failure_code|failure_code.*pass/i],
    ["non-ASCII sample id", (fixture) => {
      const sample = findSample(fixture, "selection-important", "current", 0);
      rewriteIdentity(fixture, sample, "sample_id", "样本-1");
    }, /sample_id.*stable ASCII/i],
  ]) {
    await t.test(label, () => {
      const fixture = materializeCampaign();
      try {
        mutate(fixture);
        const result = gate(fixture);
        assert.equal(result.status, 2, `${label}: ${result.stderr}`);
        assert.match(result.stderr, expected, label);
        assertNoReport(fixture);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("v3 gate rejects an outside report before mutating foreign paths", () => {
  const fixture = materializeCampaign();
  const outside = mkdtempSync(resolve(tmpdir(), "superzhao-gate-v3-outside-"));
  try {
    const foreign = resolve(outside, "gate-report.json");
    writeFileSync(foreign, "foreign report\n");
    fixture.report = foreign;
    const result = gate(fixture);
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /outside|workspace|unsafe_path_or_integrity/i);
    assert.equal(readFileSync(foreign, "utf8"), "foreign report\n");
  } finally {
    fixture.cleanup();
    rmSync(outside, { recursive: true, force: true });
  }
});

test("invalid or racing workspace roots are integrity exit 3 with no report", async (t) => {
  for (const [label, prepare, invoke] of [
    ["ordinary file", (fixture) => {
      const root = resolve(fixture.root, "workspace-file");
      writeFileSync(root, "not a directory\n");
      return root;
    }, (fixture, root) => runCli(gateArgs(fixture, root))],
    ["symlink", (fixture) => {
      const root = resolve(fixture.root, "workspace-link");
      symlinkSync(fixture.root, root, "dir");
      return root;
    }, (fixture, root) => runCli(gateArgs(fixture, root))],
    ["missing", (fixture) => resolve(fixture.root, "missing-workspace"),
      (fixture, root) => runCli(gateArgs(fixture, root))],
    ["realpath race", (fixture) => fixture.root, (fixture, root) => {
      const hook = `const fs = require("node:fs");\n`
        + `const { syncBuiltinESMExports } = require("node:module");\n`
        + `const original = fs.realpathSync;\n`
        + `const target = ${JSON.stringify(root)};\n`
        + `let raced = false;\n`
        + `fs.realpathSync = function(path, ...args) {\n`
        + `  if (!raced && String(path) === target) {\n`
        + `    raced = true;\n`
        + `    const error = new Error("workspace disappeared during realpath");\n`
        + `    error.code = "ENOENT";\n`
        + `    throw error;\n`
        + `  }\n`
        + `  return original.call(this, path, ...args);\n`
        + `};\n`
        + `syncBuiltinESMExports();\n`;
      return runWithHook(fixture, gateArgs(fixture, root), hook);
    }],
  ]) {
    await t.test(label, () => {
      const fixture = materializeCampaign();
      try {
        const root = prepare(fixture);
        const result = invoke(fixture, root);
        assert.equal(result.status, 3, result.stderr);
        assert.match(result.stderr, /unsafe_path_or_integrity/);
        assertNoReport(fixture);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

test("the per-input 8 MiB ceiling is enforced before gate decisions", () => {
  const fixture = materializeCampaign();
  try {
    fixture.ledger.source = writeArtifact(
      fixture.root,
      "skills/oversized/SKILL.md",
      Buffer.alloc((8 * 1024 * 1024) + 1, 0x61),
    );
    persistLedger(fixture);
    const result = gate(fixture);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /8 MiB.*input limit/);
    assertNoReport(fixture);
  } finally {
    fixture.cleanup();
  }
});

test("the aggregate 64 MiB campaign ceiling counts unique evidence artifacts", () => {
  const fixture = materializeCampaign();
  try {
    for (const [index, sample] of fixture.ledger.samples.slice(0, 8).entries()) {
      const profile = writeArtifact(
        fixture.root,
        `campaign/profiles/large-${index}.bin`,
        Buffer.alloc(8 * 1024 * 1024, index),
      );
      sample.actor_profile_id = `large-actor-profile-${index}`;
      rewriteJsonArtifact(fixture, sample.actor_run, (record) => {
        record.actor_profile_id = sample.actor_profile_id;
        record.actor_profile = profile;
      });
    }
    persistLedger(fixture);
    const result = gate(fixture);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /64 MiB.*aggregate campaign limit/);
    assertNoReport(fixture);
  } finally {
    fixture.cleanup();
  }
});

test("harness/model profiles and actor-run ledger bytes count toward 64 MiB", async (t) => {
  async function assertAggregate(count, padActorRun) {
    const fixture = materializeCampaign();
    try {
      const samples = fixture.ledger.samples.slice(0, count);
      for (const [index, sample] of samples.entries()) {
        const profile = writeArtifact(
          fixture.root,
          `campaign/profiles/large-harness-${index}.bin`,
          Buffer.alloc(8 * 1024 * 1024, index + 1),
        );
        rewriteJsonArtifact(fixture, sample.actor_run, (record) => {
          record.harness_model_profile = profile;
        });
      }
      if (padActorRun) {
        padJsonArtifact(fixture, samples[0].actor_run, 8 * 1024 * 1024);
      }
      persistLedger(fixture);
      const result = gate(fixture);
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /64 MiB.*aggregate campaign limit/);
      assertNoReport(fixture);
    } finally {
      fixture.cleanup();
    }
  }

  await t.test("eight unique harness/model profiles cross the aggregate ceiling", async () => {
    await assertAggregate(8, false);
  });
  await t.test("seven profiles plus one 8 MiB actor run cross the ceiling", async () => {
    await assertAggregate(7, true);
  });
});

test("an existing report is a publication conflict and is never replaced", () => {
  const fixture = materializeCampaign({ candidateHeldOutFailure: true });
  try {
    writeFileSync(fixture.report, "foreign report\n");
    const result = gate(fixture);
    assert.equal(result.status, 6, result.stderr);
    assert.equal(readFileSync(fixture.report, "utf8"), "foreign report\n");
  } finally {
    fixture.cleanup();
  }
});

test("v3 gate permits selection_pass with not_evaluated when there are zero test rows", () => {
  const fixture = materializeCampaign({ includeTest: false });
  try {
    const result = gate(fixture);
    assert.equal(result.status, 0, result.stderr);
    const report = readCanonicalReport(fixture);
    assert.equal(report.selection.status, "selection_pass");
    assert.deepEqual(report.final, {
      status: "not_evaluated",
      cases: [],
      reasons: ["held-out test rows were not supplied"],
    });
  } finally {
    fixture.cleanup();
  }
});

test("v3 gate publishes final_reject and exits 5 on a candidate important held-out failure", () => {
  const fixture = materializeCampaign({ candidateHeldOutFailure: true });
  try {
    const result = gate(fixture);
    assert.equal(result.status, 5, result.stderr);
    const report = readCanonicalReport(fixture);
    assert.equal(report.selection.status, "selection_pass");
    assert.equal(report.final.status, "final_reject");
    assert.match(report.final.reasons.join("\n"), /candidate failure on important case test-important/);
  } finally {
    fixture.cleanup();
  }
});
