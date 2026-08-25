import json
import re
from typing import (
    Callable,
    Type,
    TypeVar,
)

from pydantic import BaseModel, ValidationError

from app.exceptions import (
    LLMOutputError,
    LLMParseError,
    LLMRetryExhaustedError,
    LLMValidationError,
)

T = TypeVar("T", bound=BaseModel)

_CODE_BLOCK_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def _extract_json(raw: str) -> str:
    """JSONを抽出する。コードブロック → 先頭JSONオブジェクト → 全体 の順に試みる。"""
    text = raw.strip()
    m = _CODE_BLOCK_RE.search(text)
    if m:
        return m.group(1).strip()
    decoder = json.JSONDecoder()
    for i, ch in enumerate(text):
        if ch not in "{[":
            continue
        try:
            _, end = decoder.raw_decode(text[i:])
            return text[i : i + end]
        except json.JSONDecodeError:
            continue
    return text


def parse_llm_output(raw: str, model: Type[T]) -> T:
    """LLMの生テキストをPydanticモデルへ変換する。

    失敗時は LLMParseError または LLMValidationError を送出する。
    """
    json_text = _extract_json(raw)
    try:
        data = json.loads(json_text)
    except json.JSONDecodeError as e:
        raise LLMParseError(
            f"LLMの出力をJSONとして解析できません: {e}",
            raw_output=raw,
        ) from e

    try:
        return model.model_validate(data)
    except ValidationError as e:
        raise LLMValidationError(
            f"LLMの出力が期待するスキーマ ({model.__name__}) に合致しません",
            validation_error=e,
            raw_output=raw,
        ) from e


def parse_llm_output_with_retry(
    fetch: Callable[[], str],
    model: Type[T],
    max_attempts: int = 3,
) -> T:
    """LLM呼び出しをリトライしながらパースを試みる。

    全試行が失敗した場合は LLMRetryExhaustedError を送出する。
    """
    last_error: LLMOutputError | None = None
    for _ in range(max(1, max_attempts)):
        raw = fetch()
        try:
            return parse_llm_output(raw, model)
        except LLMOutputError as e:
            last_error = e

    raise LLMRetryExhaustedError(
        f"{max_attempts}回試行しましたが正しい出力が得られませんでした",
        last_error=last_error,  # type: ignore[arg-type]
    )
