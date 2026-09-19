# The JEV reader layer

The sidebar sits under the document selector and contains the "How emotional is JEV" dial and all
eight emotions enabled initially: anger, anticipation, disgust, fear, joy, sadness, surprise and
trust. Filled circles are enabled; hollow circles are hidden. Hover or keyboard focus reveals each
name. A JEV sentence carries bands for every enabled suggested emotion, and hovering it shows
those emotion names as colour-banded chips, so colour is never the only carrier of meaning.
Opacity is fixed: these scores represent association confidence, not emotional intensity. Hiding
every emotion hides the layer. The library character tracks remain name/alias baselines; the
separate research editions retain human annotations.

An NRC Emotion Lexicon underline layer previously ran alongside JEV in this reader. It was removed
so the deploy needs no build-time download of a third-party lexicon and raises no redistribution
question. NRC remains a baseline comparator in the research pipeline via `npm run affect:prepare`.

**JEV highlighting is not a user switch.** It is on wherever the server has credentials, and off
with an explanatory status line where it does not. JEV marks whole sentences using the direct
passage-v1 question and jev-1.13.0.

The display threshold is the one thing the reader controls. The "How emotional is JEV" dial runs
from 1.00 (strictest) to 0.20 (loosest) in steps of 0.05-equivalent stops, with the published
default of `readingThreshold` = 0.60 at its midpoint, and a reset action back to that default. It
re-ranks scores already in the browser cache: moving it issues no model request, changes no
sentence score, and asserts nothing about calibration.

These are emotion-association suggestions, including recalled, hypothetical or negated
descriptions. They are not character attributions, extracted evidence phrases, or measurements of
intensity. A lack of highlighting does not establish a lack of emotion. The earlier research found
that precision varies greatly with the sampled text; this feature is for comparison and inspection,
not a validated emotion map.

## On-demand inference

Where JEV is available, an IntersectionObserver watches sentences within 160 pixels of the viewport.
A 50ms scheduling delay avoids starting work on every fleeting scroll event. Only sentences
still nearby when a slot becomes available are scheduled. The client and server each permit at
most six simultaneous requests. Hidden tabs stop scheduling. Changing editions stops scheduling and
aborts pending browser requests. Up to six SDK requests already executing
on the server can finish and populate cache; browser cancellation does not cancel that remote work.

One SDK request scores all eight emotions for a sentence. Changing the visible emotions or the
threshold dial does not make another request. Client results persist across those changes; server disk cache survives
reloads. Keys incorporate the source edition/text, display format, ICU version, model, question
and context. Dropping the lexicon advanced the display version, so fingerprints from before that
change no longer match and their cached sentence scores are not reused.

With `DATABASE_URL` set, the same key also addresses a shared Neon table, read after the local
disk cache and before the model, so one reader's scored sentence is free for the next. A second
table leases model slots: `readingRequestConcurrency` bounds one process, and the lease bounds
every instance at once, which the per-process counter cannot do. Everything fails open — an
unreachable store drops each instance back to its own limit rather than stopping analysis. Those
rows are predictions in their own `reader-sentence-emotions-v1` namespace; benchmarks keep
separate caches and run artifacts and never read from the table. Identical concurrent server requests share a promise. Failures are not
negative predictions; a visible Retry analysis action retries only nearby failures. There are no
automatic retries or whole-book model prefetches.

Large metadata responses use revision-pinned JSON parts, and browser metadata omits server-only adjacent context and duplicate plan text. The metadata GET supports the selected catalog document via `layer=document:<id>` (and the independent `mentions`/`speaking` research editions). It reads the local prepared document and creates deterministic sentence plans. The
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

## Reading a highlight

Marked sentences are **not** clickable and there is no sentence inspector. Hovering a highlighted
sentence, or moving keyboard focus onto it, reveals the emotion names as colour-banded chips: one
background per suggested emotion, in that emotion's colour, and nothing else. Only the currently
visible emotions appear. The per-sentence feedback capture that previously wrote verdicts to
`localStorage` has been removed along with the inspector; no reader verdicts are recorded.

## Local use

Prepare book data as usual. The reader needs no affect data: the metadata GET builds sentence
plans from the prepared document alone.
For this sibling worktree, load the existing key without copying it into the worktree:

```sh
node --env-file=/Users/caiau/school/read-with-jev/.env \
  node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3101
```

Webpack mode accommodates the shared node_modules symlink in this worktree. With no key, the threshold dial is
disabled and no sentence is highlighted; the reader shows no separate status line for this. The server should be restarted if local
prepared data changes, because edition metadata is memoized for that process.

## Validation

- Unit tests cover displayed-text reconstruction, emphasis, offsets, chapter boundaries, the
  threshold dial, complete eight-category scores, and annotation-free requests.
- `scripts/browser-emotions.ts` uses explicit mocked JEV responses to exercise viewport scheduling,
  the six-request bound, retry, emotion reuse, the threshold dial and its score reuse, the
  highlight hover guidance, keyboard focus on a marked sentence, the absence of any click
  inspector or layer switch, edition switching, desktop/mobile layouts and invalid API requests. Screenshots from that test
  illustrate UI states, not model results.
- `scripts/browser-smoke.ts` preserves checks for existing character tracks and map navigation.
- A single real SDK smoke call on the first reader sentence returned valid eight-category scores
  and wrote the separate reader cache. No research test-partition evaluation was performed.

Completed validation: all 37 unit tests, both browser suites, TypeScript and the production
webpack build pass. The bounded visual review confirmed the existing reader identity; its one
keyboard-focus finding was fixed and verified. Desktop/mobile captures used mock model scores;
the separate real SDK/API smoke test verified live inference and cached delivery.
