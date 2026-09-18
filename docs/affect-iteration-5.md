# Affect experiment loop — iteration 5

19 September 2026. Cached predictions show a useful passage-level signal, but exact mention
selection is not the main explanation for missing emotions. This iteration changes the evaluation
unit, not the model or prompt. No new model calls, threshold tuning, or human labels were used.

## Question and method

Can existing character–emotion predictions identify a target sentence's emotion categories when
we remove exact-mention attribution? For each document and each of the eight categories, take
the maximum original highlight-v1 score across supplied character mentions. Evaluate two distinct
gold definitions, without changing source annotations:

- **Linked:** category is positive if any supplied mention has an annotated experiencer edge.
  This collapses the original mention task while retaining its relation coverage restriction.
- **All annotations:** category is positive if the target contains any annotated expression of
  that category, including expressions without an experiencer edge. This changes the intended
  task to passage-level category detection; it does not validate a character attribution.

Compare with NRC target-sentence lexical hits. When collapsed by category, NRC nearest and
preceding yield the same category presence as NRC passage because every hit has at least one
candidate assignment. Use the existing .25 and .75 thresholds unchanged. Max aggregation is not
a calibrated passage probability and can increase flag rates as the candidate count grows.

Use original cached runs for the selection cohort (64 excerpts), later follow-up (64), and
remaining-author cohort (29). The script checks dataset hashes, exact score matrices, model/prompt,
development split, unique documents, and disjoint authors. The selection cohort is reported
separately because it informed thresholds. The combined later cohorts contain 93 excerpts from
51 authors. They have already informed earlier research: this is retrospective development
analysis, not fresh validation. The held-out test partition remains closed.

## Results on the 93 later excerpts

| Task / method | Precision | Recall | Micro F1 |
| --- | ---: | ---: | ---: |
| Original exact mention task, JEV .25 | .390 | .571 | .464 |
| Linked passage categories, JEV .25 | .474 | .604 | .531 |
| Linked passage categories, NRC | .247 | .670 | .360 |
| All annotated passage categories, JEV .25 | .570 | .583 | .577 |
| All annotated passage categories, NRC | .302 | .659 | .414 |
| All annotated passage categories, JEV .75 | .923 | .182 | .304 |

The rows describe different tasks and denominators; their F1 differences are not causal estimates
of an attribution improvement. Within the all-annotations task, the paired 2,000-resample
author bootstrap interval for JEV .25 minus NRC F1 is [.083,.233]. Within linked passage
categories it is [.082,.249]. These are exploratory intervals, without a multiple-comparison
correction. The all-annotations JEV F1 is .592 on the 64-excerpt follow-up and .535 on the
29-excerpt cohort, compared with NRC .447 and .324 respectively.

At .75, 24 of 26 passage-category flags match an annotation, compared with 21 of 26 original
character flags. Three additional matches are emotions annotated without an experiencer edge,
not newly verified character assignments. Only 24 of 132 annotated passage categories are
captured; 26 flags are too few to establish a reliable precision guarantee.

### Which categories look promising?

All-annotations task, JEV .25, combined later cohorts:

| Category | Gold categories | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: |
| Anger | 12 | .588 | .833 | .690 |
| Anticipation | 18 | .259 | .389 | .311 |
| Disgust | 14 | .727 | .571 | .640 |
| Fear | 17 | .500 | .529 | .514 |
| Joy | 18 | .643 | .500 | .562 |
| Sadness | 20 | .609 | .700 | .651 |
| Surprise | 15 | .909 | .667 | .769 |
| Trust | 18 | .714 | .556 | .625 |

Small category counts make these descriptive, not a sound basis for category-specific thresholds.
Anticipation remains weak even after dropping attribution.

## Where errors come from

At .25, the original mention task has 100 false-positive flags:

- 67 have no corresponding category annotation anywhere in the target.
- 14 concern a category present but without any supplied-mention experiencer link.
- 19 concern a category linked to another mention.

Of 48 missed gold mention–emotion pairs, only **3** have that category flagged on another
mention. Simply reassigning existing category flags cannot recover most misses. These counts
are annotation disagreements, not independent human judgments; some corpus-negative cases may
be defensible readings. No coreference labels are available here, so another mention does not
necessarily mean another person.

## Product implication and next experiment

A passage-level suggestion such as “possible sadness” is a better-supported near-term direction
than asserting who feels it. Keep suggested categories reviewable and distinguish emotion
association from currently experienced emotion. These experiments do not measure intensity,
causal plot units, emotional change over time, or full-book arcs. They still depend on a supplied
gold character inventory and the existing sentence/annotation eligibility filter, so they do not
establish end-to-end reader performance.

The next model experiment should ask directly about eight target-sentence categories with no
character inventory, using the same text/context boundaries. That would test a different prompt
and remove the max-over-mentions candidate-count effect. Compare on fixed development passages
and report the reuse honestly; freeze the final task and policy before opening test. Independent
human review of the existing blank packet remains necessary to assess reader-facing usefulness.

## Reproduction and validation

```sh
node --import tsx scripts/analyze-affect-passage.ts \
  data/runs/affect-highlight-jev-64-b3ae42177955-1789739138923.json \
  data/runs/affect-highlight-jev-64-e92b56254ff9-1789739291164.json \
  data/runs/affect-highlight-jev-29-9b689cea5999-1789739706006.json
npm test
npm run typecheck
```

[Full results](affect-iteration-5-results.json) include input and code hashes, cohort IDs,
per-category metrics, and bootstrap intervals. Raw model runs remain local ignored artifacts.
30 tests and typecheck pass. Defaults, prompts, state, dependencies, and importer are unchanged.
