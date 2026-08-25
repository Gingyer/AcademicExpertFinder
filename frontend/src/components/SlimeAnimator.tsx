"use client";

// SlimeAnimator — slime アニメーションを描画する React ラッパー。
// - variant('default'|'research'|'finish') に応じてデータを読み込み、GSAPプレイヤーを生成。
// - PNG は preload+decode 完了後に再生（slimePlayer 側で待機）。
// - document.hidden 時は再生を一時停止（NFR）。
// - prefers-reduced-motion 時は静止1フレーム。非ループ(finish)なら onComplete を最小遅延で発火し
//   状態機械を先に進める（結果開示が詰まらないように）。
import { useEffect, useRef } from "react";
import "@/lib/animation/slime.css";
import { createSlimePlayer, type SlimePlayer } from "@/lib/animation/slimePlayer";
import { loadAnimationData, type SlimeVariant } from "@/lib/animation/loadData";

interface SlimeAnimatorProps {
  variant: SlimeVariant;
  /** ループ再生するか。既定はデータ側の loop 値（default/research=true, finish=false 想定）。 */
  loop?: boolean;
  /** 再生中フラグ。false で一時停止。既定 true。 */
  playing?: boolean;
  /** 非ループ再生の完了時（finish→結果開示のトリガ）。 */
  onComplete?: () => void;
  className?: string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export default function SlimeAnimator({
  variant,
  loop,
  playing = true,
  onComplete,
  className,
}: SlimeAnimatorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<SlimePlayer | null>(null);
  // onComplete は再生成せず最新参照を保つ（変更で player を作り直さないため）。
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // variant / loop が変わったらプレイヤーを作り直す。
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let reducedTimer: ReturnType<typeof setTimeout> | undefined;
    const reduced = prefersReducedMotion();

    container.innerHTML = ""; // 前回の描画をクリア

    (async () => {
      const data = await loadAnimationData(variant);
      if (cancelled) return;
      const effectiveLoop = loop ?? data.loop;
      try {
        const player = await createSlimePlayer(container, {
          data,
          loop: effectiveLoop,
          reducedMotion: reduced,
          onComplete: () => onCompleteRef.current?.(),
        });
        if (cancelled) {
          player.destroy();
          return;
        }
        playerRef.current = player;
        // reduced-motion で非ループ(finish)なら、静止のまま最小遅延で完了扱いにして先へ進める。
        if (reduced && !effectiveLoop) {
          reducedTimer = setTimeout(() => onCompleteRef.current?.(), 120);
        }
        // 初期の再生/一時停止を反映（タブ非表示なら止めておく）。
        if (playing && !document.hidden && !reduced) player.play();
      } catch {
        // 素材読み込み等に失敗しても状態遷移をブロックしない。
        // 非ループなら完了扱いにして結果開示へ進める（フォールバック）。
        if (!cancelled && !effectiveLoop) onCompleteRef.current?.();
      }
    })();

    return () => {
      cancelled = true;
      if (reducedTimer) clearTimeout(reducedTimer);
      playerRef.current?.destroy();
      playerRef.current = null;
      container.innerHTML = "";
    };
    // playing/onComplete は下の効果と ref で扱うため依存に含めない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, loop]);

  // playing の変化とタブ可視状態に応じて再生/停止を切り替える。
  useEffect(() => {
    const applyPlayState = () => {
      const player = playerRef.current;
      if (!player) return;
      if (playing && !document.hidden) player.play();
      else player.pause();
    };
    applyPlayState();
    document.addEventListener("visibilitychange", applyPlayState);
    return () => document.removeEventListener("visibilitychange", applyPlayState);
  }, [playing]);

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
