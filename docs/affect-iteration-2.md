# Affect experiment loop — iteration 2

19 September 2026. Same isolated branch/worktree. **v2 (explicit IDs and nearby text) is now the
runner default.** The user selected this representation. All model comparisons below used the
pinned `jev-1.13.0` model, fixed .5 threshold, original source hashes, and unchanged gold labels.

## Findings from the original pilot

The thirteen original smoke-pair errors were concentrated in four excerpts: five in a passage
with repeated first/second-person references and remembered feelings; four in promise/threat
attribution; one in implied sadness attributed to a collective; and three on emotion expressions
with no recorded experiencer edge. These are development observations, not new human gold.

In the entire development partition, 232 annotated emotion expressions have no recorded
experiencer edge. They contribute 311 of the 2,261 original candidate pairs. Absence of a recorded
edge does not establish that the expression genuinely has no experiencer. Preserve the strict
closed-world relation score for continuity and additionally report a clearly labeled diagnostic
subset of expressions that have at least one adjudicated experiencer. This subset is conditioned
on annotation coverage, is not deployable filtering, and does not fix other missing/coreferent links.

## Prompt/state comparison

The initial eight smoke excerpts were excluded. The next 64 development excerpts in the frozen
hash order cover 37 authors and 206 candidate pairs, with 103 positives. Prompt v2 adds local IDs,
exact span text and up to 60 characters of context before/after each span, alongside the full
excerpt. It also clarifies experiencer/target/cause definitions and supplied-category semantics.
Both wording and state changed, so gains cannot be attributed to state alone.

Prompt v3 tested compact inline markers with the same role definitions moved into shared state.
It reduced tokens but did not preserve v2's point estimate. It remains an explicit ablation,
not the selected default. See [exact prompt/state descriptions](affect-prompts.md) and
[synthetic complete request payloads](affect-prompt-examples.json).

| Method | Strict micro F1 | Linked-expression diagnostic F1 | Input tokens |
| --- | ---: | ---: | ---: |
| Nearest character | .676 | .732 | 0 |
| Nearest preceding character, nearest fallback | .733 | .794 | 0 |
| All supplied characters | .667 | .731 | 0 |
| NRC match then nearest | .429 | .444 | 0 |
| JEV v1: original | .743 | .780 | 45,635 |
| JEV v2: IDs and surrounding text | .781 | .841 | 90,758 |
| JEV v3: compact markers | .731 | .778 | 55,083 |

The preceding-character baseline is a positional heuristic, not a dependency parser. A stronger
syntactic or supervised baseline remains necessary. The weak NRC gate also lacks an
`other-emotion` category and is not a general assessment of lexicon methods.

The 95% paired author-cluster bootstrap interval for v2 minus the preceding-character baseline
is [-.023, .111] strict F1. For v2 minus v1 it is [-.005, .084]. The point estimates favor v2,
but these development intervals include zero. Three prompt versions were explored here; these
are exploratory comparisons, not a significance claim after model selection.

Each prompt used 69 SDK calls. [Reproducible comparison artifact](affect-iteration-2-results.json)
records full metrics, source/sample identities, source-code hashes and 2,000 paired bootstrap
resamples' percentile intervals (seed 20260919). Failed/missing predictions still fail scoring.

## Frozen v2 follow-up on different authors

After choosing v2, freeze it and exclude **all authors** represented in the first eight smoke
excerpts or the 64-excerpt comparison. The exclusion manifest is
[affect-prompt-development-sample.json](affect-prompt-development-sample.json). This leaves 208
eligible development excerpts; take the first 64 in the same hash order. The follow-up spans
32 authors and 174 pairs, with 91 positives. Author disjointness was checked explicitly.

| Method | Precision | Recall | Strict micro F1 | Linked-expression diagnostic F1 |
| --- | ---: | ---: | ---: | ---: |
| Nearest character | .626 | .791 | .699 | .800 |
| Nearest preceding character | .643 | .791 | .709 | .809 |
| All supplied characters | .523 | 1.000 | .687 | .816 |
| Frozen JEV v2 | .753 | .802 | .777 | .854 |

V2 improves the strict point estimate mainly by reducing false positives: 24 versus 40 for the
preceding-character baseline, with 73 versus 72 true positives. The paired author-cluster 95%
interval for the F1 difference is [-.004, .150], still including zero. This is encouraging
replication of the direction on different authors within development, not a held-out conclusion.

67 SDK calls; 80,001 input and 3,226 output tokens. [Follow-up artifact](affect-iteration-2-followup.json).
Across this iteration, 274 new calls used 271,477 input and 14,560 output tokens. Calls were capped,
retries disabled, and raw requests/responses cached. These are usage counts, not dollar estimates.
The 316-excerpt author-grouped **test partition remains unused**. No automatic extraction, actual
felt-emotion detection, intensity calibration, or causal plot-unit claim follows from this experiment.

## Reproduction

```sh
# Matched development prompt comparison (each JEV prompt plans 69 calls)
npm run affect:benchmark -- --engine jev --prompt v2 --offset 8 --limit 64 --model jev-1.13.0
# Add --execute --max-requests 69 to execute, or --cache-only to replay.
# Substitute --prompt v1 or v3 for the ablations, or --engine preceding for the baseline.

# Frozen v2 follow-up (plans 67 calls)
npm run affect:benchmark -- --engine jev --prompt v2 --limit 64 --model jev-1.13.0 --exclude-authors-from docs/affect-prompt-development-sample.json

# Explicit matched run files; first file is the reference baseline
node --import tsx scripts/compare-affect.ts data/runs/BASELINE.json data/runs/MODEL.json
```

Run reports now have unique timestamps so reruns cannot overwrite previous measurements. The
cache continues to key the full request and source dataset, so prompt variants cannot share
incompatible cached answers. Exclusion manifests fail if their dataset hash or document IDs differ.

22 tests and typecheck pass. New tests check v1 compatibility, state gold-label exclusion,
context anchors, overlapping inline markers, and the directional baseline. No new dependencies,
importer changes, or UI changes. The next experiment should isolate state versus wording and add
a stronger syntactic baseline before further prompt search or opening the test partition.
