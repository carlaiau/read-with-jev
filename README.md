# Read with JEV

A Next.js / TypeScript research prototype for a novel reader with a character minimap. The library supports multiple documents, with **Pride and Prejudice** selected initially.

The reader defaults to **deterministic name/alias baseline classifications** across the prepared library. A document selector loads one book at a time from a Netlify function. See [the library and hosting guide](docs/document-library.md).

Research datasets and the research API for *Pride and Prejudice* retain **human annotations**:

- **Mentioned:** BookCoref Gold, 38 character identities, 16,419 mention spans, 406 passages.
- **Speaking:** PDNC, 74 registry entries, 1,270 quotations / 1,708 subquotation spans, 319 passages.

Select characters to highlight passages, click the minimap to navigate, or use previous/next match. The two datasets retain their own editions and offsets. This is a full-book research view with spoilers.

The UI uses **Tailwind CSS v4 and the supplied Catalyst kit** in `src/catalyst/typescript`: sidebar, field/label, select, checkbox, and button components. Its three-column layout follows the supplied reading-instrument reference, with chapter-coverage sparklines on the left and a full-book activity rail on the right. The curve is a five-passage average of passage matches, not emotional tone or model confidence. On mobile, characters collapse behind a button while the narrow book rail remains visible. The bundled Catalyst demo is excluded from the application typecheck and Tailwind scan.

## Start locally

Requires Node.js 22+ and GitHub CLI (`gh`). GitHub downloads use `gh`; Hugging Face downloads use Node fetch.

Dependencies use exact versions and a committed lockfile. Use npm 11.13+ to enforce the configured 14-day minimum release age when resolving updates. The only approved age exception is `@typesafe-ai/sdk@0.6.0`; retain its locked version. See `AGENTS.md` for the dependency policy.

```sh
npm ci
npm run library:prepare
npm run data:fetch
npm run data:prepare
npm run dev
```

Open http://127.0.0.1:3000. Downloads are pinned to exact revisions, checksummed, and kept in ignored `data/raw/`. Preparation verifies sources and writes `data/processed/`. No Python is required.

## Expand the library

The Gutenberg top-100 import currently selects the first 50 English editions, with resumable GPT-5 mini character and alias extraction before baseline classification. See [the import and cast-discovery guide](docs/top100-library.md) for commands, source checks, and model provenance.

## Evaluate

```sh
# Name-matching baseline, 12 development passages spread across the book
npm run benchmark
npm run benchmark -- --dataset speaking

# Plan a JEV run: no API request, no credential required
npm run benchmark -- --engine jev --limit 2

# Compare target-only inputs with sliding context
npm run benchmark -- --engine jev --context none --limit 2
```

JEV uses the official **@typesafe-ai/sdk** from `src/server/jev.ts`. It is only used by the Node CLI; no API key enters the browser and the reader cannot trigger paid calls.

To run inference, create `.env.local` from `.env.example` and set `TYPESAFE_API_KEY` locally. Then explicitly execute the planned number of requests:

```sh
npm run benchmark -- --engine jev --limit 2 --execute --max-requests 10
```

The cap bounds SDK calls, not dollar cost; retries are disabled. Review the dry run and current account pricing before executing. The default model is `jev-latest`; set `TYPESAFE_MODEL` to a pinned model if your account provides one. Exact responses and returned model identifiers are retained. Live development pilots are recorded in [the context comparison](docs/jev-context-pilot.md) and [the prompt/metadata audit](docs/jev-prompt-audit.md).

Results go to `data/runs/`; validated responses go to `data/cache/`. `--cache-only` prohibits network inference. `--split test` uses the project's held-out chapters; prompt development must stay on `dev`. `--threshold` defaults to 0.5. Failure never becomes a negative label, and a partial run never produces a completed evaluation report.

## Controlled prompt experiments

The original prompt remains the default. To plan the revised mention prompt with title/author context:

```sh
npm run benchmark -- --engine jev --limit 12 --prompt explicit-mentions --book-context
```

Add `--execute --max-requests 60` to execute this 12-passage mention run. Omit `--book-context` to isolate metadata effects; `--context none` removes neighboring text. The metadata option currently supports the verified *Pride and Prejudice* / Jane Austen pairing only. Keep model, sample, threshold, and batching fixed when comparing conditions. Run artifacts record the selected prompt and metadata; request content separates cache entries.

## Checks and production build

```sh
npm test                  # Requires prepared research datasets and library
npm run typecheck
npm run build
npm run start
```

With a local server running and Google Chrome installed:

```sh
npm run test:browser
npm run test:library:browser
```

The browser check covers selection, clearing, navigation, document switching, mobile overflow, and invalid API inputs. It saves desktop/mobile screenshots under `/tmp`.

For Netlify, the committed `netlify.toml` runs `npm run build:netlify`, prepares the checksum-locked library, and bundles its JSON in the native `library` function. The reader shows character matches without a layer selector. No inference credentials are needed. Next is also configured for standalone output with prepared-data tracing. See [the hosting guide](docs/document-library.md). This prototype has no long-running inference endpoint: book processing remains an offline job, which avoids server request timeouts. A hosted worker/job queue and durable cache are later work.

## Research status

[Research summary, experiment reports, and committed metric snapshots](docs/jev-research-summary.md).

This evaluates **passage-level character mentions and quotation speakers**, not exhaustive physical presence or full coreference-clustering quality. BookCoref's original test book is being repurposed for this project's development: these results are not an untouched BookCoref benchmark submission.

The initial 12-passage development smoke run gave the name-matching mention baseline micro F1 **0.815** and supported-character macro F1 **0.731**. These are small-sample baseline results, not JEV accuracy or held-out conclusions.

- [Current experiment plan](docs/experiment-plan.md)
- [Dataset provenance and limitations](docs/datasets.md)
- [Original MVP design and future presence layer](docs/mvp-design.md)
- [Research grounding](docs/research.md)
- [Proposed character-affect and plot-unit investigation](docs/affect-investigation.md)

BookCoref annotations are described by their authors as **CC BY-NC-SA 4.0**. Keep research-data licensing separate from a future commercial reader. Dataset files are not committed or publicly deployed here. See the dataset notes for attribution and PDNC licensing status.


## Cross-book transfer evaluation

`npm run data:prepare` also imports the pinned BookCoref gold editions of *Siddhartha* and *Animal Farm*, checking matching released token arrays, gold span bounds, chapter boundaries, and full text coverage. They remain benchmark inputs. The reader also offers separate baseline library documents; Gutenberg editions can differ from the benchmark editions and passage counts.

```sh
npm run benchmark -- --book siddhartha --split all --limit 1000 --engine jev --prompt explicit-mentions --concurrency 8 --execute --max-requests 266
npm run benchmark -- --book animal-farm --split all --limit 1000 --engine jev --prompt explicit-mentions --concurrency 8 --execute --max-requests 300
```

For the comparator, use `--engine baseline` and omit `--execute --max-requests ...`. The runner defaults to eight concurrent calls (configurable 1–32), validates its first call before pooling, preserves result ordering, and stops scheduling after a failure. In-flight calls settle before failure is reported; valid responses remain cached. Automatic retries are disabled. Book-specific source hashes and output filenames isolate experiments.

See [the frozen transfer protocol](docs/jev-transfer-protocol.md) and [results](docs/jev-transfer-results.md). Both methods use the same fixed registry aliases, without extracting aliases from gold mention spans.
