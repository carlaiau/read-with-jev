# Affect experiment loop — iteration 4

19 September 2026. The revised highlight definitions did **not** improve F1. Retain
`highlight-v1` as the default; `--prompt v2` remains an experimental comparison. This is distinct
from the earlier attribution task, whose default is still its own explicit-ID/context v2.

## Audit and guideline check

We inspected a dozen apparent anticipation/trust false positives in the earlier development
follow-up. Some were future references, ordinary cooperation/approval, or potentially emotions
from surrounding sentences; some remain legitimate interpretation or annotation disagreements.
No predictions were substituted for human gold.

The pinned REMAN archive's `reman/guidelines.pdf`, pages 2, 6 and 11, clarifies that:

- Anticipation includes looking forward and expecting; interest, boredom and distraction belong
  to other-emotion, outside the eight-category experiment.
- Repeated mentions of the SAME experiencer should be represented by the mention nearest to
  an emotion expression in token distance. This does not mean choosing the nearest unrelated
  character. The guidelines therefore partly explain the strength of proximity baselines and
  the mismatch between person-level semantic judgments and strict mention-level scoring.
- Negated emotions are annotated explicitly; sadness should not become a negated joy label.

A local reference copy is in ignored `data/raw/affect/reman-guidelines.pdf`. Archive checksums and
provenance remain those of the original importer. The new v2 prompt retains the old state and adds
category definitions, boundaries for related non-emotional concepts, the nearest-coreferent mention
rule, and a reminder not to count surrounding-context emotion. The explanatory boundaries are
research operationalizations informed by the guide, not a verbatim official taxonomy.
Both category definitions and mention convention change, so this is not a single-factor ablation.

## Matched comparison on remaining different authors

Exclude all authors in the two prior highlight cohorts using
[the exclusion manifest](affect-iteration-4-exclusions.json). Only **29 eligible excerpts from
18 authors** remain, despite requesting up to 48. Use every remaining excerpt: 312 candidate pairs,
30 positives. Both prompts use `jev-1.13.0` and the previously selected threshold .25. No threshold
is retuned on this cohort. The 316-excerpt test partition remains untouched.

We also train a small regularized logistic classifier using 17 lexical/positional features:
emotion identity, NRC passage/nearest/preceding indicators, lexical density, target membership,
character count, pronoun indicator and a simple negation flag, plus intercept. Training uses the
first 64-excerpt highlight cohort; lambda and threshold selection use the second 64-excerpt cohort.
All training/validation authors are excluded from the new cohort. Full-batch fitting is deterministic,
with 1,500 steps at learning rate .5. Search lambda [.001,.01,.1] and threshold [.05.. .95] in .05
steps, breaking ties by stronger regularization then higher threshold. Selected lambda .01 and
threshold .15; no refit after selection. This is a limited pooled-feature baseline, not a general
claim about supervised NLP or a state-of-the-art literary emotion system.

| Method | Precision | Recall | Micro F1 |
| --- | ---: | ---: | ---: |
| NRC passage | .144 | .500 | .224 |
| NRC nearest | .179 | .467 | .259 |
| NRC preceding | .154 | .400 | .222 |
| Supervised linear NRC/position features | .141 | .367 | .204 |
| Original JEV highlight prompt | .319 | .500 | **.390** |
| Revised definitions/mention convention | .325 | .433 | .371 |

The revision removes five false positives but also loses two true positives. Its paired
18-author bootstrap interval for F1 change versus original is [-.084,.036]. It has not
shown a benefit and uses more input tokens. Original JEV minus the small linear baseline has
a [.017,.358] interval, but sample size and the restricted baseline limit that finding.
[Full paired comparison](affect-iteration-4-results.json) preserves all scores and intervals.

78 new SDK calls, retries disabled: original 72,202 input tokens, revision 114,751; each reports
5,460 output tokens. The linear baseline and all later analyses make no model calls. Run metadata
preserves the exact requests, responses, features/weights, training IDs, validation IDs and code hashes.

## Sparse review policy

A retrospective exploratory policy uses the *original first-cohort threshold sweep* to choose
the lowest threshold with observed precision at least .75 and at least ten predicted positives.
That selects **.75**. This is not a calibrated precision guarantee or a new preregistered evaluation.
Applying it to cached original-prompt predictions gives:

| Later cohort | Matching positives / predicted flags | Precision | Recall |
| --- | ---: | ---: | ---: |
| Earlier different-author follow-up, 64 excerpts | 14 / 19 | .737 | .171 |
| New 29-excerpt cohort | 7 / 7 | 1.000 | .233 |
| Combined descriptive total | 21 / 26 | .808 | .188 |

Seven correct flags do not establish perfect precision. These small counts support exploring
sparse, reviewable candidate highlights rather than broad automatic emotion badges. Most annotated
positives remain unflagged. [Policy record](affect-sparse-policy.json). Defaults are unchanged.

## Blinded human review preparation

`prepare-affect-review.ts` samples up to 12 cases per fixed score band (high, medium, low),
using deterministic hashes, and mixes their order. The current packet contains 36 cases from
the two later cohorts, with target/context, character anchor, and emotion question. Model scores,
corpus gold labels and sample-band identities are kept in a separate analyst key.

Local packet: `data/runs/affect-blind-review.json`; analyst key:
`data/runs/affect-blind-review-key.json`. Two reviewer forms and adjudication fields are blank,
explicitly marked **unreviewed-not-gold**. No human review has occurred. The packet asks separately
about emotional association and currently experienced emotion; independent judgments can clarify
where the benchmark and intended reader feature diverge. The score-stratified packet cannot
estimate natural prevalence or overall accuracy without accounting for sampling.

This is the next useful validation step. All eligible development authors have now appeared in
one of the highlight cohorts; further prompt tuning should not be called new-author validation.
More same-author passages remain, and the held-out test partition remains closed during design.

## Reproduction and validation

```sh
npm run affect:highlights -- --engine jev --prompt v2 --threshold .25 --limit 48 --exclude-authors-from docs/affect-iteration-4-exclusions.json
# Plans 39 calls. Add --execute --max-requests 39, or --cache-only. Compare --prompt v1.
node --import tsx scripts/benchmark-affect-linear.ts
node --import tsx scripts/prepare-affect-review.ts data/runs/ORIGINAL_FOLLOWUP.json data/runs/ORIGINAL_NEW_COHORT.json
```

28 tests and typecheck pass. No new dependencies, importer changes or UI changes.
