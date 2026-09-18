# JEV character-mention research

## Current conclusion

At the fixed 0.50 threshold, JEV improves on the literal-name baseline for Pride and Prejudice, but that advantage does not transfer consistently to Siddhartha and Animal Farm. Raising the threshold to 0.80 improves precision but reduces F1 on all three books. These are passage-level character-reference evaluations, not physical-presence classification or official coreference-clustering benchmark scores.

| Book / scope | JEV F1 (0.50) | Name-matching F1 | JEV F1 (0.80) |
|---|---:|---:|---:|
| Pride and Prejudice, whole book | 0.892 | 0.859 | 0.801 |
| Pride and Prejudice, held-out chapters | 0.882 | 0.866 | 0.798 |
| Siddhartha, whole book | 0.872 | 0.892 | 0.834 |
| Animal Farm, whole book | 0.925 | 0.931 | 0.897 |

Pride and Prejudice was used for development; its 74 held-out passages were evaluated after freezing the prompt. Both other books used that frozen prompt without tuning. The 0.80 rescore is a post-evaluation sensitivity analysis, not a newly independent test.

## Research record

1. [Initial context experiment](jev-context-pilot.md)
2. [Prompt and title/author metadata experiment](jev-prompt-audit.md)
3. [Expanded 60-passage check](jev-expanded-evaluation.md)
4. [Whole-book protocol](jev-whole-book-protocol.md) and [results](jev-whole-book-evaluation.md)
5. [Cross-book protocol](jev-transfer-protocol.md) and [three-book comparison](jev-transfer-results.md)
6. [Local 0.80 threshold rescore](jev-threshold-080.md)
7. [Dataset provenance](datasets.md)

## Saved artifacts

The repository includes [run metric snapshots](../research/results/run-metrics.json), [whole-book/per-character metrics](../research/results/mentions-whole-book-summary.json), and [both thresholds with per-character metrics](../research/results/threshold-080-comparison.json). These preserve results without committing novel text, gold spans, API responses, or credentials.

Full reproducibility artifacts remain local and Git-ignored in the research worktree: `data/raw`, `data/processed`, `data/cache`, and `data/runs`. Detailed reports link these local run files; a fresh clone has the committed metric snapshots but not those files. Re-fetch/prepare data and either restore the local cache or explicitly authorize inference to reproduce predictions. `.env` is never committed.

The reader still displays human annotations. Research predictions have not replaced its gold labels. Further tuning against evaluated books requires a fresh independent evaluation to support generalization claims.
