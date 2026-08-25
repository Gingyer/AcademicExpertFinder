"""検索 Module の Port。

- VectorIndexPort: ベクトル索引(outbound)。Adapter は Chroma(document.vector_store)。
- SearchPort: 検索ユースケース(inbound)。History 等はこの Port に依存する。
"""
from typing import List, Protocol, Tuple, runtime_checkable

from app.modules.document.professor import Professor
from app.shared.models.search import SearchRequest, SearchResponse
from app.shared.progress import (
    CancelCheck,
    ProgressCallback,
    never_cancel,
    noop_progress,
)


@runtime_checkable
class VectorIndexPort(Protocol):
    def is_indexed(self, professors: List[Professor]) -> bool:
        ...

    def build_index(self, professors: List[Professor], documents: List[str]) -> None:
        ...

    def query(self, query_text: str, n_results: int) -> List[Tuple[str, float]]:
        ...


@runtime_checkable
class SearchPort(Protocol):
    def search(
        self,
        request: SearchRequest,
        on_progress: ProgressCallback = noop_progress,
        should_cancel: CancelCheck = never_cancel,
    ) -> SearchResponse:
        ...
