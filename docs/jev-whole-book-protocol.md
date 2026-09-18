# Whole-book mention evaluation protocol

Frozen before inspecting held-out results, 19 September 2026 (Pacific/Auckland).

- Data: the existing BookCoref-derived Pride and Prejudice mention edition, all 406 passages and 38 registry characters (15,428 passage–character pairs).
- Reference: positive if at least one gold mention span overlaps the target passage. These are reference/mention labels, not physical-presence labels, scene labels, or quotation-speaker labels.
- Candidate: `explicit-mentions`, neighboring context enabled, title/author metadata omitted, threshold 0.5. Keep the existing batches of up to eight characters and existing character inventory/aliases. No prompt, threshold, or preprocessing changes during evaluation.
- Comparator: existing literal-name matching with unambiguous aliases and overlapping-name handling.
- Report development (332 passages), held-out (74 passages), and whole-book metrics separately. The whole-book aggregate includes prompt-development examples and is not an independent validation score.
- This is the project's held-out chapter split within one known novel, not the official untouched BookCoref benchmark. A full-book registry was already available during development, and pretrained knowledge of the novel cannot be ruled out.
- Record actual returned model identities; flag a mixed-model run. The existing model request alias and cache identity remain unchanged to reuse matching cached results.
- Metrics: micro precision, recall, F1 and confusion counts; supported-character macro F1; Brier score. Overall accuracy is not the primary measure because negative pairs dominate.
- Request ceiling: 1,660 development requests plus 370 test requests. Reuse exact-match cached responses. Count only new requests when estimating incremental token cost at the user-supplied $42/billion input tokens and free output.
- No further prompt tuning on the held-out results. Any later use of these results for tuning must be described as such and requires a fresh independent evaluation set.
