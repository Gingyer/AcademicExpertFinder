from pathlib import Path
from typing import List, Tuple

import chromadb

from app.modules.document.professor import Professor, professor_id
from app.modules.ai.ports import EmbeddingProvider

# professor_id は models.professor へ移設した（技術非依存化）。
# 既存 import 経路 `from app.modules.document.vector_store import professor_id` の後方互換のため再エクスポートする。
__all__ = ["ProfessorVectorStore", "professor_id"]

_COLLECTION_NAME = "professors"


class ProfessorVectorStore:
    """教授ドキュメントの埋め込みをChromaDBに永続化し、類似検索を行う。"""

    def __init__(self, persist_dir: Path, embedder: EmbeddingProvider) -> None:
        self._embedder = embedder
        client = chromadb.PersistentClient(path=str(persist_dir))
        self._collection = client.get_or_create_collection(
            name=_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    def is_indexed(self, professors: List[Professor]) -> bool:
        """現在のコレクションが professors と完全に一致するか ID セットで比較する。"""
        expected_ids = {professor_id(p) for p in professors}
        if self._collection.count() != len(expected_ids):
            return False
        existing = set(self._collection.get(include=[])["ids"])
        return existing == expected_ids

    def build_index(self, professors: List[Professor], documents: List[str]) -> None:
        new_ids = [professor_id(p) for p in professors]
        embeddings = [
            self._embedder.embed(doc, task_type="RETRIEVAL_DOCUMENT") for doc in documents
        ]
        self._collection.upsert(ids=new_ids, embeddings=embeddings, documents=documents)
        # 削除された教授の古いエントリを取り除く
        existing = set(self._collection.get(include=[])["ids"])
        stale = existing - set(new_ids)
        if stale:
            self._collection.delete(ids=list(stale))

    def query(self, query_text: str, n_results: int) -> List[Tuple[str, float]]:
        count = self._collection.count()
        if count == 0:
            return []
        n_results = min(n_results, count)
        query_vec = self._embedder.embed(query_text, task_type="RETRIEVAL_QUERY")
        result = self._collection.query(query_embeddings=[query_vec], n_results=n_results)
        ids = result["ids"][0]
        distances = result["distances"][0]
        # Chroma の cosine 空間では distance = 1 - cosine_similarity
        return [(id_, max(0.0, 1.0 - dist)) for id_, dist in zip(ids, distances)]
