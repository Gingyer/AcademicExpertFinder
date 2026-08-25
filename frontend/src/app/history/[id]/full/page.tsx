// [M0 凍結] 旧「履歴詳細(全文) /history/[id]/full」は legacy へ退避済み。旧URLは新UI(/)へリダイレクト。
import { redirect } from "next/navigation";

export default function LegacyHistoryFullRedirect() {
  redirect("/");
}
