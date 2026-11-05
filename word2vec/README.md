# Word2Vec Lab

An in-browser word2vec explorer at [`/word2vec.html`](../word2vec.html). Type a word to see its
10 nearest neighbours by cosine similarity, plus 2D and 3D PCA projections of the word and its
neighbours. Everything runs client-side: the page downloads the exported vectors once and does
the nearest-neighbour search and PCA in JavaScript. No server needed, so it deploys as static files on Netlify.

## Model

| | |
|---|---|
| Corpus | **text8**: first 100 MB of English Wikipedia, lowercased a–z only, 17,005,207 tokens |
| Algorithm | Skip-gram with negative sampling (gensim `Word2Vec`) |
| `vector_size` | 100 |
| `window` | 5 |
| `min_count` | 5 (71,290 words in the trained vocabulary) |
| `negative` | 10 |
| `sample` | 1e-4 |
| `epochs` | 5 |
| Training time | ~2.5 min on 4 CPU cores |
| Exported | 30,000 most frequent words |

## Files

- `model/vocab.json`: `{dim, words[], counts[], params, corpus, vocab_trained}`. `words` is
  ordered by corpus frequency, and row *i* of `vectors.bin` belongs to `words[i]`.
- `model/vectors.bin`: raw `int8` matrix, 30,000 × 100 = 3,000,000 bytes, row-major. Each row is
  the unit-normalised vector × 127, rounded. To use it: read as `Int8Array`, cast to float, and
  re-normalise each row. Cosine similarity is then a plain dot product.
- `training/train_word2vec.py`: trains the model and writes both files.
- `vendor/plotly-2.35.2.min.js`: Plotly, self-hosted for the charts (MIT, see `vendor/PLOTLY_LICENSE`).

Int8 quantisation shrinks the download from 12 MB (float32) to 3 MB. The neighbour lists match
gensim's float32 results on 9–10 of the top 10 words for every probe tested.

## Retrain

```bash
pip install gensim numpy
```

```bash
curl -L -o text8.gz https://github.com/piskvorky/gensim-data/releases/download/text8/text8.gz
```

```bash
cd word2vec/training && python train_word2vec.py ../../text8.gz ../model
```

The full gensim model (`model/text8.w2v.model`, ~60 MB) is written too but gitignored.

## Sample results (from the exported int8 vectors)

| Query | 10 nearest neighbours (cosine) |
|---|---|
| king | pretender .76, pepin .72, abdicates .72, prince .72, valdemar .72, lothair .71, queen .71, theodoric .70, kings .70, valois .70 |
| paris | rodin .75, montparnasse .75, nantes .72, chapelle .72, rouen .72, brussels .72, commune .71, marseille .71, france .70, sur .70 |
| dog | dogs .73, hound .73, cat .70, canine .69, breeds .69, ass .69, dachshund .68, hounds .68, keeshond .68, rat .67 |
| computer | computers .84, hardware .78, computing .77, bootstrap .76, hci .74, firmware .73, pdas .73, acorn .73, automation .72, microcomputer .72 |
| music | musical .81, electronica .79, folk .78, jazz .77, reggae .77, symphonic .75, ragtime .75, ensembles .75, dance .75, techno .74 |
| river | rivers .83, tributaries .81, yangtze .80, tributary .80, headwaters .79, waterway .79, estuary .79, basin .78, valley .77, gorge .77 |
| einstein | relativity .82, electrodynamics .78, gravitation .77, bose .75, heisenberg .74, dinger .72, relativistic .72, quantum .71, schr .70, photoelectric .70 |

Analogies (`a − b + c`, excluding the input words):

- king − man + woman → **queen**, daughter, abdicates
- paris − france + italy → bologna, venice, turin
- walking − walk + swim → hopping, kayaks, downhill (a miss: text8 is small)

Things to notice in class: neighbours mix synonyms with *related* words (dog → cat, rat) because
skip-gram learns from shared contexts, not meaning. "doctor" is dominated by *Doctor Who* from
Wikipedia. Fragments like "dinger" and "schr" come from text8 stripping non-ASCII letters (Schrödinger).
