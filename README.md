# Read with JEV

A research prototype for reading whole novels alongside two emotion layers and a character
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

**NRC underlines** (off by default). Word-level associations from the NRC Emotion Lexicon, a fixed
dictionary. It marks single words whatever the context, negation or speaker.

**JEV highlights** (always on where the server has credentials). JEV scores each nearby sentence for
all eight emotions as you scroll. Sentences at or above the current threshold get a coloured
background; hovering one names the emotions. These are whole-sentence association suggestions —
not extracted evidence spans, not character attributions, and not intensity.

**The "How emotional is JEV" dial** moves the display threshold between 1.00 and 0.20, with the
published default of 0.60 at its midpoint. It re-ranks scores the browser already has: moving it
never issues a new model request, and a position on it is not a calibration claim.

Colour is never the only carrier of meaning — underline versus background separates the two layers,
and the eight emotion circles can be toggled independently. Full-book spoilers throughout.

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
viewport as you scroll.** Without a key the reader still runs; the emotion controls say so and NRC
underlines remain available. No key ever reaches the browser.

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

`netlify.toml` runs `npm run build:netlify`, prepares the checksum-locked library, and bundles its
JSON in the native `library` function. Next is configured for standalone output with prepared-data
tracing. Character preparation stays offline; the optional emotion endpoint performs bounded
on-demand classification and needs prepared NRC data plus server credentials. A hosted worker queue
and durable cache are later work. See [the hosting guide](docs/document-library.md).

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
