# Standalone native evidence consumer

This is a concrete **portable state-analysis handoff**. It verifies a RoboTrace
export and writes ordinary JSONL observations/next-observed-state targets plus a
manifest. It runs on Node built-ins and portable analysis/policy helpers: no React, Three.js,
controller execution, provider account, network request or training job.

```sh
node scripts/consume-evidence.mjs INPUT.teachtrace.json --out .local/consumer/workcell
node scripts/consume-evidence.mjs mobile-evaluation.json --out .local/consumer/mobile
```

Omit `--out DIR` for inspection without writing output. The input limit is
**50 MiB** and 20,000 recorded samples. Native workcell output files are `analysis.jsonl` and `manifest.json`; supported
native mobile delivery files also produce protected analysis and HTML below.
Existing output files are never overwritten. Use a fresh output
directory for each handoff. Input/provider secrets are not required.

## What is checked

- Workcell `teachtrace.evidence.v1`: SHA-256 over the independently canonicalized
  unsigned payload; complete `derivedArmTrace`; native/trace clocks and object
  coordinates; recorded shoulder/elbow/wrist lengths; signed additive forward
  kinematics; TCP/gripper correspondence.
- Mobile `teachtrace.mobile-evaluation.v1` envelope: its declared SHA-256 over
  `JSON.stringify(payload)`; trajectory endpoints and clocks; recorded link
  lengths; relative arm/base yaw and additive pitch FK; downward wrist/TCP
  offset; active object's rendered-center TCP correspondence.

The workcell yaw is zero along **+X**, using `atan2(z, x)`; its elbow pitch is
signed and additive. Mobile base yaw is zero along **+Z**, using `atan2(x, z)`;
the arm's yaw is relative to that base heading. Coordinates are simulator-world
meters, angles radians, and timestamps simulated seconds. The manifest preserves
these distinct conventions rather than treating the embodiments as interchangeable.

Old workcell files lacking a derived arm trace must be re-exported by a current
build. The consumer does not invent missing joint coordinates. A changed digest
or a re-signed artifact whose angles fail FK is rejected.

## Meaning of the output

Each nonterminal JSONL row holds an actual recorded observation and the next
adjacent observation's joint positions/deltas, with a strictly positive `dtSeconds`.
Deltas are raw **next minus current** radians; angle wrapping, resampling and
joint-limit assumptions are not added. These are **next-observed-state targets**,
not requested motor commands, torques, calibrated actions or learned predictions.

Same-clock pause/clear/resume pairs produce no target pair or division by zero.
Their controller/human transition metadata is retained in the manifest. The last
observation has `terminal: true`, `target: null`; failed/stopped source outcomes
and original control events remain visible. Clock regressions are rejected:
resets with a new clock require a separate evidence segment, not silent stitching.

`frozenParentSceneSha256` uses valid declared parent lineage when present, and
otherwise groups the computed initial scene and task contract. Keep a whole parent group in one
split when designing an experiment; never randomly split this file's frames.
No train/test split is created here. Related variants may need an even broader
curator-supplied family group, so this key does not establish leakage-free evaluation.

## What this does not prove

SHA-256 establishes unchanged content, not authorship or physical truth. FK
establishes internal geometric consistency, not contact dynamics or robot safety.
The consumer does not independently execute the task or recompute full task
acceptance. The protected-analysis extension below independently recomputes the
recorded unchanged-object invariant; source goal/completion checks remain labelled
as source results. It preserves the source's simulation limits.

This is **not policy training, a validated training adapter, LeRobot/RLDS output,
or an upload/import into Physical Intelligence or another lab**. It is a small,
inspectable step that lets another program verify and analyze the states without
running our application. Training usefulness still needs the recipient's exact
observation/action contract, data rights, importer and held-out experiment.

## Local example evidence

On this development checkout, the standalone command can consume the actual
`.local/qa/workbench.teachtrace.json` and `.local/qa/mobile-live-evidence.json`
exports. Those ignored files are generated QA evidence, not files promised in a
fresh clone. Use the current application to export your own attempts.

```sh
node scripts/consume-evidence.mjs .local/qa/workbench.teachtrace.json --out .local/qa/consumer/workbench
node scripts/consume-evidence.mjs .local/qa/mobile-live-evidence.json --out .local/qa/consumer/mobile
node --test scripts/consume-evidence.test.mjs
```

## Correlated scene lineage

When a variation is loaded and recorded, its native world carries the declared
parent scene SHA-256, generator seed, case index and variation kind. The UI hashes
the source scene and task using sorted JSON keys, excluding run clocks, revision,
provenance and generated task identity. Controller timing excludes lineage hashing.
The batch export retains the actual parent scene and instruction.

The consumer groups valid descendants by `sceneProvenance.derivation.parentSceneSha256`.
Its manifest reports `groupingSource: declared-parent-scene-lineage`, the separate
`computedSceneSha256` of the recorded child, and `upstreamLineageVerified: false`.
Two different child layouts can therefore remain in one source family. Without
derivation, grouping falls back to `computed-initial-scene`. Malformed or changing
derivation is rejected; it is never silently treated as authenticated history.

