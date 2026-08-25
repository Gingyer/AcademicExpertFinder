from fastapi import APIRouter, HTTPException

from app import container
from app.shared.models.search import SearchRequest, SearchResponse
from app.modules.ai.adapters import QuotaExceededError

router = APIRouter()

# dev テスト互換のためのフック。None のとき Composition Root から取得する。
# （テストは monkeypatch でこの _engine に Fake を差し込み、search() の分岐を検証する。）
_engine = None


@router.post("/api/search", response_model=SearchResponse)
def search(request: SearchRequest) -> SearchResponse:
    engine = _engine if _engine is not None else container.get_search_engine()
    try:
        return engine.search(request)
    except QuotaExceededError as e:
        raise HTTPException(
            status_code=503,
            detail={
                "data": None,
                "error": {
                    "code": "QUOTA_EXCEEDED",
                    "message": "現在アクセスが集中しているため検索できません。しばらく時間をおいて再度お試しください。",
                },
            },
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "data": None,
                "error": {
                    "code": "SEARCH_UNAVAILABLE",
                    "message": f"検索サービスを利用できません: {e}",
                },
            },
        ) from e
