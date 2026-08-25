/*
 * slimePlayer.ts — GSAP版 slime プレイヤーの React 非依存ランタイム。
 *
 * 移植元: frontend-test-output の slime_default / slime_research / slime_finish 各 animation-gsap.js
 *         （IIFE + window.ANIMATION_DATA + DOM id 依存）。
 * 変更点:
 *   - window/DOM-id 依存を廃し、与えられた root 要素の中に scene/stage/hud を自前生成。
 *   - クラス名を .slime-* に統一（slime.css と対応）。
 *   - PNG は生成時に preload + img.decode() 完了を待ってから再生（ループ毎の再デコード回避）。
 *   - loop / ease / reducedMotion / onComplete をオプション化。
 *   - 描画は transform / opacity のみ（メッシュは transform:matrix）。
 *
 * 補間ロジック・メッシュ変形（affineTri / inflateTri）は移植元と同一の見た目を保つ。
 */
import { gsap } from "gsap";
import type { AnimationData, AnimObject, Keyframe, Vec } from "./types";

export interface SlimePlayerOptions {
  data: AnimationData;
  /** data.assetBase を上書きしたい場合。 */
  assetBase?: string;
  /** data.loop を上書き（finish は false）。 */
  loop?: boolean;
  /** 補間イージング（既定 sine.inOut）。 */
  ease?: string;
  /** reduced-motion: タイムラインを作らず初期フレームで静止。 */
  reducedMotion?: boolean;
  /** 非ループ再生の完了時（finish→結果開示のトリガに使う）。 */
  onComplete?: () => void;
}

export interface SlimePlayer {
  play(): void;
  pause(): void;
  /** 現在の再生中フラグ。 */
  readonly isPlaying: boolean;
  destroy(): void;
}

const ANIM_INFLATE = 0.6; // 三角形の継ぎ目を埋める膨らませ量（移植元と同じ）

/** N×N メッシュを三角形分割した頂点インデックス一覧。 */
function buildTris(n: number): number[][] {
  const arr: number[][] = [];
  const span = n + 1;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const tl = r * span + c;
      const tr = tl + 1;
      const bl = (r + 1) * span + c;
      const br = bl + 1;
      arr.push([tl, tr, br]);
      arr.push([tl, br, bl]);
    }
  }
  return arr;
}

/** 変形なしの初期メッシュ頂点。 */
function defaultMesh(w: number, h: number, n: number): Vec[] {
  const pts: Vec[] = [];
  const span = n + 1;
  for (let r = 0; r < span; r++) {
    for (let c = 0; c < span; c++) {
      pts.push({ x: (c / n) * w, y: (r / n) * h });
    }
  }
  return pts;
}

/** 元三角形→変形後三角形へのアフィン変換行列 [a,b,c,d,e,f]。 */
function affineTri(s0: Vec, s1: Vec, s2: Vec, d0: Vec, d1: Vec, d2: Vec): number[] {
  let den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (Math.abs(den) < 1e-9) den = den < 0 ? -1e-9 : 1e-9;
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
  const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
  const e = d0.x - a * s0.x - c * s0.y;
  const f = d0.y - b * s0.x - d * s0.y;
  return [a, b, c, d, e, f];
}

/** 三角形を重心から外へ膨らませ継ぎ目を消す。 */
function inflateTri(a: Vec, b: Vec, c: Vec, amt: number): Vec[] {
  const gx = (a.x + b.x + c.x) / 3;
  const gy = (a.y + b.y + c.y) / 3;
  const p = (q: Vec): Vec => {
    const dx = q.x - gx;
    const dy = q.y - gy;
    const l = Math.hypot(dx, dy) || 1;
    return { x: q.x + (dx / l) * amt, y: q.y + (dy / l) * amt };
  };
  return [p(a), p(b), p(c)];
}

/** オブジェクトが（オブジェクト自身 or いずれかのキーフレームで）メッシュを使うか。 */
function usesMesh(o: AnimObject, ks: Keyframe[] | undefined): boolean {
  return !!o.mesh || (ks || []).some((k) => !!k.mesh);
}

/** GSAP が補間する現在値の入れ物。 */
interface ObjState {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  mesh?: Vec[];
}

/**
 * root の中に slime を構築し、preload+decode 完了後に再生可能な状態で返す。
 * play() を呼ぶまで再生は始まらない（初期フレームは静止表示）。
 */
