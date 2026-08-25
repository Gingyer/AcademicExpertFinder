"""検索処理の進捗通知・キャンセル判定の共通インターフェース。

search_engine / prompt_history_service にフックとして渡す。job_store には依存しない
（レイヤリングのため、ここには純粋な型と例外のみを置く）。
"""
from typing import Callable

# on_progress(stage, percent, message): ステージ開始時に1回呼ぶ。percent は 0-100。
ProgressCallback = Callable[[str, int, str], None]

# should_cancel(): True ならキャンセル要求あり。各ステージ開始直前に確認する。
CancelCheck = Callable[[], bool]


class SearchCancelled(Exception):
    """キャンセル要求により、次のステージに進まず処理を終了したことを表す。"""


def noop_progress(stage: str, percent: int, message: str) -> None:
    """既定の進捗コールバック（何もしない）。同期API・既存呼び出し互換のため。"""
    return None


def never_cancel() -> bool:
    """既定のキャンセル判定（常にキャンセルしない）。"""
    return False
