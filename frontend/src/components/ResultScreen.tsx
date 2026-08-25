"use client";

// ResultScreen — 出力結果画面。
// 「どこが向いているのか」を大きく表示し、類似度・教授・キャンパス・関連論文を並べる。
// 「詳細」でプロンプト対応づけ（DetailPanel）、「戻る」で idle へ。
import { useEffect, useRef } from "react";
import { toSimilarityPercent } from "@/lib/similarity";
import type { ResultView } from "@/lib/resultModel";
import ProfessorCard from "@/components/ProfessorCard";
import DetailPanel from "@/components/DetailPanel";

interface ResultScreenProps {
  result: ResultView;
  prompt: string;
  detailOpen: boolean; // resultDetail のとき true
  onOpenDetail: () => void;
  onCloseDetail: () => void;
  onBack: () => void;
}

export default function ResultScreen({
  result,
  prompt,
  detailOpen,
  onOpenDetail,
  onCloseDetail,
  onBack,
}: ResultScreenProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const top = result.professors[0];

  // 結果表示時に大見出しへフォーカス移動（スクリーンリーダー・キーボード配慮）。
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="w-full max-w-2xl" aria-live="polite">
      {/* 大見出し：どこが向いているのか */}
      <div className="text-center">
        {top ? (
          <>
            <p className="text-sm text-gray-500">あなたに向いているのは</p>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="mt-1 text-3xl font-bold tracking-tight text-gray-900 outline-none"
            >
              {top.name}
              <span className="ml-2 align-middle text-xl font-medium text-gray-500">
                （{top.campus}）
              </span>
            </h2>
            <p className="mt-2 font-semibold text-indigo-600">
              類似度 {toSimilarityPercent(top.similarity, top.matchScore)}
            </p>
          </>
        ) : (
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold text-gray-900 outline-none"
          >
            該当する候補が見つかりませんでした
          </h2>
        )}
      </div>

      {result.message && (
        <p className="mt-3 text-center text-sm text-gray-400">{result.message}</p>
      )}

      {!detailOpen ? (
        <>
          <div className="mt-6 flex flex-col gap-4">
            {result.professors.map((p, i) => (
              <ProfessorCard key={`${p.name}-${i}`} professor={p} emphasized={i === 0} />
            ))}
            {result.professors.length === 0 && (
              <p className="text-center text-sm text-gray-400">
                別のプロンプトでもう一度お試しください。
              </p>
            )}
          </div>

          <div className="mt-8 flex justify-center gap-3">
            {top && (
              <button
                type="button"
                onClick={onOpenDetail}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                詳細
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              戻る
            </button>
          </div>
        </>
      ) : (
        <>
          {top && <DetailPanel prompt={prompt} professor={top} />}
          <div className="mt-8 flex justify-center gap-3">
            <button
              type="button"
              onClick={onCloseDetail}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              結果に戻る
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              最初に戻る
            </button>
          </div>
        </>
      )}
    </section>
  );
}
