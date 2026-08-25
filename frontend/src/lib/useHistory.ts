"use client";

// useHistory — プロンプト履歴の取得・削除(5秒Undo)を一元管理するフック。
// - 一覧はサーバー(GET /api/v1/prompt-histories)から取得し、createdAt 降順で最大50件表示。
// - 削除は「楽観的に一覧から除去 → 5秒間 Undo 可能 → 期限で実DELETE送信」。
//   Undo すると DELETE を送らずに一覧へ復帰する（サーバーを汚さない）。
// - 本フックは page で常時マウントし、サイドバー開閉ではアンマウントしない（タイマー維持のため）。
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getHistoryList,
  deleteHistory,
} from "@/lib/promptHistoryApi";
import type { PromptHistoryListItem } from "@/types/promptHistory";

const MAX_ITEMS = 50; // 表示上限（要件 A6-2）
const UNDO_MS = 5000; // Undo 猶予（約5秒）

/** Undo 待ちの削除。toast 表示にも使う。 */
export interface PendingDelete {
  id: number;
  item: PromptHistoryListItem;
}

function sortDescCapped(items: PromptHistoryListItem[]): PromptHistoryListItem[] {
  return [...items]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_ITEMS);
}

export function useHistory() {
  const [items, setItems] = useState<PromptHistoryListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDelete[]>([]);

  // id -> 実DELETEを発火するタイマー。
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getHistoryList();
      setItems(sortDescCapped(list));
    } catch (e) {
      setError(e instanceof Error ? e.message : "履歴の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  // 実際にサーバーへ DELETE を送り、Undo対象から外す。
  const finalizeDelete = useCallback((id: number) => {
    timers.current.delete(id);
    setPending((p) => p.filter((d) => d.id !== id));
    // soft delete。404（既に削除済み）は握りつぶす。
    deleteHistory(id).catch(() => undefined);
  }, []);

  // 削除要求：一覧から即除去し、5秒後に実DELETE。
  const requestDelete = useCallback(
    (item: PromptHistoryListItem) => {
      setItems((list) => list.filter((it) => it.id !== item.id));
      setPending((p) => [...p, { id: item.id, item }]);
      const timer = setTimeout(() => finalizeDelete(item.id), UNDO_MS);
      timers.current.set(item.id, timer);
    },
    [finalizeDelete],
  );

  // Undo：タイマーを止め、DELETEを送らずに一覧へ復帰。
  const undoDelete = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setPending((p) => {
      const target = p.find((d) => d.id === id);
      if (target) setItems((list) => sortDescCapped([...list, target.item]));
      return p.filter((d) => d.id !== id);
    });
  }, []);

  // アンマウント時：未確定の削除は意図を尊重して即時DELETEを発火し、タイマーを掃除。
  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      timersMap.forEach((timer, id) => {
        clearTimeout(timer);
        deleteHistory(id).catch(() => undefined);
      });
      timersMap.clear();
    };
  }, []);

  return {
    items,
    loading,
    error,
    pending,
    reload,
    requestDelete,
    undoDelete,
  };
}
