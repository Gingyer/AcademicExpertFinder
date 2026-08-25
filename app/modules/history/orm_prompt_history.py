from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Boolean, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PromptHistory(Base):
    __tablename__ = "prompt_histories"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    llm_output: Mapped[str | None] = mapped_column(Text, nullable=True)
    query_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(8), nullable=True)
    is_confident: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    search_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    search_attempts: Mapped[int | None] = mapped_column(Integer, nullable=True)
    embedding_vector: Mapped[list | None] = mapped_column(Vector(3072), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    professor_results: Mapped[list["ProfessorSearchResult"]] = relationship(
        "ProfessorSearchResult", back_populates="prompt_history", lazy="select"
    )