This is a conservative grouping suggestion for whole related episodes. SHA-256
verifies content consistency, not upstream ancestry or authorship. No train/test
split, policy training, or leakage-free partition guarantee is produced. Frame
pairs remain inside their episode and retain the parent group identifier.

## Independent protected-object analysis and matched regression

**Status:** portable analysis/CLI/report passes seven meaningful tests and an
actual CLI run; matched-pair UI passes four browser groups; the independent
file-upload page passes four browser groups on the same exported pair. See
[REGRESSION_WORKFLOW.md](REGRESSION_WORKFLOW.md) for the complete product loop.

The same command accepts these additional source formats:

| Input schema | Files written with `--out DIR` | Verification scope |
| --- | --- | --- |
| `teachtrace.mobile-matched-pair.v1` | `protected-analysis.json`, `manifest.json`, self-contained `report.html` | Pair/package/source identity, shared goal/intervention schedule, protected history and recorded first-change attribution. |
| `teachtrace.mobile-candidate-result.v1` | Same three protected-analysis files | One candidate's recorded protected-object history; no pair is inferred from unrelated runs. |
| `teachtrace.mobile-planner-report.v1` | Same three protected-analysis files | Actual recorded attempts retain their source IDs and outcomes; unrelated runs are not called matched. |
| Native mobile envelope with supported Cup/Bowl delivery goal | Existing `analysis.jsonl`/FK manifest **plus** `protected-analysis.json` and `report.html` | Native SHA/FK and next-observed-state contract, plus recorded protected history. |
| Native workcell package | `analysis.jsonl`, `manifest.json` | Existing workcell SHA/FK/state-pair contract. |

```sh
node scripts/consume-evidence.mjs .local/qa/mobile-matched-pair.json --out .local/qa/my-matched-analysis
node --test scripts/protected-analysis.test.mjs
```

Use a fresh output directory. No network, controller execution, model request or
training job runs. Protected-only inputs are not falsely labelled FK-verified or
converted into calibrated motor commands. The manifest distinguishes recomputed
protected history from full task checks and source authorship verification.

Open **Open trace analysis** from the matched UI or visit
[the independent upload page](../public/trace-analysis.html) at
`http://127.0.0.1:5189/trace-analysis.html`. Choose the actual downloaded comparison.
The page reads the selected file without React/app memory, simulator execution or
API calls. **Download analysis JSON** preserves calculated values;
**Download standalone report** embeds the source and viewer into HTML that was
verified to reopen fully offline. In-browser file upload is local, not an upload
to a provider or robotics lab.

[Viewer QA](../.local/qa/trace-analysis-results.json) verifies actual run IDs and
verdicts, selectable time/XYZ and first-violation plot, exact calculated JSON,
offline HTML, tamper rejection clearing stale verdicts and phone usability.
[CLI analysis](../.local/qa/matched-analysis-final/protected-analysis.json) and
[CLI report](../.local/qa/matched-analysis-final/report.html) use the **same source
comparison** as the matched browser UI. Earlier API-only sample reports have
their own run IDs and must not be relabelled as that export.

### Exact unchanged-object contract

The canonical policy is `teachtrace.mobile-protected-record.v1`: the protected
object's **complete initial simulated record must remain exactly unchanged**.
Position tolerance is **0 m**, with exact JSON record comparison. It is not an
invented 1 cm threshold, a physical calibration/noise standard or proof of contact
safety. The producer checks native ticks and forces the first violating state
into new candidate replay exports. Analysis cannot invent unrecorded history in
an older file.

The first record change can concern status before coordinates move. A position
curve can therefore be flat at the first violation, then show later motion and
an exact final return. Analysis names changed fields and keeps record violation
separate from position violation. Tests cover status-only changes at zero
movement, tiny exact displacement and forged first-change metadata.

For the actual matched export, the first violation is **20.6 simulated seconds,
step 8**, at **0.021831868 m** displacement. Peak displacement is **1.195583427 m**;
final displacement is **0** and the complete final Bowl record is restored. The
latched history verdict remains failed. These are this source run's observations,
not tolerances or generic performance numbers.

### Candidate handoff is not a training operation

The pair schema retains `initialSceneSha256`, seed, fixed goal and both actual
runs. Its optional `preference` references `chosenRunId`/`rejectedRunId`, a reason,
`reviewStatus: candidate-unreviewed` and `trainingValidated: false`. It is a
proposed comparison under that task rule, not a human-approved training label.
The live judge-interruption demonstration is separate from the no-intervention
matched pair; different histories are not equivalent conditions.

A later corrected operator run is an additional test. The existing comparison
still contains its original two IDs unless a new pair is built; it does not
silently substitute the later result. No model weights, reward model, DPO/RLHF
adapter or policy are trained by this handoff. Training use still needs rights,
recipient-specific observations/actions, a validated loader and a held-out
experiment. No train/test split or leakage-free guarantee is produced.
