// variant → アニメーションデータのローダ。
// default は idle で即表示するため静的 import（初期表示を速く）。
// research / finish は送信後にしか使わないため動的 import で遅延読み込み（初期バンドルを軽く）。
import type { AnimationData } from "./types";
import defaultData from "./data/default.json";

export type SlimeVariant = "default" | "research" | "finish";

export async function loadAnimationData(variant: SlimeVariant): Promise<AnimationData> {
  switch (variant) {
    case "default":
      return defaultData as unknown as AnimationData;
    case "research":
      return (await import("./data/research.json")).default as unknown as AnimationData;
    case "finish":
      return (await import("./data/finish.json")).default as unknown as AnimationData;
  }
}
