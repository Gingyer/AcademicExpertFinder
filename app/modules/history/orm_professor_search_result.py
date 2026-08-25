from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProfessorSearchResult(Base):
    __tablename__ = "professor_search_results"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    prompt_history_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("prompt_histories.id"), nullable=False
    )
    professor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    school: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    match_score: Mapped[int] = mapped_column(Integer, nullable=False)
    similarity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    matched_vector: Mapped[list | None] = mapped_column(Vector(3072), nullable=True)
    match_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    related_keywords: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    confidence_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    related_works: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    prompt_history: Mapped["PromptHistory"] = relationship(
        "PromptHistory", back_populates="professor_results"
    )
