"use client";

// DetailPanel — 「詳細」。元プロンプトのどの部分が、教授のどの研究と合致しているかを対応づける。
// 現行APIは対応スパンを返さないため、研究キーワードのプロンプト内出現で対応づける（M7クライアント簡易版）。
import { buildDetailMatches, splitPromptByMatches } from "@/lib/detailMatch";
import type { ProfessorView } from "@/lib/resultModel";

interface DetailPanelProps {
  prompt: string;
  professor: ProfessorView;
}

export default function DetailPanel({ prompt, professor }: DetailPanelProps) {
  const matches = buildDetailMatches(prompt, professor);
  const segments = splitPromptByMatches(prompt, matches);
  const matched = matches.filter((m) => m.inPrompt);
  const near = matches.filter((m) => !m.inPrompt);

  return (
    <div className="mt-6 w-full text-left">
      <h3 className="text-sm font-semibold text-gray-700">
        {professor.name}（{professor.campus}）との対応
      </h3>

      <section className="mt-3">
        <p className="text-xs font-semibold text-gray-500">
          あなたのプロンプト（合致部分をハイライト）
        </p>
        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-800">
          {segments.map((s, i) =>
            s.matched ? (
              <mark key={i} className="rounded bg-indigo-100 px-0.5 text-indigo-800">
                {s.text}
              </mark>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </p>
      </section>

      <section className="mt-4">
        <p className="text-xs font-semibold text-gray-500">合致した研究キーワード</p>
        {matched.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-1">
            {matched.map((m) => (
              <li key={m.keyword} className="text-sm text-gray-700">
                「<span className="font-medium">{m.keyword}</span>
                」— プロンプト中の言及と、この教授の研究分野が一致しています。
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-gray-500">
            プロンプトの語との直接一致はありませんでしたが、意味的に近い分野として推薦されています。
          </p>
        )}
      </section>

      {near.length > 0 && (
        <section className="mt-4">
          <p className="text-xs font-semibold text-gray-500">近い研究分野</p>
          <p className="mt-1 text-sm text-gray-600">{near.map((m) => m.keyword).join("・")}</p>
        </section>
      )}

      {professor.matchReason && (
        <section className="mt-4">
          <p className="text-xs font-semibold text-gray-500">推薦理由</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-700">{professor.matchReason}</p>
        </section>
      )}

      {professor.profileSummary && (
        <section className="mt-4">
          <p className="text-xs font-semibold text-gray-500">プロフィール</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-700">{professor.profileSummary}</p>
        </section>
      )}
    </div>
  );
}
