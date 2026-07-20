import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";

import { applyArgs, runCli, sha256, writeJson } from "./helpers.mjs";

const CAMPAIGN_ID = "production-stage-fixture-v3";
const REQUIRED_VALID = 5;

const SOURCE = `---
name: stage-fixture
description: Use when exercising the production Skill Lab stage fixture.
---

# Stage fixture

Current behavior.
`;

const CASES = [
  {
    case_id: "selection-important",
    split: "selection",
    case_type: "important",
    current: ["KNOWN_GAP", "KNOWN_GAP", "pass", "pass", "pass"],
    candidate: ["pass", "pass", "pass", "pass", "pass"],
  },
  {
    case_id: "selection-control",
    split: "selection",
    case_type: "control",
    current: ["CONTROL_VARIANCE", "pass", "pass", "pass", "pass"],
    candidate: ["CONTROL_VARIANCE", "pass", "pass", "pass", "pass"],
  },
  {
    case_id: "test-important",
    split: "test",
    case_type: "important",
    current: ["HELDOUT_GAP", "pass", "pass", "pass", "pass"],
    candidate: ["pass", "pass", "pass", "pass", "pass"],
  },
  {
    case_id: "test-control",
    split: "test",
    case_type: "control",
    current: ["CONTROL_VARIANCE", "pass", "pass", "pass", "pass"],
    candidate: ["CONTROL_VARIANCE", "pass", "pass", "pass", "pass"],
  },
];

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

function applyPatch(root) {
  const source = resolve(root, "skills/current/SKILL.md");
  const edits = resolve(root, "proposal/patch.json");
  const candidate = resolve(root, "skills/candidate/SKILL.md");
  const applyReport = resolve(root, "proposal/apply-report.json");
  mkdirSync(dirname(source), { recursive: true });
  mkdirSync(dirname(candidate), { recursive: true });
  mkdirSync(dirname(edits), { recursive: true });
  writeFileSync(source, SOURCE);
  const priorRejection = writeJsonArtifact(root, "proposal/rejections/prior.json", {
    decision: "reject",
    reason: "The earlier proposal changed a broader surface than the observed failure required.",
  });
  writeJson(edits, {
    schema: "superzhao.skill-lab.patch/v3",
    proposal_id: "production-stage-fixture-proposal-v3",
    source_sha256: sha256(SOURCE),
    max_edits: 1,
    max_added_bytes: 1024,
    max_removed_bytes: 1024,
    assumptions: [{
      assumption_id: "observed-selection-gap",
      status: "known",
      summary: "The repeated selection failure is addressed by the candidate guidance.",
    }],
    prior_rejections: [{
      rejection_id: "prior-overbroad-proposal",
      report: priorRejection,
      relationship: "narrows",
      note: "This candidate limits the change to the repeated selection failure.",
    }],
    edits: [{
      edit_id: "replace-current-guidance",
      op: "replace",
      target: "Current behavior.",
      content: "Candidate behavior fixes the known gap.",
      rationale: "Close the repeated selection failure without changing frontmatter.",
      supporting_case_ids: ["selection-important"],
      support_count: 1,
      source_types: ["failure", "human-constraint"],
    }],
  });
  const fixture = { root, source, edits, candidate, applyReport };
  const result = runCli(applyArgs(fixture));
  if (result.status !== 0) {
    throw new Error(`could not materialize v3 apply fixture: ${result.stderr}`);
  }
  return { ...fixture, applyResult: result };
}

