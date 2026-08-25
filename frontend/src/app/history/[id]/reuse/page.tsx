// [M0 凍結] 旧「履歴再利用 /history/[id]/reuse」は legacy へ退避済み。旧URLは新UI(/)へリダイレクト。
import { redirect } from "next/navigation";

export default function LegacyHistoryReuseRedirect() {
  redirect("/");
}
