import json
import lancedb

from sentence_transformers import (
    SentenceTransformer
)

DB_PATH = "lancedb_data"

model = SentenceTransformer(
    "BAAI/bge-small-en-v1.5"
)

db = lancedb.connect(DB_PATH)

with open(
    "classified_memories.json",
    "r",
    encoding="utf-8"
) as f:

    data = json.load(f)

rows = []

for i, item in enumerate(data):

    text = item["text"]
    tags = item["tags"]

    abstraction = (
        f"Conversation style example. "
        f"Tone: {', '.join(tags)}. "
        f"Message: {text}"
    )

    embedding = model.encode(
        abstraction
    ).tolist()

    rows.append({
        "id": i,
        "text": abstraction,
        "raw_text": text,
        "tags": tags,
        "vector": embedding
    })

try:
    db.drop_table("memory")
except:
    pass

table = db.create_table(
    "memory",
    rows
)

print("LanceDB memory built")
