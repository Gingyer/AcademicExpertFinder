"use client";

// メイン画面（単一ページ状態機械）。
// M1: idle（タイトル / slime_default / 入力 / 送信）。M2: サイドバー（履歴）。
// M4: 送信〜進捗（submitting/streaming、slime_research＋進捗表示、done/cancel/error/timeout）。
// finishing の描画(slime_finish)は M6、result 画面は M7、長押しキャンセルは M5 で追加する。
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { reducer, initialState } from "@/state/machine";
import { useHistory } from "@/lib/useHistory";
import { useSearchJob } from "@/lib/useSearchJob";
import { cancelSearch } from "@/lib/searchClient";
import { mapResult } from "@/lib/resultModel";
import { preloadSlime } from "@/lib/animation/preload";
import TitleBar from "@/components/TitleBar";
import SlimeAnimator from "@/components/SlimeAnimator";
import PromptInput from "@/components/PromptInput";
import ProgressPanel from "@/components/ProgressPanel";
import CancelButton from "@/components/CancelButton";
import ResultScreen from "@/components/ResultScreen";
import Sidebar from "@/components/Sidebar";
import UndoToasts from "@/components/UndoToasts";
import NoticeToast from "@/components/NoticeToast";
import HistoryDetailModal from "@/components/HistoryDetailModal";

const APP_TITLE = "教授検索AI";

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const history = useHistory();
  const searchJob = useSearchJob(dispatch);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { phase } = state;
  const isIdle = phase === "idle";
  // idle/submitting=slime_default、streaming=slime_research、finishing=slime_finish。
  const slimeVariant =
    phase === "streaming" ? "research" : phase === "finishing" ? "finish" : "default";
  // finish のみ1回再生（loop=false）。他はデータ既定(loop=true)。
  const slimeLoop = phase === "finishing" ? false : undefined;
  const showSlime =
    phase === "idle" ||
    phase === "submitting" ||
    phase === "streaming" ||
    phase === "finishing";

  const handleSubmit = () => {
    if (state.prompt.trim().length === 0) return;
    void searchJob.start(state.prompt);
  };

  // slime_finish の再生完了（reduced-motion/素材失敗のフォールバック含む）で結果を開示。
  const handleFinishComplete = () => dispatch({ type: "FINISH_COMPLETE" });

  // done の生データを画面表示用モデルへマッピング（結果/詳細フェーズで使用）。
  const resultView = useMemo(() => mapResult(state.result), [state.result]);

  // idle 表示後、research/finish をバックグラウンド先読み（初回送信を滑らかに、NFR）。
  useEffect(() => {
    const id = window.setTimeout(() => {
      void preloadSlime("research");
      void preloadSlime("finish");
    }, 1200);
    return () => window.clearTimeout(id);
  }, []);

  // エラー表示時に見出しへフォーカス移動（キーボード・スクリーンリーダー配慮）。
  const errorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (phase === "error") errorRef.current?.focus();
  }, [phase]);

  // 長押し確定で中断。cancel API の応答を待たず即 idle へ戻す（A5）。
  // クライアントのストリームも閉じ、サーバー中断は API で要求。失敗時のみ控えめに通知。
  const handleCancel = () => {
    const jobId = state.jobId;
    searchJob.abort(); // SSE を閉じ、タイムアウトも停止
    dispatch({ type: "STREAM_CANCELLED" }); // 即 idle
    if (jobId) {
      cancelSearch(jobId).catch(() => setNotice("中断に失敗しました。"));
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center px-6 py-8">
      {/* 左上: サイドバー開閉ボタン */}
      <button
        type="button"
        onClick={() => dispatch({ type: "OPEN_SIDEBAR" })}
        aria-label="プロンプトログを開く"
        aria-haspopup="dialog"
        aria-expanded={state.sidebarOpen}
        className="fixed left-4 top-4 z-30 rounded-lg border border-gray-200 bg-white p-2 text-gray-600 shadow-sm hover:bg-gray-50"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <TitleBar title={APP_TITLE} />

      {/* streaming: 進捗を slime の「上」に余白をあけて表示（要件B） */}
      {phase === "streaming" && (
        <div className="mt-4 flex w-full max-w-3xl justify-center">
          <ProgressPanel progress={state.progress} />
        </div>
      )}

      {/* 舞台：slime（idle/submitting=default, streaming=research, finishing=finish 1回再生） */}
      {/* slime-frame: 拡大(scale)しても切れないよう、ズーム倍率に応じた高さを確保する枠。
          中央寄せ＋左右の透明余白クリップも slime-frame 側で行う（slime.css 参照）。 */}
      {showSlime && (
        <div className="slime-frame mt-8 w-full max-w-3xl">
          <SlimeAnimator
            variant={slimeVariant}
            loop={slimeLoop}
            playing
            onComplete={handleFinishComplete}
          />
        </div>
      )}

      {/* streaming: slime_research の「下」に長押しキャンセルボタン（要件B） */}
      {phase === "streaming" && (
        <div className="mt-8">
          <CancelButton onConfirm={handleCancel} />
        </div>
      )}

      {/* submitting の補助表示 */}
      {phase === "submitting" && (
        <p className="mt-6 text-sm text-gray-500" aria-live="polite">
          送信中…
        </p>
      )}

      {/* idle: 入力エリア */}
      {isIdle && (
        <div className="mt-6 w-full max-w-2xl">
          <PromptInput
            value={state.prompt}
            onChange={(v) => dispatch({ type: "SET_PROMPT", value: v })}
            onSubmit={handleSubmit}
          />
        </div>
      )}

      {/* finishing: slime_finish を再生中（上の舞台で描画）。完了後に自動で result へ。 */}
      {phase === "finishing" && (
        <p className="mt-6 text-sm text-gray-500" aria-live="polite">
          結果を準備しています…
        </p>
      )}

      {/* result / resultDetail: 出力結果画面 */}
      {(phase === "result" || phase === "resultDetail") && (
        <div className="mt-8 flex w-full justify-center">
          <ResultScreen
            result={resultView}
            prompt={state.prompt}
            detailOpen={phase === "resultDetail"}
            onOpenDetail={() => dispatch({ type: "OPEN_DETAIL" })}
            onCloseDetail={() => dispatch({ type: "CLOSE_DETAIL" })}
            onBack={() => dispatch({ type: "RESET" })}
          />
        </div>
      )}

      {/* error: サーバー/タイムアウトのメッセージ */}
      {phase === "error" && (
        <div ref={errorRef} tabIndex={-1} role="alert" className="mt-10 text-center outline-none">
          <p className="text-base font-medium text-gray-800">{state.errorMessage}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              再試行
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "RESET" })}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              戻る
            </button>
          </div>
        </div>
      )}

      {/* サイドバー（過去ログ） */}
      <Sidebar
        open={state.sidebarOpen}
        onClose={() => dispatch({ type: "CLOSE_SIDEBAR" })}
        items={history.items}
        loading={history.loading}
        error={history.error}
        onReload={history.reload}
        onDetail={(id) => setDetailId(id)}
        onDelete={history.requestDelete}
      />
      <HistoryDetailModal id={detailId} onClose={() => setDetailId(null)} />
      <UndoToasts pending={history.pending} onUndo={history.undoDelete} />
      <NoticeToast message={notice} onDismiss={() => setNotice(null)} />
    </main>
  );
}
