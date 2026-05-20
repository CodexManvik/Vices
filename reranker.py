from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification
)
from config import RERANKER_MODEL

import torch

tokenizer = AutoTokenizer.from_pretrained(
    RERANKER_MODEL
)

model = AutoModelForSequenceClassification.from_pretrained(
    RERANKER_MODEL
)

model.eval()


def rerank(query, documents):

    pairs = [
        [query, doc]
        for doc in documents
    ]

    inputs = tokenizer(
        pairs,
        padding=True,
        truncation=True,
        return_tensors="pt"
    )

    with torch.no_grad():

        scores = model(
            **inputs
        ).logits.squeeze(-1)

    scored = list(zip(
        documents,
        scores.tolist()
    ))

    scored.sort(
        key=lambda x: x[1],
        reverse=True
    )

    return [
        x[0]
        for x in scored[:5]
    ]
