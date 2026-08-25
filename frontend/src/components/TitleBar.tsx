"use client";

// TitleBar — 画面上部のタイトル表示。
// 左上のサイドバー開閉ボタンは M2 で追加する（本 M ではタイトルのみ）。
interface TitleBarProps {
  title: string;
}

export default function TitleBar({ title }: TitleBarProps) {
  return (
    <header className="w-full py-2 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-gray-900">{title}</h1>
    </header>
  );
}
