# Affect experiment loop — iteration 8

19 September 2026. The source guidelines confirm that REMAN character annotations are selected
through emotion annotation, not a general character inventory. This explains why earlier
character-filtered evaluation samples were strongly enriched for emotion. Earlier numerical
results remain valid for their conditional tasks, but must not be generalized to ordinary
passage emotion tagging or end-to-end character discovery.

## What the source establishes

The pinned archive's `reman/guidelines.pdf` is preserved at `data/raw/affect/reman-guidelines.pdf`,
SHA256 `f0ab6284f4a206c6e070978807050fc7dd2584c8b2f3613bbb25e6c83b49f661`.
This iteration inspected the relevant page text; it did not create or alter the PDF.

- Pages 1–2: the middle sentence is the annotation target; surrounding sentences supply context
  and receive selective relevant entity annotation. Emotions in the target are intended to be
  annotated, including implicit expressions.
- Page 3, section 2.1.2: entity and character annotation is limited to participants in emotion
  relations—experiencers, causes, and targets.
- Page 10, section 3.2.2: the character annotation is explicitly not an exhaustive inventory of
  every character appearing in the excerpt.
- Page 11: multiple mentions of the same experiencer are reduced to the closest mention for an
  emotion expression; negated emotions have their own annotation convention.

Therefore, supplying gold character mentions gives an emotion-detection model annotation-derived
information about likely emotion participants. Even removing those mentions from the state
(as iteration 6 did) does not remove selection bias if evaluation still requires those annotations
to exist. A general character detector would produce a different candidate inventory. The earlier
nearest-character attribution experiments also operate on this conditional inventory.

The source does **not** establish that every model/corpus disagreement is missing annotation.
It intends target emotions to be covered. Treat unsupported predictions as benchmark errors until
independent review clarifies the intended reader task; do not replace corpus labels with model outputs.

## Development census

Among all 1,253 development excerpts, 1,108 satisfy the existing sentence segmentation and
annotation-scope rules. No model scores or test-partition labels are used for this census.

| Corpus character annotations | Eligible excerpts | With any of eight emotions | Positive category decisions |
| --- | ---: | ---: | ---: |
| Absent | 428 | 23 / 428 = **5.4%** | 30 / 3,424 = **0.88%** |
| Present | 680 | 620 / 680 = **91.2%** | 968 / 5,440 = **17.79%** |

This is a property of the annotated development corpus, not a prevalence estimate for arbitrary
fiction. The disparity is approximately 20-fold per category decision. It corroborates the
iteration-7 result: precision evaluated on the character-filtered subset does not transfer to
passages without that annotation. No new performance estimate or tuned threshold is introduced.

## Inspection of the strongest disagreements

We read all five no-character-stratum flags at scores at least .75 from iteration 7. One matches
a sadness annotation; the four remaining flags occur in three documents. The following are
research hypotheses, not adjudicated replacement labels:

- A favorable future appraisal gets anticipation and joy flags; laughter occurs in surrounding
  context. This could be ordinary appraisal, supported affect, or context spillover.
- Leaving a threatening situation gets a fear flag. It may express implicit fear, or the model
  may be supplying a plausible reaction beyond the target's words.
- A description of pain, fatigue and danger gets sadness. Physical suffering and sadness may
  have been conflated, but that requires independent judgment.

These cases motivate target-evidence review rather than a blanket claim that corpus annotations
are incomplete. They also motivate a future context ablation; this iteration does not establish
which mechanism caused a prediction.

## Blinded review prepared, not performed

Two separate local files, one per independent human reviewer:

- `data/runs/affect-expansion-review-A.json`
- `data/runs/affect-expansion-review-B.json`

Each contains the same 40 shuffled items from 33 distinct documents, with target/context text and
an emotion category. No scores, corpus emotion labels, annotation-character stratum, source IDs,
matching identities, or other reviewer's judgments are exposed. A separate local analyst key
contains that information and blank adjudication fields; do not give it to reviewers.

Selection uses twelve pairs of flags at the fixed .35 threshold, matched across annotation-character
strata on emotion category and nearest available model score without replacement. Eight additional
below-threshold cases per stratum are selected by deterministic hash. Emotion-category gold outcomes
are not used in selection; strata necessarily use corpus character annotations. Mean absolute score
difference within pairs is .076, maximum .350: matching is approximate and does not control text or
author differences. The packet is deliberately diagnostic, not prevalence-representative, and
multiple items from one document are not independent observations.

Reviewers independently answer yes/no/unclear for:

1. Does the target associate the specified emotion with anyone, including negated, hypothetical,
   or remembered descriptions?
2. Is it asserted as currently experienced at the target scene time?

They quote target evidence and may record asserted/negated/hypothetical/remembered/mixed/unclear
status. Context can resolve meaning but cannot supply the emotion by itself. The instructions
are a proposed product-audit definition, not an official extension of REMAN. They distinguish
benefit from joy, future tense from anticipation, and physical pain from sadness.

Both forms and all adjudication fields are blank, marked **unreviewed-not-gold**. Automated checks
verified that all 40 entries in each file have only allowed blinded fields and null judgments.
No human review, inter-rater agreement, or new gold set is claimed. Independent review followed
by explicit adjudication is required before using these answers as evaluation labels.

## Research decision

Stop treating supplied REMAN characters as ordinary character detection output. Keep the earlier
conditional results but prominently qualify the source of their candidate inventory. For passage
emotion detection, future evaluation should use a sampling rule independent of character/emotion
annotations and report realistic prevalence. Separate emotion association from current experience
before constructing arcs or character affect states.

A bounded next model experiment is to remove surrounding context while keeping the question and
threshold fixed on the existing sample. That could measure sensitivity to context; it would not
by itself prove context leakage or produce new gold. Independent review remains the route to
judging whether disputed flags are useful to readers. The test partition stays closed during
these task-definition decisions.

## Reproduction and validation

```sh
node --import tsx scripts/audit-affect-selection.ts
npm run typecheck
```

The generator refuses to overwrite reviewer files so it cannot silently erase annotations.
The [audit record](affect-iteration-8-results.json) contains census counts, source hashes, packet
hashes, sampling description and match quality. Raw text packets and analyst key remain ignored
local artifacts. No new model calls, dependency changes, prompt changes, threshold changes, or
label changes. Typecheck passes; the prior 32-test suite is unchanged.
