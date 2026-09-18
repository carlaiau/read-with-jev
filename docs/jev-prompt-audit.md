# Mention prompt and book-metadata audit

19 September 2026 (Pacific/Auckland). Development-only experiment.

## Integration audit

Inspected the SDK implementation: systemOne forwards the request state/questions to JSON, and noul preserves instructions and optional criteria. Saved responses contain the low probabilities reported by the evaluator. Source inspection confirms that missed targets include explicit names (Mr. Bennet and Mr. Bingley in p30; Lydia and Catherine in p66). This did not reveal a serialization defect; it does not prove all preprocessing or annotation assumptions correct.

The new prompt refers to exact state field names, supplies character aliases in each question, and defines mention-positive and mention-negative criteria. These changes are one combined prompt revision; this experiment does not isolate their individual effects. The revised prompt remains opt-in.

Official reference: [TypeSafe Noul](https://docs.typesafe.ai/primitives/noul) documents optional true/false criteria and the interpretation of noul as a yes-probability.

## Paired experiment

All conditions use the same 12 development passages, 456 pairs, 62 gold positives, threshold 0.5, and batches of up to eight questions. JEV conditions here include the same neighboring text. All returned models are jev-1.13.0; the requested alias was jev-latest. Metadata consists only of the verified title Pride and Prejudice and author Jane Austen.

| Condition | TP | FP | FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Literal-name baseline | 44 | 2 | 18 | 0.957 | 0.710 | 0.815 |
| Original prompt, no metadata | 28 | 0 | 34 | 1.000 | 0.452 | 0.622 |
| Original prompt + title/author | 25 | 0 | 37 | 1.000 | 0.403 | 0.575 |
| Explicit mention prompt + title/author | 46 | 2 | 16 | 0.958 | 0.742 | 0.836 |
| Explicit mention prompt, no metadata | 49 | 3 | 13 | 0.942 | 0.790 | 0.860 |

The revised prompt without metadata scores highest on this sample. Adding title and author did not improve either prompt in these single runs. That is not evidence that book metadata is universally harmful: the sample is small, familiar-book prior knowledge is a possible confound, and repeated-run variability has not been measured. No threshold tuning or held-out evaluation occurred.

## Remaining errors in the highest-scoring condition

- Miss: p30, Charles Bingley, score 0.29.
- Miss: p66, Mrs Bennet, score 0.26.
- False positive: p66, Mary Bennet, score 0.94.
- Miss: p100, Jane Bennet, score 0.33.
- False positive: p100, Lydia Bennet, score 0.53.
- Miss: p133, Mr Bennet, score 0.43.
- Miss: p133, Mrs Bennet, score 0.22.
- Miss: p133, Elizabeth Bennet, score 0.3.
- Miss: p133, Charlotte Lucas, score 0.07.
- Miss: p133, Mary Bennet, score 0.18.
- False positive: p198, Georgiana Darcy, score 0.53.
- Miss: p269, Georgiana Darcy, score 0.28.
- Miss: p269, Mrs. Reynolds, score 0.26.
- Miss: p337, Mr Gardiner, score 0.32.
- Miss: p337, Mrs Gardiner, score 0.3.
- Miss: p373, Mrs Bennet, score 0.28.

## Usage

Across all saved live mention pilots so far: 300 new API calls, 1,038,575 reported input tokens, estimated $0.04362. Reused local cache responses are excluded. This estimate uses the user-supplied rate of $42 per billion input tokens and free output; it is not a billing statement.

## Next step

Treat the revised prompt as a candidate, not a validated winner. Audit its false positives against source evidence and evaluate the fixed variants on a larger, disjoint development sample before freezing a configuration for the held-out split. Preserve both metadata conditions until repeatability is assessed. The gold reader remains unchanged.

## Reproduction

Use `npm run benchmark -- --engine jev --limit 12 --prompt explicit-mentions --execute --max-requests 60`. Add `--book-context` for title and author. For offline replay, use `--cache-only` instead of `--execute --max-requests 60` with the same model and options.

- [mentions-baseline-dev-1789734710243.json](../data/runs/mentions-baseline-dev-1789734710243.json)
- [mentions-jev-dev-1789734692528.json](../data/runs/mentions-jev-dev-1789734692528.json)
- [mentions-jev-dev-1789735071381.json](../data/runs/mentions-jev-dev-1789735071381.json)
- [mentions-jev-dev-1789735110792.json](../data/runs/mentions-jev-dev-1789735110792.json)
- [mentions-jev-dev-1789735143922.json](../data/runs/mentions-jev-dev-1789735143922.json)
