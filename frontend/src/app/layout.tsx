import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "教授検索AI",
  description:
    "プロンプトを入力すると、興味に合う研究者・研究分野を提案します。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 白背景を基調とするライトテーマ固定（OS のダークモードに引きずられないよう
  // color-scheme を light に明示。詳細な配色は M1 の globals.css で詰める）。
  return (
    <html lang="ja" style={{ colorScheme: "light" }}>
      <body className="min-h-screen bg-white text-gray-900">{children}</body>
    </html>
  );
}
