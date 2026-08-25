"""Gemini アダプタ共通の低レベル定義。

Port ではなく Adapter(具体実装)側の関心事をここに置く。
"""
import threading


class QuotaExceededError(RuntimeError):
    """設定されている全てのAPIキーがクォータ上限（429 ResourceExhausted）に達した場合に発生する。"""


# genai.configure() はプロセス全体のモジュールグローバルを書き換えるため、
# configure → API 呼び出し の一連をアトミックに保護するプロセスレベルの共有ロック。
# GeminiEmbeddingService と GeminiLLMService の両方がこのロックを取得してから
# configure を呼び出すことで、異なる API キーが混在するレースコンディションを防ぐ。
_genai_lock = threading.Lock()
