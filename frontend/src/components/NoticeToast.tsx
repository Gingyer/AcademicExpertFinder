"use client";

// NoticeToast — 一時的な通知（例：「中断に失敗しました」）。数秒で自動的に消える。
import { useEffect } from "react";

interface NoticeToastProps {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}

export default function NoticeToast({ message, onDismiss, durationMs = 4000 }: NoticeToastProps) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(id);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
    >
      {message}
    </div>
  );
}
