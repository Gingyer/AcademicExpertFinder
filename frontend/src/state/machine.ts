// メイン画面の有限状態機械。
// idle → submitting → streaming → finishing → result（＋ resultDetail / error）。
// M1: idle・入力・サイドバー。M4: 送信〜進捗（submitting/streaming）と done/cancel/error 遷移。
// finishing の描画(slime_finish) は M6、result 画面は M7 で拡張する。
import type { ProgressData, DoneResult } from "@/types/progress";

export type Phase =
  | "idle" // 通常時（slime_default ループ・入力可）
  | "submitting" // 送信直後・job_id 取得待ち
  | "streaming" // 進捗受信中（slime_research）
  | "finishing" // slime_finish 再生中・結果バッファ（描画は M6）
  | "result" // 結果表示（M7）
  | "resultDetail" // 結果の詳細表示（M7）
  | "error"; // エラー/タイムアウト

/** SSE 進捗の最新スナップショット。 */
export interface ProgressSnapshot {
  seq: number;
  stage: string;
  percent: number;
  message: string;
}

export interface MachineState {
  phase: Phase;
  prompt: string; // 入力中プロンプト
  jobId: string | null; // 実行中ジョブ
  progress: ProgressSnapshot | null;
  result: DoneResult | null; // done で受信した結果（描画は M6/M7）
  errorMessage: string | null;
  sidebarOpen: boolean; // 履歴サイドバー（M2）
}

export const initialState: MachineState = {
  phase: "idle",
  prompt: "",
  jobId: null,
  progress: null,
  result: null,
  errorMessage: null,
  sidebarOpen: false,
};

export type Action =
  | { type: "SET_PROMPT"; value: string }
  | { type: "SUBMIT" } // idle → submitting
  | { type: "JOB_STARTED"; jobId: string } // submitting → streaming
  | { type: "PROGRESS"; event: ProgressData } // streaming（seq で古いものは破棄）
  | { type: "STREAM_DONE"; result: DoneResult } // streaming → finishing
  | { type: "FINISH_COMPLETE" } // finishing → result（slime_finish 再生完了）
  | { type: "OPEN_DETAIL" } // result → resultDetail
  | { type: "CLOSE_DETAIL" } // resultDetail → result
  | { type: "STREAM_CANCELLED" } // → idle
  | { type: "STREAM_ERROR"; message: string } // → error
  | { type: "RESET" } // idle へ戻す
  | { type: "OPEN_SIDEBAR" }
  | { type: "CLOSE_SIDEBAR" }
  | { type: "TOGGLE_SIDEBAR" };

export function reducer(state: MachineState, action: Action): MachineState {
  switch (action.type) {
    case "SET_PROMPT":
      return { ...state, prompt: action.value };

    case "SUBMIT":
      // 送信開始。idle または error(再試行) から。前回の進捗・結果・エラーはクリアする。
      if (state.phase !== "idle" && state.phase !== "error") return state;
      return {
        ...state,
        phase: "submitting",
        jobId: null,
        progress: null,
        result: null,
        errorMessage: null,
      };

    case "JOB_STARTED":
      if (state.phase !== "submitting") return state;
      return { ...state, phase: "streaming", jobId: action.jobId };

    case "PROGRESS": {
      // 進捗はストリーミング中のみ反映。seq が古い（同値含む）イベントは破棄（順序逆転対策）。
      if (state.phase !== "streaming") return state;
      if (state.progress && action.event.seq <= state.progress.seq) return state;
      return {
        ...state,
        progress: {
          seq: action.event.seq,
          stage: action.event.stage,
          percent: action.event.percent,
          message: action.event.message,
        },
      };
    }

    case "STREAM_DONE":
      // 結果を保持して finishing へ。slime_finish を再生し、完了後に result で開示する。
      return { ...state, phase: "finishing", jobId: null, result: action.result };

    case "FINISH_COMPLETE":
      // slime_finish の再生完了（or reduced-motion/素材失敗のフォールバック）で結果を開示。
      if (state.phase !== "finishing") return state;
      return { ...state, phase: "result" };

    case "OPEN_DETAIL":
      if (state.phase !== "result") return state;
      return { ...state, phase: "resultDetail" };

    case "CLOSE_DETAIL":
      if (state.phase !== "resultDetail") return state;
      return { ...state, phase: "result" };

    case "STREAM_CANCELLED":
      // 通常時(idle)へ戻す。入力は保持する。
      return {
        ...state,
        phase: "idle",
        jobId: null,
        progress: null,
        errorMessage: null,
      };

    case "STREAM_ERROR":
      return {
        ...state,
        phase: "error",
        jobId: null,
        errorMessage: action.message,
      };

    case "RESET":
      return { ...initialState, sidebarOpen: state.sidebarOpen };

    case "OPEN_SIDEBAR":
      return { ...state, sidebarOpen: true };
    case "CLOSE_SIDEBAR":
      return { ...state, sidebarOpen: false };
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarOpen: !state.sidebarOpen };

    default:
      return state;
  }
}
