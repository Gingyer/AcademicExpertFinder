"""埋め込みに関する純粋なユーティリティ。

Provider の Port は app.modules.ai.ports.EmbeddingProvider、Gemini 実装は
app.modules.ai.adapters.gemini_embedding.GeminiEmbeddingService に分離済み。
本モジュールは技術非依存の数値計算のみを持つ。
"""
import math


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)
