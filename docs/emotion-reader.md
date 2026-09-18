# NRC and JEV reader comparison

The sidebar, above the document selector, contains independent NRC-underlining and JEV-background toggles, with all eight
emotions enabled initially: anger, anticipation, disgust, fear, joy, sadness, surprise and trust.
Colours are shared across both layers; text and the underline/background distinction carry meaning
without relying on colour alone. Filled circles are enabled; hollow circles are hidden. Hover or
keyboard focus reveals each name. Shared NRC words have segmented coloured underlines; shared
JEV sentences have bands for every enabled suggested emotion. Opacity is fixed: these scores
represent association confidence, not emotional intensity. Hiding every emotion hides both layers;
the independent JEV switch controls inference. The library character tracks remain name/alias baselines; the separate research editions retain human annotations.

NRC marks dictionary-associated words. JEV marks whole sentences at the fixed experimental .75
threshold, using the direct passage-v1 question and jev-1.13.0. These are emotion-association
suggestions, including recalled, hypothetical or negated descriptions. They are not character
attributions, extracted evidence phrases, or measurements of intensity. A lack of highlighting
does not establish a lack of emotion. The earlier research found that precision varies greatly
with the sampled text; this feature is for comparison and inspection, not a validated emotion map.

## On-demand inference

When JEV is enabled, an IntersectionObserver watches sentences within 160 pixels of the viewport.
A 50ms scheduling delay avoids starting work on every fleeting scroll event. Only sentences
still nearby when a slot becomes available are scheduled. The client and server each permit at
most six simultaneous requests. Hidden tabs stop scheduling. Disabling JEV or changing editions
stops scheduling and aborts pending browser requests. Up to six SDK requests already executing
on the server can finish and populate cache; browser cancellation does not cancel that remote work.

One SDK request scores all eight emotions for a sentence. Changing visible emotions does not
make another request. Client results persist while toggling layers; server disk cache survives
reloads. Keys incorporate the source edition/text, display format, ICU version, lexicon, model,
question and context. Identical concurrent server requests share a promise. Failures are not
negative predictions; a visible Retry analysis action retries only nearby failures. There are no
automatic retries or whole-book model prefetches.

Large metadata responses use revision-pinned JSON parts, and browser metadata omits server-only adjacent context and duplicate plan text. The metadata GET supports the selected catalog document via `layer=document:<id>` (and the independent `mentions`/`speaking` research editions). It reads local book/lexicon data and creates deterministic sentence plans. The
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

## Sentence segmentation

Boundary detection uses an offset-preserving copy of the displayed text: single line breaks are
masked as spaces, and common honorifics (Mr., Mrs., Dr., etc.) and name initials are protected.
Blank lines retain paragraph/dialogue boundaries. Highlight ranges and model targets slice the
original display text, preserving whitespace, Unicode, and emphasis offsets. The segmentation
version is included in the source fingerprint, so old fragment predictions cannot be reused.

The reported “delighted with it … Mr. Morris” example now remains inside its complete sentence.
The Pride and Prejudice library edition has 6,027 units rather than the previous 17,253 fragments.
These are rule-based English boundaries, not a perfect linguistic parser: unusual abbreviations
remain ambiguous, and units do not cross existing reading-passage or chapter boundaries. JEV
still highlights the supplied whole unit; it does not return evidence phrases or word offsets.

## Inspection

The sentence inspector stays in the reading column, including when the mobile sidebar is closed. Click or keyboard-activate a marked sentence to inspect the enabled categories, NRC words, and
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
  the six-request bound, retry, emotion reuse, pause, layer toggles, keyboard inspection, feedback,
  edition switching, desktop/mobile layouts and invalid API requests. Screenshots from that test
  illustrate UI states, not model results.
- `scripts/browser-smoke.ts` preserves checks for existing character tracks and map navigation.
- A single real SDK smoke call on the first reader sentence returned valid eight-category scores
  and wrote the separate reader cache. No research test-partition evaluation was performed.

Completed validation: all 37 unit tests, both browser suites, TypeScript and the production
webpack build pass. The bounded visual review confirmed the existing reader identity; its one
keyboard-focus finding was fixed and verified. Desktop/mobile captures used mock model scores;
the separate real SDK/API smoke test verified live inference and cached delivery.
