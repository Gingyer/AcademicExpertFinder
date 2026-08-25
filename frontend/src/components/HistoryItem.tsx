"use client";

// HistoryItem — サイドバーの履歴1件。プロンプト先頭・日時・類似度の目安を表示し、
// 「詳細参照」「削除」を提供する。
import type { PromptHistoryListItem } from "@/types/promptHistory";

interface HistoryItemProps {
  item: PromptHistoryListItem;
  onDetail: (id: number) => void;
  onDelete: (item: PromptHistoryListItem) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate(),
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

// 一覧の類似度目安。値域は 0–1（内部値）。表示は簡易に整数%（詳細な整形は M7 の共通関数）。
function similarityLabel(score: number | null): string | null {
  if (score === null || Number.isNaN(score)) return null;
  return `${Math.round(score * 100)}%`;
}

export default function HistoryItem({ item, onDetail, onDelete }: HistoryItemProps) {
  const sim = similarityLabel(item.similarityScore);
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <p className="line-clamp-2 text-sm text-gray-800">
        {item.inputText.trim() || "(空のプロンプト)"}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {formatDate(item.createdAt)}
          {sim ? ` ・ 類似度 ${sim}` : ""}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDetail(item.id)}
            className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            詳細参照
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
          >
            削除
          </button>
        </div>
      </div>
    </li>
  );
}
