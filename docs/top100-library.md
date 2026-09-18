# English top-100 import and cast discovery

The source is a dated snapshot of Project Gutenberg’s **last 30 days** list, not yesterday’s list. `library/top100.json` retains rank, ID, listing, download count, fetch time, and page checksum. Editions remain separate by Gutenberg ID. `library/top100-import.json` records metadata from each text header, raw-source checksums, language exclusions, and import status. Only entries whose declared language is English enter cast extraction. Excluded entries do not get replaced by a different ranking list.

The current snapshot contains 97 English editions and three excluded French/German editions. The active import is capped at the **first 50 English editions**, in ranking order, by `library/import-settings.json`. Extraction, status, and publication share this selection. Cached work outside the selection is retained but is not published. The existing curated collection is retained, including three books outside this selection, giving 53 reader documents when all 50 casts are ready. Publication years are left unknown for imported editions: Gutenberg’s digital release date is not the original publication year.

## Pipeline

Completed run: all 50 selected English editions have validated registries from `gpt-5-mini-2025-08-07`, containing 4,807 edition-specific character records. Publication contains 53 reader documents, with no selected editions pending. These counts include separate editions and collections; they are not counts of unique literary works or unique people across the library. The original curated casts remain in use for their six overlapping editions.

```sh
# Download/cache sources and record the requested ranking. Refresh is explicit.
npm run library:import-top100 -- --refresh-list
# Subsequent imports use the saved ranking.
npm run library:import-top100

# Server-side OpenAI structured extraction; resumable via content-addressed caches.
npm run library:extract-casts -- --execute --concurrency=6
# Check durable progress without API calls:
npm run library:status
# One book, or cache-only verification (omit --execute):
npm run library:extract-casts -- --book=11

# Validate all selected English casts and add the new editions to the library manifest.
npm run library:publish-top100
# If a run is blocked, publish only validated casts and record pending IDs:
# npm run library:publish-top100 -- --ready-only
npm run library:prepare
```

`OPENAI_API_KEY` lives only in `.env`/`.env.local` and is used by the offline extraction CLI. The reader and Netlify function never invoke OpenAI. The implementation calls the official Responses REST endpoint from TypeScript; it adds no npm dependency. JEV remains separate and continues using its official SDK.

Default model: `gpt-5-mini-2025-08-07` (medium reasoning); override with `OPENAI_CAST_MODEL` before a fresh extraction. Results pin the actual returned model and prompt version. A registry with a mismatched source/model/version fails rather than being silently reused. Explicitly archive/remove that registry to regenerate it; cached raw responses remain available.

The request uses strict JSON Schema with character name, short identifying description, story/play scope, and aliases. Every body segment is submitted, in bounded chunks; multi-chunk works get an identity-consolidation pass. Consolidation assigns a representative identity to every input record using schema-required keys. Code forms identity groups and unions their original aliases, so no candidate record can disappear and no new alias can be invented. Earlier successful consolidation responses used explicit groups validated for exact record coverage; failed responses are repaired with the required-key format. Earlier GPT-4.1 mini pilot registries were archived outside the published collection when the user selected the original GPT-5 mini. Model-specific cache keys keep those responses separate.

`library/casts/<Gutenberg ID>.json` stores the registry with source checksum and half-open UTF-16 offsets for each accepted alias in the exact downloaded source. The adjacent audit JSON stores chunk ranges, cached-request hashes, token usage, and rejected aliases. Raw API responses are cached under ignored `data/cache/`; keys include the entire request and prompt version. Credentials are never cached. Refusal, incomplete output, API failure, malformed output, or failed consolidation is an error, not an empty cast. Six workers process independent books; each book’s chunks run sequentially. There are no automatic network retries. Credit/quota or authentication errors stop new requests; in-flight responses may finish and are cached. Consolidation target indices and complete key coverage are validated before a registry is accepted. Re-running uses completed responses and registries.

## What validation establishes

An accepted alias occurs in that source edition. This does **not** prove the model assigned it to the correct identity or discovered every character. Casts are machine-generated metadata, not gold labels. A `no-characters` result is recorded separately from failure. Nonfiction, poetry, very large collections, unnamed characters, generic titles, and identities repeated across stories need particular review. Wikidata’s [characters property](https://www.wikidata.org/wiki/Property:P674) can supplement review, but is not treated as an edition-specific complete alias registry.

Existing curated books retain their cast IDs and verified section boundaries; their newly extracted registries are saved for comparison. New editions use automatic reading sections at paragraph boundaries, not inferred narrative scenes or verified chapters. Front matter inside the Gutenberg body may remain in these uncurated editions. The baseline still applies literal name/alias matching and rejects aliases shared by multiple identities; it does not resolve pronouns or establish physical presence. Story scope is metadata, not a validated span boundary, so shared generic aliases can be missed rather than reliably disambiguated.

## Delivery

Generated document JSON is built before deployment. The catalog’s optional `importStatus` records the English target count, completed count, excluded count, and pending Gutenberg IDs. `--ready-only` publication includes only validated registries; it never inserts empty placeholder casts for unfinished books. A normal request returns a whole document below 4.5 MB. Larger books return a `json-parts` manifest; the client fetches numbered pieces with the manifest’s revision and reassembles the JSON. Each piece is bounded; a deployment change returns 409 instead of mixing editions. Source text, labels, and offsets remain a single logical document. This avoids the single-function response budget; all book files still count toward the deployment bundle size.

Official references: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini), [Gutenberg metadata](https://www.gutenberg.org/help/bibliographic_record.html).
