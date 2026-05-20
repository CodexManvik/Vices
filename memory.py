import os
import json
import re
import numpy as np
from sentence_transformers import SentenceTransformer
from turbovec import IdMapIndex
from reranker import rerank
from config import (
    TV_INDEX_PATH, METADATA_PATH, EMBEDDING_MODEL, RETRIEVAL_INITIAL_K,
    RETRIEVAL_MAX_EXPLICIT_DOCS, RETRIEVAL_FINAL_RETURN_COUNT,
    EXPLICIT_WORDS, ENABLE_CONTENT_GUARDRAILS, NORMALIZE_SLANG
)

# --- SYSTEM CONFIGURATION ---
# Note: These are now loaded from config.py via environment variables

# Move text normalization out into a maintainable data structure
SLANG_MAP = {
    r'\b2\b': 'to',
    r'\b4\b': 'for',
    r'\bu\b': 'you',
    r'\br\b': 'are',
    r'\bur\b': 'your',
    r'\bn\b': 'and'
}

RETRIEVAL_PARAMS = {
    "initial_k": RETRIEVAL_INITIAL_K,
    "max_explicit_docs": RETRIEVAL_MAX_EXPLICIT_DOCS,
    "final_return_count": RETRIEVAL_FINAL_RETURN_COUNT
}

# --- ENGINE INITIALIZATION ---
print("[RETRIEVAL ENGINE] Initializing embedding models...")
model = SentenceTransformer(EMBEDDING_MODEL)

if os.path.exists(TV_INDEX_PATH) and os.path.exists(METADATA_PATH):
    index = IdMapIndex.load(TV_INDEX_PATH)
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        metadata_lookup = json.load(f)
    print("[RETRIEVAL ENGINE] Loaded Turbovec Index and lookup maps.")
else:
    index = None
    metadata_lookup = {}
    print("[WARNING] Vector database matching keys not found! Run build_memory_db.py.")


# --- CORE LOGIC ---
def clean_text_shorthand(text: str) -> str:
    """Standardizes chat slang using the dynamic lookup map configuration."""
    if not NORMALIZE_SLANG:
        return text
    
    for pattern, replacement in SLANG_MAP.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text


def enforce_content_guardrails(docs: list) -> list:
    """Clamps explicit examples based on configured volume limits."""
    if not ENABLE_CONTENT_GUARDRAILS:
        return docs
    
    filtered = []
    explicit_count = 0
    
    for doc in docs:
        is_explicit = any(word in doc.lower() for word in EXPLICIT_WORDS)
        
        if is_explicit:
            explicit_count += 1
            if explicit_count > RETRIEVAL_PARAMS["max_explicit_docs"]:
                continue
                
        filtered.append(doc)
    return filtered


def retrieve_memories(query: str):
    if index is None or not metadata_lookup:
        return []

    # 1. Vector query structure generation
    query_vector = model.encode(query).astype(np.float32).reshape(1, -1)
    
    # 2. Hardware accelerated 4-bit retrieval pass
    _, retrieved_ids = index.search(query_vector, k=RETRIEVAL_PARAMS["initial_k"])
    
    docs = [
        metadata_lookup[str(uid)]["raw_text"] 
        for uid in retrieved_ids[0] 
        if str(uid) in metadata_lookup
    ]

    if not docs:
        return []

    # 3. Execution of Rerank, Sanitization, and Guardrail pipelines
    reranked_docs = rerank(query, docs)
    cleaned_docs = [clean_text_shorthand(doc) for doc in reranked_docs]
    safeguarded_docs = enforce_content_guardrails(cleaned_docs)

    # 4. Final context return slice boundary slice
    return safeguarded_docs[:RETRIEVAL_PARAMS["final_return_count"]]