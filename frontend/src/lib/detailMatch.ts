// 「元プロンプトのどの部分が、どこと合致しているか」の対応づけ（クライアント簡易マッチ）。
// 現行APIは対応スパンを返さないため、教授の研究キーワードがプロンプト中に出現するかで対応づける。
// 将来サーバーが対応情報を返すようになれば差し替え可能。
import type { ProfessorView } from "@/lib/resultModel";

export interface DetailMatch {
  keyword: string; // 合致した研究キーワード
  inPrompt: boolean; // プロンプト中に明示的に出現したか
}

/** プロンプトを、合致キーワードで分割したセグメント列にする（ハイライト表示用）。 */
export interface PromptSegment {
  text: string;
  matched: boolean;
}

export function buildDetailMatches(prompt: string, professor: ProfessorView): DetailMatch[] {
  return professor.relatedKeywords.map((keyword) => ({
    keyword,
    inPrompt: keyword.length > 0 && prompt.includes(keyword),
  }));
}

/** プロンプト文字列を、合致キーワード出現箇所で区切ってハイライト用に分割する。 */
export function splitPromptByMatches(prompt: string, matches: DetailMatch[]): PromptSegment[] {
  const keywords = matches.filter((m) => m.inPrompt).map((m) => m.keyword);
  if (keywords.length === 0) return [{ text: prompt, matched: false }];

  // 長いキーワードから優先してマッチ（部分被り対策）。
  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  const segments: PromptSegment[] = [];
  let rest = prompt;

  while (rest.length > 0) {
    // 最も手前に出現するキーワードを探す。
    let bestIdx = -1;
    let bestKw = "";
    for (const kw of sorted) {
      const idx = rest.indexOf(kw);
      if (idx >= 0 && (bestIdx === -1 || idx < bestIdx)) {
        bestIdx = idx;
        bestKw = kw;
      }
    }
    if (bestIdx === -1) {
      segments.push({ text: rest, matched: false });
      break;
    }
    if (bestIdx > 0) segments.push({ text: rest.slice(0, bestIdx), matched: false });
    segments.push({ text: bestKw, matched: true });
    rest = rest.slice(bestIdx + bestKw.length);
  }
  return segments;
}
