export interface WorkSummary {
  title: string;
  abstract?: string | null;
}

export interface ProfessorResult {
  name: string;
  school: string;
  url: string;
  match_score: number;
  similarity_score?: number | null;
  match_reason: string;
  profile_summary: string;
  related_keywords: string[];
  confidence_note: string | null;
  related_works?: WorkSummary[];
}

export interface SearchResponse {
  query_type: "professor_recommendation" | "professor_detail";
  confidence: "high" | "low";
  is_confident: boolean;
  message: string | null;
  search_attempts: number;
  results: ProfessorResult[];
}
