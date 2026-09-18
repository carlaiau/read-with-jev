# Three-book character-mention benchmark

19 September 2026 (Pacific/Auckland). Protocols: [Pride and Prejudice](jev-whole-book-protocol.md) · [cross-book transfer](jev-transfer-protocol.md).

## Results

| Book | Method | Precision | Recall | Micro F1 | Character macro F1 | TP | FP | FN |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Pride and Prejudice | JEV | 0.952 | 0.838 | 0.892 | 0.854 | 1907 | 96 | 368 |
| Pride and Prejudice | Name matching | 0.969 | 0.772 | 0.859 | 0.816 | 1756 | 57 | 519 |
| Siddhartha | JEV | 0.857 | 0.887 | 0.872 | 0.825 | 329 | 55 | 42 |
| Siddhartha | Name matching | 0.971 | 0.825 | 0.892 | 0.748 | 306 | 9 | 65 |
| Animal Farm | JEV | 0.946 | 0.904 | 0.925 | 0.923 | 386 | 22 | 41 |
| Animal Farm | Name matching | 0.947 | 0.916 | 0.931 | 0.939 | 391 | 22 | 36 |

Pride and Prejudice: all 406 passages × 38 identities = 15,428 judgments, with 2,275 annotated positive pairs. Siddhartha: all 133 passages × 9 identities = 1,197 judgments, with 371 annotated positive pairs. Animal Farm: all 100 passages × 20 identities = 2,000 judgments, with 427 annotated positive pairs. Both methods use identical passages, gold labels, and aliases. Every JEV response identifies jev-1.13.0, matching the prior experiment.

### Evaluation scope

Pride and Prejudice was used for prompt development, so its whole-book score includes development examples. Its separately held-out 74 passages score **0.882 JEV F1 versus 0.866 for name matching**. Siddhartha and Animal Farm were evaluated whole with that prompt and threshold frozen, without tuning on either book. Do not treat all three whole-book scores as equally independent tests. These are passage-level mention evaluations, not the official BookCoref coreference-clustering benchmark.

## What this changes

The overall JEV advantage observed on Pride and Prejudice did not transfer to these two novels at the frozen 0.5 threshold. Literal-name matching wins micro F1 on both books. This does not establish that JEV never helps: in Siddhartha, JEV has better recall and character macro F1, but its additional false positives outweigh that gain in aggregate F1. The books are small in number, and alias coverage and annotation conventions differ.

Siddhartha’s JEV false positives concentrate in Young Siddhartha (26) and The Samanas (24), accounting for 50 of 55 false positives. This suggests identity/group-reference handling needs inspection; scores alone do not establish the cause. JEV identifies 15 of 17 annotated matches for Siddhartha’s Father, for whom the literal baseline finds no matches with this fixed alias registry. The latter demonstrates a limitation of literal aliases, not an alias-independent comparison.

Animal Farm’s JEV false positives concentrate in collective identities: dogs (10), sheep (7), hens (4). The two methods have 22 false positives each overall, but JEV misses five more positives. No changes to prompt, threshold, or aliases were made after seeing these results.

## Parallel execution and usage

For Siddhartha and Animal Farm only: eight-request concurrency, after one serial validation call; 566 new API calls total. Siddhartha took 10.7 seconds and Animal Farm 22.2 seconds for the benchmark runner. These are observed wall times, not a controlled speedup measurement. Reported input usage: 1,512,613 tokens; estimated total $0.06353 using the user-supplied $42/billion input-token rate and free output.

The earlier Pride and Prejudice whole-book expansion used 1,730 new requests and 300 cache hits, with 7,049,609 input tokens (estimated $0.29608); those figures exclude its earlier exploratory runs. It ran sequentially, so the transfer-run timings are not directly comparable.

## Implementation and checks

The importer checks source hashes, agreement of released tokens, embedded gold text where available, span bounds, full text coverage, and chapter-bounded context. Existing Pride and Prejudice processed data remains byte-identical. The concurrent worker pool preserves result order, stops new scheduling on failure, and settles in-flight work before rejecting. A failed run cannot write a completed artifact; cached successes remain reusable. Twelve tests and TypeScript checks passed.

## Artifacts

- [Pride and Prejudice full evaluation](jev-whole-book-evaluation.md)
- [Pride and Prejudice combined metrics and per-character results](../data/runs/mentions-whole-book-summary.json)

- [animal-farm-mentions-baseline-all-1789736701146.json](../data/runs/animal-farm-mentions-baseline-all-1789736701146.json)
- [animal-farm-mentions-jev-all-1789736700939.json](../data/runs/animal-farm-mentions-jev-all-1789736700939.json)
- [siddhartha-mentions-baseline-all-1789736678574.json](../data/runs/siddhartha-mentions-baseline-all-1789736678574.json)
- [siddhartha-mentions-jev-all-1789736678373.json](../data/runs/siddhartha-mentions-jev-all-1789736678373.json)

Predictions remain separate from the human annotations and are not installed as reader gold. These books have now been used for evaluation: any changes guided by their errors must be described as further development, not a fresh independent test.
