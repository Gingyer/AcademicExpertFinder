"use client";

// HistoryDetailModal — 履歴の「詳細参照」。保存済みの検索結果を表示する簡易モーダル。
// リッチな結果画面は M7 で作るため、ここでは入力プロンプトと各教授の要点のみを表示する。
import { useEffect, useState } from "react";
import { getHistoryDetail } from "@/lib/promptHistoryApi";
import type { PromptHistoryDetail } from "@/types/promptHistory";

interface HistoryDetailModalProps {
  id: number | null; // null で非表示
  onClose: () => void;
}

export default function HistoryDetailModal({ id, onClose }: HistoryDetailModalProps) {
  const [detail, setDetail] = useState<PromptHistoryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === null) {
      setDetail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getHistoryDetail(id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "詳細の取得に失敗しました。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Esc で閉じる。
  useEffect(() => {
    if (id === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [id, onClose]);

  if (id === null) return null;

  const results = detail?.searchResult?.results ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="履歴の詳細"
        className="relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800">履歴の詳細</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <p className="text-sm text-gray-400">読み込み中…</p>}
          {error && !loading && <p className="text-sm text-red-600">{error}</p>}
          {detail && !loading && !error && (
            <>
              <section className="mb-4">
                <h3 className="mb-1 text-xs font-semibold text-gray-500">入力プロンプト</h3>
                <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
                  {detail.inputText}
                </p>
              </section>
              <section>
                <h3 className="mb-2 text-xs font-semibold text-gray-500">結果</h3>
                {results.length === 0 ? (
                  <p className="text-sm text-gray-400">該当する結果はありません。</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {results.map((r) => (
                      <li key={r.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                          <span className="shrink-0 text-xs text-gray-500">
                            {r.school}
                            {r.similarityScore !== null
                              ? ` ・ 類似度 ${Math.round(r.similarityScore * 100)}%`
                              : ""}
                          </span>
                        </div>
                        {r.matchReason && (
                          <p className="mt-1 text-xs text-gray-600">{r.matchReason}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
