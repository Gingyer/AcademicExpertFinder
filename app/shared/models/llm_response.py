from typing import Annotated, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class ProfessorMatchItem(BaseModel):
    name: str
    school: str
    match_score: Annotated[int, Field(ge=0, le=100)]
    reason: str

    @field_validator("name", "school", "reason", mode="before")
    @classmethod
    def strip_and_require(cls, v: object) -> str:
        if not isinstance(v, str):
            raise ValueError("文字列である必要があります")
        stripped = v.strip()
        if not stripped:
            raise ValueError("空文字は許可されていません")
        return stripped

    @field_validator("match_score", mode="before")
    @classmethod
    def coerce_score(cls, v: object) -> int:
        if isinstance(v, float):
            return int(v)
        if isinstance(v, str) and v.strip().isdigit():
            return int(v.strip())
        return v  # type: ignore[return-value]


class LLMSearchOutput(BaseModel):
    query_intent: str
    matches: List[ProfessorMatchItem]
    confidence: str = "high"
    note: Optional[str] = None

    @field_validator("query_intent", mode="before")
    @classmethod
    def strip_intent(cls, v: object) -> str:
        if not isinstance(v, str):
            raise ValueError("文字列である必要があります")
        stripped = v.strip()
        if not stripped:
            raise ValueError("空文字は許可されていません")
        return stripped

    @field_validator("confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, v: object) -> str:
        if not isinstance(v, str):
            raise ValueError("文字列である必要があります")
        normalized = v.strip().lower()
        if normalized not in {"high", "low"}:
            raise ValueError("'high' または 'low' のみ許可されています")
        return normalized

    @model_validator(mode="after")
    def matches_not_empty(self) -> "LLMSearchOutput":
        if not self.matches:
            raise ValueError("matches は1件以上必要です")
        return self
