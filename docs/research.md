# Research grounding and corrections

> Follow-up: BookCoref Gold supplies whole-book character coreference annotations and is now imported alongside PDNC. See [dataset provenance](datasets.md). The original recommendation to label a pilot manually has been superseded for the mention/speaking phase.

Reviewed 18 September 2026. The supplied notes are useful leads, not a verified bibliography. The sources below were checked at their original documentation or publication pages. Architectural recommendations remain proposals to test; none of these sources establishes JEV's accuracy on this task.

## Sources that directly shape the MVP

| Source | What it supports | Application and limitation |
| --- | --- | --- |
| [JEV reranking implementation](https://github.com/carlaiau/jev-reranking/blob/main/reranking/jev.py) | A cached pointwise classifier using TypeSafe, with validation and run metadata. | Adapt its request/cache pattern. News relevance is a different task from character presence. Source inspected through `gh api`; no code copied into this project. |
| [TypeSafe introduction](https://docs.typesafe.ai/introduction), [Noul](https://docs.typesafe.ai/primitives/noul), [quick start](https://docs.typesafe.ai/introduction/quickstart) | Typed classification questions; Noul returns a yes-probability. The documented HTTP endpoint is `POST https://api.typesafe.ai/v1/systemone`. | Use separate atomic presence and mention questions. Free-text cast extraction and evidence generation are not outputs of this primitive. |
| [Vala et al., EMNLP 2015](https://aclanthology.org/D15-1088/), *Mr. Bennet, his coachman, and the Archbishop walk into a bar but only one of them gets recognized* | Literary character detection deserves task-specific handling beyond ordinary name recognition. | Begin with a reviewed registry, then evaluate discovery separately. |
| [Bamman, Lewke, and Mansoor, LREC 2020](https://aclanthology.org/2020.lrec-1.6.pdf), *An Annotated Dataset of Coreference in English Literature* | LitBank provides literary coreference annotations. | Useful for entity-resolution evaluation; not direct gold labels for passage-level physical/narrative presence. |
| [Zehe et al., EACL 2021](https://aclanthology.org/2021.eacl-main.276/), *Detecting Scenes in Fiction: A new Segmentation Task* | Scene segmentation is a distinct and difficult task, with annotated German fiction. | Avoid assuming chapters or fixed-size chunks are scenes. Begin with passages and audit scene transitions. |
| [Toshniwal et al., EMNLP 2020](https://aclanthology.org/2020.emnlp-main.685/), *Learning to Ignore* | A learned bounded-memory architecture for long-document coreference. | Motivates a later bounded-state experiment. A prose summary is an analogy, not an implementation or replication of this model. |
| [DraCor schema documentation](https://dracor-org.github.io/dracor-schema/) | Networks are extracted from distinct speakers within scene-level segments. | Useful structured drama data, but shared scene speech does not certify exhaustive physical presence, especially for silent characters. |
| [Vishnubhotla, Hammond, and Hirst, LREC 2022](https://aclanthology.org/2022.lrec-1.628/), *The Project Dialogism Novel Corpus* | The published dataset contains quotation annotations across 22 novels, including speakers and addressees. | Relevant when adding speech attribution. Quotation labels are not comprehensive presence labels. |
| [Hearst, Computational Linguistics 1997](https://aclanthology.org/J97-1003/), *TextTiling* | Lexical-cohesion segmentation into subtopic passages. | A possible segmentation baseline, not a ready-made narrative scene detector. |
| [Liu et al., TACL 2024](https://aclanthology.org/2024.tacl-1.9/), *Lost in the Middle* | Long-context models can be sensitive to where relevant information appears in context. | Motivates testing local windows; it does not establish that JEV has the same failure curve or identify an optimal window size. |

## Changes to the supplied architecture

**Keep the global registry, but make discovery a separate milestone.** A classifier with fixed labels needs someone or something to supply those labels. Starting with automatic aliases, scene detection, coreference, salience, and voice attribution would make a failed pilot hard to interpret.

**Use overlapping context with disjoint targets.** This keeps predictions attached to precise text intervals. Overlapping output windows would otherwise require arbitrary voting and could label the same paragraph inconsistently.

**Do not require extracted evidence from an API that does not generate it.** Begin with human evidence for auditing. Candidate-sentence classification could later approximate machine evidence, but adds cost and another evaluation problem.

**Do not treat drama as free exhaustive presence gold.** DraCor is useful for a supplementary speaker/co-occurrence sanity check. Entrances, exits, and silent participation require audited stage-direction handling; prose validation remains necessary. Building a drama adapter is optional after the first prose pilot.

**Separate relevance to the story from presence in a passage.** Salience and voice share can be valuable later, but need distinct definitions, gold labels, and scoring. The first interface only needs presence, mention, and uncertainty.

## Deferred verification

The supplied notes additionally name Pfister, Marcus, Moretti, Xia/Sedoc/Van Durme, Bohnet, Dobrovolskii, Elson/McKeown, He/Barbosa/Kondrak, Muzny et al., speech/thought representation research, entity salience, BooookScore, recursive summarization, and entity tracking. Those references have not been individually verified here and are not prerequisites for this MVP. Verify exact publications and relevance when their corresponding feature becomes part of the experiment.

The original notes should not be interpreted as evidence that scene-level presence, salience, or free indirect discourse can already be measured reliably with this proposed pipeline. The experiment plan is designed to establish the first of those claims.
