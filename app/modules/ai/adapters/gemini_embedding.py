"""EmbeddingProvider の Gemini Adapter。

Port: app.modules.ai.ports.EmbeddingProvider
外部技術: google.generativeai（遅延 import。Adapter 内に閉じ込める）
"""
import os

from app.modules.ai.adapters.gemini_common import QuotaExceededError, _genai_lock


class GeminiEmbeddingService:
    """Gemini API を使った Embedding サービス。

    GEMINI_API_KEYS（カンマ区切りで複数指定可）と EMBEDDING_MODEL は必ず環境変数から読む。
    1件のみの場合は GEMINI_API_KEY でも可。ハードコード禁止。
    キーが上限超過（429 ResourceExhausted）になった場合は、次のキーへ自動的に切り替える。
    """

    def __init__(self) -> None:
        raw_keys = os.environ.get("GEMINI_API_KEYS", "")
        self._api_keys: list[str] = [k.strip() for k in raw_keys.split(",") if k.strip()]
        if not self._api_keys:
            single_key = os.environ.get("GEMINI_API_KEY", "")
            if single_key:
                self._api_keys = [single_key]
        if not self._api_keys:
            raise ValueError(
                "GEMINI_API_KEY（複数指定する場合は GEMINI_API_KEYS）が環境変数に設定されていません。"
                ".env ファイルに GEMINI_API_KEY=<your_key> を設定してください。"
            )
        self._model: str = os.environ.get("EMBEDDING_MODEL", "models/text-embedding-004")
        self._cache: dict[str, list[float]] = {}
        self._key_index: int = 0

    def embed(self, text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
        cache_key = f"{task_type}::{text}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        import google.generativeai as genai
        from google.api_core.exceptions import ResourceExhausted

        with _genai_lock:
            if cache_key in self._cache:
                return self._cache[cache_key]

            last_error: ResourceExhausted | None = None
            attempts = len(self._api_keys)
            for attempt in range(attempts):
                try:
                    genai.configure(api_key=self._api_keys[self._key_index])
                    result = genai.embed_content(
                        model=self._model,
                        content=text,
                        task_type=task_type,
                    )
                    vec: list[float] = result["embedding"]
                    self._cache[cache_key] = vec
                    return vec
                except ResourceExhausted as e:
                    last_error = e
                    if attempt < attempts - 1:
                        self._key_index = (self._key_index + 1) % len(self._api_keys)

            raise QuotaExceededError(
                f"設定されている全てのAPIキー（{len(self._api_keys)}件）が上限に達しました。"
            ) from last_error
