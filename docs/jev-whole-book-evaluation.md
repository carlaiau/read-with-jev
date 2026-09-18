# Whole-book character-mention benchmark

19 September 2026 (Pacific/Auckland). See [the frozen protocol](jev-whole-book-protocol.md).

## What the benchmark measures

Reference labels come from BookCoref human mention spans for Pride and Prejudice. A passage/character pair is positive if an annotated mention overlaps the passage, including names, pronouns and descriptions. These labels do not establish physical presence, co-location, scene boundaries or who is speaking. The comparator is literal-name matching using the existing aliases.

The evaluated JEV configuration is explicit-mentions with neighboring context, without title/author metadata, at threshold 0.5. Every passage is evaluated against all 38 registry characters in batches of up to eight. Prompt and threshold were frozen before the held-out run.

## Held-out chapters: 74 passages, 2,812 pairs

| Method | TP | FP | FN | Precision | Recall | Micro F1 | Character macro F1 | Brier |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| JEV | 339 | 18 | 73 | 0.950 | 0.823 | 0.882 | 0.845 | 0.0252 |
| Name matching | 324 | 12 | 88 | 0.964 | 0.786 | 0.866 | 0.848 | 0.0356 |

## Development: 332 passages, 12,616 pairs

| Method | TP | FP | FN | Precision | Recall | Micro F1 | Character macro F1 | Brier |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| JEV | 1568 | 78 | 295 | 0.953 | 0.842 | 0.894 | 0.849 | 0.0246 |
| Name matching | 1432 | 45 | 431 | 0.970 | 0.769 | 0.857 | 0.802 | 0.0377 |

## Whole book: 406 passages, 15,428 pairs

| Method | TP | FP | FN | Precision | Recall | Micro F1 | Character macro F1 | Brier |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| JEV | 1907 | 96 | 368 | 0.952 | 0.838 | 0.892 | 0.854 | 0.0247 |
| Name matching | 1756 | 57 | 519 | 0.969 | 0.772 | 0.859 | 0.816 | 0.0373 |

## Interpretation limits

The held-out chapter split is independent of direct prompt development, but comes from the same familiar novel and uses a full-book character registry. It is not the untouched official BookCoref benchmark. Whole-book numbers include passages used for prompt development. Annotation coverage and identity decisions can affect false-positive and false-negative counts. These single runs do not measure repeatability or prove an advantage across books.

Micro F1 weights all judgments together. Character macro F1 averages F1 across characters with positive support in that split. Brier measures probability error (lower is better). Accuracy is omitted as a headline metric because absent-character pairs dominate.

## Models, usage and artifacts

Returned model identities: jev-1.13.0.
1730 new requests and 300 local cache hits. New calls reported 7,049,609 input tokens, estimated $0.29608 at the user-supplied rate of $42/billion input tokens and free output. This is an estimate, not a billing statement.

- [mentions-jev-dev-1789736028401.json](../data/runs/mentions-jev-dev-1789736028401.json)
- [mentions-jev-test-1789736143251.json](../data/runs/mentions-jev-test-1789736143251.json)
- [mentions-baseline-dev-1789736028740.json](../data/runs/mentions-baseline-dev-1789736028740.json)
- [mentions-baseline-test-1789736143531.json](../data/runs/mentions-baseline-test-1789736143531.json)
- [Combined metrics and per-character results](../data/runs/mentions-whole-book-summary.json)

The reader continues to show gold labels; these predictions remain separate local research artifacts. Do not tune against these held-out results and continue to call them independent evaluation.
