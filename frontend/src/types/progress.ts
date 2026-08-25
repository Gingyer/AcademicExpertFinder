// SSE 進捗イベントの型（バックエンド app/services/job_store.py と対応）。

export interface ProgressData {
  type: "progress";
  seq: number;
  stage: string;
  percent: number; // 0-100・単調増加
  message: string; // ユーザーにそのまま表示してよい日本語
}

/**
 * done イベントが運ぶ最終結果。
 * バックエンドは SearchResponse.model_dump()（snake_case）＋ historyId を返す。
 * 画面表示用のマッピング（camelCase・類似度整形など）は M7 で行うため、ここでは緩く受ける。
 */
export interface DoneResult {
  query_type?: string;
  confidence?: string;
  is_confident?: boolean;
  message?: string | null;
  search_attempts?: number;
  results?: unknown[];
  historyId?: number;
  [key: string]: unknown;
}
