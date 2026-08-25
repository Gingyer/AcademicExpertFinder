"use client";

// UndoToasts — 削除の取り消し(Undo)トースト群。Undo待ちの削除ごとに1枚表示する。
// 5秒後に実DELETEが走ると pending から外れ、トーストも消える。
import type { PendingDelete } from "@/lib/useHistory";

interface UndoToastsProps {
  pending: PendingDelete[];
  onUndo: (id: number) => void;
}

function preview(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 24 ? t.slice(0, 24) + "…" : t || "(空のプロンプト)";
}

export default function UndoToasts({ pending, onUndo }: UndoToastsProps) {
  if (pending.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
      {pending.map((d) => (
        <div
          key={d.id}
          role="status"
          className="flex items-center gap-4 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span>「{preview(d.item.inputText)}」を削除しました</span>
          <button
            type="button"
            onClick={() => onUndo(d.id)}
            className="font-semibold text-indigo-300 underline-offset-2 hover:underline"
          >
            元に戻す
          </button>
        </div>
      ))}
    </div>
  );
}
