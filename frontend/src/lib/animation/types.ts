// slime アニメーションのデータ契約（frontend-test-output の animation-data.js を型化したもの）。
// x/y/scaleX/scaleY/rotation/opacity の線形キーフレーム＋任意のメッシュ変形で構成される。

export interface Vec {
  x: number;
  y: number;
}

/** 1オブジェクトの1キーフレーム。mesh は頂点配列（(meshN+1)^2 個）を持つ場合がある。 */
export interface Keyframe {
  frame: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  zIndex?: number;
  ease?: string; // 個別イージング上書き（例 "steps(1)" で瞬間移動）
  mesh?: Vec[] | null;
}

/** 描画対象オブジェクト（PNG部品1枚）。 */
export interface AnimObject {
  id: string;
  name: string;
  src: string; // assetBase からの相対パス（例 "parts/slime-body.png"）
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  groupId: string | null;
  isHUD: boolean;
  mesh: Vec[] | null;
}

/** 1アニメーション全体（1周ぶん）のデータ。 */
export interface AnimationData {
  assetBase: string; // 画像URLの基底（本プロジェクトでは "/slime/"）
  stage: { width: number; height: number };
  fps: number;
  totalFrames: number;
  loop: boolean;
  meshN: number;
  /** スライム全体をまとめて平行移動するオフセット（px）。省略時は {x:0,y:0}。 */
  offset?: Vec;
  /** スライム全体の大きさ。数値=等倍、{x,y}=軸別。省略時は 1。 */
  scale?: number | Vec;
  /** スライム全体の回転（度）。省略時は 0。 */
  rotation?: number;
  /** 拡大・回転の中心（ステージ座標 px）。省略時はステージ中心。 */
  pivot?: Vec;
  groups: Record<string, unknown>;
  objects: AnimObject[];
  tracks: Record<string, Keyframe[]>; // objectId -> キーフレーム列
}
