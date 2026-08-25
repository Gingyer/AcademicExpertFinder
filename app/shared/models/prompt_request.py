from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, field_validator


class PromptHistoryCreateRequest(BaseModel):
    basePrompt: str
    additionalPrompt: Optional[str] = None

    @field_validator("basePrompt")
    @classmethod
    def validate_base_prompt(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("プロンプトを入力してください")
        if len(v) > 500:
            raise ValueError("プロンプトは500文字以内で入力してください")
        return v


class PromptHistoryListItem(BaseModel):
    id: int
    inputText: str
    llmOutput: Optional[str] = None
    similarityScore: Optional[float] = None
    createdAt: datetime


class ProfessorResultOut(BaseModel):
    id: int
    name: str
    school: str
    url: Optional[str] = None
    matchScore: int
    similarityScore: Optional[float] = None
    matchReason: Optional[str] = None
    profileSummary: Optional[str] = None
    relatedKeywords: list[str] = []
    confidenceNote: Optional[str] = None
    relatedWorks: list[dict[str, Any]] = []


class SearchResultOut(BaseModel):
    queryType: Optional[str] = None
    confidence: Optional[str] = None
    isConfident: Optional[bool] = None
    message: Optional[str] = None
    searchAttempts: Optional[int] = None
    results: list[ProfessorResultOut] = []


class PromptHistoryDetailOut(BaseModel):
    id: int
    inputText: str
    createdAt: datetime
    searchResult: SearchResultOut
