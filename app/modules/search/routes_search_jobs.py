"""非同期検索ジョブ + SSE 進捗配信 + キャンセルのエンドポイント。

- POST /api/v1/search               → { job_id } を即返し、検索をバックグラウンド実行。
- GET  /api/v1/search/{id}/stream   → SSE で進捗(progress/done/cancelled/error)を配信。
- POST /api/v1/search/{id}/cancel   → 冪等キャンセル要求。

認証は HttpOnly Cookie(セッションID)で行い、発行元セッション以外の stream/cancel は 403。
トークンを URL に載せない（EventSource は使わず、フロントは fetch+ReadableStream で受信）。
"""
import json
import queue
import threading

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app import container
from app.config import get_settings
from app.database import SessionLocal
from app.shared.models.prompt_request import PromptHistoryCreateRequest
from app.modules.search.job_store import Job, get_job_store
from app.shared.progress import SearchCancelled

router = APIRouter(prefix="/api/v1")

SESSION_COOKIE = "sid"
_HEARTBEAT_SECONDS = 15  # SSE 無イベント時のハートビート間隔


def _run_job(job: Job, base_prompt: str, additional_prompt: str | None) -> None:
    """バックグラウンドで検索＋履歴保存を実行し、進捗/結果を job に流す。"""
    db = SessionLocal()
    try:
        service = container.get_prompt_history_service(db)
        response, history_id = service.execute(
            base_prompt=base_prompt,
            additional_prompt=additional_prompt,
            on_progress=job.emit_progress,
            should_cancel=job.is_cancel_requested,
        )
        result = response.model_dump()
        result["historyId"] = history_id
        job.emit_progress("完了", 100, "結果を表示します")
        job.emit_done(result)
    except SearchCancelled:
        # キャンセル済み job の結果は破棄し、クライアントには返さない。
        job.emit_cancelled()
    except Exception:
        # 内部情報（例外詳細・スタックトレース等）はクライアントに出さない。
        job.emit_error(
            "SEARCH_FAILED",
            "検索処理に失敗しました。時間をおいて再度お試しください。",
        )
    finally:
        db.close()


@router.post("/search")
def start_search(request: Request, body: PromptHistoryCreateRequest) -> JSONResponse:
    # エンジン初期化不可（APIキー未設定等）はここで 503 として即失敗させる。
    container.get_search_engine()

    sid = request.cookies.get(SESSION_COOKIE)
    new_cookie = sid is None
    if not sid:
        import uuid

        sid = str(uuid.uuid4())

    store = get_job_store()
    job = store.create(session_id=sid)

    threading.Thread(
        target=_run_job,
        args=(job, body.basePrompt, body.additionalPrompt),
        daemon=True,
    ).start()

    resp = JSONResponse(
        {"success": True, "data": {"job_id": job.id}, "error": None}
    )
    if new_cookie:
        resp.set_cookie(
            key=SESSION_COOKIE,
            value=sid,
            httponly=True,
            samesite="strict",
            secure=get_settings().APP_ENV == "production",
            path="/",
            max_age=60 * 60 * 24,  # 1日
        )
    return resp


def _require_owned_job(request: Request, job_id: str) -> Job:
    """job の存在と、発行元セッションからのアクセスであることを検証する。"""
    job = get_job_store().get(job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "data": None,
                "error": {"code": "JOB_NOT_FOUND", "message": "ジョブが見つかりません。"},
            },
        )
    sid = request.cookies.get(SESSION_COOKIE)
    if not sid or sid != job.session_id:
        raise HTTPException(
            status_code=403,
            detail={
                "success": False,
                "data": None,
                "error": {"code": "FORBIDDEN", "message": "このジョブにアクセスできません。"},
            },
        )
    return job


@router.get("/search/{job_id}/stream")
def stream_search(request: Request, job_id: str) -> StreamingResponse:
    job = _require_owned_job(request, job_id)
    store = get_job_store()

    def event_stream():
        while True:
            try:
                ev = job.events.get(timeout=_HEARTBEAT_SECONDS)
            except queue.Empty:
                # 接続維持＆切断検知のためのハートビート（SSEコメント行）。
                yield ": ping\n\n"
                # 期限切れ等でストアから破棄された running job は終了扱いにする。
                if store.get(job.id) is None and job.status == "running":
                    payload = {
                        "type": "error",
                        "seq": -1,
                        "code": "EXPIRED",
                        "message": "時間切れのため中断しました。",
                    }
                    yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                    break
                continue
            yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
            if ev["type"] in ("done", "cancelled", "error"):
                break

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx 等でのバッファリング無効化
        },
    )


@router.post("/search/{job_id}/cancel")
def cancel_search(request: Request, job_id: str) -> dict:
    job = _require_owned_job(request, job_id)
    # 冪等: 既に完了/キャンセル/エラーの job には状態をそのまま返す（エラーにしない）。
    if job.status in ("done", "cancelled", "error"):
        return {"success": True, "data": {"status": job.status}, "error": None}
    job.request_cancel()
    return {"success": True, "data": {"status": "cancelling"}, "error": None}
