# rule_store.py
"""
LanceDB persistence layer for behavioral rules.

Isolates the 'behavioral_rules' table from the episodic memory index.
Rules flow through three states: quarantined -> approved -> deprecated.
Embeddings are generated using the same SentenceTransformer model as memory.py
to maintain vector space consistency for cross-table nearest-neighbour alignment.
"""

import uuid
import json
import numpy as np
import lancedb
import pyarrow as pa
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import torch
from sentence_transformers import SentenceTransformer

from config import EMBEDDING_MODEL, MAX_VRAM_ALLOCATION, RULE_ENGINE_TOP_K_RULES

# ─────────────────────────────────────────────
# Embedding model (shared device logic with memory.py)
# ─────────────────────────────────────────────
_device = "cuda" if (torch.cuda.is_available() and MAX_VRAM_ALLOCATION > 4) else "cpu"
_embed_model = SentenceTransformer(EMBEDDING_MODEL, device=_device)

EMBEDDING_DIM = _embed_model.get_embedding_dimension()

# ─────────────────────────────────────────────
# LanceDB connection
# ─────────────────────────────────────────────
_DB_PATH = Path(__file__).parent.parent / "lancedb_data" / "rules_db"
_DB_PATH.mkdir(parents=True, exist_ok=True)
_db = lancedb.connect(str(_DB_PATH))

_TABLE_NAME = "behavioral_rules"

_SCHEMA = pa.schema([
    pa.field("id",                   pa.utf8()),
    pa.field("category",             pa.utf8()),
    pa.field("confidence",           pa.float32()),
    pa.field("scope",                pa.utf8()),
    pa.field("status",               pa.utf8()),
    pa.field("body",                 pa.utf8()),
    pa.field("rationale",            pa.utf8()),
    pa.field("examples_before",      pa.utf8()),
    pa.field("examples_after",       pa.utf8()),
    pa.field("source_interaction_id",pa.utf8()),
    pa.field("created_at",           pa.utf8()),
    pa.field("approved_at",          pa.utf8()),
    pa.field("vector",               pa.list_(pa.float32(), EMBEDDING_DIM)),
])


def _get_or_create_table() -> lancedb.table.Table:
    """Returns the rules table, creating it with the schema if it doesn't exist."""
    if _TABLE_NAME in _db.table_names():
        return _db.open_table(_TABLE_NAME)
    return _db.create_table(_TABLE_NAME, schema=_SCHEMA)


def _embed(text: str) -> list[float]:
    """Generates a normalized embedding vector for the given text."""
    vec = _embed_model.encode(text, normalize_embeddings=True).astype(np.float32)
    return vec.tolist()


# ─────────────────────────────────────────────
# Write Operations
# ─────────────────────────────────────────────

def insert_rule(
    category: str,
    confidence: float,
    scope: str,
    body: str,
    rationale: str,
    examples_before: str,
    examples_after: str,
    source_interaction_id: str,
) -> str:
    """
    Inserts a new rule with status='quarantined'.
    The embedding is computed from body + rationale concatenated so that
    retrieval captures both the instruction and the reasoning context.
    Returns the generated rule UUID.
    """
    rule_id = f"rule_{uuid.uuid4().hex[:12]}"
    embed_text = f"{body}\n\n{rationale}"
    vector = _embed(embed_text)

    record = {
        "id":                    rule_id,
        "category":              category,
        "confidence":            float(confidence),
        "scope":                 scope,
        "status":                "quarantined",
        "body":                  body,
        "rationale":             rationale,
        "examples_before":       examples_before,
        "examples_after":        examples_after,
        "source_interaction_id": source_interaction_id,
        "created_at":            datetime.now(timezone.utc).isoformat(),
        "approved_at":           "",
        "vector":                vector,
    }

    table = _get_or_create_table()
    table.add([record])
    return rule_id


def approve_rule(rule_id: str) -> bool:
    """Transitions a quarantined rule to approved status."""
    table = _get_or_create_table()
    approved_at = datetime.now(timezone.utc).isoformat()
    try:
        table.update(
            where=f"id = '{rule_id}'",
            values={"status": "approved", "approved_at": approved_at},
        )
        return True
    except Exception:
        return False


def reject_rule(rule_id: str) -> bool:
    """Transitions a quarantined rule to deprecated status (soft delete)."""
    table = _get_or_create_table()
    try:
        table.update(
            where=f"id = '{rule_id}'",
            values={"status": "deprecated"},
        )
        return True
    except Exception:
        return False


def update_rule_body(rule_id: str, body: str, rationale: str) -> bool:
    """
    Allows user to edit a quarantined rule before approving.
    Re-embeds after edit so the vector stays consistent with content.
    """
    table = _get_or_create_table()
    vector = _embed(f"{body}\n\n{rationale}")
    try:
        table.update(
            where=f"id = '{rule_id}'",
            values={"body": body, "rationale": rationale, "vector": vector},
        )
        return True
    except Exception:
        return False


def deprecate_rule(rule_id: str) -> bool:
    """Explicitly deprecates an approved rule."""
    return reject_rule(rule_id)


# ─────────────────────────────────────────────
# Read Operations
# ─────────────────────────────────────────────

def retrieve_relevant_rules(query: str, top_k: Optional[int] = None) -> list[dict]:
    """
    Retrieves the top-K approved rules most semantically relevant to the query.
    Uses cosine similarity on the pre-normalized vectors.
    Applies confidence decay: rules with confidence < 0.3 are filtered out.
    """
    k = top_k or RULE_ENGINE_TOP_K_RULES
    table = _get_or_create_table()

    try:
        query_vec = _embed(query)
        results = (
            table.search(query_vec)
            .where("status = 'approved'")
            .limit(k * 2)  # oversample then filter by confidence
            .to_list()
        )
        # Filter low-confidence rules and return top-k
        filtered = [r for r in results if r.get("confidence", 0) >= 0.3]
        return filtered[:k]
    except Exception:
        return []


def get_quarantined_rules() -> list[dict]:
    """Returns all rules pending user review."""
    table = _get_or_create_table()
    try:
        return table.search().where("status = 'quarantined'").to_list()
    except Exception:
        return []


def get_all_rules(status: Optional[str] = None) -> list[dict]:
    """
    Returns all rules, optionally filtered by status.
    status: 'quarantined' | 'approved' | 'deprecated' | None (all)
    """
    table = _get_or_create_table()
    try:
        if status:
            return table.search().where(f"status = '{status}'").to_list()
        return table.to_pandas().to_dict("records")
    except Exception:
        return []


def get_rule_by_id(rule_id: str) -> Optional[dict]:
    """Fetches a single rule by its ID."""
    table = _get_or_create_table()
    try:
        rows = table.search().where(f"id = '{rule_id}'").to_list()
        return rows[0] if rows else None
    except Exception:
        return None


def get_rule_count_by_status() -> dict[str, int]:
    """Returns counts per status for UI badge display."""
    table = _get_or_create_table()
    try:
        df = table.to_pandas()
        return df.groupby("status").size().to_dict()
    except Exception:
        return {"quarantined": 0, "approved": 0, "deprecated": 0}
