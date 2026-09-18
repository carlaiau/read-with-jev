# Experiment plan: existing gold annotations first

Updated 18 September 2026. This replaces the initial proposal to manually annotate passage-level presence. We now start with BookCoref Gold and PDNC, using TypeScript throughout.

## What is implemented

The pipeline imports pinned artifacts, verifies hashes, constructs non-overlapping targets with neighboring context, derives gold labels, runs a literal-name baseline, and prepares cached JEV classification through the official JavaScript SDK. A Next reader displays the gold maps for inspection.

Two independent tasks:

| Task | Gold source | Positive target label |
| --- | --- | --- |
| Mentioned | BookCoref Gold character mention clusters | At least one annotated reference to the character overlaps the target, including pronouns and descriptions. |
| Speaking | PDNC quotation speakers | At least one annotated subquotation spoken by the character overlaps the target. |

Absence of a label means negative for this dataset's task and identity inventory. It does not prove physical absence. PDNC references inside dialogue do not supply exhaustive mention negatives in narration, so they are not used as mention gold.

## Text and splits

BookCoref targets combine released tokenized sentences; PDNC targets combine native paragraphs. Target size is approximately 350 whitespace-separated units, ending at a sentence/paragraph boundary. Long units can exceed that size; the dry run exposes actual input volume. Context adds up to 300 whitespace-separated units on each side, clipped to the chapter. Targets never cross chapters and cover each edition from beginning to end.

Chapter numbers divisible by five form the project `test` split; all other chapters are `dev`. Context never crosses the split because it cannot cross chapters. The default 12-target sample is deterministically spread over the selected split. Increase `--limit` for more coverage.

**This is a project-specific split within an originally published test novel.** We can use it for development but must not claim untouched performance on the original BookCoref test set. A later independent book is needed for cross-book validation. Within-book overlap of characters is intentional: this tests a known cast, not unseen identity discovery.

## Three comparisons

1. **A: literal-name baseline.** Names/aliases matched case-insensitively with word boundaries, period/whitespace normalization, rejection of shared aliases, and longest-match handling. For speaking this is deliberately a naive comparator, not a speaker-attribution system.
2. **B: JEV target only.** One Noul question per character, with a full identity registry but no neighboring text.
3. **C: JEV sliding context.** Identical targets and questions, with neighboring text for resolving identity or speaker attribution.

Each JEV request asks up to eight questions. Every batch sees the same full registry. Gold offsets, passage labels, and source model predictions are never included in requests. Aliases come from the external PDNC registry and explicit identity mappings, not from held-out mention spans. These are known-cast experiments: registry quality is part of the supplied input.

Run B and C on development first. Freeze prompts and thresholds before using test chapters. Model identity, request payloads, source hash, raw responses, and cache hits are recorded. Cache-only runs must fail on a missing response.

## Measurements

Implemented reporting:

- Per-character precision, recall, F1, support, TP/FP/FN.
- Micro precision/recall/F1 and counts over all evaluated pairs.
- Macro F1 over characters with positive gold support; unsupported characters remain visible with false-positive counts.
- Brier score for probabilities (baseline outputs are binary).
- Pair count, passage IDs, input character volume, wall time, and raw response usage/model metadata.

The evaluator requires the exact character × selected-passage matrix. Missing, duplicate, non-finite, out-of-range, and unexpected predictions fail evaluation instead of becoming negative labels.

Initial smoke result, **12 development mention passages / 456 pairs**, name matching only:

- Micro precision 0.957; recall 0.710; F1 0.815.
- Supported-character macro F1 0.731 across 21 supported characters.
- These establish an executable baseline, not a model conclusion. No live JEV inference has run.

For an actual comparison, expand coverage, inspect errors by chapter and character, and add paired chapter-level bootstrap intervals. Annotated aliases and pronoun spans can help characterize errors without requiring fresh gold labels. Do not tune against test errors and then reuse those same chapters as an independent test.

## Cost and execution

The default JEV command is a dry run. It prints requests, character questions, passage IDs, and input character volume. It does not pretend characters are tokens or quote an unverified price.

Executing requires credentials and an explicit request cap. Automatic retries are disabled. The cap is not a monetary budget; review account pricing and start with a small pilot. Sequential cached execution keeps partial progress reusable. Completed reports are written atomically only after every answer validates.

## Next decision

After B/C are measured, decide whether their improvement over A justifies latency/cost, particularly on pronoun-only references and speaker attribution. No numerical JEV acceptance claim is made before these runs.

If mention/speaking maps are useful, build model-prediction comparison into the reader and validate on another annotated book. Only then revisit automatic registry discovery or narrative presence. The latter still requires a separately validated target; neither coreference nor quotation annotations supplies exhaustive physical-presence gold.
