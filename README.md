# readwithjev

A research prototype for reading whole novels alongside a model emotion layer and a character
minimap. Built with Next.js and TypeScript.

It is a reading instrument for inspecting model output, **not** a validated emotion map. Nothing
here is a benchmark submission, and no highlight should be read as a measurement.

**Pride and Prejudice** opens by default; 31 novels and novellas are available from the document
selector.

## What it shows

**Characters.** Passages are tagged by deterministic name and alias matching against a curated cast
per document. Select characters to highlight their passages, follow their curves in the whole-book
minimap, and step between matches. Name matching does not resolve pronouns and does not establish
physical presence: an unmarked passage does not prove a character is absent.

**JEV highlights** (always on where the server has credentials). JEV scores each sentence near the viewport for
all eight emotions as you scroll, after a 50 ms pause so a flick of the wheel starts no work. Sentences at or above the current threshold get a coloured
background; hovering one names the emotions. These are whole-sentence association suggestions —
not extracted evidence spans, not character attributions, and not intensity.

**The "How emotional is JEV" dial** moves the display threshold between 1.00 and 0.20, with the
published default of 0.60 at its midpoint. It re-ranks scores the browser already has: moving it
never issues a new model request, and a position on it is not a calibration claim.

The eight emotion circles can be toggled independently, and every highlight names its emotions in
text on hover, so colour is never the only carrier of meaning. Full-book spoilers throughout.

An NRC Emotion Lexicon underline layer used to sit alongside this. It was removed to keep the
deploy free of a build-time download of a third-party lexicon and of the licensing questions that
come with redistributing one. The research pipeline still uses NRC as a baseline comparator; see
`npm run affect:prepare`.

The UI uses Tailwind CSS v4 and the supplied Catalyst kit in `src/catalyst/typescript`. On mobile,
the characters panel and the book map collapse behind buttons. The bundled Catalyst demo is excluded
from the application typecheck and the Tailwind scan.

## Start locally

Requires Node.js 22+ and the GitHub CLI (`gh`). GitHub downloads use `gh`; Hugging Face downloads
use Node fetch. No Python is required for the reader.

```sh
npm ci
npm run library:prepare
npm run data:fetch
npm run data:prepare
npm run dev
```

Open http://127.0.0.1:3000. Downloads are pinned to exact revisions, checksummed, and kept in the
ignored `data/raw/`. Preparation verifies sources and writes `data/processed/`.

JEV highlighting needs a server-side key. Copy `.env.example` to `.env.local` and set
`TYPESAFE_API_KEY`. **The reader then requests paid emotion analysis for sentences near the
viewport as you scroll.** Without a key the reader still runs: the threshold dial is disabled and
no sentence is highlighted. No key ever reaches the browser.

Dependencies are pinned to exact versions with a committed lockfile. Use npm 11.13+ to enforce the
configured 14-day minimum release age. The only approved exception is `@typesafe-ai/sdk@0.6.0`. See
[`AGENTS.md`](AGENTS.md) for the full policy.

## The library

`library/reader-selection.json` is an explicit editorial allow-list. Collections, plays, poetry,
nonfiction and incomplete editions stay archived but are never published or sent for cast
extraction, and only one edition per work is published — a second Gutenberg edition of a title
already in the catalogue is excluded as a duplicate. `npm run library:prepare` enforces both rules
and fails on a duplicate work. Rebuilding never restores an excluded title.

To grow the catalogue, the Gutenberg top-100 import takes the first 50 English editions as a
candidate pool and publishes only explicitly selected novels, with resumable GPT-5 mini character
and alias extraction before baseline classification. See
[the import and cast-discovery guide](docs/top100-library.md).

## Checks

```sh
npm test          # requires the prepared research datasets and library
npm run typecheck
npm run build
```

The social preview image at `app/opengraph-image.png` is a real screenshot of the running reader.
Regenerate it after a visible UI change, with a local server running:

```sh
npm run og:capture
```

The same harness records a short demo video — the threshold dial moving, a highlight's emotions on
hover, and a character lighting up the book map. It drives the real app, so JEV scores sentences in
the viewport and the first run may bill for them:

