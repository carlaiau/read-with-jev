# Read with JEV

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary audience is researchers evaluating JEV classification. They need to inspect character labels in their source context, compare predictions with human annotations, and assess whether sliding context improves classification.

## Product Purpose

Test whether a general-purpose JEV classifier can produce useful, trustworthy character maps for novels. The reader makes character distributions navigable alongside the book text, supporting inspection of the experiment rather than substituting a compelling visualization for evidence of accuracy.

The longer-term concept is a web novel reader that processes Project Gutenberg books and lets readers select characters to highlight their contributions. The MVP evaluates three annotated novels and offers a curated nine-document baseline reader. Arbitrary-book ingestion remains future work.

## Positioning

The research mechanism combines stable target passages, overlapping neighboring context, typed character-classification questions through the official TypeSafe JavaScript SDK, and a reader with independent character tracks. The hypothesis that this produces reliable narrative-presence labels remains unvalidated.

## Operating Context

- The primary annotated reader is *Pride and Prejudice*. BookCoref and PDNC supply independent annotated editions; their text offsets and character inventories must stay separate.
- Researchers switch between character mentions and quotation speakers, select one or several characters, inspect matching passages, and navigate with the whole-book minimap or previous/next passage controls.
- Shared passages retain a separate colored margin line for every selected matching character. Each selected character also has an independent minimap curve, using the same color as their channel.
- Data preparation and inference run offline through TypeScript commands. Reading and filtering do not trigger paid model requests. The Next.js reader defaults to deterministic name/alias baseline classifications across nine documents, served by a Netlify function. Local Pride and Prejudice research layers retain human annotations; JEV predictions remain offline research artifacts.
- This research view reveals the full cast and whole-book activity. It is not spoiler-safe.

## Capabilities and Constraints

- Use TypeScript, Next.js, Tailwind CSS, and the supplied licensed Catalyst components. Use the official JavaScript SDK for JEV and keep credentials and model calls server-side.
- Preserve source provenance, checksums, character identities, and evidence offsets. Keep gold annotations separate from prediction artifacts.
- Mentions, quotation speakers, and narrative presence are distinct tasks. A mention or shared passage does not establish physical co-location or a relationship between characters.
- Passage highlights indicate a passage-level match, not attribution of every sentence to the selected character. Passages are not automatically detected scenes.
- Evaluate against existing annotations before adding manual labeling. Keep development and held-out chapter splits separate; do not present development results as untouched benchmark performance.
- Record model responses and request identity for reproducibility. Missing answers or failed requests must not become negative labels.
- Dependency versions follow the exact-pin and 14-day release-age policy in AGENTS.md, including its explicitly approved SDK exception.
- Arbitrary-book ingestion, automated cast discovery, validated presence labels, relationship graphs, a public-reader spoiler policy, and commercial deployment remain future decisions or work.

## Brand Commitments

The current project name is Read with JEV. The user supplied a three-column reading-instrument reference: character channels, book text, and a whole-book map. Preserve that functional relationship and consistent character identity across those views. The supplied Catalyst kit is an implementation commitment.

## Evidence on Hand

- `data/processed/mentions.json`: BookCoref-derived human mention annotations; 38 characters, 406 passages, and 16,419 mention spans in the current prepared edition.
- `data/processed/speaking.json`: PDNC-derived human speaker annotations; 74 registry entries, 319 passages, 1,270 quotations, and 1,708 subquotation spans.
- `docs/datasets.md`: dataset provenance, edition differences, and licensing limitations. Source and annotation licensing require separate consideration for any public or commercial use.
- `docs/experiment-plan.md`: current experiment and evaluation plan. This supersedes the initial manual-presence-annotation proposal in `docs/mvp-design.md`.
- `docs/research.md`: research grounding. `src/server/jev.ts` and the benchmark scripts implement the classifier experiment.
- Live mention-classification experiments cover Pride and Prejudice, Siddhartha, and Animal Farm. `docs/jev-research-summary.md` links the protocols, whole-book and held-out results, threshold analysis, and committed metric snapshots. They do not establish general accuracy across novels or physical-presence classification.

## Product Principles

1. Make every displayed label traceable to its source text and annotation or prediction origin.
2. Preserve individual character contributions when comparing several characters together.
3. Separate measured capabilities from research hypotheses and planned features.
4. Keep evaluation reproducible across editions, prompts, context windows, and model responses.
5. Let the book remain readable while the map supports inspection and navigation.

## Open Decisions

Formal accessibility targets and researcher-specific accessibility needs have not yet been established. Numerical acceptance thresholds for classification quality and the scope of a future general-reader release remain undecided.
