# NRC and JEV reader comparison

The existing reader now has independent NRC-underlining and JEV-background toggles, with one
selected emotion at a time: anger, anticipation, disgust, fear, joy, sadness, surprise and trust.
Colours are shared across both layers; text and the underline/background distinction carry meaning
without relying on colour alone. Existing character tracks remain human annotations.

NRC marks dictionary-associated words. JEV marks whole sentences at the fixed experimental .75
threshold, using the direct passage-v1 question and jev-1.13.0. These are emotion-association
suggestions, including recalled, hypothetical or negated descriptions. They are not character
attributions, extracted evidence phrases, or measurements of intensity. A lack of highlighting
does not establish a lack of emotion. The earlier research found that precision varies greatly
with the sampled text; this feature is for comparison and inspection, not a validated emotion map.

## On-demand inference

When JEV is enabled, an IntersectionObserver watches sentences within 160 pixels of the viewport.
A 180ms scheduling delay avoids starting work on every fleeting scroll event. Only sentences
still nearby when a slot becomes available are scheduled. The client and server each permit at
most two simultaneous requests. Hidden tabs stop scheduling. Disabling JEV or changing editions
stops scheduling and aborts pending browser requests. Up to two SDK requests already executing
on the server can finish and populate cache; browser cancellation does not cancel that remote work.

One SDK request scores all eight emotions for a sentence. Changing the selected emotion does not
make another request. Client results persist while toggling layers; server disk cache survives
reloads. Keys incorporate the source edition/text, display format, ICU version, lexicon, model,
question and context. Identical concurrent server requests share a promise. Failures are not
negative predictions; a visible Retry analysis action retries only nearby failures. There are no
automatic retries or whole-book model prefetches.

The metadata GET reads local book/lexicon data and creates deterministic sentence plans. The
POST accepts only a known edition, its source fingerprint and a sentence ID; text is reconstructed
on the server. Invalid editions, stale versions, unknown sentences, malformed/oversized bodies and
cross-origin browser requests are rejected. This is a local research app, not an authenticated
public inference service. JEV credentials and SDK calls stay server-side.

## Text and provenance

BookCoref's display detokenization and Gutenberg emphasis are preserved. Sentence and underline
ranges refer to the exact displayed text, not the original annotation coordinates. Original source
text and gold offsets are never modified. Sentence contexts stay within chapter boundaries; the
server supplies sentence boundaries to the client, avoiding browser/server segmentation mismatch.
Live reader outputs use their own cache namespace and are not benchmark gold or held-out scores.

## Inspection

Click or keyboard-activate a marked sentence to inspect the selected category, NRC words, and
JEV sentence-level status. Focus moves into the inspector and returns to the sentence on Close
or Escape. Suggested sentences offer Supported, Wrong emotion, Wrong span, and Unclear feedback.
These choices are saved only in this browser's localStorage, keyed by edition/text, sentence and
emotion, with model/threshold metadata. They are not automatically exported or promoted to gold.

## Local use

Prepare book data as usual and run `npm run affect:prepare` once if the NRC data is absent.
For this sibling worktree, load the existing key without copying it into the worktree:

```sh
node --env-file=/Users/caiau/school/read-with-jev/.env \
  node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3101
```

Webpack mode accommodates the shared node_modules symlink in this worktree. With no key, NRC
still works and the UI explains that JEV is unavailable. The server should be restarted if local
prepared data changes, because edition metadata is memoized for that process.

## Validation

- Unit tests cover displayed-text reconstruction, emphasis, offsets, chapter boundaries,
  lexicon associations, complete eight-category scores, and annotation-free requests.
- `scripts/browser-emotions.ts` uses explicit mocked JEV responses to exercise viewport scheduling,
  the two-request bound, retry, emotion reuse, pause, layer toggles, keyboard inspection, feedback,
  edition switching, desktop/mobile layouts and invalid API requests. Screenshots from that test
  illustrate UI states, not model results.
- `scripts/browser-smoke.ts` preserves checks for existing character tracks and map navigation.
- A single real SDK smoke call on the first reader sentence returned valid eight-category scores
  and wrote the separate reader cache. No research test-partition evaluation was performed.

Completed validation: all 37 unit tests, both browser suites, TypeScript and the production
webpack build pass. The bounded visual review confirmed the existing reader identity; its one
keyboard-focus finding was fixed and verified. Desktop/mobile captures used mock model scores;
the separate real SDK/API smoke test verified live inference and cached delivery.
