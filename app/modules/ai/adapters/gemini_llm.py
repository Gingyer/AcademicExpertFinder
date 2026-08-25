"""LLMProvider の Gemini Adapter。

Port: app.modules.ai.ports.LLMProvider
外部技術: google.generativeai（遅延 import。Adapter 内に閉じ込める）
"""
import os

from app.modules.ai.adapters.gemini_common import QuotaExceededError, _genai_lock


class GeminiLLMService:
    def __init__(self) -> None:
        raw_keys = os.environ.get("GEMINI_API_KEYS", "")
        self._api_keys: list[str] = [k.strip() for k in raw_keys.split(",") if k.strip()]
        if not self._api_keys:
            single_key = os.environ.get("GEMINI_API_KEY", "")
            if single_key:
                self._api_keys = [single_key]
        if not self._api_keys:
            raise ValueError(
                "GEMINI_API_KEY が環境変数に設定されていません。"
            )
        self._model_name: str = os.environ.get("GENERATION_MODEL", "gemini-1.5-flash")
        self._key_index: int = 0

    def generate(self, prompt: str) -> str:
        import google.generativeai as genai
        from google.api_core.exceptions import ResourceExhausted

        with _genai_lock:
            last_error: ResourceExhausted | None = None
            attempts = len(self._api_keys)
            for attempt in range(attempts):
                try:
                    genai.configure(api_key=self._api_keys[self._key_index])
                    model = genai.GenerativeModel(self._model_name)
                    response = model.generate_content(prompt)
                    return response.text
                except ResourceExhausted as e:
                    last_error = e
                    if attempt < attempts - 1:
                        self._key_index = (self._key_index + 1) % len(self._api_keys)

            raise QuotaExceededError(
                f"設定されている全てのAPIキー（{len(self._api_keys)}件）が上限に達しました。"
            ) from last_error
