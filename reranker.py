from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification
)
from config import RERANKER_MODEL, MAX_VRAM_ALLOCATION
import torch

# Safeguard: For 4GB VRAM budgets, execute secondary local pipelines on CPU.
# This prevents CUDA dynamic allocations from OOM-crashing your primary LLM server (Gemma).
device = "cuda" if (torch.cuda.is_available() and MAX_VRAM_ALLOCATION > 4) else "cpu"
print(f"[AFFECTIVE RERANK] Initializing Reranker model on device: {device.upper()}")

tokenizer = AutoTokenizer.from_pretrained(
    RERANKER_MODEL
)

model = AutoModelForSequenceClassification.from_pretrained(
    RERANKER_MODEL
).to(device)

model.eval()



def rerank(query, documents):
    if not documents:
        return []

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

    # Move inputs to device (GPU) if CUDA is active
    inputs = {k: v.to(device) for k, v in inputs.items()}

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

