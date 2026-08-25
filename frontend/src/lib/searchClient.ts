// 検索ジョブの開始と SSE 進捗購読のクライアント。
// 認証は Cookie（HttpOnly セッション）で行うため credentials:"include" を付ける。
// EventSource は Authorization を付けられずトークンURL露出の恐れがあるため使わず、
// fetch + ReadableStream で SSE を受信する（A4-1）。
import type { DoneResult, ProgressData } from "@/types/progress";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** POST /search → job_id を返す。失敗時はサーバー文言で例外を投げる。 */
export async function startSearch(basePrompt: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/search`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ basePrompt }),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `検索を開始できませんでした（${res.status}）`);
  }
  return body.data.job_id as string;
}

/** POST /cancel。冪等。失敗時は例外を投げる（呼び出し側でトースト通知）。 */
export async function cancelSearch(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/search/${jobId}/cancel`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`キャンセルに失敗しました（${res.status}）`);
  }
}

export interface StreamHandlers {
  onProgress: (event: ProgressData) => void;
  onDone: (result: DoneResult) => void;
  onCancelled: () => void;
  onError: (code: string, message: string) => void;
}

/**
 * GET /search/{job_id}/stream を購読し、SSE イベントをハンドラへ流す。
 * done/cancelled/error を受けるとサーバーがストリームを閉じ、本関数も return する。
 * signal で中断できる（AbortError は呼び出し側の意図とみなし握りつぶす）。
 */
export async function subscribeSearchStream(
  jobId: string,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/search/${jobId}/stream`, {
      credentials: "include",
      headers: { Accept: "text/event-stream" },
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    handlers.onError("STREAM_FAILED", "進捗の受信に失敗しました。");
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError("STREAM_FAILED", `進捗の受信に失敗しました（${res.status}）`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (dataLine: string) => {
    let ev: { type?: string } & Record<string, unknown>;
    try {
      ev = JSON.parse(dataLine);
    } catch {
      return; // 壊れた行は無視
    }
    switch (ev.type) {
      case "progress":
        handlers.onProgress(ev as unknown as ProgressData);
        break;
      case "done":
        handlers.onDone((ev.result ?? {}) as DoneResult);
        break;
      case "cancelled":
        handlers.onCancelled();
        break;
      case "error":
        handlers.onError(
          (ev.code as string) ?? "STREAM_ERROR",
          (ev.message as string) ?? "エラーが発生しました。",
        );
        break;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE のイベント境界は空行（\n\n）。
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        // "data:" 行のみ連結。": ping" 等のコメント行は無視。
        const dataLine = rawEvent
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("");
        if (dataLine) dispatch(dataLine);
      }
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return; // 中断は正常
    handlers.onError("STREAM_FAILED", "進捗の受信が中断されました。");
  }
}
