from typing import List, Literal, Optional

from pydantic import BaseModel, field_validator


class SearchRequest(BaseModel):
    query: str

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        normalized = v.strip()
        if not normalized:
            raise ValueError("検索文を入力してください")
        if len(normalized) > 500:
            raise ValueError("検索文は500文字以内で入力してください")
        return normalized


class WorkSummary(BaseModel):
    title: str
    abstract: Optional[str] = None


class ProfessorResult(BaseModel):
    name: str
    school: str
    url: str
    match_score: int
    similarity_score: Optional[float] = None
    match_reason: str
    profile_summary: str
    related_keywords: List[str]
    confidence_note: Optional[str] = None
    related_works: List[WorkSummary] = []


class SearchResponse(BaseModel):
    query_type: Literal["professor_recommendation", "professor_detail"]
    confidence: Literal["high", "low"]
    is_confident: bool
    message: Optional[str] = None
    search_attempts: int
    results: List[ProfessorResult]
