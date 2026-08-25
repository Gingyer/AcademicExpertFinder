"use client";

// ProfessorCard — 結果1件（教授）。類似度・教授名・キャンパス・理由・関連論文を表示。
// 関連論文0件は淡グレーの控えめ表示（枠線・警告色なし、要件A7-3）。
import { toSimilarityPercent } from "@/lib/similarity";
import type { ProfessorView } from "@/lib/resultModel";

interface ProfessorCardProps {
  professor: ProfessorView;
  emphasized?: boolean; // 先頭候補を少し強調
}

export default function ProfessorCard({ professor, emphasized = false }: ProfessorCardProps) {
  const similarity = toSimilarityPercent(professor.similarity, professor.matchScore);
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        emphasized ? "border-indigo-200 ring-1 ring-indigo-100" : "border-gray-200"
      }`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-gray-900">{professor.name}</p>
          <p className="text-sm text-gray-500">{professor.campus}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">類似度</p>
          <p className="text-xl font-bold text-indigo-600">{similarity}</p>
        </div>
      </div>

      {professor.matchReason && (
        <p className="mt-3 text-sm leading-relaxed text-gray-700">{professor.matchReason}</p>
      )}

      {professor.relatedKeywords.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {professor.relatedKeywords.map((kw) => (
            <span
              key={kw}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-500">関連論文</p>
        {professor.relatedWorks.length === 0 ? (
          <p className="mt-1 text-sm text-gray-300">関連論文は見つかりませんでした</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1.5">
            {professor.relatedWorks.map((w, i) => (
              <li key={i} className="text-sm text-gray-700">
                <span className="font-medium">{w.title}</span>
                {w.abstract && (
                  <span className="mt-0.5 block text-xs text-gray-500">{w.abstract}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {professor.url && (
        <a
          href={professor.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
        >
          プロフィールを見る ↗
        </a>
      )}
    </div>
  );
}
