# Affect experiment loop — iteration 3

19 September 2026. This iteration removes supplied emotion expressions and their labels from
JEV's input. It moves toward passage-level highlighting while retaining supplied character mentions.
It is a new task; its F1 must not be compared directly with the easier attribution scores.

## Task and input

For each supplied character mention, ask eight independent Noul questions: anger, anticipation,
disgust, fear, joy, sadness, surprise and trust. State contains the preceding sentence, TARGET
(middle sentence), following sentence, and character IDs with exact text, UTF-16 offsets, and
60-character context on either side. No gold emotion spans, emotion categories for the passage,
modifiers, role edges, author names or book titles enter the request. The eight categories are
fixed questions for every candidate, not derived from the passage's annotated labels.

Full prompt is in `src/server/affect-highlight-request.ts`. It asks whether TARGET expresses or
implies an emotion for C0, etc., uses neighboring text only for interpretation, distinguishes
experiencer from cause/target, and requires textual support for implicit emotion.

REMAN also annotates negated, remembered and hypothetical emotion. The task explicitly includes
those associations and cannot be described as determining a character's currently felt emotion.
It does not extract supporting words, discover character identities, or determine emotion intensity.

## Scope audit and gold

The release does not encode target sentence boundaries. We use the runtime's English
`Intl.Segmenter`, accept exactly three segments, and check that all adjudicated emotion spans
fall in the derived middle segment. Misaligned examples are excluded rather than guessing a
boundary from gold emotions. Runtime Node/ICU versions are recorded for reproducibility.

From the existing 1,253 retained development excerpts, 137 fail the three-segment rule, 428
have no supplied character, and eight fail the gold-scope check, leaving 680 eligible excerpts.
These exclusions are additional to the original raw-data quarantine and narrow coverage.

Gold is an adjudicated experiencer edge of that emotion type to the supplied mention, collapsed
across expressions of the same type. Absence is scored negative under the corpus convention;
it is not independently confirmed exhaustive absence. Gold character candidates are themselves
annotation-selected. The NRC-filtered corpus and candidate selection mean this is still not an
end-to-end reader evaluation on unfiltered prose. The original 316-excerpt test split stays unused.

## First development sample and threshold selection

First 64 eligible excerpts by the fixed ID-hash order: 36 authors, 816 mention/emotion pairs,
90 positives. Request the pinned `jev-1.13.0` model. Keep the prompt unchanged throughout.

| Method | Precision | Recall | Micro F1 |
| --- | ---: | ---: | ---: |
| NRC words anywhere in TARGET, assigned to every candidate | .202 | .700 | .313 |
| NRC word associated with nearest candidate | .201 | .422 | .272 |
| NRC word associated with nearest preceding candidate (nearest fallback) | .233 | .500 | .318 |
| JEV, initial threshold .50 | .614 | .300 | .403 |

NRC uses exact surface-word matching, no lemmatization or dependency parser. These are simple
baselines, not the strongest conventional sentiment systems. The Unicode-safe matcher preserves
source offsets; a subsequent offset fix was verified not to change any recorded baseline scores.

Select one threshold by maximizing development micro F1 over .05, .10, ... .95, preferring the
higher threshold on ties. The selected threshold is **.25**, giving .409 precision, .578 recall,
and .479 F1 on the selection sample. This is an optimistic selection result, not independent
validation or probability calibration. No per-emotion thresholds were tuned.

[Initial comparison](affect-iteration-3-results.json) and
[threshold sweep plus frozen sample](affect-highlight-threshold-selection.json) preserve the results.
The selected-threshold replay used cached responses only.

## Frozen follow-up on different authors

Exclude every author in the threshold-selection sample. This leaves 217 eligible excerpts;
take the first 64 in the same hash order. Author disjointness was checked. The follow-up covers
33 authors and 784 pairs, with 82 positives. Neither the prompt nor threshold changes.

| Method | Precision | Recall | Micro F1 |
| --- | ---: | ---: | ---: |
| NRC passage | .180 | .720 | .288 |
| NRC nearest | .210 | .585 | .309 |
| NRC preceding | .209 | .561 | .305 |
| JEV, frozen threshold .25 | .419 | .598 | **.492** |

The paired author-cluster bootstrap interval (2,000 replicates, fixed seed) for JEV minus NRC
nearest is **[.095, .273] F1**, with a point difference of .184. This is evidence of improvement
over these specific simple baselines on this development follow-up, not a held-out test result.
It does not establish superiority over stronger syntactic/supervised baselines.

Per-emotion follow-up counts are small:

| Emotion | Positive support | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: |
| Anger | 9 | .533 | .889 | .667 |
| Anticipation | 8 | .130 | .375 | .194 |
| Disgust | 7 | .800 | .571 | .667 |
| Fear | 11 | .500 | .636 | .560 |
| Joy | 13 | .400 | .462 | .429 |
| Sadness | 14 | .500 | .714 | .588 |
| Surprise | 10 | .667 | .600 | .632 |
| Trust | 10 | .312 | .500 | .385 |

These are diagnostic, not stable rankings of emotions. The 68 false positives comprise 43
cases with no annotation of that emotion category, 14 with an emotion linked to another mention,
and 11 with an annotated emotion but no experiencer edge. This automated partition describes
the gold structure; it does not adjudicate whether the predictions or annotations are correct.

[Follow-up comparison](affect-iteration-3-followup.json) contains scores and uncertainty estimates.
JEV made 102 selection-sample calls and 98 follow-up calls, with retries disabled. Total reported
usage: 376,017 input tokens and 28,000 output tokens. Replays make no inference calls. All responses
and exact requests remain in the ignored local cache/run files.

## Implication for the reader

This supports continuing with **reviewable candidate highlights**, not automatic assertions
about characters. At the selected threshold, fewer than half the predicted positives agree with
this corpus's strict labels. Show the target passage, keep model uncertainty separate from emotion
intensity, and make the annotation limitations visible in research views.

Next priorities: human audit of apparent false positives, explicit category definitions (especially
anticipation versus ordinary future reference), a negation/factuality-aware human-labeled sample,
and stronger lexical/syntactic baselines. Do not open the test split while these choices change.
No UI feature has been added based on these provisional results.

## Reproduce

```sh
npm run affect:highlights -- --engine jev  # first 64, dry run, .5 threshold
# Add --execute --max-requests 102 to run; --cache-only to replay.

node --import tsx scripts/tune-affect-highlights.ts data/runs/SELECTION_RUN.json

npm run affect:highlights -- --engine jev --threshold .25 --exclude-authors-from docs/affect-highlight-threshold-selection.json
# Follow-up dry run plans 98 calls. Add --execute --max-requests 98 or --cache-only.
# Substitute nrc-passage, nrc-nearest, or nrc-preceding for a local baseline.
```

The highlight runner deliberately exposes development data only. Threshold selection rejects
non-development runs. Comparison rejects different task definitions, sample IDs or dataset hashes.
No dependencies or importer changes were needed. Tests cover emotion-label input isolation,
complete eight-category queries, TARGET boundaries, source-scope exclusions, and Unicode offsets.
