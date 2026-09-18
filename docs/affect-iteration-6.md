# Affect experiment loop — iteration 6

19 September 2026. Direct passage questions retain useful emotion-detection performance without
supplying character annotations and use substantially fewer input tokens. The small measured
accuracy advantage over max-aggregated character questions is inconclusive. Keep this as the
next research candidate; no production or earlier benchmark defaults changed.

## Experiment

One request per excerpt asks eight independent Noul questions: anger, anticipation, disgust,
fear, joy, sadness, surprise and trust. The state contains only `precedingContext`, `target`,
and `followingContext`. No character spans, expression annotations, source metadata, offsets,
or role labels enter the request. The prompt asks whether TARGET expresses or implies the
emotion for anyone, including negated, recalled and hypothetical emotion descriptions; context
may resolve meaning but must not supply the emotion itself. Exact wording and a synthetic state
are in [the prompt record](affect-prompts.md#direct-passage-detection-passage-v1-iteration-6).

Use the same original highlight-v1 cohorts as iteration 5 and `jev-1.13.0` throughout. Score
against all annotated target emotion categories, including expressions without experiencer
edges. The matched sample still inherits the old supplied-character and annotation-scope
eligibility filter, although the direct model never sees those annotations. This has not yet
measured performance on arbitrary passages or passages without annotated characters.

The first 64 excerpts select a threshold from .05 through .95 in steps of .05, maximizing micro
F1 and breaking ties toward the higher threshold. Select separately for direct predictions and
cached max-over-character predictions against the SAME passage gold. Thresholds are **.35 direct**
and **.30 projected**, frozen before issuing the later 93 requests. Also report the previously
specified .25 and .75 operating points without selecting between them after evaluation.
[The frozen selection record](affect-direct-threshold-selection.json) records all candidate scores.

The 64-excerpt follow-up and 29-excerpt remaining-author cohort have authors disjoint from the
selection cohort and each other. These are reused development cohorts that informed prior work,
not independent fresh validation. The test partition remains unopened.

## Matched later-cohort results

93 excerpts, 51 authors, 744 passage–category pairs, 132 positives:

| Method | Threshold | Precision | Recall | Micro F1 |
| --- | ---: | ---: | ---: | ---: |
| Direct passage, selected | .35 | .577 | .598 | **.587** |
| Max over character questions, selected | .30 | .614 | .530 | .569 |
| NRC passage lexicon | binary | .302 | .659 | .414 |
| Direct passage, fixed | .25 | .531 | .712 | .608 |
| Max over character questions, fixed | .25 | .570 | .583 | .577 |
| Direct passage, sparse fixed | .75 | .850 | .258 | .395 |
| Max over character questions, sparse fixed | .75 | .923 | .182 | .304 |

At selected thresholds, direct-minus-projected F1 is +.018, with a paired author-bootstrap
95% interval of [-.026,.072]. This does **not** establish superiority or equivalence. Against
NRC, direct gains +.173, interval [.092,.251]. At fixed .25, direct-minus-projected is +.032,
interval [-.014,.081]. All intervals use 2,000 paired whole-author resamples with seed 20260919;
they are exploratory and unadjusted for repeated development comparisons.

The selected direct prompt scores .606 F1 on the 64-excerpt follow-up and .535 on the 29-excerpt
cohort. Fixed .25 improves the former to .646 but lowers the latter to .500. Do not promote .25
as a newly optimized default on the strength of the combined retrospective result.

At .75, direct matches 34/40 flags versus projected 24/26. This is a precision–recall tradeoff:
direct flags more annotated categories and produces more false positives. Its selection-cohort
precision at .75 was only 13/20 (.650), so .75 is especially not a stable 85% precision guarantee.
These labels describe category association, not necessarily an emotion currently experienced.

## Category detail

Direct prompt at selected .35, combined later cohorts:

| Category | Gold categories | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: |
| Anger | 12 | .611 | .917 | .733 |
| Anticipation | 18 | .280 | .389 | .326 |
| Disgust | 14 | .615 | .571 | .593 |
| Fear | 17 | .588 | .588 | .588 |
| Joy | 18 | .667 | .556 | .606 |
| Sadness | 20 | .625 | .750 | .682 |
| Surprise | 15 | .769 | .667 | .714 |
| Trust | 18 | .667 | .444 | .533 |

Anticipation remains the weakest category. Small supports do not justify per-category threshold
selection or strong comparative claims. The absence of a flag is not evidence that an emotion
is absent from a passage.

## Request volume and token usage

| On the same later 93 excerpts | Requests | Input tokens | Output tokens |
| --- | ---: | ---: | ---: |
| Direct passage | 93 | 125,145 | 13,020 |
| Original character questions | 137 | 255,363 | 19,180 |

Direct uses 51.0% fewer input tokens and 32.1% fewer requests on these excerpts. This is measured
token/request volume, not a dollar-price or latency claim. The direct method also avoids requiring
character annotations at inference. Wording, state and aggregation change together, so this
comparison does not isolate which change affects quality.

This iteration made **157 new SDK calls**, retries disabled, with cached request/response records:
211,454 input tokens and 21,980 output tokens across all three cohorts. Original character runs
were read from cache, not rerun. All returned models were `jev-1.13.0`.

## Research decision

Continue with direct passage questions as the simpler candidate for reviewable emotion suggestions.
The evidence supports semantic filtering beyond NRC lexical hits on these development excerpts;
it does not support reliable full-coverage emotion tagging or character-level affect states.

Next, evaluate the frozen direct prompt on a separately declared sample of remaining development
passages, including those without annotated character mentions. That tests the eligibility
restriction, although authors will recur and must not be described as newly held-out. Before
building affect arcs or Lehnert-style plot units, distinguish negated, hypothetical, remembered,
and currently experienced affect and verify those distinctions against suitable human annotation.
The existing blinded review packet is still unreviewed; model predictions are not new gold.

## Reproduction

```sh
# Dry run first; execute loads TYPESAFE_API_KEY server-side from the environment.
node --import tsx scripts/benchmark-affect-passage.ts --cohort 0
node --import tsx scripts/benchmark-affect-passage.ts --cohort 0 --execute --max-requests 64
node --import tsx scripts/analyze-affect-direct.ts data/runs/SELECTION_DIRECT.json
# Select mode refuses to overwrite an existing frozen selection artifact.
node --import tsx scripts/benchmark-affect-passage.ts --cohort 1 --execute --max-requests 64
node --import tsx scripts/benchmark-affect-passage.ts --cohort 2 --execute --max-requests 29
node --import tsx scripts/analyze-affect-direct.ts \
  data/runs/SELECTION_DIRECT.json data/runs/FOLLOWUP_DIRECT.json data/runs/REMAINING_DIRECT.json
```

Use `--cache-only` instead of `--execute` to reproduce model outputs without requests. The local
run paths and hashes are recorded in [full results](affect-iteration-6-results.json); raw responses
and source text remain ignored local artifacts. The frozen selection is already committed, so
reproduction should use its recorded selection run rather than overwrite it.

31 tests and typecheck pass. Tests verify the direct state excludes annotation/metadata inputs
and that all eight questions are stable when gold annotations change. No dependency, importer,
UI, or existing default changes.
