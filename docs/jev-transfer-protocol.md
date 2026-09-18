# Frozen transfer protocol: Siddhartha and Animal Farm

Before inference: reuse the Pride and Prejudice explicit-mentions prompt, threshold 0.5, target passages of approximately 350 whitespace-delimited tokens, 300-token neighboring context inside chapters, and up to eight character questions per request. No book title/author metadata. Model alias remains jev-latest; verify returned model identity against jev-1.13.0. No tuning on either book.

Gold labels come exclusively from the pinned official BookCoref character mention spans. Sentence arrays from both released prediction artifacts must agree; their predicted labels are ignored. Animal Farm's embedded gold sentence array is checked too. All input checksums and span bounds are verified.

Each complete novel is an external-book transfer evaluation for this project's prompt, not the official coreference-clustering task or a claim of unseen model-training data. Siddhartha: 133 passages, 9 identities. Animal Farm: 100 passages, 20 identities. Existing per-chapter split fields are ignored for these whole-book evaluations.

Both methods receive the same registry and fixed aliases in scripts/prepare-books.ts, defined before inference and without mining gold mention spans. Alias coverage differs from Pride and Prejudice's PDNC-derived aliases; report within-book comparisons rather than attributing all cross-book differences to model quality. Generic group aliases such as dogs, hens, sheep, and Samanas are intentionally retained as potentially ambiguous names for both methods. Siddhartha and Young Siddhartha remain distinct identities; no gold-driven disambiguation is applied to the literal baseline.

Concurrency is eight with a serial first-request check. No automatic retries. A failure stops new scheduling, waits for in-flight calls, retains valid caches, and prevents a completed-run artifact. At most seven other calls can already be in flight when a pooled call fails. Request caps: 266 for Siddhartha and 300 for Animal Farm.
