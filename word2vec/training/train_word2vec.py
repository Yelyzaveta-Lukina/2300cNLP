"""Train the word2vec model used by word2vec.html and export it for the browser.

Corpus: text8 (first 100 MB of English Wikipedia, cleaned to lowercase a-z words,
~17M tokens). Download: https://github.com/piskvorky/gensim-data/releases/download/text8/text8.gz

Usage:
    pip install gensim numpy
    python train_word2vec.py path/to/text8.gz ../model

Outputs (in the output directory):
    vocab.json    {"dim": D, "words": [...], "counts": [...], "params": {...}}
    vectors.bin   int8 matrix [len(words), D], row-wise unit-normalised and scaled by 127
    text8.w2v.model  full gensim model (not deployed; gitignored)
"""
import gzip
import json
import sys
import time
from pathlib import Path

import numpy as np
from gensim.models import Word2Vec
from gensim.models.word2vec import LineSentence

CORPUS = Path(sys.argv[1] if len(sys.argv) > 1 else "text8.gz")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "../model")
EXPORT_TOP_N = 30000  # most frequent words shipped to the browser

PARAMS = dict(
    vector_size=100,  # embedding dimensions
    window=5,         # context words on each side
    min_count=5,      # ignore rarer words
    sg=1,             # 1 = skip-gram, 0 = CBOW
    negative=10,      # negative-sampling noise words
    sample=1e-4,      # down-sample very frequent words
    epochs=5,
    workers=4,
    seed=42,
)


def sentences(path):
    # text8 is one 100 MB line; split it into 10k-token pseudo-sentences.
    with gzip.open(path, "rt") as f:
        tokens = f.read().split()
    return [tokens[i:i + 10000] for i in range(0, len(tokens), 10000)]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    corpus = sentences(CORPUS)
    print(f"{sum(map(len, corpus)):,} tokens")
    t = time.time()
    model = Word2Vec(corpus, **PARAMS)
    print(f"trained in {time.time() - t:.0f}s, vocab {len(model.wv):,}")
    model.save(str(OUT / "text8.w2v.model"))

    wv = model.wv
    words = wv.index_to_key[:EXPORT_TOP_N]  # already sorted by frequency
    vecs = np.stack([wv[w] for w in words]).astype(np.float32)
    vecs /= np.linalg.norm(vecs, axis=1, keepdims=True)
    np.clip(np.round(vecs * 127), -127, 127).astype(np.int8).tofile(OUT / "vectors.bin")
    meta = {
        "dim": PARAMS["vector_size"],
        "words": words,
        "counts": [int(wv.get_vecattr(w, "count")) for w in words],
        "params": {k: v for k, v in PARAMS.items() if k not in ("workers", "seed")},
        "corpus": "text8 (Wikipedia, ~17M tokens)",
        "vocab_trained": len(wv),
    }
    (OUT / "vocab.json").write_text(json.dumps(meta, separators=(",", ":")))

    for probe in ["king", "france", "computer", "dog", "music"]:
        print(probe, [w for w, _ in wv.most_similar(probe, topn=10)])
    print("king - man + woman =", wv.most_similar(positive=["king", "woman"], negative=["man"], topn=3))


if __name__ == "__main__":
    main()
