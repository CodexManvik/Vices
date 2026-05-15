import lancedb
from sentence_transformers import SentenceTransformer
from reranker import rerank
import re

DB_PATH = "lancedb_data"
db = lancedb.connect(DB_PATH)
table = db.open_table("memory")
model = SentenceTransformer("BAAI/bge-small-en-v1.5")

def retrieve_memories(query):
    embedding = model.encode(query).tolist()

    results = (
        table.search(embedding)
        .limit(8)
        .to_list()
    )

    # 1. Extract raw text and rerank
    docs = [r["raw_text"] for r in results]
    docs = rerank(query, docs)

    # 2. Clean slangs and shorthand
    cleaned_docs = []
    for doc in docs:
        # Safely replace shorthand using explicit word boundaries
        d = re.sub(r'\b2\b', 'to', doc)
        d = re.sub(r'\b4\b', 'for', d)
        d = re.sub(r'\bu\b', 'you', d, flags=re.IGNORECASE)
        d = re.sub(r'\br\b', 'are', d, flags=re.IGNORECASE)
        d = re.sub(r'\bur\b', 'your', d, flags=re.IGNORECASE)
        d = re.sub(r'\bn\b', 'and', d, flags=re.IGNORECASE)
        cleaned_docs.append(d)

    # 3. Filter for explicit content frequency
    # We allow at most ONE explicit style example to avoid overwhelming the prompt
    filtered = []
    sexual_count = 0
    sexual_words = ["cum", "cock", "pussy", "fuck", "daddy"]

    for doc in cleaned_docs:
        has_sexual_word = any(w in doc.lower() for w in sexual_words)
        
        if has_sexual_word:
            sexual_count += 1
            # If we already have one explicit example, skip this one
            if sexual_count > 1:
                continue
        
        filtered.append(doc)

    # Return top 3 processed examples
    return filtered[:3]