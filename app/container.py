"""Composition Root（DI コンテナ）。

アプリ全体の依存を組み立てる唯一の場所。ルートや各モジュールは、他モジュールの
内部（private グローバル）を直接掴まず、この Composition Root 経由で依存を取得する。
ここだけが具象 Adapter（Gemini・Chroma・SQLAlchemy 等）を知ってよい。
"""
import threading
from pathlib import Path

from fastapi import HTTPException

from app.modules.ai.adapters.gemini_embedding import GeminiEmbeddingService
from app.modules.ai.adapters.gemini_llm import GeminiLLMService
from app.modules.ai.ports import EmbeddingProvider, LLMProvider  # noqa: F401
from app.modules.search.ports import SearchPort, VectorIndexPort  # noqa: F401
from app.modules.search.search_engine import SearchEngine
from app.modules.document.vector_store import ProfessorVectorStore

# 索引(Chroma)の永続化ディレクトリ。infra 設定は Composition Root が知る。
_CHROMA_DIR = Path(__file__).resolve().parent / "data" / "chroma_store"

_embedder: EmbeddingProvider | None = None
_engine: SearchEngine | None = None
_lock = threading.Lock()


def _ensure_built() -> None:
    """Embedder / LLM / SearchEngine を一度だけ組み立てる（スレッドセーフ）。

    Embedder の初期化不可（APIキー未設定等）は 503 SERVICE_UNAVAILABLE として
    即失敗させる。LLM は任意（未設定なら None のまま動作を継続）。
    """
    global _embedder, _engine
    if _engine is not None:
        return
    with _lock:
        if _engine is not None:
            return
        try:
            embedder: EmbeddingProvider = GeminiEmbeddingService()
        except ValueError as e:
            raise HTTPException(
                status_code=503,
                detail={
                    "data": None,
                    "error": {"code": "SERVICE_UNAVAILABLE", "message": str(e)},
                },
            ) from e
        try:
            llm: LLMProvider | None = GeminiLLMService()
        except ValueError:
            llm = None
        # Chroma Adapter を組み立て、ドメインには Port として注入する。
        store: VectorIndexPort = ProfessorVectorStore(_CHROMA_DIR, embedder)
        _embedder = embedder
        _engine = SearchEngine(store, llm=llm)


def get_embedder() -> EmbeddingProvider:
    _ensure_built()
    assert _embedder is not None
    return _embedder


def get_search_engine() -> SearchEngine:
    _ensure_built()
    assert _engine is not None
    return _engine


def get_search() -> SearchPort:
    """検索ユースケースを Port 型で返す（呼び出し側は具象を知らない）。"""
    return get_search_engine()


def get_history_repository(db):
    """履歴永続化 Adapter(SQLAlchemy) を組み立てる。具象を知るのは container だけ。"""
    # DB(ORM) を要するため遅延 import（container を import しただけで DB を要求しない）。
    from app.modules.history.repository import PromptHistoryRepository

    return PromptHistoryRepository(db)


def get_prompt_history_service(db):
    """履歴ユースケースを組み立てる。Search・永続化への依存は Port 経由で注入する。"""
    from app.modules.history.prompt_history_service import PromptHistoryService

    return PromptHistoryService(
        engine=get_search(),
        embedder=get_embedder(),
        repo=get_history_repository(db),
    )


def reset() -> None:
    """テスト用: 組み立て済みシングルトンを破棄する。"""
    global _embedder, _engine
    with _lock:
        _embedder = None
        _engine = None
