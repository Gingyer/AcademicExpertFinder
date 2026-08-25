from app.shared.models.search import SearchRequest, SearchResponse
from app.modules.ai.ports import EmbeddingProvider
from app.modules.history.ports import HistoryRecord, HistoryRepositoryPort
from app.modules.search.ports import SearchPort
from app.shared.progress import (
    CancelCheck,
    ProgressCallback,
    SearchCancelled,
    never_cancel,
    noop_progress,
)


class PromptHistoryService:
    def __init__(
        self,
        engine: SearchPort,
        embedder: EmbeddingProvider,
        repo: HistoryRepositoryPort,
    ) -> None:
        self._engine = engine
        self._embedder = embedder
        # 永続化は Port として注入される（具象 SQLAlchemy 実装は container が生成）。
        self._repo = repo

    def execute(
        self,
        base_prompt: str,
        additional_prompt: str | None = None,
        on_progress: ProgressCallback = noop_progress,
        should_cancel: CancelCheck = never_cancel,
    ) -> tuple[SearchResponse, int]:
        combined = base_prompt
        if additional_prompt:
            combined = f"{base_prompt}\n\n{additional_prompt}"

        response = self._engine.search(
            SearchRequest(query=combined),
            on_progress=on_progress,
            should_cancel=should_cancel,
        )

        # 保存ステージ開始直前のキャンセル確認。立っていれば履歴を保存せず終了する
        # （キャンセル済み job の結果は破棄し、クライアントに返さない）。
        if should_cancel():
            raise SearchCancelled()
        on_progress("保存", 95, "履歴を保存しています")

        try:
            embedding_vector = self._embedder.embed(combined, task_type="RETRIEVAL_QUERY")
        except Exception:
            embedding_vector = None

        professor_results = [
            {
                "professor_name": r.name,
                "school": r.school,
                "url": r.url,
                "match_score": r.match_score,
                "similarity_score": r.similarity_score,
                "match_reason": r.match_reason,
                "profile_summary": r.profile_summary,
                "related_keywords": r.related_keywords,
                "confidence_note": r.confidence_note,
                "related_works": [
                    {"title": w.title, "abstract": w.abstract}
                    for w in r.related_works
                ],
            }
            for r in response.results
        ]

        history = self._repo.create(
            input_text=combined,
            query_type=response.query_type,
            confidence=response.confidence,
            is_confident=response.is_confident,
            search_message=response.message,
            search_attempts=response.search_attempts,
            embedding_vector=embedding_vector,
            professor_results=professor_results,
        )

        return response, history.id

    def get_list(self) -> list[HistoryRecord]:
        return self._repo.get_list()

    def get_by_id(self, history_id: int) -> HistoryRecord | None:
        return self._repo.get_by_id(history_id)

    def soft_delete(self, history_id: int) -> HistoryRecord | None:
        return self._repo.soft_delete(history_id)
