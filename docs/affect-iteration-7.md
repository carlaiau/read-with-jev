# Affect experiment loop — iteration 7

19 September 2026. The frozen direct passage prompt does not retain its earlier precision when
extended to passages without annotated characters. It still filters out many NRC lexical false
flags, but the earlier selected sample was much richer in annotated emotions. This is a useful
negative result: do not turn the earlier high-precision figures into a general reader claim.

## Frozen expansion design

Keep passage-v1, `jev-1.13.0`, the three-field text-only state, and the primary threshold **.35**
from iteration 6. Secondary .25 and .75 are unchanged. There is no new tuning or prompt revision.

Exclude 181 distinct documents appearing in previous same-dataset runs with model responses.
The initial attempt to exclude every previously evaluated document left insufficient candidates
because full-development lexical baselines had already covered most character-containing
excerpts. Before any new inference, the rule was clarified to **not previously sent to JEV**;
earlier lexical evaluation is allowed. The manifest lists exact exclusion runs and hashes.

Retain the existing three-sentence segmentation and source annotation-scope checks. Among
remaining development documents, 120 fail segmentation and five fail emotion-scope checks,
leaving 947 candidates: 428 without annotated characters and 519 with them. Select 48 from each
group by SHA256(`affect-expansion-v1:` + document ID), without consulting model scores or emotion
labels for ordering. The [96-document manifest](affect-iteration-7-sample.json) was frozen before
requests and records prompt and threshold-selection hashes.

There are no exact-text duplicates within the selected sample or against earlier JEV documents.
Authors recur: 38 of 40 selected authors appeared in earlier JEV runs. This is development
expansion, not held-out-author evaluation. The test partition remains untouched. Equal stratum
sizes are a diagnostic design, so pooled metrics are not natural-prevalence estimates.

## Results at the frozen .35 threshold

Each passage has eight category decisions. Gold means any corresponding REMAN emotion annotation
in the target, including negated, hypothetical, or remembered emotion descriptions.

| Sample | Annotated categories | JEV precision | JEV recall | JEV F1 | NRC F1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 48 without annotated characters | 5 | .091 | .600 | .158 | .033 |
| 48 with annotated characters | 65 | .508 | .508 | .508 | .466 |
| Balanced 96 combined | 70 | .367 | .514 | .429 | .305 |

In the group without annotated characters, JEV matches 3/33 flags; NRC matches 2/117.
JEV flags at least one category in **17/44** passages with no annotation in the eight target
categories; NRC flags all 44. Category-level false-positive rates are 7.9% versus 30.3%.
JEV is a better filter than lexical hits here, but most of its flags still lack corpus support.

For passages with annotated characters, the primary JEV-minus-NRC F1 difference is +.042,
with an exploratory paired-author bootstrap interval [-.032,.120]. The advantage is not established
within this group. The balanced combined difference is +.124, interval [.057,.206]. The group
without annotated characters has only five positive labels; its interval [0,.272] is unstable
and includes degenerate resamples. Use the counts rather than a strong significance claim.

All intervals use 2,000 paired whole-author resamples, seed 20260919, without multiplicity
correction. Authors are resampled jointly across both strata for the combined comparison.

## Does the sparse threshold fix this?

At the previously specified .75 threshold:

| Sample | Matching flags / all flags | Precision | Recall |
| --- | ---: | ---: | ---: |
| Without annotated characters | 1 / 5 | .200 | .200 |
| With annotated characters | 15 / 17 | .882 | .231 |
| Balanced combined | 16 / 22 | .727 | .229 |

The stricter threshold reduces how often unsupported labels appear, but its precision does not
transfer uniformly. It flags three of 44 annotation-negative passages in the no-character group,
versus 17 at .35. There are too few high-score flags to estimate precision reliably. At .25,
combined F1 falls to .391 and precision to .287; no threshold is changed after these results.

## Interpretation and research decision

The annotation prevalence differs sharply: five of 384 category decisions are positive without
annotated characters, versus 65 of 384 with them. That is 1.3% versus 16.9%. Precision therefore
needs to be assessed on the intended deployment distribution, not transferred from an
affect-rich evaluation subset. This comparison is not a causal effect of removing character
information: the direct prompt already lacked it, and the two groups contain different texts.

“No annotated characters” does not mean no people appear in the story text. Likewise, an absent
emotion annotation is a benchmark negative, not independent proof that a reader would reject
that interpretation. This experiment cannot distinguish model overinterpretation from missing
or differently scoped annotations. It supplies evidence of a substantial deployment-selection
problem, not new human labels.

Keep the direct model as an experimental candidate for reviewable suggestions, not automatic
emotion badges on every passage. The next useful step is a blinded human audit of high-scoring
annotation disagreements from this low-prevalence group, paired with score-matched examples
from the character-annotated group. Reviewers should separately judge target-supported emotion
association and currently experienced emotion, and quote the evidence. Do not use the annotation
character-presence flag as a production gate: it is oracle corpus metadata and related to the
labeling process. Do not retune repeatedly on these 96 passages or open test before freezing the
intended product task. The earlier human review packet remains blank and unreviewed.

## Implementation, usage, and reproduction

Direct passage eligibility, gold construction and NRC scoring now work with an empty character
inventory. The runner accepts a frozen `--sample` manifest while preserving the previous cohort
mode. Scoring checks data/run/prompt/selection hashes, complete prediction matrices, development
membership, stratum membership, and exclusion of prior JEV documents.

96 new SDK requests, retries disabled; 129,374 input tokens and 13,440 output tokens. Every
response reports `jev-1.13.0`. Full requests and responses are cached locally; no predictions
became gold. [Full results](affect-iteration-7-results.json) include per-emotion metrics, false-flag
rates, uncertainty, usage and provenance hashes.

```sh
# Manifest is already frozen; preparation refuses to overwrite it.
node --import tsx scripts/prepare-affect-expansion.ts
node --import tsx scripts/benchmark-affect-passage.ts \
  --sample docs/affect-iteration-7-sample.json --cache-only
node --import tsx scripts/analyze-affect-expansion.ts \
  data/runs/affect-passage-expansion-1789758612027.json
```

For new inference use `--execute --max-requests 96` with the existing server-side key. No new
credentials or dependencies are required. 32 tests and typecheck pass; new tests cover empty
character inventories, target-only lexicon scoring, and annotation/offset integrity. No importer,
UI, or prompt defaults changed.
