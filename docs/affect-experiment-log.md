# Affect experiment loop — iteration 1

Follow-up: [iteration 2](affect-iteration-2.md) implements explicit span IDs and surrounding context, with a larger prompt comparison and author-disjoint development follow-up.

19 September 2026. Branch `codex/affect-experiments`, isolated worktree
`/Users/caiau/school/read-with-jev-affect-experiments`.

## Question and current decision

Can JEV attach an annotated emotion expression to its experiencer more accurately than simple proximity?
The first smoke run does **not** show an improvement. Keep this as an initial negative result, inspect
development errors and annotation conventions, and do not proceed to emotional-arc claims yet.

This is a deliberately narrower first step than the full proposal. All methods receive adjudicated
emotion spans/types and character mention candidates. The model never receives gold role edges.
We score whether a specific mention has an adjudicated experiencer edge, including negated or
hypothetical expressions. This is not a test of actual felt emotion, automatic extraction, exhaustive
cast discovery, or entity-level coreference. An absent edge is negative under the corpus convention,
not proof that a fictional person feels nothing. Cause/target characters supply important negatives.

## Data audit

Pinned public sources and checksums live in `scripts/prepare-affect.py`. The XML adapter uses only
Python's standard library; all classification and scoring use TypeScript. The original ZIPs remain
unchanged and ignored. REMAN v1.0's readme licenses its annotations under CC BY 4.0, explicitly
excluding the separate Gutenberg text license. NRC's research download is non-commercial.

- 1,720 source excerpts; 1,569 retained; 151 quarantined.
- 157 adjudicated span/text offset mismatches, one dangling relation, and six repeated document IDs
  affecting 12 records. Some records have multiple issues. Entire affected excerpts are excluded;
  no offsets or annotations are silently repaired.
- Source code-point offsets and converted UTF-16 offsets are retained and exact text is checked.
  Rejected annotations are not gold; the original archive preserves them.
- Deterministic author-grouped split: 1,253 development and 316 test excerpts. Grouping by author
  keeps alternate editions of a work together. Exact duplicate text is checked for cross-split leakage.
- 772 development excerpts contain both an annotated emotion and character candidate, producing
  2,261 candidate relation pairs, including 1,226 positives. Other retained excerpts are ineligible
  for this conditional task; they are not silently counted as negative predictions.

REMAN's NRC-filtered sampling, imperfect annotation agreement, selected candidate inventory and
quarantine exclusions constrain generalization. No test predictions have been produced.

## Baselines and first live pilot

Full eligible development set:

| Method | Precision | Recall | Micro F1 |
| --- | ---: | ---: | ---: |
| Every supplied character is an experiencer | .542 | 1.000 | .703 |
| Nearest character span (all ties positive) | .673 | .746 | .707 |
| NRC exact-word emotion match, then nearest | .697 | .338 | .456 |

NRC matching uses the supplied expression, lowercase surface words and no lemmatization. NRC has no
`other-emotion` category; this baseline predicts negative for it. The evaluator additionally exposes
an eight-emotion-only view in new reports. This weak gating baseline is not a general assessment of
NRC or a substitute for grammatical-role/negation-aware baselines. The near equality of all-positive
and nearest F1 also shows why precision, recall and task prevalence must accompany F1.

Matched eight-excerpt smoke sample, selected by sorting development document-ID hashes:

| Method | Precision | Recall | Micro F1 |
| --- | ---: | ---: | ---: |
| Nearest character span | .684 | .722 | .703 |
| NRC match, then nearest | .875 | .389 | .538 |
| JEV, full excerpt, threshold .5 | .647 | .611 | .629 |

36 pairs, 18 positive edges. Ten sequential SDK calls, retries disabled, returned model
`jev-1.13.0` through the requested `jev-latest` alias. SDK-reported usage totals: 7,164 input and
652 output tokens. Measured runner wall time was 3,080 ms; this small run is not a latency benchmark
or a verified dollar-cost estimate. Original responses, requests and scores are cached locally.
No confidence interval or held-out claim is warranted from eight excerpts.

[Aggregate result snapshot](affect-pilot-results.json) retains source hashes, sample IDs, metrics,
usage and returned model identity without redistributing excerpt text. Local complete reports are
under `data/runs/affect-*`; validated API responses are under `data/cache/affect-*`.

## Next iteration

1. Audit the thirteen smoke-pair errors against the exact adjudicated edges. They include experiencer
   versus affected-person confusion, indirect emotion and repeated/coreferent mentions. Distinguish
   semantic mistakes from exact mention-link convention mismatches before changing the prompt.
2. Add an entity-aware evaluation or documented mention-selection rule, preserving the strict
   relation benchmark separately. Do not relabel gold to agree with JEV.
3. Add the stronger grammatical-role baseline, freeze a prompt revision, then use a larger fixed
   development sample and report paired author-grouped uncertainty. Keep test locked during tuning.
4. After attribution is understood, add the independently annotated sample and automatic emotion
   detection condition from the proposal. This pilot supplies no evidence for plot-causal links yet.

## Reproduction and checks

Run `npm run affect:prepare`, then `npm run affect:benchmark -- --engine nearest --limit 2000`.
Use `--engine all` or `--engine nrc-nearest` for the other baselines. JEV defaults to a dry run;
`--engine jev --limit 8 --execute --max-requests 10` enables exactly the planned bounded pilot,
subject to cache hits. `--cache-only` forbids inference. Put credentials in the worktree's ignored
local environment or supply them through the shell; no credential is committed.

`npm run data:prepare`, `npm test` (18 tests), and `npm run typecheck` passed. New tests cover
experiencer/target separation, incomplete predictions, offset corruption, dangling references,
Unicode offset conversion, source pins, and split isolation. No dependencies or UI were changed.
