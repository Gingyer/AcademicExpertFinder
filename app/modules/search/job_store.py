"""非同期検索ジョブのインメモリ管理。

- job_id は推測不可能な UUIDv4。job は発行元セッション(session_id)に紐づく。
- 進捗イベントは queue に積み、SSE ストリームが順に取り出す。
- percent は単調増加を強制、各イベントに seq を採番（取りこぼし・順序逆転の検知用）。
- 一定時間(既定10分)進捗が動かない job は自動破棄する。
"""
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

EXPIRE_SECONDS = 600  # 無進捗でこの秒数を超えた job は破棄（要件: 10分）

# job のライフサイクル
STATUS_RUNNING = "running"
STATUS_DONE = "done"
STATUS_CANCELLED = "cancelled"
STATUS_ERROR = "error"
_TERMINAL = {STATUS_DONE, STATUS_CANCELLED, STATUS_ERROR}


@dataclass
class Job:
    id: str
    session_id: str
    status: str = STATUS_RUNNING
    cancel_event: threading.Event = field(default_factory=threading.Event)
    events: "queue.Queue[dict[str, Any]]" = field(default_factory=queue.Queue)
    result: Optional[dict[str, Any]] = None
    error: Optional[dict[str, Any]] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    _seq: int = 0
    _last_percent: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def is_cancel_requested(self) -> bool:
        return self.cancel_event.is_set()

    def request_cancel(self) -> None:
        self.cancel_event.set()

    def _touch(self) -> int:
        # 呼び出し側で self._lock を保持していること。
        self.updated_at = time.time()
        self._seq += 1
        return self._seq

    def emit_progress(self, stage: str, percent: int, message: str) -> None:
        with self._lock:
            # percent は単調増加（減らさない）。
            p = max(int(percent), self._last_percent)
            self._last_percent = p
            seq = self._touch()
        self.events.put(
            {"type": "progress", "seq": seq, "stage": stage, "percent": p, "message": message}
        )

    def emit_done(self, result: dict[str, Any]) -> None:
        with self._lock:
            self.status = STATUS_DONE
            self.result = result
            seq = self._touch()
        self.events.put({"type": "done", "seq": seq, "result": result})

    def emit_cancelled(self) -> None:
        with self._lock:
            self.status = STATUS_CANCELLED
            seq = self._touch()
        self.events.put({"type": "cancelled", "seq": seq})

    def emit_error(self, code: str, message: str) -> None:
        with self._lock:
            self.status = STATUS_ERROR
            self.error = {"code": code, "message": message}
            seq = self._touch()
        self.events.put({"type": "error", "seq": seq, "code": code, "message": message})


class JobStore:
    def __init__(self, expire_seconds: int = EXPIRE_SECONDS) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._expire_seconds = expire_seconds

    def create(self, session_id: str) -> Job:
        self._sweep()
        job = Job(id=str(uuid.uuid4()), session_id=session_id)
        with self._lock:
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Optional[Job]:
        self._sweep()
        with self._lock:
            return self._jobs.get(job_id)

    def _sweep(self) -> None:
        """無進捗が閾値を超えた job を破棄する。running のものはキャンセルも要求。

        破棄後も、ストリーム中の消費者は job への参照を保持しているため配信は継続できる。
        """
        now = time.time()
        with self._lock:
            expired = [
                jid
                for jid, j in self._jobs.items()
                if now - j.updated_at > self._expire_seconds
            ]
            for jid in expired:
                job = self._jobs.pop(jid)
                if job.status not in _TERMINAL:
                    job.request_cancel()

    # テスト用途
    def _count(self) -> int:
        with self._lock:
            return len(self._jobs)


# アプリ全体で共有する単一ストア。
_store = JobStore()


def get_job_store() -> JobStore:
    return _store
