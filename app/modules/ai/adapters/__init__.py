"""Adapters（具体実装）層。

Port を満たす具体的な外部技術実装を集約する。ここだけが google.generativeai
などの外部 SDK を知る。生成(組み立て)は Composition Root(app.container) が行う。
"""
from app.modules.ai.adapters.gemini_common import QuotaExceededError
from app.modules.ai.adapters.gemini_embedding import GeminiEmbeddingService
from app.modules.ai.adapters.gemini_llm import GeminiLLMService

__all__ = ["QuotaExceededError", "GeminiEmbeddingService", "GeminiLLMService"]
