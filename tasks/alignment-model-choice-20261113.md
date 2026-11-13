# Specialized word alignment: bounded model comparison

Initial research verified from primary sources on 2026-11-13. The bounded local comparison below supersedes the initial recommendation.

## Selected after the local comparison

Use pinned [LaBSE](https://huggingface.co/sentence-transformers/LaBSE) `836121a0533e5664b21c7aacc5d22951f2b8b25b` (Apache-2.0) for sentence/note scope and retain mBERT for fine word alignment. Seven evaluable representative contexts gave E5 5 correct top1 matches and LaBSE 6; original-title metadata was outside this retrieval test. XLM-Align did not beat mBERT on twelve lexical cases: native macroF1 .434 (layer8) versus .585. This small sample is not a whole-book accuracy estimate.

Improve the general pipeline through structural scopes, split/merge support, semantic note matching and caption/body links. No further per-sentence/per-word audit or LLM/Vilao processing is selected. Private experiment data are under `work/alignment-model-study`.

| Candidate and pinned revision | Evidence and limits |
| --- | --- |
| `microsoft/xlm-align-base` — `3e2a40ea5f9c75353ad2769bd74f7cb425fce671` | [Official metadata](https://huggingface.co/api/models/microsoft/xlm-align-base?blobs=true): 941,840,167-byte PyTorch checkpoint. [Paper](https://aclanthology.org/2021.acl-long.265.pdf), Appendix Table10: en–vi parallel pretraining data **0.86GB**; Vietnamese is supported, but word-alignment evaluation covers only de–en/en–fr/en–hi/ro–en. [Official aligner](https://github.com/CZWin32768/XLM-Align/tree/master/word_aligner) uses joint sentence encoding plus optimal transport/Sinkhorn. |
| `qiyuw/WSPAlign-mbert-base` — `008b5c093f66a662644e903bc753df1fefebe415` | [Official metadata](https://huggingface.co/api/models/qiyuw/WSPAlign-mbert-base?blobs=true): 709,127,985-byte checkpoint, **CC-BY-NC-SA-4.0** weights. [Author inference repository](https://github.com/qiyuw/WSPAlign.InferEval) recommends mBERT for Asian languages; its stock tokenizer accepts six languages, excluding vi. Vietnamese needs tokenizer adaptation and zero-shot evaluation; no released VI fine-tune is documented. |

**Licensing:** XLM-Align [repository code is MIT](https://github.com/CZWin32768/XLM-Align/blob/master/LICENSE); the official HF checkpoint/card has no explicit weight-license field or license file, so a weight-specific MIT grant remains unverified. WSPAlign inference code has a separate [NTT internal-evaluation license](https://github.com/qiyuw/WSPAlign.InferEval/blob/main/LICENSE.txt) restricting modification and redistribution; do not treat the code as MIT or Apache.

**CPU:** Both checkpoint sizes fit a small isolated CPU experiment in principle; RAM and latency are unmeasured. [WSPAlign code](https://github.com/qiyuw/WSPAlign.InferEval/blob/main/inference.py) supports CPU but runs QA span prediction per word in both directions. [XLM-Align runner](https://github.com/CZWin32768/XLM-Align/blob/master/word_aligner/xlmalign-ot-aligner.py) hardcodes CUDA and needs a CPU device adaptation.

**Recommendation:** Benchmark XLM-Align with its OT decoder first on 10–20 existing representative pairs, separate from sentence pairing. Compare exact phrase precision, omission false matches, compound/name handling and latency; test layers8/9 without claiming Vietnamese superiority. Keep WSPAlign as a research comparator subject to its code/weight terms. Reuse existing cases; no new corpus-wide audit or repeated awesome-align MNN pilot.
