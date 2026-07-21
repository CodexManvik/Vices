import json
import numpy as np
from sentence_transformers import SentenceTransformer
from turbovec import IdMapIndex
from config import TV_INDEX_PATH, METADATA_PATH, CLASSIFIED_MEMORIES_PATH, EMBEDDING_MODEL, TURBOVEC_BIT_WIDTH

print("[MEMORY BUILDER] Initializing sentence-transformer core...")
model = SentenceTransformer(EMBEDDING_MODEL)

with open(CLASSIFIED_MEMORIES_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

vectors = []
ids = []
metadata_lookup = {}

print(f"[MEMORY BUILDER] Vectorizing {len(data)} memories...")
for i, item in enumerate(data):
    text = item["text"]
    tags = item["tags"]

    # Recreate semantic abstraction string
    abstraction = (
        f"Conversation style example. "
        f"Tone: {', '.join(tags)}. "
        f"Message: {text}"
    )

    # Encode array to float32
    embedding = model.encode(abstraction).astype(np.float32)
    vectors.append(embedding)
    ids.append(i)
    
    # Store parallel text references in sidecar map
    metadata_lookup[str(i)] = {
        "raw_text": text,
        "tags": tags
    }

# Pack data structures for hardware kernel execution
vectors_np = np.vstack(vectors)
ids_np = np.array(ids, dtype=np.uint64)

print("[MEMORY BUILDER] Committing arrays to TurboQuant layout...")
# Bit-width configured via TURBOVEC_BIT_WIDTH provides optimal lexical accuracy for semantic recall
idx = IdMapIndex(bit_width=TURBOVEC_BIT_WIDTH)
idx.add_with_ids(vectors_np, ids_np)

# Persist files locally
idx.write(TV_INDEX_PATH)
with open(METADATA_PATH, "w", encoding="utf-8") as f:
    json.dump(metadata_lookup, f, indent=4)

print(f"🎉 Success! Turbovec index written to '{TV_INDEX_PATH}' and lookup map to '{METADATA_PATH}'.")