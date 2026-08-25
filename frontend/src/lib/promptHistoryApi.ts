import { SearchResponse } from "@/types/search";
import { PromptHistoryDetail, PromptHistoryListItem } from "@/types/promptHistory";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `エラーが発生しました（${res.status}）`);
  }
  return body.data as T;
}

export async function executeAndSave(
  basePrompt: string,
  additionalPrompt?: string | null
): Promise<{ historyId: number; searchResult: SearchResponse }> {
  return apiRequest<{ historyId: number; searchResult: SearchResponse }>(
    "/api/v1/prompt-histories",
    {
      method: "POST",
      body: JSON.stringify({
        basePrompt,
        additionalPrompt: additionalPrompt ?? null,
      }),
    }
  );
}

export async function getHistoryList(): Promise<PromptHistoryListItem[]> {
  const data = await apiRequest<{ items: PromptHistoryListItem[]; total: number }>(
    "/api/v1/prompt-histories"
  );
  return data.items;
}

export async function getHistoryDetail(id: number): Promise<PromptHistoryDetail> {
  return apiRequest<PromptHistoryDetail>(`/api/v1/prompt-histories/${id}`);
}

export async function deleteHistory(id: number): Promise<void> {
  await apiRequest(`/api/v1/prompt-histories/${id}`, { method: "DELETE" });
}
