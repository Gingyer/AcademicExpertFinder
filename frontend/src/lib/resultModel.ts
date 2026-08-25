// done イベントの生データ（snake_case: SearchResponse.model_dump()）を
// 画面表示用モデル（camelCase）へマッピングする。
import type { DoneResult } from "@/types/progress";

export interface RelatedWorkView {
  title: string;
  abstract: string | null;
}

export interface ProfessorView {
  name: string;
  campus: string; // 現行データの school（大阪校/東京校/名古屋校）＝キャンパス
  url: string | null;
  similarity: number | null; // 0–1（内部値）。表示は toSimilarityPercent で整形
  matchScore: number; // 0–100（参考: LLM関連度）
  matchReason: string | null;
  profileSummary: string | null;
  relatedKeywords: string[];
  relatedWorks: RelatedWorkView[];
}

export interface ResultView {
  message: string | null; // 低確信時の注記など（あれば控えめ表示）
  professors: ProfessorView[];
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asNumberOrNull(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function mapProfessor(raw: Record<string, unknown>): ProfessorView {
  const works = Array.isArray(raw.related_works) ? raw.related_works : [];
  const keywords = Array.isArray(raw.related_keywords) ? raw.related_keywords : [];
  return {
    name: asString(raw.name),
    campus: asString(raw.school),
    url: typeof raw.url === "string" ? raw.url : null,
    similarity: asNumberOrNull(raw.similarity_score),
    matchScore: asNumberOrNull(raw.match_score) ?? 0,
    matchReason: typeof raw.match_reason === "string" ? raw.match_reason : null,
    profileSummary: typeof raw.profile_summary === "string" ? raw.profile_summary : null,
    relatedKeywords: keywords.filter((k): k is string => typeof k === "string"),
    relatedWorks: works
      .map((w) => (w && typeof w === "object" ? (w as Record<string, unknown>) : {}))
      .map((w) => ({
        title: asString(w.title),
        abstract: typeof w.abstract === "string" ? w.abstract : null,
      }))
      .filter((w) => w.title.length > 0),
  };
}

export function mapResult(done: DoneResult | null): ResultView {
  if (!done) return { message: null, professors: [] };
  const rawList = Array.isArray(done.results) ? done.results : [];
  const professors = rawList
    .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : {}))
    .map(mapProfessor)
    .filter((p) => p.name.length > 0);
  return {
    message: typeof done.message === "string" ? done.message : null,
    professors,
  };
}
