export interface PromptHistoryListItem {
  id: number;
  inputText: string;
  llmOutput: string | null;
  similarityScore: number | null;
  createdAt: string;
}

export interface ProfessorResultOut {
  id: number;
  name: string;
  school: string;
  url: string | null;
  matchScore: number;
  similarityScore: number | null;
  matchReason: string | null;
  profileSummary: string | null;
  relatedKeywords: string[];
  confidenceNote: string | null;
  relatedWorks: Array<{ title: string; abstract?: string | null }>;
}

export interface SearchResultOut {
  queryType: string | null;
  confidence: string | null;
  isConfident: boolean | null;
  message: string | null;
  searchAttempts: number | null;
  results: ProfessorResultOut[];
}

export interface PromptHistoryDetail {
  id: number;
  inputText: string;
  createdAt: string;
  searchResult: SearchResultOut;
}
