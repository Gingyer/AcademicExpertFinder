"use client";

// ProgressPanel — レスポンス待ち中の進捗表示。slime_research の「上に」余白をあけて置く（要件B）。
// スクリーンリーダーには aria-live で読み上げる。
import type { ProgressSnapshot } from "@/state/machine";

interface ProgressPanelProps {
  progress: ProgressSnapshot | null;
}

export default function ProgressPanel({ progress }: ProgressPanelProps) {
  const percent = progress?.percent ?? 0;
  return (
    <div aria-live="polite" className="w-full max-w-xl text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {progress?.stage ?? "準備中"}
      </p>
      <p className="mt-1 text-base font-medium text-gray-800">
        {progress?.message ?? "処理を開始しています…"}
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-indigo-500 transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
