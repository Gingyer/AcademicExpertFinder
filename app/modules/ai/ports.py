"""AI(埋め込み・生成)の Port。

現在の Adapter は Gemini(app.modules.ai.adapters.*)。OpenAI 等へ交換する際は
この Port を満たす別 Adapter を差し込むだけでよい。Port 自体は
google.generativeai を一切知らない（技術非依存）。
"""
from typing import List, Protocol, runtime_checkable


@runtime_checkable
class EmbeddingProvider(Protocol):
    def embed(self, text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> List[float]:
        ...


@runtime_checkable
class LLMProvider(Protocol):
    def generate(self, prompt: str) -> str:
        ...