function materializeCampaign(root, sourcePath, candidatePath, mode) {
  const source = {
    path: workspacePath(root, sourcePath),
    sha256: sha256(readFileSync(sourcePath)),
  };
  const candidate = {
    path: workspacePath(root, candidatePath),
    sha256: sha256(readFileSync(candidatePath)),
  };
  const environment = writeJsonArtifact(root, "campaign/environment.json", {
    node: "22.22.2",
    platform: "fixture",
  });
  const harness = writeJsonArtifact(root, "campaign/profiles/harness-model.json", {
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
  const inventoryCases = CASES.map((row) => ({
    case_id: row.case_id,
    split: row.split,
    case_type: row.case_type,
    prompt: writeArtifact(root, `campaign/prompts/${row.case_id}.md`, `Prompt ${row.case_id}\n`),
    rubric: writeArtifact(root, `campaign/rubrics/${row.case_id}.md`, `Rubric ${row.case_id}\n`),
  }));
  const inventory = {
    schema: "superzhao.skill-lab.cases/v3",
    campaign_id: CAMPAIGN_ID,
    required_valid: REQUIRED_VALID,
    cases: inventoryCases,
  };
  const cases = writeJsonArtifact(root, "campaign/cases.json", inventory);
  const samples = [];

  for (const [caseIndex, row] of CASES.entries()) {
    if (mode === "not_evaluated" && row.split === "test") continue;
    for (const arm of ["current", "candidate"]) {
      for (let index = 0; index < REQUIRED_VALID; index += 1) {
        const suffix = `${row.case_id}-${arm}-${index + 1}`;
        let result = row[arm][index];
        if (mode === "selection_reject"
            && row.case_id === "selection-important"
            && arm === "candidate"
            && index < 2) {
          result = "KNOWN_GAP";
        }
        if (mode === "final_reject"
            && row.case_id === "test-important"
            && arm === "candidate"
            && index === 0) {
          result = "HELDOUT_REGRESSION";
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
        const actorRun = writeJsonArtifact(root, `campaign/runs/${suffix}.json`, {
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
          prompt: inventoryCases[caseIndex].prompt,
          environment,
          harness_model_profile: harness,
          transcript,
        });
        const scorerRecord = writeJsonArtifact(root, `campaign/scores/${suffix}.json`, {
          schema: "superzhao.skill-lab.scorer-record/v3",
          sample_id: `sample-${suffix}`,
          run_id: `run-${suffix}`,
          scorer_run_id: `scorer-${suffix}`,
          scorer_profile_id: `scorer-profile-${scorerProfileIndex + 1}`,
          scorer_version: "fixture-scorer-v1",
          scorer_profile: scorerProfiles[scorerProfileIndex],
          rubric: inventoryCases[caseIndex].rubric,
          transcript,
          scorer_output: scorerOutput,
          status: "valid",
          outcome,
          ...(outcome === "fail" ? { failure_code: result } : {}),
        });
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
    }
  }

  const ledger = {
    schema: "superzhao.skill-lab.samples/v3",
    campaign_id: CAMPAIGN_ID,
    source,
    candidate,
    cases,
    samples,
  };
  const results = resolve(root, "campaign/samples.json");
  writeJson(results, ledger);
  return {
    sourceArtifact: source,
    candidateArtifact: candidate,
    inventory,
    cases,
    ledger,
    results,
  };
}

export function gateArgs(fixture) {
  return [
    "gate",
    "--workspace-root", fixture.root,
    "--results", fixture.results,
    "--report", fixture.gateReport,
  ];
}

export function stageArgs(fixture, outputDir = fixture.outputDir) {
  return [
    "stage",
    "--workspace-root", fixture.root,
    "--source", fixture.source,
    "--candidate", fixture.candidate,
    "--edits", fixture.edits,
    "--apply-report", fixture.applyReport,
    "--results", fixture.results,
    "--gate-report", fixture.gateReport,
    "--output-dir", outputDir,
  ];
}

export function makeV3CampaignFixture({ mode = "final_accept" } = {}) {
  if (!["final_accept", "selection_reject", "final_reject", "not_evaluated"].includes(mode)) {
    throw new Error(`unsupported v3 campaign fixture mode: ${mode}`);
  }
  const root = mkdtempSync(resolve(tmpdir(), "superzhao-stage-v3-"));
  try {
    const applied = applyPatch(root);
    const campaign = materializeCampaign(root, applied.source, applied.candidate, mode);
    const gateReport = resolve(root, "campaign/gate-report.json");
    const outputParent = resolve(root, "published");
    mkdirSync(outputParent, { mode: 0o700 });
    const fixture = {
      ...applied,
      ...campaign,
      mode,
      gateReport,
      outputParent,
      outputDir: resolve(outputParent, "bundle"),
    };
    const gateResult = runCli(gateArgs(fixture));
    const expectedGateStatus = mode === "selection_reject"
      ? 4
      : mode === "final_reject"
        ? 5
        : 0;
    if (gateResult.status !== expectedGateStatus) {
      throw new Error(`could not materialize v3 gate fixture: ${gateResult.stderr}`);
    }
    const gate = JSON.parse(readFileSync(gateReport, "utf8"));
    if (mode === "final_reject"
        && (gate.selection.status !== "selection_pass"
          || gate.final.status !== "final_reject")) {
      throw new Error("final_reject fixture did not retain the required gate decision");
    }
    return {
      ...fixture,
      gateResult,
      gate,
      cleanup: () => rmSync(root, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}
