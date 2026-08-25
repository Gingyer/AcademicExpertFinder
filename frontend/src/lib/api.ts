import { SearchResponse } from "@/types/search";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function searchProfessors(query: string): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message ?? `検索に失敗しました（${res.status}）`;
    throw new Error(msg);
  }

  return res.json() as Promise<SearchResponse>;
}
