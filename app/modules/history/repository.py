from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.modules.history.orm_professor_search_result import ProfessorSearchResult
from app.modules.history.orm_prompt_history import PromptHistory


class PromptHistoryRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def create(
        self,
        input_text: str,
        llm_output: str | None = None,
        query_type: str | None = None,
        confidence: str | None = None,
        is_confident: bool | None = None,
        search_message: str | None = None,
        search_attempts: int | None = None,
        embedding_vector: list | None = None,
        professor_results: list[dict] | None = None,
    ) -> PromptHistory:
        history = PromptHistory(
            input_text=input_text,
            llm_output=llm_output,
            query_type=query_type,
            confidence=confidence,
            is_confident=is_confident,
            search_message=search_message,
            search_attempts=search_attempts,
            embedding_vector=embedding_vector,
            is_deleted=False,
        )
        self._db.add(history)
        self._db.flush()

        for r in professor_results or []:
            result = ProfessorSearchResult(
                prompt_history_id=history.id,
                professor_name=r["professor_name"],
                school=r["school"],
                url=r.get("url"),
                match_score=r["match_score"],
                similarity_score=r.get("similarity_score"),
                matched_vector=r.get("matched_vector"),
                match_reason=r.get("match_reason"),
                profile_summary=r.get("profile_summary"),
                related_keywords=r.get("related_keywords"),
                confidence_note=r.get("confidence_note"),
                related_works=r.get("related_works"),
            )
            self._db.add(result)

        self._db.commit()
        self._db.refresh(history)
        return history

    def get_list(self) -> list[PromptHistory]:
        return (
            self._db.query(PromptHistory)
            .filter(PromptHistory.is_deleted == False)  # noqa: E712
            .order_by(PromptHistory.created_at.desc())
            .all()
        )

    def get_by_id(self, history_id: int) -> PromptHistory | None:
        return (
            self._db.query(PromptHistory)
            .filter(
                PromptHistory.id == history_id,
                PromptHistory.is_deleted == False,  # noqa: E712
            )
            .first()
        )

    def soft_delete(self, history_id: int) -> PromptHistory | None:
        history = self.get_by_id(history_id)
        if history is None:
            return None
        history.is_deleted = True
        history.updated_at = datetime.now(timezone.utc)
        self._db.commit()
        self._db.refresh(history)
        return history
