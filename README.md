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

JEV uses the official **@typesafe-ai/sdk** from `src/server/jev.ts`. The CLI and server-side reader API use it; no API key enters the browser. When enabled, the reader requests paid emotion analysis for nearby sentences.

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

For Netlify, the committed `netlify.toml` runs `npm run build:netlify`, prepares the checksum-locked library, and bundles its JSON in the native `library` function. The reader shows character matches without a layer selector. No inference credentials are needed. Next is also configured for standalone output with prepared-data tracing. See [the hosting guide](docs/document-library.md). Character preparation remains offline; the optional emotion endpoint performs bounded on-demand classification and requires prepared NRC data and server credentials. A hosted worker/job queue and durable cache are later work.

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

## Affect experiment worktree

The conditional REMAN attribution experiment and first measured results are described in
[the experiment log](docs/affect-experiment-log.md). This branch requires Python 3's standard
library for the pinned ZIP/XML adapter; evaluation and JEV calls use TypeScript and the official SDK.
No new package dependencies are needed.

```sh
npm run affect:prepare
npm run affect:benchmark -- --engine nearest --limit 2000
npm run affect:benchmark -- --engine nrc-nearest --limit 2000
npm run affect:benchmark -- --engine jev --limit 8  # dry run
npm test
npm run typecheck
```

Run `affect:prepare` as well as `data:prepare` before this branch's test suite.
JEV execution requires a local server-side `TYPESAFE_API_KEY` and
`--execute --max-requests 10` for the eight-excerpt pilot. `--cache-only` replays without inference.
These are supplied-emotion/supplied-character **mention-level relation** scores, not end-to-end
emotion detection or character emotional arcs. The author-grouped test partition remains unused.

The current affect default is `--prompt v2`: explicit span IDs plus exact text and surrounding
context in state. Use `--prompt v1` for the original offsets-only comparison or `--prompt v3`
for the compact marker ablation. [Exact prompts and state](docs/affect-prompts.md) and
[iteration 2 results](docs/affect-iteration-2.md) document the experiment.
Pin `--model jev-1.13.0` when reproducing iteration 2. The new dry run may have a different
request payload/cache identity from the original pilot even when the sample IDs match.

The next [passage-highlight experiment](docs/affect-iteration-3.md) uses `npm run affect:highlights`
to predict eight emotion associations per supplied character, without supplied emotion spans.
It is a separate, harder task with development-only evaluation and a frozen-threshold follow-up.

[Iteration 4](docs/affect-iteration-4.md) compares guideline-informed definitions with the original
highlight prompt, adds a supervised lexical baseline, and prepares a blinded human-review packet.
The revised highlight prompt did not improve F1; the original remains the default.

[Iteration 5](docs/affect-iteration-5.md) projects cached predictions onto passage-level emotion
categories, separating category detection from exact-mention attribution and reporting both
linked and all-annotation gold definitions. No new model calls or test-partition evaluation.

[Iteration 6](docs/affect-iteration-6.md) tests direct passage-emotion questions without character
annotations in state, with frozen development thresholds and matched accuracy/token comparisons.

[Iteration 7](docs/affect-iteration-7.md) evaluates the frozen direct prompt on 96 new-to-JEV
passages, including those without annotated characters, exposing a substantial precision drop
in that low-annotation-prevalence group. No threshold retuning or test-partition evaluation.

[Iteration 8](docs/affect-iteration-8.md) confirms from REMAN's guidelines that character annotations
are emotion-participant annotations, quantifies their selection effect, and prepares two independent
blinded review forms. Earlier character-filtered metrics are conditional, not general passage accuracy.

[Iteration 9](docs/affect-iteration-9.md) uses GPT-5.6 Sol as a blinded automated judge on the
40-case diagnostic packet. Judgments, evidence quotes and agreement counts are separate model
artifacts, not new gold; the pass also exposes a judge rubric mismatch around negated emotions.

## Live emotion comparison in the reader

Toggle **NRC underlines** and **JEV highlights**, use the eight coloured circles to toggle emotions independently. JEV analyses
nearby sentences as you scroll, with cached results and at most two concurrent requests. Click a
marked sentence to inspect it or record local feedback. Backgrounds are sentence-level suggestions,
not extracted evidence spans or character emotions. [Setup, behaviour and validation](docs/emotion-reader.md).