```sh
npm run demo:frames   # numbered PNG frames + per-frame durations
npm run demo:video    # 1280x800 H.264 MP4, needs ffmpeg on PATH
```

Both write to `data/runs/`. `FRAME_DIR` and `DEMO_VIDEO_PATH` override the locations. ffmpeg is the
only step that needs a tool outside the project (`brew install ffmpeg`); nothing in the app, the
build or the test suite depends on it.

With a local server running and Google Chrome installed:

```sh
npm run test:browser          # selection, navigation, document switching, mobile overflow
npm run test:library:browser
READER_URL=http://127.0.0.1:3000 node --import tsx scripts/browser-emotions.ts
READER_URL=http://127.0.0.1:3000 node --import tsx scripts/browser-document-state.ts
```

The emotion check runs against mocked JEV responses, so it costs nothing. Screenshots are written
under `/tmp`.

## Deploying

`netlify.toml` runs `npm run build:netlify`, which prepares the checksum-locked library and then
builds the app. The library JSON is bundled in the native `library` function, and Next is
configured for standalone output with prepared-data tracing. The build downloads nothing from a
third party beyond the pinned, checksummed Gutenberg sources the library already uses.

Set these on the deploy:

| Variable | Needed for |
| --- | --- |
| `TYPESAFE_API_KEY` | JEV highlighting. Without it the reader loads, the dial is disabled, and no sentence is highlighted. |
| `NEXT_PUBLIC_SITE_URL` | Absolute Open Graph URLs, if the site is served from a domain other than Netlify's own `URL`. |

No research dataset and no third-party lexicon is deployed. Character preparation stays offline;
the emotion endpoint performs bounded on-demand classification.

### The shared cache

A public deploy needs `DATABASE_URL` pointing at a Neon Postgres database. Use the **pooled**
connection string — the one whose host contains `-pooler`. The reader runs as many short-lived
serverless instances, and the direct string is bounded by the compute's connection slots. Reach
for the direct string only for session-level work the pooler does not carry. Without a database
every instance is on its own: the on-disk cache in `data/cache/` is per-instance and ephemeral, so two
people reading the same chapter each pay for the same sentences and nothing survives a cold start.

```sh
npm run store:prepare                                     # idempotent DDL, safe to re-run
npm run store:warm -- --document pride-and-prejudice      # dry run, and free: see below
npm run store:warm -- --document pride-and-prejudice --execute --max-requests 500
```

Warming copies any local `data/cache/` answers into the store first. That costs nothing, so it
runs uncapped and without `--execute`; only sentences no cache can answer reach the model, and
those need an explicit `--execute --max-requests N`, matching the benchmark runner.

`readingScores` reads through in order: the in-flight promise, the local disk cache, the shared
store, and only then the model. Rows are keyed by the request digest already used for the disk
cache, which folds in the edition, display version, sentence segmentation, model and prompt — so a
prompt or edition change misses rather than silently serving a stale score. Pre-warming the
documents people actually open turns public traffic into cache hits that cost nothing.

**Concurrency is bounded globally, not per instance.** `readingRequestConcurrency` caps six
in-flight model calls per server *process*, and a platform runs many processes, so on its own it
bounds nothing. `JEV_MAX_CONCURRENT_CALLS` (default 12) is a lease held in Postgres for the life
of each call, so every instance draws from one pool; a caller that finds it full gets a `429` and
the reader retries. Leases expire after 120 seconds, comfortably past the route's own 90-second
ceiling, so an instance that dies mid-call frees its slot without cleanup.

It is a soft ceiling. The count comes from the statement's snapshot and excludes the row being
inserted, so a simultaneous burst can briefly overshoot before the losers release. That is the
right trade here: the point is to avoid hammering the provider, not to ration. Everything fails
open — an unreachable store drops each instance back to its own six-call limit rather than
stopping analysis.

For scale, the corpus is about 219,000 sentences across 31 documents (6,027 in *Pride and
Prejudice* alone), and one reader scrolling a few screens scores on the order of 100-200. Fully
warmed, the table is roughly 60-80 MB.

These rows are model predictions and are never gold. They carry their own task namespace
(`reader-sentence-emotions-v1`); benchmarks keep their own cache and run artifacts and must not
read from this table. A hosted worker queue and durable cache are later work. See
[the hosting guide](docs/document-library.md).

