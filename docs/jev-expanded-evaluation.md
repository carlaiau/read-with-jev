# Expanded mention evaluation: 60 development passages

19 September 2026 (Pacific/Auckland).

## Protocol

The fixed explicit-mentions prompt, neighboring context, no title/author metadata, threshold 0.5, and eight-character batches were evaluated on 60 deterministic development passages spanning 41 chapters. The sample contains the 12 prompt-development passages and 48 additional passages. No held-out passages were used. All responses identify jev-1.13.0. The source hash and passage IDs match the baseline.

## All 60 passages (2,280 pairs)

| Method | TP | FP | FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| JEV | 268 | 14 | 58 | 0.950 | 0.822 | 0.882 |
| Name matching | 257 | 6 | 69 | 0.977 | 0.788 | 0.873 |

## New 48 passages (1,824 pairs)

These exclude every passage in the original 12-passage prompt-development sample. They remain a development check, not a final held-out benchmark.

| Method | TP | FP | FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| JEV | 219 | 11 | 45 | 0.952 | 0.830 | 0.887 |
| Name matching | 213 | 4 | 51 | 0.982 | 0.807 | 0.886 |

## Interpretation

On the 48 new passages, micro F1 is effectively tied: 0.887 for JEV versus 0.886 for name matching. JEV gains six true positives but adds seven false positives relative to the baseline. The small overall F1 advantage does not establish superiority. Across all 60 passages, supported-character macro F1 favors the baseline (0.848 versus 0.802), so the aggregate JEV score should not conceal uneven performance across characters.

## Usage and artifacts

240 new API calls; 60 local cache hits. 968,692 input tokens, estimated $0.04069 at the user-supplied rate of $42/billion input tokens and free output.

- [JEV run](../data/runs/mentions-jev-dev-1789735451453.json)
- [Baseline run](../data/runs/mentions-baseline-dev-1789735451720.json)

## Limitations

One book, a non-random sample, and one run per condition. Familiar-book training contamination cannot be ruled out. Labels measure annotated mentions, not physical presence; annotation omissions can affect apparent errors. Success on the prompt-development passages is not independent validation. No prompt or threshold was changed during this expansion.
