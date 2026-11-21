# Standalone native evidence consumer

This is a concrete **portable state-analysis handoff**. It verifies a TeachTrace
export and writes ordinary JSONL observations/next-observed-state targets plus a
manifest. It uses only Node built-ins: no React, Three.js, simulator imports,
provider account, network request or training job.

```sh
node scripts/consume-evidence.mjs INPUT.teachtrace.json --out .local/consumer/workcell
node scripts/consume-evidence.mjs mobile-evaluation.json --out .local/consumer/mobile
```

Omit `--out DIR` for inspection without writing output. The input limit is
**50 MiB** and 20,000 recorded samples. Output files are `analysis.jsonl` and
`manifest.json`; existing files are never overwritten. Use a fresh output
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
The consumer records the source task checks but does not independently execute
the task or recompute its acceptance. It preserves the source's simulation limits.

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