## Evaluation

```sh
# Name-matching baseline, 12 development passages spread across the book
npm run benchmark
npm run benchmark -- --dataset speaking

# Plan a JEV run: no API request, no credential required
npm run benchmark -- --engine jev --limit 2

# Then execute an explicit number of requests
npm run benchmark -- --engine jev --limit 2 --execute --max-requests 10
```

The cap bounds SDK calls, not dollar cost; retries are disabled. Review the dry run and current
account pricing before executing. Results go to `data/runs/`; validated responses go to
`data/cache/`. `--cache-only` prohibits network inference. `--split test` uses the held-out
chapters; prompt development must stay on `dev`. A failure never becomes a negative label, and a
partial run never produces a completed evaluation report.

Prompt and metadata conditions are selected with `--prompt` and `--book-context`; keep model,
sample, threshold and batching fixed when comparing conditions. Cross-book transfer uses the pinned
BookCoref editions of *Siddhartha* and *Animal Farm* under
[a frozen protocol](docs/jev-transfer-protocol.md).

## Research status

Start with the [research summary and committed metric snapshots](docs/jev-research-summary.md).

This project evaluates **passage-level character mentions and quotation speakers**, not exhaustive
physical presence or coreference-clustering quality. BookCoref's original test book is being
repurposed here for development, so these results are not an untouched BookCoref benchmark
submission. The initial 12-passage development smoke run gave the name-matching mention baseline a
micro F1 of **0.815** and a supported-character macro F1 of **0.731** — small-sample baseline
numbers, not JEV accuracy and not held-out conclusions.

- [Current experiment plan](docs/experiment-plan.md) · [research grounding](docs/research.md) ·
  [original MVP design](docs/mvp-design.md)
- [Dataset provenance and limitations](docs/datasets.md)
- [Transfer protocol](docs/jev-transfer-protocol.md) and [results](docs/jev-transfer-results.md)
- [Context comparison](docs/jev-context-pilot.md) and [prompt/metadata audit](docs/jev-prompt-audit.md)
- [Emotion reader setup, behaviour and validation](docs/emotion-reader.md)

### Character-affect investigation

The conditional REMAN attribution experiment is described in
[the experiment log](docs/affect-experiment-log.md), with
[exact prompts and state](docs/affect-prompts.md). It needs Python 3's standard library for the
pinned ZIP/XML adapter; evaluation and JEV calls stay in TypeScript on the official SDK.

```sh
npm run affect:prepare        # run alongside data:prepare before this suite
npm run affect:benchmark -- --engine jev --limit 8   # dry run
npm run affect:highlights
```

These are supplied-emotion, supplied-character **mention-level relation** scores, not end-to-end
emotion detection or character emotional arcs. The author-grouped test partition remains unused.
Iterations [2](docs/affect-iteration-2.md), [3](docs/affect-iteration-3.md),
[4](docs/affect-iteration-4.md), [5](docs/affect-iteration-5.md), [6](docs/affect-iteration-6.md),
[7](docs/affect-iteration-7.md), [8](docs/affect-iteration-8.md) and
[9](docs/affect-iteration-9.md) record each step, including the results that did **not** improve:
the revised highlight prompt did not beat the original, iteration 7 exposed a substantial precision
drop on passages without annotated characters, and iteration 8 showed that REMAN's character
annotations are emotion-participant annotations, which makes earlier character-filtered metrics
conditional rather than general passage accuracy.

## Data, licensing and attribution

Reader documents are prepared from Project Gutenberg editions, which are public domain in the
United States, with the exception of *Animal Farm*, which is carried over from the pinned BookCoref
source for cross-book comparison. Each document links its own source edition, and copyright status
outside the United States varies by title and jurisdiction — check before redistributing.

Research datasets are **not committed to this repository and are not publicly deployed**. BookCoref
annotations are described by their authors as **CC BY-NC-SA 4.0**; PDNC licensing status and full
attribution are recorded in [the dataset notes](docs/datasets.md). Research-data licensing is
deliberately kept separate from any future commercial reader.

Prediction artifacts are never used as gold labels, and mention, quotation-speaker and
physical-presence labels are kept distinct throughout.
