"use client";

// PromptInput — メインのプロンプト入力欄。
// - Enter は「改行」（送信しない）。
// - Cmd+Enter / Ctrl+Enter で送信。
// - 空入力（trim後空）は送信不可。送信ボタンも無効化。
import { useId } from "react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function PromptInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "興味・やりたいこと・研究テーマなどを入力（Enter で改行 / ⌘+Enter で送信）",
}: PromptInputProps) {
  const textareaId = useId();
  const canSubmit = !disabled && value.trim().length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter のみ送信。Enter 単独は改行（既定動作を維持）。
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (canSubmit) onSubmit();
    }
  };

  return (
    <div className="w-full">
      <label htmlFor={textareaId} className="sr-only">
        プロンプト入力
      </label>
      <textarea
        id={textareaId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={4}
        placeholder={placeholder}
        className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">Enter で改行 ・ ⌘/Ctrl + Enter で送信</span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          送信
        </button>
      </div>
    </div>
  );
}
