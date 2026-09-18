# Affect experiment loop — iteration 9: GPT-5.6 judge

19 September 2026. Add a blinded automated second opinion to the 40-case review packet from
iteration 8. These are model judgments, not human review or replacement gold labels.

## Model and protocol

The existing `OPENAI_API_KEY` in the main checkout's `.env` can access `gpt-5.6-sol`.
OpenAI's [model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
identifies GPT-5.6 Sol as the target of the `gpt-5.6` alias. This run explicitly requests
`gpt-5.6-sol`, medium reasoning, with at most 3,000 output tokens per case. Actual returned
model names and token usage are recorded in the results.

Use the [Responses API structured-output format](https://developers.openai.com/api/docs/guides/structured-outputs)
with a strict JSON schema, `store:false`, no tools, and no conversation history between cases.
The client uses Node's built-in fetch, with no new dependencies. Calls remain in a server/CLI
module, the key stays in the environment, and logs do not include credentials. No automatic
retries; at most two requests run concurrently. One pilot case verifies the response format,
then its cached result is reused in the full 40-case run.

The user explicitly authorized transmitting these 40 passage/context/category inputs to OpenAI
after automatic approval review requested payload-specific confirmation. Scores and corpus labels
are not included in the model input.

Each call contains only the target, its preceding/following context, and one emotion category.
It reuses the human packet's interpretation instructions and asks for:

- emotion association: yes / no / unclear;
- currently experienced at the target scene time: yes / no / unclear;
- asserted / negated / hypothetical / remembered / mixed / unclear status;
- an exact target quote, required for a positive association;
- a short evidence-based explanation.

The judge does not see JEV scores, corpus emotion labels, character annotations, source IDs,
matching/group membership, or another reviewer's answer. Code selects an explicit allowlist of
input fields. Model outputs must pass local validation: complete response, valid enums, exact
nonempty target quote for positive associations, and no current-experience yes with association
no/unclear. Invalid outputs stop execution instead of being silently scored as negatives.

The human forms remain blank. Responses and judgments are saved to separate ignored cache/run
files with packet/request/code hashes. Joining to the analyst key happens only in the analysis
script after judgments have been generated. Corpus labels are unchanged.

## How to interpret the comparison

The 40 cases comprise 12 pairs matched approximately on category and score across annotation
strata, plus eight lower-score cases per stratum. They are not representative of natural passage
prevalence. Several cases share a passage, and the judge itself can overinterpret language.

Agreement with REMAN or JEV is descriptive, not an accuracy estimate. Unclear judgments remain
explicit and are excluded only from agreement denominators that are labeled as decisive.
A GPT disagreement identifies a case worth human inspection; it does not establish annotation
error. Shared instructions and possible correlated model errors limit independence. This is one
judge pass, not a reliability or inter-rater study.

## Reproduction

```sh
# Dry-run plan; does not load a key or transmit text.
node --import tsx scripts/judge-affect-review.ts
# Use the existing environment for explicitly authorized API execution.
node --env-file=/Users/caiau/school/read-with-jev/.env --import tsx \
  scripts/judge-affect-review.ts --execute --limit 40 --max-requests 40
# Or reuse cached outputs without new calls.
node --import tsx scripts/judge-affect-review.ts --cache-only
node --import tsx scripts/analyze-affect-judge.ts data/runs/FULL_JUDGE_RUN.json
```

34 tests and typecheck pass. New tests check blinded serialization, target-only evidence,
verdict consistency, incomplete outputs, and refusals. No dependency or importer changes.

## Completed results

All 40 cases returned schema-valid judgments and passed exact-target quote checks. Across all
cases, GPT judged association yes on 11, no on 25, and unclear on four. On the 36 decisive cases,
it agreed with REMAN on 27 (75.0%) and JEV at .35 on 25 (69.4%). These are agreements on this
selected packet, not judge accuracy or general JEV precision.

| Cases | GPT yes | GPT no | GPT unclear |
| --- | ---: | ---: | ---: |
| 24 JEV flags | 10 | 10 | 4 |
| 16 below-threshold cases | 1 | 15 | 0 |
| 20 without annotated characters | 6 | 13 | 1 |
| 20 with annotated characters | 5 | 12 | 3 |

Seven GPT yes judgments have no matching REMAN category annotation; two REMAN-positive cases
receive a GPT no and two receive unclear. The judge does not uniformly vindicate JEV or the
corpus. Of eleven association-yes cases, only six are judged currently experienced; four are no
and one unclear. This distinction may matter for reader features, but it is not validated gold.

One instructive failure candidate is item-15: the judge calls “As I expected” **negated surprise**.
That conflicts with the guideline principle against manufacturing an emotion from an opposite
state; it is at least a rubric-boundary disagreement requiring review. The current shared review
instructions did not explicitly restate that REMAN rule. Another case interprets guessing an
unspoken disclosure as anticipation. These examples show why exact evidence quotes verify
text grounding but do not guarantee semantic correctness.

Do not silently repair these responses or rerun until they agree with corpus labels. Preserve
this frozen pass. A later rubric revision should explicitly separate a mentioned/negated emotion
from an inferred absence of its opposite, and should be evaluated as a new judge version. Human
review remains needed to decide ambiguous cases and validate the proposed product definition.

The run used 40 new API requests in total (one pilot plus 39 uncached requests in the full run),
16,917 input tokens and 5,975 output tokens, including 3,116 reasoning tokens. All returned models
were `gpt-5.6-sol`. Human packet hashes are unchanged. The [sanitized results](affect-iteration-9-results.json)
record contingency counts and usage; full judgments, exact quotes and explanations remain in
`data/runs/affect-openai-judge-40-1789759768240.json`, a separate local prediction artifact.
