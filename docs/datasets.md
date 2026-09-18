# Dataset provenance

## Pinned inputs

The importer is `scripts/fetch-data.ts`. It records every original URL and SHA-256 in `data/raw/manifest.json` and uses GitHub CLI for GitHub access.

| Artifact | Pinned revision |
| --- | --- |
| [PDNC](https://github.com/Priya22/project-dialogism-novel-corpus) — PrideAndPrejudice novel_text.txt, character_info.csv, quotation_info.csv | `6fda0a78bda5e9da0854f7befb5dab268abefb7e` |
| [BookCoref Gold](https://huggingface.co/datasets/sapienzanlp/bookcoref) — bookcoref_annotations/full/test.jsonl | `2c2587aca956a4225712abdcf1af72b93f18a28f` |
| [BookCoref evaluation artifacts](https://github.com/sapienzanlp/bookcoref) — predictions/off_the_shelf/maverick_xl.jsonl and booknlp.jsonl | `9283951b92978f97ae6cd60eeefe79bd3a7cb34c` |

### BookCoref

The official gold file has character mention token indices but omits Pride and Prejudice text. The authors' Hugging Face loader reconstructs it using Python tokenization and a correction delta. We avoid recreating that tokenizer in JavaScript by extracting the **sentences only** from the authors' released evaluation artifacts.

The importer requires both released sentence arrays to match exactly. It obtains **all labels exclusively from the official gold test file**, discarding the prediction artifacts' `clusters` and `characters`. All gold token spans must fall within the resulting 142,742-token text. The gold character layer contains 38 identities and 16,419 spans.

This validates matching released inputs and bounded offsets, not every annotation's semantic correctness. The release's token count differs from the paper table; the actual pinned artifact and its checksum define our reproducible input. Example opening references were inspected against the text.

Gold token ends are inclusive. Conversion maps them into half-open JavaScript UTF-16 text offsets. The reader displays the tokenized edition, so punctuation spacing can differ from a typeset novel.

### PDNC

The pinned book has 74 registry entries and 1,270 quotations split into 1,708 subquotations. Every speaker resolves to a registry name. The importer parses Python-style literals as data using a restricted parser; it never uses eval or executes downloaded code.

Despite the field name `quoteByteSpans`, the importer verifies possible UTF-8, code-point, and UTF-16 conventions against every subquotation. This particular text is ASCII, so those conventions coincide. Four spans have extra leading/trailing whitespace. Only edge whitespace is trimmed; each correction is recorded in the processed provenance. Any substantive text mismatch fails preparation.

The registry contains aliases and apparent duplicate identities that need care. We retain source IDs for the speaking task rather than silently merging gold identities. For BookCoref's classifier registry, an explicit name crosswalk imports corresponding PDNC aliases. The ambiguous bare `Bennet` alias and `Lady Lucas` assigned to Charlotte Lucas are excluded there. Other source ambiguities remain a limitation of the known-cast experiment.

## Editions and offsets

The two books are **not offset-aligned**. Each task has its own text, passage manifest, registry, and evidence. Switching layers changes edition and resets reading position. No code transfers raw offsets between editions.

Prepared JSON includes the manifest, transformation notes, UTF-16 evidence offsets, chapter-bounded context, and gold passage labels. Targets receive a label when an evidence span overlaps them. Windows do not claim every word concerns a highlighted character.

## Attribution and reuse

- BookCoref: Giuliano Martinelli, Tommaso Bonomo, Pere-Lluís Huguet Cabot, and Roberto Navigli. 2025. [BOOKCOREF: Coreference Resolution at Book Scale](https://aclanthology.org/2025.acl-long.1197/).
- PDNC: Krishnapriya Vishnubhotla, Adam Hammond, and Graeme Hirst. 2022. [The Project Dialogism Novel Corpus](https://aclanthology.org/2022.lrec-1.628/).
- Underlying novel: Jane Austen, *Pride and Prejudice*, Project Gutenberg ID 1342; these artifacts retain the editions used by their annotators.

The BookCoref authors' README/license prose specifies **CC BY-NC-SA 4.0**, although some badges/metadata differ. This research prototype does not assume commercial reuse permission. The pinned PDNC repository root has no standalone license file; its reuse terms should be clarified before redistributing its annotations publicly. Raw and derived datasets are ignored by Git and have only been used locally here.


## Additional BookCoref novels

`scripts/prepare-books.ts` imports *Siddhartha* (`siddhartha_2500`) and *Animal Farm* (`animal_farm_0`) from the same pinned downloads. Both released input token arrays must match; Animal Farm's embedded gold text must also match. Predictions from those artifacts are never used as labels. Gold inclusive token endpoints are converted to half-open UTF-16 offsets, retaining all source text.

Siddhartha uses its 12 named chapter headings; Animal Farm uses its 10 numbered chapter headings. Sentence units spanning a heading are split before passage construction. Existing target length and chapter-bounded context rules apply. BookCoref includes group identities (for example, Samanas and dogs), which are evaluated as provided, not reinterpreted as individual people.

Prepared outputs: `data/processed/siddhartha.json` (133 passages, 9 identities, 4,933 evidence spans) and `data/processed/animal-farm.json` (100 passages, 20 identities, 1,705 evidence spans). Fixed aliases are recorded in the importer and are shared by JEV and the baseline. The P&P-specific PDNC alias crosswalk is not reused for other books. Both new novels are used whole for frozen-prompt transfer evaluation.
