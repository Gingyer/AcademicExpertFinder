"use client";

// useSearchJob — 送信〜進捗購読のオーケストレーション。
// start(prompt): POST /search で job_id を取得し、SSE を購読して reducer へ dispatch する。
// タイムアウト（全体90秒 / 無進捗30秒）で中断し error へ。abort() は M5 のキャンセルでも使う。
import { useCallback, useEffect, useRef, type Dispatch } from "react";
import { startSearch, subscribeSearchStream } from "@/lib/searchClient";
import type { Action } from "@/state/machine";

const OVERALL_TIMEOUT_MS = 90_000; // 全体タイムアウト
const NO_PROGRESS_TIMEOUT_MS = 30_000; // 無進捗タイムアウト（進捗ごとにリセット）
const TIMEOUT_MESSAGE = "応答がありません。時間をおいて再度お試しください。";

export function useSearchJob(dispatch: Dispatch<Action>) {
  const abortRef = useRef<AbortController | null>(null);
  const overallTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const noProgressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearTimers = useCallback(() => {
    if (overallTimer.current) clearTimeout(overallTimer.current);
    if (noProgressTimer.current) clearTimeout(noProgressTimer.current);
    overallTimer.current = undefined;
    noProgressTimer.current = undefined;
  }, []);

  const start = useCallback(
    async (prompt: string) => {
      dispatch({ type: "SUBMIT" });
      const ac = new AbortController();
      abortRef.current = ac;

      const failTimeout = () => {
        ac.abort();
        clearTimers();
        dispatch({ type: "STREAM_ERROR", message: TIMEOUT_MESSAGE });
      };
      const armNoProgress = () => {
        if (noProgressTimer.current) clearTimeout(noProgressTimer.current);
        noProgressTimer.current = setTimeout(failTimeout, NO_PROGRESS_TIMEOUT_MS);
      };
      overallTimer.current = setTimeout(failTimeout, OVERALL_TIMEOUT_MS);
      armNoProgress();

      try {
        const jobId = await startSearch(prompt, ac.signal);
        dispatch({ type: "JOB_STARTED", jobId });
        await subscribeSearchStream(
          jobId,
          {
            onProgress: (event) => {
              armNoProgress(); // 進捗が来たら無進捗タイマーを延長
              dispatch({ type: "PROGRESS", event });
            },
            onDone: (result) => {
              clearTimers();
              dispatch({ type: "STREAM_DONE", result });
            },
            onCancelled: () => {
              clearTimers();
              dispatch({ type: "STREAM_CANCELLED" });
            },
            onError: (_code, message) => {
              clearTimers();
              dispatch({ type: "STREAM_ERROR", message });
            },
          },
          ac.signal,
        );
      } catch (e) {
        if (ac.signal.aborted) return; // 中断はタイムアウト/キャンセル側で処理済み
        clearTimers();
        dispatch({
          type: "STREAM_ERROR",
          message: e instanceof Error ? e.message : "通信に失敗しました。",
        });
      }
    },
    [dispatch, clearTimers],
  );

  // ストリームを中断する（タイマーも停止）。M5 のキャンセルから利用する。
  const abort = useCallback(() => {
    abortRef.current?.abort();
    clearTimers();
  }, [clearTimers]);

  // アンマウント時に確実に後始末。
  useEffect(
    () => () => {
      abortRef.current?.abort();
      clearTimers();
    },
    [clearTimers],
  );

  return { start, abort };
}
