from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import container
from app.database import get_db
from app.shared.models.prompt_request import PromptHistoryCreateRequest
from app.modules.history.orm_prompt_history import PromptHistory
from app.modules.history.ports import HistoryRepositoryPort
from app.modules.history.prompt_history_service import PromptHistoryService

router = APIRouter(prefix="/api/v1")


def _get_repo(db: Session = Depends(get_db)) -> HistoryRepositoryPort:
    # 具象 Adapter の生成は Composition Root に委譲し、ルートは Port にのみ依存する。
    return container.get_history_repository(db)


def _get_service(db: Session = Depends(get_db)) -> PromptHistoryService:
    return container.get_prompt_history_service(db)


def _history_to_list_item(history: PromptHistory) -> dict:
    best_sim = max(
        (r.similarity_score for r in history.professor_results if r.similarity_score is not None),
        default=None,
    )
    return {
        "id": history.id,
        "inputText": history.input_text,
        "llmOutput": history.llm_output,
        "similarityScore": best_sim,
        "createdAt": history.created_at.isoformat(),
    }


def _history_to_detail(history: PromptHistory) -> dict:
    return {
        "id": history.id,
        "inputText": history.input_text,
        "createdAt": history.created_at.isoformat(),
        "searchResult": {
            "queryType": history.query_type,
            "confidence": history.confidence,
            "isConfident": history.is_confident,
            "message": history.search_message,
            "searchAttempts": history.search_attempts,
            "results": [
                {
                    "id": r.id,
                    "name": r.professor_name,
                    "school": r.school,
                    "url": r.url,
                    "matchScore": r.match_score,
                    "similarityScore": r.similarity_score,
                    "matchReason": r.match_reason,
                    "profileSummary": r.profile_summary,
                    "relatedKeywords": r.related_keywords or [],
                    "confidenceNote": r.confidence_note,
                    "relatedWorks": r.related_works or [],
                }
                for r in history.professor_results
            ],
        },
    }


@router.post("/prompt-histories")
def create_prompt_history(
    request: PromptHistoryCreateRequest,
    service: PromptHistoryService = Depends(_get_service),
) -> dict:
    try:
        response, history_id = service.execute(
            base_prompt=request.basePrompt,
            additional_prompt=request.additionalPrompt,
        )
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "success": False,
                "data": None,
                "error": {"code": "SEARCH_FAILED", "message": str(e)},
            },
        ) from e
    return {
        "success": True,
        "data": {
            "historyId": history_id,
            "searchResult": response.model_dump(),
        },
        "error": None,
    }


@router.get("/prompt-histories")
def list_prompt_histories(repo: HistoryRepositoryPort = Depends(_get_repo)) -> dict:
    items = repo.get_list()
    return {
        "success": True,
        "data": {
            "items": [_history_to_list_item(h) for h in items],
            "total": len(items),
        },
        "error": None,
    }


@router.get("/prompt-histories/{history_id}")
def get_prompt_history(
    history_id: int,
    repo: HistoryRepositoryPort = Depends(_get_repo),
) -> dict:
    history = repo.get_by_id(history_id)
    if history is None:
        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "data": None,
                "error": {
                    "code": "PROMPT_HISTORY_NOT_FOUND",
                    "message": "指定された履歴が見つかりません。",
                },
            },
        )
    return {"success": True, "data": _history_to_detail(history), "error": None}


@router.delete("/prompt-histories/{history_id}")
def delete_prompt_history(
    history_id: int,
    repo: HistoryRepositoryPort = Depends(_get_repo),
) -> dict:
    result = repo.soft_delete(history_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "data": None,
                "error": {
                    "code": "PROMPT_HISTORY_NOT_FOUND",
                    "message": "指定された履歴が見つかりません。",
                },
            },
        )
    return {
        "success": True,
        "data": {"id": result.id, "isDeleted": result.is_deleted},
        "error": None,
    }
