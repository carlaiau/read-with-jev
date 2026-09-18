# Investigating character affect and plot units

19 September 2026. Original research proposal. The first conditional attribution pilot is now implemented; see [experiment log](affect-experiment-log.md) for measured results and its narrower scope. “NEV” in the request is provisionally interpreted as this project's JEV classifier.

## Recommendation

Make character-conditioned affect the next research experiment. Keep character identification as supporting infrastructure. Use lexical emotion scoring as a baseline, then test whether JEV improves attribution and contextual interpretation. Evaluate causal plot structure separately after affect classification works.

The strongest hypothesis is: given the same character candidates and text, contextual classification can better distinguish who feels an emotion, what it concerns, and what causes it. Success must be measured against human annotations, not agreement with a lexicon or a visually plausible smoothed curve.

## What the proposed layers measure

| Layer | Example question | Important distinction |
| --- | --- | --- |
| Lexical affect | How much sadness-associated vocabulary occurs? | Word association is not experienced sadness. |
| Experienced emotion | Does this passage portray Alice experiencing sadness? | Separate experiencer, target, and stimulus; allow multiple emotions. |
| Character-relative outcome | Does this event benefit or harm Alice's interests? | An adverse event need not establish a felt emotion. |
| Goal/mental state | Does Alice form or pursue a goal here? | A mental state is not a fallback label for neutral text. |
| Plot relation | Does this event motivate that goal or fulfill it? | Temporal adjacency does not establish causation. |

Constructed diagnostic example: “Alice rejoiced at Bob's dismissal. Bob had not yet heard.” Alice's joy is supported. Bob's emotional reaction is unknown, even if the dismissal is judged adverse for him. A passage-wide score cannot express those distinctions.

## Verified research grounding

- [Lehnert (1981), Plot Units and Narrative Summarization](https://onlinelibrary.wiley.com/doi/abs/10.1207/s15516709cog0504_1): plot units organize narrative structure into connected conceptual patterns for summarization. A character emotion timeline alone is not a plot-unit representation.
- [Goyal, Riloff, and Daumé (2010), AESOP](https://aclanthology.org/D10-1008.pdf): the pipeline recognizes affect states, identifies characters, projects states onto characters, and creates links. Mental states include plans/goals; patient-polarity verbs capture desirable or undesirable consequences. Evaluation used 34 selected two-character fables, so results do not establish novel-scale performance.
- [NRC EmoLex](https://saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm): the standard English word-level resource provides binary associations with eight emotions and positive/negative sentiment. These are not contextual probabilities or intensity measurements. The linked research download is designated non-commercial; record the actual release and terms when importing.
- [ANEW, Bradley and Lang (1999)](https://pdodds.w3.uvm.edu/teaching/courses/2009-08UVM-300/docs/others/everything/bradley1999a.pdf) supplies word ratings for valence, arousal, and dominance. [LIWC](https://www.liwc.app/help/howitworks) calculates dictionary-category frequencies. These resources measure different constructs and should not be treated as interchangeable gold labels.
- [REMAN, Kim and Klinger (2018)](https://aclanthology.org/C18-1114.pdf), with its [official corpus page](https://www.ims.uni-stuttgart.de/en/research/resources/corpora/reman/), is the closest initial evaluation resource: 1,720 fiction excerpts, emotion spans, and experiencer/target/cause relations. Its eight emotion categories plus “other” permit multiple labels. Emotion annotations apply to the middle sentence; roles may occur throughout the three-sentence excerpt. Sampling required an NRC word in the middle sentence, and annotation agreement is imperfect. Preserve modifiers such as negation. This is not full-book arc or plot-link gold.

## Proposed first experiment

1. Inspect the REMAN release, annotation guidelines, source identifiers, and license before building an importer. Pin and hash original files, validate offsets, and keep raw/adjudicated annotations distinguishable. Group splits by source book where metadata permits; do not randomly split neighboring excerpts. Preserve a fixed development/test manifest.
2. Start with a clearly labeled supplied-candidate experiment. Give every method the same character candidates without revealing gold emotion spans or role edges. Evaluate character × emotion pairs, retaining unsupported/unknown cases separately where annotation coverage does not justify negatives. Gold-supplied candidates measure conditional classification, not end-to-end extraction; run an automatic-candidate condition separately and report candidate recall.
3. Compare NRC passage counts; NRC local-window attribution; NRC with negation and grammatical-role rules; JEV target-only; and JEV with neighboring context. Tune lexical thresholds and model thresholds only on development data. Include a conventional supervised text classifier when adequate training data is available, so beating word counts is not the entire claim.
4. Add an independently sampled, human-annotated fiction set with no lexicon filter. Include ordinary passages as well as a separately reported challenge set for implicit emotions, negation, hypothetical events, conflicting character reactions, and indirect narration. Keep annotators blind to predictions; retain disagreements and adjudication. Do not manufacture affect gold from BookCoref or PDNC.
5. Report per-emotion support, precision/recall/F1, macro/micro F1, and attribution errors. Evaluate probability calibration and Brier score on defensible binary gold; lexical counts are not probabilities without calibration. Use paired book-level uncertainty estimates where sample size allows. Record usage, latency, failures, and candidate-generation errors.

## Fit to the current project

The existing `src/server/jev.ts` uses official SDK Noul questions and supplies separate target/context text. [Noul](https://docs.typesafe.ai/primitives/noul) returns a yes-probability, making atomic character/emotion questions feasible without changing dependencies. For example: “Does TARGET portray Alice experiencing fear? Use CONTEXT only to interpret TARGET. Do not infer fear solely because an event is dangerous.” This is a proposed prompt, not a validated one.

Create separate affect task types and a dedicated importer/evaluator rather than reusing mention/speaker labels. Reuse server-side calls, request caps, raw response retention, caching, and provenance. Preserve the SDK version policy. Fixed candidate spans can later support relation questions; this classification primitive does not itself supply arbitrary extracted spans or a complete event graph.

For reader curves, first retain unsmoothed predictions and evidence locations. A mean probability of fear is a model estimate about label occurrence, not fear intensity. Missing character evidence must remain missing rather than becoming neutral. Publish smoothing choices and denominators, and keep lexical density and character emotion on separately named tracks.

Only after local affect validation, annotate a small event/goal/link pilot. Compare JEV relation classification against explicit causal markers and constrained rules, scoring links both with supplied gold nodes and with predicted nodes. REMAN cause relations can inform this work but do not substitute for Lehnert-style plot graphs.

Proceed if gains over the strongest baseline hold on untouched data, including the independent sample, at acceptable measured cost. The original investigation made no live calls. The subsequent isolated experiment has imported pinned data and run a small JEV pilot; see the experiment log.
