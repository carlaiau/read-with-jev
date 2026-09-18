# Saved-prediction rescore at threshold 0.80

All metrics recomputed locally from saved responses. No API calls; no prompt, model, aliases, or passage changes. A positive prediction now requires probability >= 0.80. Literal-name scores are binary and therefore unchanged.

| Book / scope | Method | Precision | Recall | F1 | TP | FP | FN |
|---|---|---:|---:|---:|---:|---:|---:|
| Pride and Prejudice — whole book | JEV at 0.50 | 0.952 | 0.838 | 0.892 | 1907 | 96 | 368 |
| Pride and Prejudice — whole book | JEV at 0.80 | 0.985 | 0.675 | 0.801 | 1535 | 24 | 740 |
| Pride and Prejudice — whole book | Name matching | 0.969 | 0.772 | 0.859 | 1756 | 57 | 519 |
| Pride and Prejudice — held-out | JEV at 0.50 | 0.950 | 0.823 | 0.882 | 339 | 18 | 73 |
| Pride and Prejudice — held-out | JEV at 0.80 | 0.986 | 0.670 | 0.798 | 276 | 4 | 136 |
| Pride and Prejudice — held-out | Name matching | 0.964 | 0.786 | 0.866 | 324 | 12 | 88 |
| Siddhartha | JEV at 0.50 | 0.857 | 0.887 | 0.872 | 329 | 55 | 42 |
| Siddhartha | JEV at 0.80 | 0.961 | 0.736 | 0.834 | 273 | 11 | 98 |
| Siddhartha | Name matching | 0.971 | 0.825 | 0.892 | 306 | 9 | 65 |
| Animal Farm | JEV at 0.50 | 0.946 | 0.904 | 0.925 | 386 | 22 | 41 |
| Animal Farm | JEV at 0.80 | 0.967 | 0.836 | 0.897 | 357 | 12 | 70 |
| Animal Farm | Name matching | 0.947 | 0.916 | 0.931 | 391 | 22 | 36 |

## Interpretation

Raising the threshold trades recall for precision; it does not make the underlying classifier more accurate by definition. This is a post-evaluation sensitivity analysis requested after the original held-out and transfer results were inspected. If it guides threshold selection, a fresh independent evaluation is needed before claiming that selection generalizes. The original 0.50 run artifacts and benchmark default remain unchanged.

[Detailed metrics, per-character results, and source artifacts](../data/runs/threshold-080-comparison.json)
