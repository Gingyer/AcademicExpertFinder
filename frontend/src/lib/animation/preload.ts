// slime 素材の後追いプリロード。
// idle 表示後にバックグラウンドで research/finish のデータと画像を温めておき、
// 初回送信時のデコード遅延を避ける（NFR: 初期表示は default のみ、以降を後追い）。
import { loadAnimationData, type SlimeVariant } from "./loadData";

const preloaded = new Set<SlimeVariant>();

export async function preloadSlime(variant: SlimeVariant): Promise<void> {
  if (typeof window === "undefined" || preloaded.has(variant)) return;
  preloaded.add(variant);
  try {
    const data = await loadAnimationData(variant); // 動的 import を温める
    const base = data.assetBase ?? "/slime/";
    const srcs = Array.from(new Set(data.objects.map((o) => base + o.src)));
    await Promise.all(
      srcs.map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode ? img.decode().catch(() => undefined) : Promise.resolve();
      }),
    );
  } catch {
    // 先読み失敗は無視（本番再生時に SlimeAnimator 側で再取得/フォールバック）。
    preloaded.delete(variant);
  }
}
