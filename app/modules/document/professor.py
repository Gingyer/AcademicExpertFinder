from pydantic import AliasChoices, BaseModel, Field, field_validator
from typing import Any, List, Optional


class Work(BaseModel):
    title: str
    year: Optional[int] = None
    summary: Optional[str] = None


class Professor(BaseModel):
    school: str
    school_slug: str
    name: str
    url: str
    profile: str
    representative_works: List[Work] = []
    research_keywords: List[str] = Field(
        default=[], validation_alias=AliasChoices("research_keywords", "category")
    )

    @field_validator("representative_works", mode="before")
    @classmethod
    def normalize_representative_works(cls, v: Any) -> Any:
        if v is None:
            return []
        if not isinstance(v, list):
            return v
        return [{"title": item} if isinstance(item, str) else item for item in v]

    @field_validator("name", "school", "school_slug", "url", "profile")
    @classmethod
    def must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("空文字は許可されていません")
        return v


def professor_id(prof: "Professor") -> str:
    """教授を一意に識別する ID。索引の Adapter・ドメイン双方から使う純粋関数。

    ベクトルストア(Chroma 等)の実装から独立させるため、技術非依存の
    models 層に置く。
    """
    return f"{prof.school_slug}::{prof.name}"
