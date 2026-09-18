# Read with JEV

A Next.js / TypeScript research prototype for a novel reader with a character minimap. The first book is **Pride and Prejudice**.

The reader currently displays **human annotations**, not model predictions:

- **Mentioned:** BookCoref Gold, 38 character identities, 16,419 mention spans, 406 passages.
- **Speaking:** PDNC, 74 registry entries, 1,270 quotations / 1,708 subquotation spans, 319 passages.

Select characters to highlight passages, click the minimap to navigate, or use previous/next match. The two datasets retain their own editions and offsets. This is a full-book research view with spoilers.

The UI uses **Tailwind CSS v4 and the supplied Catalyst kit** in `src/catalyst/typescript`: sidebar, field/label, select, checkbox, and button components. Its three-column layout follows the supplied reading-instrument reference, with chapter-coverage sparklines on the left and a full-book activity rail on the right. The curve is a five-passage average of annotated matches, not emotional tone or model confidence. On mobile, channels collapse behind a button while the narrow book rail remains visible. The bundled Catalyst demo is excluded from the application typecheck and Tailwind scan.

## Start locally

Requires Node.js 22+ and GitHub CLI (`gh`). GitHub downloads use `gh`; Hugging Face downloads use Node fetch.

```sh
npm ci
npm run data:fetch
npm run data:prepare
npm run dev
```

Open http://127.0.0.1:3000. Downloads are pinned to exact revisions, checksummed, and kept in ignored `data/raw/`. Preparation verifies sources and writes `data/processed/`. No Python is required.

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

The cap bounds SDK calls, not dollar cost; retries are disabled. Review the dry run and current account pricing before executing. The default model is `jev-latest`; set `TYPESAFE_MODEL` to a pinned model if your account provides one. Exact responses and returned model identifiers are retained. No live JEV calls have been made as part of initial setup.

Results go to `data/runs/`; validated responses go to `data/cache/`. `--cache-only` prohibits network inference. `--split test` uses the project's held-out chapters; prompt development must stay on `dev`. `--threshold` defaults to 0.5. Failure never becomes a negative label, and a partial run never produces a completed evaluation report.

## Checks and production build

```sh
npm test                  # Requires prepared datasets
npm run typecheck
npm run build
npm run start
```

With a local server running and Google Chrome installed:

```sh
npm run test:browser
```

The browser check covers selection, clearing, navigation, layer switching, mobile overflow, and invalid API inputs. It saves desktop/mobile screenshots under `/tmp`.

Next is configured for standalone output and explicitly includes both prepared JSON artifacts. Prepare the data before building on a deployment machine. This prototype has no long-running inference endpoint: book processing remains an offline job, which avoids server request timeouts. A hosted worker/job queue and durable cache are later work.

## Research status

This evaluates **passage-level character mentions and quotation speakers**, not exhaustive physical presence or full coreference-clustering quality. BookCoref's original test book is being repurposed for this project's development: these results are not an untouched BookCoref benchmark submission.

The initial 12-passage development smoke run gave the name-matching mention baseline micro F1 **0.815** and supported-character macro F1 **0.731**. These are small-sample baseline results, not JEV accuracy or held-out conclusions.

- [Current experiment plan](docs/experiment-plan.md)
- [Dataset provenance and limitations](docs/datasets.md)
- [Original MVP design and future presence layer](docs/mvp-design.md)
- [Research grounding](docs/research.md)

BookCoref annotations are described by their authors as **CC BY-NC-SA 4.0**. Keep research-data licensing separate from a future commercial reader. Dataset files are not committed or publicly deployed here. See the dataset notes for attribution and PDNC licensing status.
