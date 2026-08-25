"use client";

// CancelButton — slime_research の下に置く「2秒長押しで中断」ボタン。
// - 押している間だけ進行リングが 0→1 に伸び、2.0秒到達で確定（onConfirm）。
// - 2秒未満で離すとキャンセルせずリングを 0 に戻す。
// - キーボード代替: フォーカスして Space/Enter を押しっぱなしにすると同様に長押し扱い。
// リング描画は React 再レンダを避け、rAF で SVG を直接更新する（軽量化）。
import { useCallback, useEffect, useRef } from "react";

const HOLD_MS = 2000; // 長押し確定までの時間
const RING_R = 26; // リング半径
const RING_CIRC = 2 * Math.PI * RING_R;

interface CancelButtonProps {
  onConfirm: () => void;
}

export default function CancelButton({ onConfirm }: CancelButtonProps) {
  const ringRef = useRef<SVGCircleElement | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const startRef = useRef(0);
  const holdingRef = useRef(false);
  const confirmedRef = useRef(false);

  const setProgress = useCallback((p: number) => {
    const c = ringRef.current;
    if (c) c.style.strokeDashoffset = String(RING_CIRC * (1 - p));
  }, []);

  const confirm = useCallback(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    holdingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setProgress(1);
    onConfirm();
  }, [onConfirm, setProgress]);

  const tick = useCallback(
    (now: number) => {
      if (!holdingRef.current) return;
      const p = Math.min((now - startRef.current) / HOLD_MS, 1);
      setProgress(p);
      if (p >= 1) {
        confirm();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [confirm, setProgress],
  );

  const startHold = useCallback(() => {
    if (holdingRef.current || confirmedRef.current) return;
    holdingRef.current = true;
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const endHold = useCallback(() => {
    if (confirmedRef.current) return;
    holdingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setProgress(0); // 途中で離したらリングを戻す（キャンセルしない）
  }, [setProgress]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault(); // 単発クリックを抑止し、押しっぱなしを長押しとして扱う
      startHold();
    }
  };
  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      endHold();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="長押し（2秒）で検索を中断する"
        className="relative flex h-16 w-16 touch-none select-none items-center justify-center rounded-full text-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      >
        <svg width="64" height="64" viewBox="0 0 64 64" className="absolute inset-0">
          {/* 背景リング */}
          <circle cx="32" cy="32" r={RING_R} fill="none" stroke="#e5e7eb" strokeWidth="4" />
          {/* 進行リング（rAFで strokeDashoffset を更新） */}
          <circle
            ref={ringRef}
            cx="32"
            cy="32"
            r={RING_R}
            fill="none"
            stroke="#4f46e5"
            strokeWidth="4"
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
            style={{
              strokeDasharray: RING_CIRC,
              strokeDashoffset: RING_CIRC, // 初期は 0%
            }}
          />
        </svg>
        {/* 中断アイコン（四角） */}
        <span className="block h-4 w-4 rounded-[3px] bg-gray-400" aria-hidden="true" />
      </button>
      <span className="mt-2 text-xs text-gray-400">長押しで中断</span>
    </div>
  );
}