export async function createSlimePlayer(
  root: HTMLElement,
  opts: SlimePlayerOptions,
): Promise<SlimePlayer> {
  const data = opts.data;
  const base = opts.assetBase ?? data.assetBase ?? "";
  const n = data.meshN || 3;
  const fps = data.fps || 10;
  const ease = opts.ease ?? "sine.inOut";
  const loop = opts.loop ?? data.loop;
  const duration = data.totalFrames / fps; // 1周の秒数
  const toSec = (frame: number) => frame / fps;
  const tris = buildTris(n);

  // ── scene/stage/hud を root 内に生成 ──
  root.classList.add("slime-scene");
  root.style.width = data.stage.width + "px";
  root.style.height = data.stage.height + "px";
  const stage = document.createElement("div");
  stage.className = "slime-stage";
  const hud = document.createElement("div");
  hud.className = "slime-hud";
  root.appendChild(stage);
  root.appendChild(hud);

  // ── スライム全体の変換（移動・拡大・回転）を stage コンテナへ一括適用 ──
  // 各パーツのキーフレームやアニメには手を触れず、ここだけでスライム全体を動かせる。
  // HUD は別コンテナ(hud)なので影響を受けない。
  {
    const ox = data.offset?.x ?? 0;
    const oy = data.offset?.y ?? 0;
    const sc = data.scale ?? 1;
    const sx = typeof sc === "number" ? sc : (sc.x ?? 1);
    const sy = typeof sc === "number" ? sc : (sc.y ?? 1);
    const rot = data.rotation ?? 0;
    // 拡大・回転の中心。省略時は CSS 既定の center center（＝ステージ中心）に任せる。
    if (data.pivot) stage.style.transformOrigin = `${data.pivot.x}px ${data.pivot.y}px`;
    stage.style.transform = `translate(${ox}px,${oy}px) rotate(${rot}deg) scale(${sx},${sy})`;
  }

  const els: Record<string, HTMLElement> = {};
  const meshEls: Record<string, HTMLElement> = {};
  const meshObjs: Record<string, boolean> = {};
  const images: HTMLImageElement[] = [];

  // ── 各オブジェクトの DOM を生成 ──
  data.objects.forEach((o) => {
    const el = document.createElement("div");
    el.className = "slime-obj";
    el.style.width = o.width + "px";
    el.style.height = o.height + "px";
    el.style.zIndex = String(o.zIndex);

    if (usesMesh(o, data.tracks[o.id])) {
      const mr = document.createElement("div");
      mr.className = "slime-mesh";
      const rest = defaultMesh(o.width, o.height, n);
      tris.forEach((tri) => {
        const piece = document.createElement("div");
        piece.className = "slime-tri";
        piece.style.width = o.width + "px";
        piece.style.height = o.height + "px";
        const s0 = rest[tri[0]];
        const s1 = rest[tri[1]];
        const s2 = rest[tri[2]];
        const clip = `polygon(${s0.x}px ${s0.y}px,${s1.x}px ${s1.y}px,${s2.x}px ${s2.y}px)`;
        piece.style.clipPath = clip;
        (piece.style as unknown as { webkitClipPath: string }).webkitClipPath = clip;
        const im = document.createElement("img");
        im.src = base + o.src;
        im.style.width = o.width + "px";
        im.style.height = o.height + "px";
        images.push(im);
        piece.appendChild(im);
        mr.appendChild(piece);
      });
      el.appendChild(mr);
      meshEls[o.id] = mr;
      meshObjs[o.id] = true;
    } else {
      const img = document.createElement("img");
      img.src = base + o.src;
      images.push(img);
      el.appendChild(img);
    }

    (o.isHUD ? hud : stage).appendChild(el);
    els[o.id] = el;
  });

  // ── 初期状態 ──
  const state: Record<string, ObjState> = {};
  const initialMesh = (o: AnimObject): Vec[] => {
    const ks = data.tracks[o.id];
    let src: Vec[];
    if (ks && ks.length && ks[0].mesh) src = ks[0].mesh;
    else if (o.mesh) src = o.mesh;
    else src = defaultMesh(o.width, o.height, n);
    return src.map((p) => ({ x: p.x, y: p.y }));
  };
  data.objects.forEach((o) => {
    const ks = data.tracks[o.id];
    const first = ks && ks.length ? ks[0] : o;
    const s: ObjState = {
      x: first.x,
      y: first.y,
      scaleX: first.scaleX,
      scaleY: first.scaleY,
      rotation: first.rotation,
      opacity: first.opacity,
    };
    if (meshObjs[o.id]) s.mesh = initialMesh(o);
    state[o.id] = s;
  });

  // ── 描画 ──
  const updateMesh = (o: AnimObject, mr: HTMLElement, mp: Vec[]) => {
    const rest = defaultMesh(o.width, o.height, n);
    const pieces = mr.children;
    for (let i = 0; i < tris.length; i++) {
      const tri = tris[i];
      const s0 = rest[tri[0]];
      const s1 = rest[tri[1]];
      const s2 = rest[tri[2]];
      const d = inflateTri(mp[tri[0]], mp[tri[1]], mp[tri[2]], ANIM_INFLATE);
      const m = affineTri(s0, s1, s2, d[0], d[1], d[2]);
      const piece = pieces[i] as HTMLElement | undefined;
      if (piece) {
        piece.style.transform = `matrix(${m[0]},${m[1]},${m[2]},${m[3]},${m[4]},${m[5]})`;
      }
    }
  };
  const renderAll = () => {
    // 全体の移動・拡大・回転は stage コンテナ側で一括適用済み（上部参照）。
    data.objects.forEach((o) => {
      const v = state[o.id];
      const el = els[o.id];
      el.style.transform = `translate(${v.x}px,${v.y}px) rotate(${v.rotation}deg) scale(${v.scaleX},${v.scaleY})`;
      el.style.opacity = String(v.opacity);
      const mr = meshEls[o.id];
      if (mr && v.mesh) updateMesh(o, mr, v.mesh);
    });
  };

  // 素材の preload+decode を待つ（ループ毎の再デコードを避ける）。失敗は握りつぶし、
  // 静止フォールバックは呼び出し側(SlimeAnimator)が判断する。
  await Promise.all(
    images.map((im) => (im.decode ? im.decode().catch(() => undefined) : Promise.resolve())),
  );

  // 初期フレームを描画（停止状態でも1枚は見える）。
  renderAll();

  // ── reduced-motion: タイムラインを作らず静止。onComplete のみ即時扱いは呼び出し側で。 ──
  if (opts.reducedMotion) {
    return {
      get isPlaying() {
        return false;
      },
      play() {
        /* 静止のため何もしない */
      },
      pause() {
        /* 何もしない */
      },
      destroy() {
        root.classList.remove("slime-scene", "is-playing");
        stage.remove();
        hud.remove();
      },
    };
  }

  // ── GSAP タイムライン構築 ──
  const master = gsap.timeline({
    repeat: loop ? -1 : 0,
    paused: true, // play() まで再生しない
    defaults: { ease },
    onUpdate: renderAll,
    onComplete: () => {
      root.classList.remove("is-playing");
      opts.onComplete?.();
    },
  });

  // 1周の尺を totalFrames 分に固定するスペーサー。
  master.to({}, { duration }, 0);

  data.objects.forEach((o) => {
    const ks = data.tracks[o.id];
    if (!ks || ks.length < 2) return; // 動かない（静止）
    const s = state[o.id];
    const head = {
      x: ks[0].x,
      y: ks[0].y,
      scaleX: ks[0].scaleX,
      scaleY: ks[0].scaleY,
      rotation: ks[0].rotation,
      opacity: ks[0].opacity,
    };
    master.set(s, head, 0);
    for (let i = 0; i < ks.length - 1; i++) {
      const a = ks[i];
      const c = ks[i + 1];
      const dur = toSec(c.frame) - toSec(a.frame);
      const vars: gsap.TweenVars = {
        x: c.x,
        y: c.y,
        scaleX: c.scaleX,
        scaleY: c.scaleY,
        rotation: c.rotation,
        opacity: c.opacity,
        duration: dur,
      };
      if (c.ease) vars.ease = c.ease;
      master.to(s, vars, toSec(a.frame));
    }
    if (meshObjs[o.id] && s.mesh) {
      const meshKfs = ks.filter((k) => !!k.mesh) as (Keyframe & { mesh: Vec[] })[];
      if (meshKfs.length) {
        const m0 = meshKfs[0].mesh;
        for (let j = 0; j < s.mesh.length; j++) {
          master.set(s.mesh[j], { x: m0[j].x, y: m0[j].y }, 0);
        }
      }
      for (let mi = 0; mi < meshKfs.length - 1; mi++) {
        const ma = meshKfs[mi];
        const mc = meshKfs[mi + 1];
        const mdur = toSec(mc.frame) - toSec(ma.frame);
        for (let j = 0; j < s.mesh.length; j++) {
          master.to(
            s.mesh[j],
            { x: mc.mesh[j].x, y: mc.mesh[j].y, duration: mdur },
            toSec(ma.frame),
          );
        }
      }
    }
  });

  let playing = false;
  return {
    get isPlaying() {
      return playing;
    },
    play() {
      playing = true;
      root.classList.add("is-playing");
      master.play();
    },
    pause() {
      playing = false;
      root.classList.remove("is-playing");
      master.pause();
    },
    destroy() {
      master.kill();
      root.classList.remove("slime-scene", "is-playing");
      stage.remove();
      hud.remove();
    },
  };
}
