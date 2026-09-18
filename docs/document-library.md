# Baseline document library

The reader loads a catalog, then fetches one selected document. Classification happens during preparation; viewing books never invokes JEV or needs an API key. This library is separate from the gold datasets and frozen research results.

## Included documents

| Document ID | Title | Source | Passages |
| --- | --- | --- | ---: |
| `pride-and-prejudice` | Pride and Prejudice | Gutenberg 1342 | 324 |
| `siddhartha` | Siddhartha | Gutenberg 2500 | 100 |
| `animal-farm` | Animal Farm | Pinned BookCoref text | 100 |
| `moby-dick` | Moby-Dick | Gutenberg 2701 | 553 |
| `frankenstein` | Frankenstein | Gutenberg 84 | 191 |
| `alice-in-wonderland` | Alice’s Adventures in Wonderland | Gutenberg 11 | 75 |
| `crime-and-punishment` | Crime and Punishment | Gutenberg 2554 | 485 |
| `sherlock-holmes` | The Adventures of Sherlock Holmes | Gutenberg 1661 | 263 |
| `romeo-and-juliet` | Romeo and Juliet | Gutenberg 1513 | 85 |

These are edition-specific reading passages, not detected scenes. The selected cast registries are editable and not exhaustive. Matching uses the existing baseline's case-insensitive, word-boundary name/alias search. It does not resolve pronouns, determine speakers, or establish physical presence. Ambiguous aliases and descriptors can produce false matches. No new accuracy claim is made for the six added titles.

## Data contract

`src/lib/library-model.ts` defines the contract. A catalog has `schema: 1` and a `documents` array with stable `documentId`, title, author, year, counts, classification metadata, source link, and a content revision hash.

Each document contains:

- `documentId`, title, author, year, and `textFormat`.
- Normalized `text` and ordered `sections` with titles and half-open UTF-16 offsets.
- `characters`: stable identities, display names, and explicit aliases.
- `passages`: text offsets, section number (`chapter`), context offsets, and matched character IDs in `labels`.
- `classification`: baseline method/version, registry hash, and coverage limitations.
- `provenance`: source URL/checksum, normalized-text checksum, transformation and rights notes.

`evidence` is empty: baseline passage labels are not gold evidence spans. For compatibility with the research reader, `id: "mentions"` denotes the task; use **`documentId`** to identify a book. Legacy passage `split` values are not a validation claim for these new editions. Benchmark commands continue using their separate prepared gold datasets.

## Netlify and local development

```sh
npm ci
npm run library:prepare
npm run dev
```

The client uses these endpoints:

```text
GET /.netlify/functions/library
GET /.netlify/functions/library?document=moby-dick
```

The first returns the catalog; the second returns a complete document. HEAD and ETag revalidation are supported. Malformed requests return 400, unknown document IDs return 404, and missing prepared data returns 503. Only allowlisted catalog documents can be read. No credentials or raw gold annotation files are returned.

`netlify/functions/library.ts` is the native Netlify handler. For `next dev` and local Next production builds, a rewrite forwards the same URL to `/api/library`; both use `src/server/library.ts`.

Connect this repository to Netlify using the committed `netlify.toml`: it runs `npm run build:netlify`, publishes the Next build, and includes `data/library/*.json` in the function bundle. Library preparation needs outbound access to the source hosts at build time, but requests need only the bundled files. No Netlify deployment has been performed as part of this implementation.

Every current document is below 1.4 MB as JSON. Preparation rejects documents at 5.5 MB; larger future works should use chunked passage endpoints or object storage rather than enlarging this response indefinitely. All catalog files are bundled together, so reconsider bundle size as the collection grows.

## Sources and adding documents

`library/documents.json` owns metadata and cast aliases. `library/sources.lock.json` pins raw-source URL/checksum pairs. Ignored `data/library-sources/` holds downloaded source text; ignored `data/library/` holds generated responses. Ordinary preparation verifies source checksums and fails if an upstream edition changes.

To add a document, add its unique ID, source, metadata, and reviewed cast to the registry, then add and verify its body anchor and section-heading rules in `src/lib/library-prepare.ts`. Update expected section-count checks and ingestion tests. This is curated ingestion, not an arbitrary-upload endpoint.

After reviewing a new or changed source, run `npm run library:prepare -- --update-source-lock`. This uses cached source files if present; to deliberately download a changed edition, remove only that document's cached source first. Review the resulting checksum changes before committing them. Regenerate and verify:

```sh
npm run library:prepare
npm run data:prepare
npm test
npm run typecheck
npm run build:netlify
# With the reader running and Chrome installed:
npm run test:library:browser
```

Research checks also require `npm run data:fetch` on a fresh checkout. `npm run test:browser` covers character selection and mouse/keyboard navigation. The reader has no layer selector; gold datasets remain available to the research API and benchmark commands.

Gutenberg documents retain their source and terms links. Animal Farm uses only released token text from the checksum-pinned BookCoref file, never its labels. Its BookCoref research license and underlying-text rights remain distinct from the Gutenberg editions; see [dataset provenance](datasets.md) before any public distribution. The catalog and each response carry source attribution.
