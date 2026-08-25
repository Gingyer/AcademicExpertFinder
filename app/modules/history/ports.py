"""履歴 Module の Port。

永続化(outbound)。Adapter は SQLAlchemy(history.repository)。
Port を技術非依存に保つため ORM エンティティを型参照せず、永続化レコードは
不透明な HistoryRecord として扱う。
"""
from typing import Any, List, Optional, Protocol, runtime_checkable

# 永続化レコードの型エイリアス（ORM 非参照）。
HistoryRecord = Any


@runtime_checkable
class HistoryRepositoryPort(Protocol):
    def create(
        self,
        input_text: str,
        llm_output: Optional[str] = None,
        query_type: Optional[str] = None,
        confidence: Optional[str] = None,
        is_confident: Optional[bool] = None,
        search_message: Optional[str] = None,
        search_attempts: Optional[int] = None,
        embedding_vector: Optional[list] = None,
        professor_results: Optional[List[dict]] = None,
    ) -> HistoryRecord:
        ...

    def get_list(self) -> List[HistoryRecord]:
        ...

    def get_by_id(self, history_id: int) -> Optional[HistoryRecord]:
        ...

    def soft_delete(self, history_id: int) -> Optional[HistoryRecord]:
        ...
