from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.modules.history.routes_prompt_history import router as prompt_history_router
from app.modules.search.routes_search import router as search_router
from app.modules.search.routes_search_jobs import router as search_jobs_router

app = FastAPI(title="教授検索API", version="0.3.0")

_settings = get_settings()
_origins = (
    _settings.ALLOWED_ORIGINS
    if _settings.ALLOWED_ORIGINS
    else ["http://localhost:3000", "http://localhost:3001"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(search_router)
app.include_router(prompt_history_router)
app.include_router(search_jobs_router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content=exc.detail)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    errors = exc.errors()
    if errors:
        message = errors[0]["msg"].removeprefix("Value error, ")
    else:
        message = "入力内容に誤りがあります。"
    return JSONResponse(
        status_code=422,
        content={"data": None, "error": {"code": "VALIDATION_ERROR", "message": message}},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"data": None, "error": {"code": "INTERNAL_ERROR", "message": "サーバーエラーが発生しました。"}},
    )
