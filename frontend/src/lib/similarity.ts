// 類似度の表示整形を「一箇所」に集約する（要件A7-1）。
// 内部値: similarity は 0–1（コサイン類似度）、matchScore は 0–100（LLM関連度）。
// 表示: パーセント・小数1桁（例 "87.3%"）。両方 null のときは "—"。

export function toSimilarityPercent(
  similarity: number | null | undefined,
  matchScore?: number | null | undefined,
): string {
  let pct: number | null = null;
  if (typeof similarity === "number" && !Number.isNaN(similarity)) {
    pct = similarity * 100; // 0–1 → 0–100
  } else if (typeof matchScore === "number" && !Number.isNaN(matchScore)) {
    pct = matchScore; // フォールバック（既に 0–100）
  }
  if (pct === null) return "—";
  // 0–100 にクランプしてから小数1桁。
  const clamped = Math.max(0, Math.min(100, pct));
  return `${clamped.toFixed(1)}%`;
}
