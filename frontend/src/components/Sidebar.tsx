"use client";

// Sidebar — 過去のプロンプトログ一覧。左からスライドインするダイアログ。
// アクセシビリティ: role="dialog" / aria-modal、Esc で閉じる、Tab フォーカストラップ、
// 開いた時に最初の要素へフォーカス、閉じた時に元のフォーカスへ復帰。
import { useEffect, useRef } from "react";
import HistoryItem from "@/components/HistoryItem";
import type { PromptHistoryListItem } from "@/types/promptHistory";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  items: PromptHistoryListItem[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onDetail: (id: number) => void;
  onDelete: (item: PromptHistoryListItem) => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function Sidebar({
  open,
  onClose,
  items,
  loading,
  error,
  onReload,
  onDetail,
  onDelete,
}: SidebarProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  // 開いたら履歴を取得し直す。
  useEffect(() => {
    if (open) onReload();
  }, [open, onReload]);

  // 開閉時のフォーカス管理。
  useEffect(() => {
    if (open) {
      prevFocus.current = document.activeElement as HTMLElement | null;
      // 描画後に閉じるボタンへフォーカス。
      const id = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    // 閉じたら元の要素へフォーカスを戻す。
    prevFocus.current?.focus?.();
  }, [open]);

  // Esc で閉じる／Tab をパネル内に閉じ込める。
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" onKeyDown={handleKeyDown}>
      {/* 背景。クリックで閉じる。 */}
      <div
        className="absolute inset-0 bg-gray-900/30"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* パネル本体 */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="過去のプロンプトログ"
        className="absolute left-0 top-0 flex h-full w-80 flex-col border-r border-gray-200 bg-gray-50 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">プロンプトログ</h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="サイドバーを閉じる"
            className="rounded p-1 text-gray-500 hover:bg-gray-200"
          >
            {/* × アイコン */}
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

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading && <p className="px-1 py-4 text-sm text-gray-400">読み込み中…</p>}
          {error && !loading && (
            <div className="px-1 py-4 text-sm text-red-600">
              {error}
              <button
                type="button"
                onClick={onReload}
                className="ml-2 underline hover:no-underline"
              >
                再試行
              </button>
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="px-1 py-4 text-sm text-gray-400">履歴はまだありません。</p>
          )}
          {!loading && !error && items.length > 0 && (
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  onDetail={onDetail}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
