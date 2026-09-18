# JEV mention pilot: context comparison

Run date: 19 September 2026 (Pacific/Auckland).

## Protocol

Paired evaluation of 12 deterministically sampled development passages, 38 characters and 456 character–passage pairs, containing 62 positive gold labels across 21 supported characters. All three conditions use identical passage IDs and source hashes. Threshold remains 0.5. Model responses identify `jev-1.13.0` (requested `jev-latest`). The held-out split was not used.

Two JEV conditions had a cap of 60 requests each. The context run reused 10 pilot responses and made 50 new calls; target-only made 60 new calls. Total new calls: 110. Requests were cached; no dollar cost is inferred from request counts.

## Results

| Condition | TP | FP | FN | Precision | Recall | Micro F1 | Supported-character macro F1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| JEV with neighboring context | 28 | 0 | 34 | 1.000 | 0.452 | 0.622 | 0.516 |
| JEV target only | 22 | 1 | 40 | 0.957 | 0.355 | 0.518 | 0.397 |
| Literal-name baseline | 44 | 2 | 18 | 0.957 | 0.710 | 0.815 | 0.731 |

## Interpretation

Neighboring context improves micro F1 by 0.105 on this development sample, but both JEV conditions underperform literal-name matching. Context-aware JEV detects 28 of 62 gold matches and misses 34, with no false positives at the current threshold. The perfect two-passage pilot did not generalize to this broader sample.

This evaluates mentions, including annotated pronouns and descriptions, not physical presence or quotation attribution. The sample is small, non-random, and drawn from one book; it does not establish general accuracy or statistical significance.

## Missed-label examples

These spans are drawn from gold evidence overlapping the target; they are inspection aids, not a diagnosis of the model’s reasoning.

- p30, Mr Bennet: score 0.12; annotated spans: "my", "Mr. Bennet".
- p30, Charles Bingley: score 0.12; annotated spans: "Mr. Bingley".
- p30, Elizabeth Bennet: score 0.36; annotated spans: "Her", "Elizabeth:--", "My dearest".
- p66, Mr Bennet: score 0.22; annotated spans: "sir", "my", "I".
- p66, Mrs Bennet: score 0.13; annotated spans: "their mother", "her", "she".
- p66, Lydia Bennet: score 0.11; annotated spans: "Lydia".
- p66, Catherine Bennet: score 0.07; annotated spans: "Catherine".
- p100, Mr. Darcy: score 0.26; annotated spans: "Mr. Darcy", "he", "Mr. Darcy".

## Next experiment

Audit missed labels against source context and alias mappings before changing the classifier. In particular, check explicit-name misses versus pronoun/description misses and verify the request’s target/context semantics. Then test one controlled prompt or input change on development passages. Keep threshold tuning separate from prompt experiments, and freeze choices before held-out evaluation. Do not replace the gold reader with these predictions yet.

## Artifacts

- [mentions-jev-dev-1789734692528.json](../data/runs/mentions-jev-dev-1789734692528.json)
- [mentions-jev-dev-1789734710016.json](../data/runs/mentions-jev-dev-1789734710016.json)
- [mentions-baseline-dev-1789734710243.json](../data/runs/mentions-baseline-dev-1789734710243.json)

Run JSON and cached responses are local, Git-ignored research artifacts; retain them for reproducibility.
